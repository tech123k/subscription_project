import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, FileText } from 'lucide-react';
import { invoiceAPI, customerAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const emptyItem = { description: '', hsnCode: '', quantity: '1', unit: 'piece', unitPrice: '', gstRate: '18', discountPercent: '0' };

const calcItem = (item) => {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  const disc = Number(item.discountPercent) || 0;
  const subtotal = qty * price * (1 - disc / 100);
  const gstAmt = subtotal * (Number(item.gstRate) / 100);
  return { subtotal, gstAmt, total: subtotal + gstAmt };
};

const InvoiceForm = () => {
  const navigate = useNavigate();
  const company = useAuthStore((s) => s.user?.company);

  const [form, setForm] = useState({
    customerId: '', invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '', isInterState: false,
    shippingAddress: '', notes: '', terms: 'Payment due within 30 days.',
    items: [{ ...emptyItem }],
  });

  const { data: customers } = useQuery({ queryKey: ['customers-simple'], queryFn: () => customerAPI.getAll({ limit: 500 }) });

  const create = useMutation({
    mutationFn: (d) => invoiceAPI.create(d),
    onSuccess: (res) => {
      toast.success('Invoice created');
      navigate(`/invoices/${res.data.id}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create invoice'),
  });

  const f = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
  };

  const setItem = (idx, key, val) => setForm((p) => {
    const items = [...p.items];
    items[idx] = { ...items[idx], [key]: val };
    return { ...p, items };
  });

  const addItem = () => setForm((p) => ({ ...p, items: [...p.items, { ...emptyItem }] }));
  const removeItem = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const totals = form.items.reduce((acc, item) => {
    const c = calcItem(item);
    return { subtotal: acc.subtotal + c.subtotal, tax: acc.tax + c.gstAmt, total: acc.total + c.total };
  }, { subtotal: 0, tax: 0, total: 0 });

  const handleSubmit = () => {
    const validItems = form.items.filter((i) => i.unitPrice && Number(i.unitPrice) > 0);
    if (!form.customerId) { toast.error('Please select a customer'); return; }
    if (!validItems.length) { toast.error('At least one item with a rate is required'); return; }
    if (validItems.some((i) => !i.description)) { toast.error('Every item needs a description'); return; }

    create.mutate({
      ...form,
      items: validItems.map((i) => ({
        description: i.description,
        hsnCode: i.hsnCode || '',
        quantity: Number(i.quantity) || 1,
        unit: i.unit || 'piece',
        rate: Number(i.unitPrice),
        gstPercent: Number(i.gstRate) || 0,
        discountAmount: Number(i.unitPrice) * (Number(i.quantity) || 1) * (Number(i.discountPercent) || 0) / 100,
      })),
    });
  };

  const custList = customers?.data || [];

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/invoices')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Invoice</h1>
          <p className="text-sm text-gray-500">Create a GST tax invoice</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        {/* Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Customer *</label>
            <select value={form.customerId} onChange={f('customerId')} className="input-field">
              <option value="">Select customer...</option>
              {custList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Invoice Date</label>
            <input type="date" value={form.invoiceDate} onChange={f('invoiceDate')} className="input-field" />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" value={form.dueDate} onChange={f('dueDate')} className="input-field" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isInterState} onChange={f('isInterState')}
                className="w-4 h-4 rounded border-gray-300 text-primary-600" />
              <span className="text-sm text-gray-700">Inter-State Supply (IGST)</span>
            </label>
          </div>
        </div>

        {/* Line Items */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</p>
            <Button variant="secondary" size="sm" icon={Plus} onClick={addItem}>Add Item</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-3 text-xs text-gray-500 font-medium w-[35%]">Description</th>
                  <th className="text-left py-2 pr-3 text-xs text-gray-500 font-medium">HSN</th>
                  <th className="text-right py-2 pr-3 text-xs text-gray-500 font-medium">Qty</th>
                  <th className="text-right py-2 pr-3 text-xs text-gray-500 font-medium">Rate</th>
                  <th className="text-right py-2 pr-3 text-xs text-gray-500 font-medium">GST%</th>
                  <th className="text-right py-2 pr-3 text-xs text-gray-500 font-medium">Disc%</th>
                  <th className="text-right py-2 pr-3 text-xs text-gray-500 font-medium">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {form.items.map((item, idx) => {
                  const c = calcItem(item);
                  return (
                    <tr key={idx}>
                      <td className="py-2 pr-3">
                        <input value={item.description} onChange={(e) => setItem(idx, 'description', e.target.value)}
                          className="input-field text-xs py-1.5" placeholder="Item description" />
                      </td>
                      <td className="py-2 pr-3">
                        <input value={item.hsnCode} onChange={(e) => setItem(idx, 'hsnCode', e.target.value)}
                          className="input-field text-xs py-1.5 w-20" placeholder="HSN" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" value={item.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                          className="input-field text-xs py-1.5 w-16 text-right" min="0" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" value={item.unitPrice} onChange={(e) => setItem(idx, 'unitPrice', e.target.value)}
                          className="input-field text-xs py-1.5 w-24 text-right" min="0" placeholder="0.00" />
                      </td>
                      <td className="py-2 pr-3">
                        <select value={item.gstRate} onChange={(e) => setItem(idx, 'gstRate', e.target.value)}
                          className="input-field text-xs py-1.5 w-16">
                          {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" value={item.discountPercent} onChange={(e) => setItem(idx, 'discountPercent', e.target.value)}
                          className="input-field text-xs py-1.5 w-16 text-right" min="0" max="100" />
                      </td>
                      <td className="py-2 pr-3 text-right font-medium whitespace-nowrap">
                        ₹{c.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2">
                        {form.items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
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

          {/* Totals */}
          <div className="mt-4 border-t border-gray-100 pt-4 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{form.isInterState ? 'IGST' : 'CGST + SGST'}</span>
                <span>₹{totals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={f('notes')} className="input-field resize-none" rows={3} placeholder="Thank you for your business" />
          </div>
          <div>
            <label className="label">Terms & Conditions</label>
            <textarea value={form.terms} onChange={f('terms')} className="input-field resize-none" rows={3} />
          </div>
          <div className="col-span-2">
            <label className="label">Shipping Address</label>
            <input value={form.shippingAddress} onChange={f('shippingAddress')} className="input-field" placeholder="If different from billing address" />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={() => navigate('/invoices')}>Cancel</Button>
          <Button icon={FileText} loading={create.isPending} onClick={handleSubmit}>Create Invoice</Button>
        </div>
      </Card>
    </div>
  );
};

export default InvoiceForm;
