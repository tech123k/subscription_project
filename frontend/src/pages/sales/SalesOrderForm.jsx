import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { salesOrderAPI, customerAPI, warehouseAPI, productAPI } from '../../services/api';
import Button from '../../components/ui/Button';

const INPUT = 'w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 placeholder-gray-400 transition';
const LABEL = 'block text-xs font-medium text-gray-600 mb-1';

const emptyItem = () => ({
  _id: Math.random().toString(36).slice(2),
  productId: '', variantId: '', unit: 'pairs',
  quantity: '', rate: '', discountPercent: 0, gstPercent: 0,
});

const SalesOrderForm = () => {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    customerId: '', warehouseId: '', orderDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: '', channel: 'direct', priority: 'normal',
    paymentTerms: '', deliveryTerms: '', shippingAddress: '', notes: '',
    reserveStock: true,
  });
  const [items, setItems] = useState([emptyItem()]);
  const [productSearch, setProductSearch] = useState({});

  const { data: customersData } = useQuery({ queryKey: ['customers-list'], queryFn: () => customerAPI.getAll({ limit: 500 }), staleTime: 5 * 60_000 });
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses-list'], queryFn: () => warehouseAPI.getAll({ limit: 100 }), staleTime: 5 * 60_000 });
  const { data: productsData }   = useQuery({ queryKey: ['products-for-so'], queryFn: () => productAPI.getAll({ limit: 500, isActive: 'true' }), staleTime: 5 * 60_000 });

  const customers  = customersData?.data || [];
  const warehouses = warehousesData?.data || [];
  const products   = productsData?.data || [];

  const createMut = useMutation({
    mutationFn: (data) => salesOrderAPI.create(data),
    onSuccess: (res) => {
      toast.success('Sales order created');
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
      navigate(`/sales-orders/${res.data.id}`);
    },
    onError: (e) => toast.error(e?.message || 'Failed to create order'),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setItem = (idx, k, v) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [k]: v };
      if (k === 'productId') {
        const prod = products.find((p) => p.id === v);
        if (prod) updated.unit = prod.unit || 'pairs';
      }
      return updated;
    }));
  };

  const addItem    = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const subtotal  = items.reduce((s, it) => s + (parseFloat(it.quantity || 0) * parseFloat(it.rate || 0) * (1 - (parseFloat(it.discountPercent || 0) / 100))), 0);
  const taxTotal  = items.reduce((s, it) => {
    const line = parseFloat(it.quantity || 0) * parseFloat(it.rate || 0) * (1 - (parseFloat(it.discountPercent || 0) / 100));
    return s + (line * parseFloat(it.gstPercent || 0) / 100);
  }, 0);
  const netTotal  = subtotal + taxTotal;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.customerId) { toast.error('Select a customer'); return; }
    const validItems = items.filter((it) => it.productId && parseFloat(it.quantity) > 0 && parseFloat(it.rate) >= 0);
    if (!validItems.length) { toast.error('Add at least one valid item'); return; }

    createMut.mutate({
      ...form,
      items: validItems.map((it) => ({
        productId: it.productId || null,
        variantId: it.variantId || null,
        unit: it.unit,
        quantity: parseFloat(it.quantity),
        rate: parseFloat(it.rate),
        discountPercent: parseFloat(it.discountPercent || 0),
        gstPercent: parseFloat(it.gstPercent || 0),
      })),
    });
  };

  return (
    <div className="max-w-4xl space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/sales-orders')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Sales Order</h1>
          <p className="text-xs text-gray-400 mt-0.5">Create a new customer order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Order Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={LABEL}>Customer *</label>
              <select value={form.customerId} onChange={(e) => set('customerId', e.target.value)} required className={INPUT}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Warehouse</label>
              <select value={form.warehouseId} onChange={(e) => set('warehouseId', e.target.value)} className={INPUT}>
                <option value="">— None —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Order Date *</label>
              <input type="date" value={form.orderDate} onChange={(e) => set('orderDate', e.target.value)} required className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Expected Delivery</label>
              <input type="date" value={form.expectedDeliveryDate} onChange={(e) => set('expectedDeliveryDate', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Channel</label>
              <select value={form.channel} onChange={(e) => set('channel', e.target.value)} className={INPUT}>
                <option value="direct">Direct</option>
                <option value="online">Online</option>
                <option value="dealer">Dealer</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Priority</label>
              <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={INPUT}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Shipping Address</label>
              <textarea value={form.shippingAddress} onChange={(e) => set('shippingAddress', e.target.value)} rows={2} className={INPUT} placeholder="Delivery address…" />
            </div>
            <div>
              <label className={LABEL}>Payment Terms</label>
              <input value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} placeholder="e.g. Net 30" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Notes</label>
              <input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Internal notes…" className={INPUT} />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Order Items</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
              <Plus size={13} /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item._id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="grid grid-cols-12 gap-2 items-end">
                  {/* Product */}
                  <div className="col-span-4">
                    <label className={LABEL}>Product *</label>
                    <select value={item.productId} onChange={(e) => setItem(idx, 'productId', e.target.value)} className={INPUT}>
                      <option value="">Select product…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                    </select>
                  </div>
                  {/* Unit */}
                  <div className="col-span-2">
                    <label className={LABEL}>Unit</label>
                    <input value={item.unit} onChange={(e) => setItem(idx, 'unit', e.target.value)} placeholder="pairs" className={INPUT} />
                  </div>
                  {/* Qty */}
                  <div className="col-span-1">
                    <label className={LABEL}>Qty *</label>
                    <input type="number" min="1" value={item.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} placeholder="0" className={INPUT} />
                  </div>
                  {/* Rate */}
                  <div className="col-span-2">
                    <label className={LABEL}>Rate ₹ *</label>
                    <input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => setItem(idx, 'rate', e.target.value)} placeholder="0.00" className={INPUT} />
                  </div>
                  {/* Discount */}
                  <div className="col-span-1">
                    <label className={LABEL}>Disc %</label>
                    <input type="number" min="0" max="100" value={item.discountPercent} onChange={(e) => setItem(idx, 'discountPercent', e.target.value)} placeholder="0" className={INPUT} />
                  </div>
                  {/* GST */}
                  <div className="col-span-1">
                    <label className={LABEL}>GST %</label>
                    <input type="number" min="0" value={item.gstPercent} onChange={(e) => setItem(idx, 'gstPercent', e.target.value)} placeholder="0" className={INPUT} />
                  </div>
                  {/* Amount + Delete */}
                  <div className="col-span-1 flex items-end justify-between">
                    <span className="text-xs font-semibold text-gray-700 tabular-nums">
                      ₹{(parseFloat(item.quantity || 0) * parseFloat(item.rate || 0) * (1 - (parseFloat(item.discountPercent || 0) / 100))).toLocaleString('en-IN')}
                    </span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span className="tabular-nums font-medium">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-gray-500"><span>GST</span><span className="tabular-nums font-medium">₹{taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-gray-900 font-bold border-t border-gray-200 pt-1.5">
                <span>Net Total</span>
                <span className="tabular-nums text-sm">₹{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stock reservation toggle */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
          <ShieldCheck size={18} className="text-indigo-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-indigo-900">Reserve Stock Automatically</p>
            <p className="text-xs text-indigo-600 mt-0.5">When enabled, available stock will be reserved for this order immediately</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={form.reserveStock} onChange={(e) => set('reserveStock', e.target.checked)} className="sr-only peer" />
            <div className="w-10 h-5 bg-gray-200 peer-checked:bg-indigo-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={() => navigate('/sales-orders')}>Cancel</Button>
          <Button type="submit" loading={createMut.isPending}>Create Order</Button>
        </div>
      </form>
    </div>
  );
};

export default SalesOrderForm;
