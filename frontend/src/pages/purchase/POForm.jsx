import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { poAPI, supplierAPI, warehouseAPI, materialAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

const emptyItem = { materialId: '', quantity: '', unit: '', rate: '', gstPercent: '18', notes: '' };

const POForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    supplierId: '',
    warehouseId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    paymentTerms: '',
    notes: '',
  });
  const [items, setItems] = useState([{ ...emptyItem }]);

  const { data: poData } = useQuery({
    queryKey: ['po', id],
    queryFn: () => poAPI.getById(id),
    enabled: isEdit,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-simple'],
    queryFn: () => supplierAPI.getAll({ limit: 500 }),
  });
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-simple'],
    queryFn: () => warehouseAPI.getAll({ limit: 100 }),
  });
  const { data: materials } = useQuery({
    queryKey: ['materials-simple'],
    queryFn: () => materialAPI.getAll({ limit: 500 }),
  });

  useEffect(() => {
    if (poData?.data) {
      const p = poData.data;
      setForm({
        supplierId: p.supplier_id || '',
        warehouseId: p.warehouse_id || '',
        orderDate: p.order_date?.split('T')[0] || '',
        expectedDelivery: p.expected_delivery?.split('T')[0] || '',
        paymentTerms: p.payment_terms || '',
        notes: p.notes || '',
      });
      if (p.items?.length) {
        setItems(p.items.map((i) => ({
          materialId: i.material_id,
          quantity: String(i.quantity),
          unit: i.unit || '',
          rate: String(i.rate),
          gstPercent: String(i.gst_percent),
          notes: i.notes || '',
        })));
      }
    }
  }, [poData]);

  const matList = materials?.data || [];
  const supList = suppliers?.data || [];
  const whList = warehouses?.data || [];

  const setItem = (idx, key, val) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      // Auto-fill unit and rate when material is selected
      if (key === 'materialId') {
        const mat = matList.find((m) => m.id === val);
        if (mat) {
          next[idx].unit = mat.unit || '';
          next[idx].rate = mat.purchase_rate ? String(mat.purchase_rate) : '';
          next[idx].gstPercent = mat.gst_percent ? String(mat.gst_percent) : '18';
        }
      }
      return next;
    });
  };

  const addItem = (afterIdx) => setItems((p) => {
    if (afterIdx === undefined) return [...p, { ...emptyItem }];
    const next = [...p];
    next.splice(afterIdx + 1, 0, { ...emptyItem });
    return next;
  });
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const totalAmount = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.rate || 0)), 0);

  const save = useMutation({
    mutationFn: (data) => isEdit ? poAPI.update(id, data) : poAPI.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'PO updated' : 'Purchase Order created');
      queryClient.invalidateQueries({ queryKey: ['po'] });
      navigate('/po');
    },
    onError: (err) => toast.error(err?.message || 'Failed to save PO'),
  });

  const handleSubmit = () => {
    if (!form.supplierId) { toast.error('Please select a supplier'); return; }
    if (items.some((i) => !i.materialId || !i.quantity)) {
      toast.error('All items need a material and quantity');
      return;
    }
    save.mutate({ ...form, items });
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/po')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
          <p className="text-sm text-gray-500">Order materials from supplier</p>
        </div>
      </div>

      {/* Header Details */}
      <Card className="p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Order Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Supplier *</label>
            <select value={form.supplierId} onChange={f('supplierId')} className="input-field">
              <option value="">Select supplier...</option>
              {supList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Delivery Warehouse</label>
            <select value={form.warehouseId} onChange={f('warehouseId')} className="input-field">
              <option value="">Select warehouse...</option>
              {whList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Order Date</label>
            <input type="date" value={form.orderDate} onChange={f('orderDate')} className="input-field" />
          </div>
          <div>
            <label className="label">Expected Delivery</label>
            <input type="date" value={form.expectedDelivery} onChange={f('expectedDelivery')} className="input-field" />
          </div>
          <div>
            <label className="label">Payment Terms</label>
            <input value={form.paymentTerms} onChange={f('paymentTerms')} className="input-field" placeholder="e.g. Net 30, Advance, COD" />
          </div>
          <div>
            <label className="label">Notes</label>
            <input value={form.notes} onChange={f('notes')} className="input-field" placeholder="Optional notes..." />
          </div>
        </div>
      </Card>

      {/* Items Table */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Order Items</p>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 w-64">Material *</th>
                <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 w-24">Qty *</th>
                <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 w-20">Unit</th>
                <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 w-28">Rate (₹)</th>
                <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 w-20">GST %</th>
                <th className="text-right py-2 pr-3 text-xs font-semibold text-gray-500 w-28">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, idx) => {
                const amount = Number(item.quantity || 0) * Number(item.rate || 0);
                return (
                  <tr key={idx}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1">
                        <select
                          value={item.materialId}
                          onChange={(e) => setItem(idx, 'materialId', e.target.value)}
                          className="input-field text-xs flex-1"
                        >
                          <option value="">Select material...</option>
                          {matList.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                        </select>
                        <button
                          onClick={() => addItem(idx)}
                          className="p-1.5 rounded-md border border-gray-200 text-gray-400 hover:text-primary-600 hover:border-primary-400 hover:bg-primary-50 transition-colors flex-shrink-0"
                          title="Add row below"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                        className="input-field text-xs"
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={item.unit}
                        onChange={(e) => setItem(idx, 'unit', e.target.value)}
                        className="input-field text-xs"
                        placeholder="kg"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => setItem(idx, 'rate', e.target.value)}
                        className="input-field text-xs"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={item.gstPercent}
                        onChange={(e) => setItem(idx, 'gstPercent', e.target.value)}
                        className="input-field text-xs"
                      >
                        {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3 text-right font-medium text-gray-900">
                      ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2">
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total Order Value</p>
            <p className="text-xl font-bold text-primary-700">
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={() => navigate('/po')}>Cancel</Button>
          <Button icon={ShoppingCart} loading={save.isPending} onClick={handleSubmit}>
            {isEdit ? 'Update PO' : 'Create PO'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default POForm;
