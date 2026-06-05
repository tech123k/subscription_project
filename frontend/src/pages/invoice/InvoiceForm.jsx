import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, FileText } from 'lucide-react';
import { invoiceAPI, customerAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import toast from 'react-hot-toast';

const GST_RATES = [0, 5, 12, 18, 28];
const emptyItem = () => ({ description: '', hsnCode: '', quantity: '1', unit: 'piece', unitPrice: '', gstRate: '18', discountPercent: '0' });

const calcRow = (item) => {
  const qty  = Number(item.quantity)        || 0;
  const rate = Number(item.unitPrice)       || 0;
  const disc = Number(item.discountPercent) || 0;
  const base = qty * rate * (1 - disc / 100);
  const gst  = base * (Number(item.gstRate) / 100);
  return { base, gst, total: base + gst };
};

const InvoiceForm = () => {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();

  const [customerId,    setCustomerId]    = useState('');
  const [invoiceDate,   setInvoiceDate]   = useState(new Date().toISOString().split('T')[0]);
  const [dueDate,       setDueDate]       = useState('');
  const [isInterState,  setIsInterState]  = useState(false);
  const [shippingAddr,  setShippingAddr]  = useState('');
  const [notes,         setNotes]         = useState('');
  const [terms,         setTerms]         = useState('Payment due within 30 days.');
  const [items,         setItems]         = useState([emptyItem()]);

  const { data: customersData } = useQuery({
    queryKey: ['customers-simple'],
    queryFn: () => customerAPI.getAll({ limit: 500 }),
  });
  const custList = customersData?.data || [];

  /* ── item helpers ── */
  const updateItem = (idx, key, val) =>
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  const addItem    = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  /* ── totals ── */
  const totals = items.reduce(
    (acc, it) => { const r = calcRow(it); return { base: acc.base + r.base, gst: acc.gst + r.gst, total: acc.total + r.total }; },
    { base: 0, gst: 0, total: 0 }
  );

  /* ── submit ── */
  const create = useMutation({
    mutationFn: (d) => invoiceAPI.create(d),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created');
      navigate(`/invoices/${res.data.id}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create invoice'),
  });

  const handleSubmit = () => {
    if (!customerId) { toast.error('Please select a customer'); return; }
    const valid = items.filter((i) => Number(i.unitPrice) > 0 && i.description.trim());
    if (!valid.length) { toast.error('Add at least one item with description and rate'); return; }

    create.mutate({
      customerId,
      invoiceDate,
      dueDate: dueDate || null,
      isInterState,
      shippingAddress: shippingAddr || null,
      notes: notes || null,
      termsConditions: terms || null,
      items: valid.map((i) => ({
        description:    i.description,
        hsnCode:        i.hsnCode || '',
        quantity:       Number(i.quantity) || 1,
        unit:           i.unit || 'piece',
        rate:           Number(i.unitPrice),
        gstPercent:     Number(i.gstRate) || 0,
        discountAmount: Number(i.unitPrice) * (Number(i.quantity) || 1) * (Number(i.discountPercent) || 0) / 100,
      })),
    });
  };

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

      {/* Header details */}
      <Card className="p-4 sm:p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Customer *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field">
              <option value="">Select customer...</option>
              {custList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Invoice Date</label>
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="inter-state"
              checked={isInterState}
              onChange={(e) => setIsInterState(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="inter-state" className="text-sm text-gray-700 cursor-pointer">Inter-State Supply (IGST)</label>
          </div>
        </div>
      </Card>

      {/* Line items */}
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</p>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        {/* ── Mobile: card per item ── */}
        <div className="sm:hidden space-y-3">
          {items.map((item, idx) => {
            const r = calcRow(item);
            return (
              <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div>
                  <label className="label">Description *</label>
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className="input-field text-sm"
                    placeholder="Item description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">HSN</label>
                    <input
                      value={item.hsnCode}
                      onChange={(e) => updateItem(idx, 'hsnCode', e.target.value)}
                      className="input-field text-sm"
                      placeholder="HSN code"
                    />
                  </div>
                  <div>
                    <label className="label">Unit</label>
                    <input
                      value={item.unit}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      className="input-field text-sm"
                      placeholder="piece"
                    />
                  </div>
                  <div>
                    <label className="label">Qty</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      className="input-field text-sm"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="label">Rate (₹) *</label>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                      className="input-field text-sm"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label">GST %</label>
                    <select
                      value={item.gstRate}
                      onChange={(e) => updateItem(idx, 'gstRate', e.target.value)}
                      className="input-field text-sm"
                    >
                      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Disc %</label>
                    <input
                      type="number"
                      value={item.discountPercent}
                      onChange={(e) => updateItem(idx, 'discountPercent', e.target.value)}
                      className="input-field text-sm"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <div className="flex justify-end border-t border-gray-200 pt-1">
                  <span className="text-xs text-gray-500 mr-2">Amount:</span>
                  <span className="text-sm font-bold text-gray-900">₹{r.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Desktop: table ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-2 text-xs text-gray-500 font-medium">Description *</th>
                <th className="text-left py-2 pr-2 text-xs text-gray-500 font-medium w-20">HSN</th>
                <th className="text-left py-2 pr-2 text-xs text-gray-500 font-medium w-16">Unit</th>
                <th className="text-right py-2 pr-2 text-xs text-gray-500 font-medium w-16">Qty</th>
                <th className="text-right py-2 pr-2 text-xs text-gray-500 font-medium w-24">Rate (₹) *</th>
                <th className="text-right py-2 pr-2 text-xs text-gray-500 font-medium w-16">GST %</th>
                <th className="text-right py-2 pr-2 text-xs text-gray-500 font-medium w-16">Disc %</th>
                <th className="text-right py-2 pr-2 text-xs text-gray-500 font-medium w-28">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, idx) => {
                const r = calcRow(item);
                return (
                  <tr key={idx}>
                    <td className="py-1.5 pr-2">
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        className="input-field text-xs py-1.5 w-full"
                        placeholder="Item description"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={item.hsnCode}
                        onChange={(e) => updateItem(idx, 'hsnCode', e.target.value)}
                        className="input-field text-xs py-1.5 w-full"
                        placeholder="HSN"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        className="input-field text-xs py-1.5 w-full"
                        placeholder="pc"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className="input-field text-xs py-1.5 w-full text-right"
                        min="0"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                        className="input-field text-xs py-1.5 w-full text-right"
                        min="0"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={item.gstRate}
                        onChange={(e) => updateItem(idx, 'gstRate', e.target.value)}
                        className="input-field text-xs py-1.5 w-full"
                      >
                        {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        value={item.discountPercent}
                        onChange={(e) => updateItem(idx, 'discountPercent', e.target.value)}
                        className="input-field text-xs py-1.5 w-full text-right"
                        min="0"
                        max="100"
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right font-medium text-gray-900 whitespace-nowrap">
                      ₹{r.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
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
        <div className="flex justify-end border-t border-gray-100 pt-4">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{totals.base.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{isInterState ? 'IGST' : 'CGST + SGST'}</span>
              <span>₹{totals.gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Notes & Terms */}
      <Card className="p-4 sm:p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes & Terms</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field resize-none" rows={3} placeholder="Thank you for your business" />
          </div>
          <div>
            <label className="label">Terms & Conditions</label>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} className="input-field resize-none" rows={3} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Shipping Address</label>
            <input value={shippingAddr} onChange={(e) => setShippingAddr(e.target.value)} className="input-field" placeholder="If different from billing address" />
          </div>
        </div>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Button variant="secondary" onClick={() => navigate('/invoices')}>Cancel</Button>
        <Button icon={FileText} loading={create.isPending} onClick={handleSubmit}>Create Invoice</Button>
      </div>
    </div>
  );
};

export default InvoiceForm;
