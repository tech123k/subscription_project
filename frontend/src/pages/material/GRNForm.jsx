import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package, Link2, CheckCircle, ChevronDown, AlertCircle } from 'lucide-react';
import { grnAPI, materialAPI, supplierAPI, warehouseAPI, poAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import toast from 'react-hot-toast';

const emptyForm = {
  materialId: '',
  supplierId: '',
  warehouseId: '',
  receivedDate: new Date().toISOString().split('T')[0],
  receivedQuantity: '',
  acceptedQuantity: '',
  rejectedQuantity: '0',
  unitCost: '',
  qcStatus: 'pending',
  batchNumber: '',
  invoiceNumber: '',
  invoiceDate: '',
  notes: '',
  poId: '',
};

const InfoRow = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-400">{label}</p>
    <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
  </div>
);

const GRNForm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const linkedPoId = searchParams.get('poId');
  const isFromPO = Boolean(linkedPoId);

  const [form, setForm] = useState({ ...emptyForm, poId: linkedPoId || '' });
  const [selectedPoItemId, setSelectedPoItemId] = useState('');
  const [maxQty, setMaxQty] = useState(null);

  // ── Data fetches ─────────────────────────────────────────────────────────
  const { data: materials } = useQuery({
    queryKey: ['materials-simple'],
    queryFn: () => materialAPI.getAll({ limit: 500 }),
    enabled: !isFromPO, // not needed when PO drives the material
  });
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-simple'],
    queryFn: () => supplierAPI.getAll({ limit: 500 }),
    enabled: !isFromPO,
  });
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-simple'],
    queryFn: () => warehouseAPI.getAll({ limit: 100 }),
    enabled: !isFromPO,
  });
  const { data: openPos } = useQuery({
    queryKey: ['po-open'],
    queryFn: async () => {
      const [c, p] = await Promise.all([
        poAPI.getAll({ status: 'confirmed', limit: 100 }),
        poAPI.getAll({ status: 'partial', limit: 100 }),
      ]);
      return { data: [...(c?.data || []), ...(p?.data || [])] };
    },
    enabled: !isFromPO,
  });
  const { data: poDetail, isLoading: poLoading } = useQuery({
    queryKey: ['po', form.poId],
    queryFn: () => poAPI.getById(form.poId),
    enabled: !!form.poId,
  });

  // ── Auto-fill from PO ────────────────────────────────────────────────────
  useEffect(() => {
    if (!poDetail?.data) return;
    const po = poDetail.data;

    setForm((p) => ({
      ...p,
      supplierId: po.supplier_id || p.supplierId,
      warehouseId: po.warehouse_id || p.warehouseId,
    }));

    // Auto-select the single pending item when coming from PO detail
    if (isFromPO) {
      const pending = (po.items || []).filter(
        (i) => Number(i.received_quantity || 0) < Number(i.quantity) - 0.001
      );
      if (pending.length === 1) {
        applyPoItem(pending[0]);
      }
    }
  }, [poDetail]);

  // ── PO item selection ────────────────────────────────────────────────────
  const applyPoItem = (poItem) => {
    const remaining = Math.max(0, Number(poItem.quantity) - Number(poItem.received_quantity || 0));
    setSelectedPoItemId(poItem.id);
    setMaxQty(remaining);
    setForm((p) => ({
      ...p,
      materialId: poItem.material_id,
      receivedQuantity: String(remaining),
      acceptedQuantity: String(remaining),
      rejectedQuantity: '0',
      unitCost: String(poItem.rate || ''),
    }));
  };

  const handlePoItemSelect = (id) => {
    const poItem = poDetail?.data?.items?.find((i) => i.id === id);
    if (poItem) applyPoItem(poItem);
  };

  // ── Field change helper ──────────────────────────────────────────────────
  const f = (k) => (e) => {
    const val = e.target.value;
    setForm((p) => {
      const next = { ...p, [k]: val };
      if (k === 'receivedQuantity' && next.qcStatus === 'approved') {
        next.acceptedQuantity = val;
        next.rejectedQuantity = '0';
      }
      if (k === 'acceptedQuantity') {
        const rej = Number(next.receivedQuantity) - Number(val);
        next.rejectedQuantity = String(Math.max(0, rej));
      }
      return next;
    });
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const create = useMutation({
    mutationFn: (d) => grnAPI.create(d),
    onSuccess: () => {
      toast.success('GRN created successfully');
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      if (form.poId) {
        queryClient.invalidateQueries({ queryKey: ['po', form.poId] });
        queryClient.invalidateQueries({ queryKey: ['po'] });
      }
      navigate(form.poId ? `/po/${form.poId}` : '/grn');
    },
    onError: (err) => toast.error(err?.message || 'Failed to create GRN'),
  });

  const handleSubmit = () => {
    if (!form.materialId) { toast.error('Please select a material'); return; }
    if (!form.warehouseId) { toast.error('Please select a warehouse'); return; }
    if (!form.receivedQuantity || Number(form.receivedQuantity) <= 0) {
      toast.error('Received quantity must be greater than 0');
      return;
    }
    if (maxQty !== null && Number(form.receivedQuantity) > maxQty + 0.001) {
      toast.error(`Cannot receive more than remaining qty: ${maxQty.toFixed(2)}`);
      return;
    }
    create.mutate(form);
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const po = poDetail?.data;
  const poItems = po?.items || [];
  const pendingItems = poItems.filter(
    (i) => Number(i.received_quantity || 0) < Number(i.quantity) - 0.001
  );
  const selectedPoItem = poItems.find((i) => i.id === selectedPoItemId);
  const matList = materials?.data || [];
  const supList = suppliers?.data || [];
  const whList = warehouses?.data || [];
  const poList = openPos?.data || [];
  const isOverQty = maxQty !== null && Number(form.receivedQuantity) > maxQty + 0.001;
  const backTo = form.poId ? `/po/${form.poId}` : '/grn';

  // ── PO fully received (no pending items) ────────────────────────────────
  if (isFromPO && !poLoading && po && pendingItems.length === 0) {
    return (
      <div className="space-y-5 animate-fade-in max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backTo)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">New GRN</h1>
        </div>
        <Card className="p-8 text-center space-y-3">
          <CheckCircle size={40} className="mx-auto text-green-500" />
          <p className="font-semibold text-gray-900">All items in this PO have been fully received</p>
          <p className="text-sm text-gray-500">No pending quantities remain for PO {po.po_number}</p>
          <Button onClick={() => navigate(backTo)} variant="secondary" size="sm">Back to PO</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(backTo)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New GRN</h1>
          <p className="text-sm text-gray-500">
            {isFromPO && po ? `Receiving against ${po.po_number}` : 'Record goods received from supplier'}
          </p>
        </div>
      </div>

      <Card className="p-6 space-y-6">

        {/* ── MODE A: Linked to specific PO (from PO detail page) ── */}
        {isFromPO ? (
          <>
            {/* PO Summary card (locked) */}
            {poLoading ? (
              <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />
            ) : po ? (
              <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary-700 text-sm font-semibold">
                  <Link2 size={14} />
                  Purchase Order
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InfoRow label="PO Number" value={po.po_number} />
                  <InfoRow label="Supplier" value={po.supplier_name} />
                  <InfoRow label="Warehouse" value={po.warehouse_name} />
                </div>
              </div>
            ) : null}

            {/* Material / PO item selector */}
            {pendingItems.length > 1 ? (
              <div>
                <label className="label">Select Material to Receive *</label>
                <select
                  value={selectedPoItemId}
                  onChange={(e) => handlePoItemSelect(e.target.value)}
                  className="input-field"
                >
                  <option value="">— Choose a pending item —</option>
                  {pendingItems.map((i) => {
                    const rem = Math.max(0, Number(i.quantity) - Number(i.received_quantity || 0));
                    return (
                      <option key={i.id} value={i.id}>
                        {i.material_name} · {i.material_code} — remaining: {rem.toFixed(2)} {i.unit}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-400 mt-1">{pendingItems.length} items pending receipt</p>
              </div>
            ) : selectedPoItem ? (
              /* Single item auto-selected — show as info card */
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Material</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InfoRow label="Name" value={selectedPoItem.material_name} />
                  <InfoRow label="Code" value={selectedPoItem.material_code} />
                  <InfoRow label="Remaining" value={`${maxQty?.toFixed(2)} ${selectedPoItem.unit}`} />
                </div>
              </div>
            ) : null}
          </>
        ) : (
          /* ── MODE B: Direct inward — optional PO link ── */
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-gray-600 text-sm font-semibold">
              <Link2 size={14} />
              Link to Purchase Order <span className="font-normal text-gray-400">(optional)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Purchase Order</label>
                <select
                  value={form.poId}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, poId: e.target.value, materialId: '', supplierId: '', warehouseId: '' }));
                    setSelectedPoItemId('');
                    setMaxQty(null);
                  }}
                  className="input-field"
                >
                  <option value="">— No PO (direct inward) —</option>
                  {poList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.po_number} — {p.supplier_name || 'No supplier'}
                    </option>
                  ))}
                </select>
              </div>
              {form.poId && pendingItems.length > 0 && (
                <div>
                  <label className="label">PO Item</label>
                  <select
                    value={selectedPoItemId}
                    onChange={(e) => handlePoItemSelect(e.target.value)}
                    className="input-field"
                  >
                    <option value="">— Choose item —</option>
                    {pendingItems.map((i) => {
                      const rem = Math.max(0, Number(i.quantity) - Number(i.received_quantity || 0));
                      return (
                        <option key={i.id} value={i.id}>
                          {i.material_name} — remaining: {rem.toFixed(2)} {i.unit}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
            {form.poId && pendingItems.length === 0 && po && (
              <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                <CheckCircle size={12} /> All items in {po.po_number} have been received
              </p>
            )}
          </div>
        )}

        {/* ── Receipt Details ── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt Details</p>

          {/* Material + Supplier + Warehouse (only manual when direct inward without PO item) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isFromPO && (
              <div className="col-span-2">
                <label className="label">Material *</label>
                {selectedPoItemId ? (
                  <div className="input-field bg-gray-50 text-gray-700 cursor-default">
                    {poItems.find((i) => i.id === selectedPoItemId)?.material_name || '—'}
                  </div>
                ) : (
                  <select value={form.materialId} onChange={f('materialId')} className="input-field">
                    <option value="">Select material...</option>
                    {matList.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {!isFromPO && (
              <>
                <div>
                  <label className="label">Supplier</label>
                  {form.poId && po?.supplier_id ? (
                    <div className="input-field bg-gray-50 text-gray-700 cursor-default">{po.supplier_name}</div>
                  ) : (
                    <select value={form.supplierId} onChange={f('supplierId')} className="input-field">
                      <option value="">Select supplier...</option>
                      {supList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="label">Warehouse *</label>
                  {form.poId && po?.warehouse_id ? (
                    <div className="input-field bg-gray-50 text-gray-700 cursor-default">{po.warehouse_name}</div>
                  ) : (
                    <select value={form.warehouseId} onChange={f('warehouseId')} className="input-field">
                      <option value="">Select warehouse...</option>
                      {whList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="label">Received Date *</label>
              <input type="date" value={form.receivedDate} onChange={f('receivedDate')} className="input-field" />
            </div>
            <div>
              <label className="label">QC Status</label>
              <select value={form.qcStatus} onChange={f('qcStatus')} className="input-field">
                <option value="pending">Pending QC</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="conditional">Conditional</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Quantity & Cost ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantity & Cost</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="label">Received Qty *</label>
              <input
                type="number"
                value={form.receivedQuantity}
                onChange={f('receivedQuantity')}
                className={`input-field ${isOverQty ? 'border-red-400 focus:ring-red-400' : ''}`}
                min="0.01"
                max={maxQty ?? undefined}
                step="0.01"
                placeholder="0"
              />
              {maxQty !== null && (
                <p className={`text-xs mt-1 ${isOverQty ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                  {isOverQty ? `Max: ${maxQty.toFixed(2)}` : `Remaining: ${maxQty.toFixed(2)}`}
                </p>
              )}
            </div>
            <div>
              <label className="label">Accepted Qty</label>
              <input type="number" value={form.acceptedQuantity} onChange={f('acceptedQuantity')}
                className="input-field" min="0" step="0.01" placeholder="0" />
              <p className="text-xs text-gray-400 mt-1">Added to stock on approval</p>
            </div>
            <div>
              <label className="label">Rejected Qty</label>
              <input type="number" value={form.rejectedQuantity} onChange={f('rejectedQuantity')}
                className="input-field" min="0" step="0.01" placeholder="0" />
              <p className="text-xs text-gray-400 mt-1">For scrap / return tracking</p>
            </div>
            <div>
              <label className="label">Unit Cost (₹)</label>
              <input type="number" value={form.unitCost} onChange={f('unitCost')}
                className="input-field" min="0" step="0.01" placeholder="0.00" />
            </div>
          </div>
          <div className="w-48">
            <label className="label">Batch Number</label>
            <input value={form.batchNumber} onChange={f('batchNumber')} className="input-field" placeholder="Optional" />
          </div>
        </div>

        {/* ── Invoice Details ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier Invoice No</label>
              <input value={form.invoiceNumber} onChange={f('invoiceNumber')} className="input-field" />
            </div>
            <div>
              <label className="label">Invoice Date</label>
              <input type="date" value={form.invoiceDate} onChange={f('invoiceDate')} className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea value={form.notes} onChange={f('notes')} className="input-field resize-none" rows={2} />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={() => navigate(backTo)}>Cancel</Button>
          <Button
            icon={Package}
            loading={create.isPending}
            onClick={handleSubmit}
            disabled={isFromPO && !selectedPoItemId}
          >
            Create GRN
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default GRNForm;
