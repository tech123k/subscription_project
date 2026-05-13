import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Truck } from 'lucide-react';
import { dispatchAPI, customerAPI, invoiceAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { INDIAN_STATES } from '../../utils/constants';
import toast from 'react-hot-toast';

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
    eWayBillNumber: '',
    notes: '',
  });

  const { data: customers } = useQuery({ queryKey: ['customers-simple'], queryFn: () => customerAPI.getAll({ limit: 500 }) });
  const { data: invoices } = useQuery({ queryKey: ['invoices-dispatch'], queryFn: () => invoiceAPI.getAll({ limit: 500, paymentStatus: '' }) });

  const create = useMutation({
    mutationFn: (d) => dispatchAPI.create(d),
    onSuccess: () => {
      toast.success('Dispatch created');
      navigate('/dispatches');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create dispatch'),
  });

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleInvoiceChange = (e) => {
    const invoiceId = e.target.value;
    const inv = (invoices?.data || []).find((i) => i.id === invoiceId);
    setForm((p) => ({
      ...p,
      invoiceId,
      customerId: inv?.customer_id || p.customerId,
    }));
  };

  const handleSubmit = () => {
    if (!form.customerId) {
      toast.error('Customer is required');
      return;
    }
    create.mutate(form);
  };

  const custList = customers?.data || [];
  const invList = invoices?.data || [];

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dispatches')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Dispatch</h1>
          <p className="text-sm text-gray-500">Create a new dispatch / delivery record</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Linked Invoice</label>
            <select value={form.invoiceId} onChange={handleInvoiceChange} className="input-field">
              <option value="">No invoice</option>
              {invList.map((i) => <option key={i.id} value={i.id}>{i.invoice_number} — {i.customer_name}</option>)}
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

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vehicle & Transport</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Vehicle Number</label>
              <input value={form.vehicleNumber} onChange={f('vehicleNumber')} className="input-field" placeholder="MH 01 AB 1234" />
            </div>
            <div>
              <label className="label">Vehicle Type</label>
              <input value={form.vehicleType} onChange={f('vehicleType')} className="input-field" placeholder="e.g. Truck, Tempo" />
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
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">LR & E-Way Bill</p>
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
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Destination</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
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
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Freight</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Freight Amount (₹)</label>
              <input type="number" value={form.freightAmount} onChange={f('freightAmount')} className="input-field" min="0" />
            </div>
            <div>
              <label className="label">Freight Paid By</label>
              <select value={form.freightPaidBy} onChange={f('freightPaidBy')} className="input-field">
                <option value="consignor">Consignor (Sender)</option>
                <option value="consignee">Consignee (Receiver)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="label">Notes</label>
          <textarea value={form.notes} onChange={f('notes')} className="input-field resize-none" rows={2} />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={() => navigate('/dispatches')}>Cancel</Button>
          <Button icon={Truck} loading={create.isPending} onClick={handleSubmit}>Create Dispatch</Button>
        </div>
      </Card>
    </div>
  );
};

export default DispatchForm;
