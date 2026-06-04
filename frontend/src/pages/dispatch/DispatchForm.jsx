import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Truck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { dispatchAPI, customerAPI, invoiceAPI, materialAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { INDIAN_STATES } from '../../utils/constants';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const StockBadge = ({ current, required }) => {
  if (current === null) return null;
  if (current === 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
      <XCircle size={10} /> Out of Stock
    </span>
  );
  if (current < required) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
      <AlertTriangle size={10} /> Low ({current} available)
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
      <CheckCircle size={10} /> In Stock ({current})
    </span>
  );
};

const DispatchForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    invoiceId: '', customerId: '',
    vehicleNumber: '', vehicleType: '', transportName: '', driverName: '', driverPhone: '',
    lrNumber: '', lrDate: '',
    dispatchDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    destinationAddress: '', destinationCity: '', destinationState: '', destinationPincode: '',
    freightAmount: '', freightPaidBy: 'consignor',
    eWayBillNumber: '', notes: '',
  });
  const [dispatchItems, setDispatchItems] = useState([]);

  const { data: customersData } = useQuery({ queryKey: ['customers-simple'], queryFn: () => customerAPI.getAll({ limit: 500 }) });
  const { data: invoicesData }  = useQuery({ queryKey: ['invoices-dispatch'], queryFn: () => invoiceAPI.getAll({ limit: 500 }) });
  const { data: materialsData } = useQuery({ queryKey: ['materials-simple'],  queryFn: () => materialAPI.getAll({ limit: 500 }) });

  const { data: invoiceDetail } = useQuery({
    queryKey: ['invoice-detail', form.invoiceId],
    queryFn: () => invoiceAPI.getOne(form.invoiceId),
    enabled: !!form.invoiceId,
  });

  // Auto-populate items when invoice is selected
  useEffect(() => {
    if (!form.invoiceId || !invoiceDetail?.data) { setDispatchItems([]); return; }
    const mats = materialsData?.data || [];
    const items = (invoiceDetail.data.items || []).map((item) => {
      const mat = mats.find((m) => m.id === item.material_id);
      const invoiceQty = Number(item.quantity);
      const currentStock = mat ? Number(mat.current_stock) : null;
      const maxDispatch = currentStock !== null ? Math.min(invoiceQty, currentStock) : invoiceQty;
      return {
        materialId: item.material_id,
        description: item.description || mat?.name || '',
        hsnCode: item.hsn_code || '',
        invoiceQty,
        dispatchQty: String(maxDispatch > 0 ? maxDispatch : 0),
        unit: item.unit || mat?.unit || 'piece',
        currentStock,
        canDispatch: currentStock === null || currentStock > 0,
      };
    });
    setDispatchItems(items);
  }, [invoiceDetail, materialsData, form.invoiceId]);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleInvoiceChange = (e) => {
    const invoiceId = e.target.value;
    const inv = (invoicesData?.data || []).find((i) => i.id === invoiceId);
    setForm((p) => ({ ...p, invoiceId, customerId: inv?.customer_id || '' }));
    setDispatchItems([]);
  };

  const setItemQty = (idx, val) => {
    setDispatchItems((prev) => {
      const next = [...prev];
      const item = next[idx];
      const max = item.currentStock !== null
        ? Math.min(item.invoiceQty, item.currentStock)
        : item.invoiceQty;
      const num = Math.max(0, Math.min(Number(val) || 0, max));
      next[idx] = { ...item, dispatchQty: String(num) };
      return next;
    });
  };

  const create = useMutation({
    mutationFn: (d) => dispatchAPI.create(d),
    onSuccess: () => { toast.success('Dispatch created'); navigate('/dispatches'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create dispatch'),
  });

  const handleSubmit = () => {
    if (!form.invoiceId) { toast.error('Please select an invoice'); return; }
    if (!form.customerId) { toast.error('Customer is required'); return; }

    const toDispatch = dispatchItems.filter((i) => Number(i.dispatchQty) > 0);
    if (!toDispatch.length) { toast.error('No items with quantity to dispatch'); return; }

    const blocked = toDispatch.filter(
      (i) => i.currentStock !== null && Number(i.currentStock) < Number(i.dispatchQty)
    );
    if (blocked.length) {
      toast.error(`Insufficient stock: ${blocked.map((i) => i.description).join(', ')}`);
      return;
    }

    create.mutate({
      ...form,
      items: toDispatch.map((i) => ({
        materialId: i.materialId || null,
        description: i.description,
        quantity: Number(i.dispatchQty),
        unit: i.unit || 'piece',
        packages: 1,
      })),
    });
  };

  const custList = customersData?.data || [];
  const invList  = invoicesData?.data  || [];
  const hasItems = dispatchItems.length > 0;
  const allBlocked = hasItems && dispatchItems.every((i) => !i.canDispatch);

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dispatches')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Dispatch</h1>
          <p className="text-sm text-gray-500">Dispatch must be linked to a confirmed invoice</p>
        </div>
      </div>

      {/* Invoice + Customer */}
      <Card className="p-4 sm:p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Order Reference</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Invoice * <span className="text-red-400 text-[10px]">(required)</span></label>
            <select value={form.invoiceId} onChange={handleInvoiceChange} className="input-field">
              <option value="">Select invoice...</option>
              {invList.map((i) => (
                <option key={i.id} value={i.id}>{i.invoice_number} — {i.customer_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Customer *</label>
            <select value={form.customerId} onChange={f('customerId')} className="input-field">
              <option value="">Select customer...</option>
              {custList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dispatch Date</label>
            <input type="date" value={form.dispatchDate} onChange={f('dispatchDate')} className="input-field" />
          </div>
          <div>
            <label className="label">Expected Delivery</label>
            <input type="date" value={form.expectedDeliveryDate} onChange={f('expectedDeliveryDate')} className="input-field" />
          </div>
        </div>
      </Card>

      {/* Items from invoice — with stock status */}
      {hasItems && (
        <Card className="p-4 sm:p-6 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items to Dispatch</p>
          {allBlocked && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertTriangle size={16} className="flex-shrink-0" />
              All items are out of stock — cannot create dispatch.
            </div>
          )}
          <div className="space-y-2">
            {dispatchItems.map((item, idx) => (
              <div
                key={idx}
                className={clsx(
                  'flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border',
                  !item.canDispatch
                    ? 'border-red-100 bg-red-50'
                    : item.currentStock !== null && item.currentStock < item.invoiceQty
                    ? 'border-orange-100 bg-orange-50'
                    : 'border-gray-100 bg-gray-50'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">Invoice qty: {item.invoiceQty} {item.unit}</span>
                    <StockBadge current={item.currentStock} required={item.invoiceQty} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="text-xs text-gray-500 whitespace-nowrap">Dispatch Qty</label>
                  <input
                    type="number"
                    value={item.dispatchQty}
                    onChange={(e) => setItemQty(idx, e.target.value)}
                    disabled={!item.canDispatch}
                    min="0"
                    max={item.currentStock !== null ? Math.min(item.invoiceQty, item.currentStock) : item.invoiceQty}
                    className={clsx(
                      'input-field text-sm w-24 text-right',
                      !item.canDispatch && 'opacity-40 cursor-not-allowed'
                    )}
                  />
                  <span className="text-xs text-gray-500">{item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Transport */}
      <Card className="p-4 sm:p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle & Transport</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Vehicle Number</label>
            <input value={form.vehicleNumber} onChange={f('vehicleNumber')} className="input-field" placeholder="MH 01 AB 1234" />
          </div>
          <div>
            <label className="label">Vehicle Type</label>
            <input value={form.vehicleType} onChange={f('vehicleType')} className="input-field" placeholder="Truck, Tempo..." />
          </div>
          <div>
            <label className="label">Transport Name</label>
            <input value={form.transportName} onChange={f('transportName')} className="input-field" />
          </div>
          <div>
            <label className="label">Driver Name</label>
            <input value={form.driverName} onChange={f('driverName')} className="input-field" />
          </div>
          <div>
            <label className="label">Driver Phone</label>
            <input value={form.driverPhone} onChange={f('driverPhone')} className="input-field" type="tel" />
          </div>
          <div>
            <label className="label">Freight Amount (₹)</label>
            <input type="number" value={form.freightAmount} onChange={f('freightAmount')} className="input-field" min="0" />
          </div>
        </div>
      </Card>

      {/* LR & E-Way */}
      <Card className="p-4 sm:p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LR & E-Way Bill</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">LR Number</label>
            <input value={form.lrNumber} onChange={f('lrNumber')} className="input-field" />
          </div>
          <div>
            <label className="label">LR Date</label>
            <input type="date" value={form.lrDate} onChange={f('lrDate')} className="input-field" />
          </div>
          <div>
            <label className="label">E-Way Bill No</label>
            <input value={form.eWayBillNumber} onChange={f('eWayBillNumber')} className="input-field" />
          </div>
        </div>
      </Card>

      {/* Destination */}
      <Card className="p-4 sm:p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Destination</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input value={form.destinationAddress} onChange={f('destinationAddress')} className="input-field" />
          </div>
          <div>
            <label className="label">City</label>
            <input value={form.destinationCity} onChange={f('destinationCity')} className="input-field" />
          </div>
          <div>
            <label className="label">State</label>
            <select value={form.destinationState} onChange={f('destinationState')} className="input-field">
              <option value="">Select state...</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Pincode</label>
            <input value={form.destinationPincode} onChange={f('destinationPincode')} className="input-field" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={f('notes')} className="input-field resize-none" rows={2} />
          </div>
        </div>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Button variant="secondary" onClick={() => navigate('/dispatches')}>Cancel</Button>
        <Button
          icon={Truck}
          loading={create.isPending}
          onClick={handleSubmit}
          disabled={allBlocked}
        >
          Create Dispatch
        </Button>
      </div>
    </div>
  );
};

export default DispatchForm;
