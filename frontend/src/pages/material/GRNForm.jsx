import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package } from 'lucide-react';
import { grnAPI, materialAPI, supplierAPI, warehouseAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import toast from 'react-hot-toast';

const GRNForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
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
  });

  const { data: materials } = useQuery({ queryKey: ['materials-simple'], queryFn: () => materialAPI.getAll({ limit: 500 }) });
  const { data: suppliers } = useQuery({ queryKey: ['suppliers-simple'], queryFn: () => supplierAPI.getAll({ limit: 500 }) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses-simple'], queryFn: () => warehouseAPI.getAll({ limit: 100 }) });

  const create = useMutation({
    mutationFn: (d) => grnAPI.create(d),
    onSuccess: () => {
      toast.success('GRN created successfully');
      navigate('/grn');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create GRN'),
  });

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

  const handleSubmit = () => {
    if (!form.materialId || !form.receivedQuantity || !form.warehouseId) {
      toast.error('Material, warehouse and received quantity are required');
      return;
    }
    create.mutate(form);
  };

  const matList = materials?.data || [];
  const supList = suppliers?.data || [];
  const whList = warehouses?.data || [];

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/grn')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New GRN</h1>
          <p className="text-sm text-gray-500">Record goods received from supplier</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Material *</label>
            <select value={form.materialId} onChange={f('materialId')} className="input-field">
              <option value="">Select material...</option>
              {matList.map((m) => (
                <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Supplier</label>
            <select value={form.supplierId} onChange={f('supplierId')} className="input-field">
              <option value="">Select supplier...</option>
              {supList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Warehouse *</label>
            <select value={form.warehouseId} onChange={f('warehouseId')} className="input-field">
              <option value="">Select warehouse...</option>
              {whList.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Received Date *</label>
            <input type="date" value={form.receivedDate} onChange={f('receivedDate')} className="input-field" />
          </div>

          <div>
            <label className="label">QC Status</label>
            <select value={form.qcStatus} onChange={f('qcStatus')} className="input-field">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="conditional">Conditional</option>
            </select>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quantity & Cost</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Received Qty *</label>
              <input type="number" value={form.receivedQuantity} onChange={f('receivedQuantity')} className="input-field" min="0" step="0.01" />
            </div>
            <div>
              <label className="label">Accepted Qty</label>
              <input type="number" value={form.acceptedQuantity} onChange={f('acceptedQuantity')} className="input-field" min="0" step="0.01" />
            </div>
            <div>
              <label className="label">Rejected Qty</label>
              <input type="number" value={form.rejectedQuantity} onChange={f('rejectedQuantity')} className="input-field" min="0" step="0.01" />
            </div>
            <div>
              <label className="label">Unit Cost (₹)</label>
              <input type="number" value={form.unitCost} onChange={f('unitCost')} className="input-field" min="0" step="0.01" />
            </div>
            <div>
              <label className="label">Batch Number</label>
              <input value={form.batchNumber} onChange={f('batchNumber')} className="input-field" placeholder="Optional" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Invoice Details</p>
          <div className="grid grid-cols-2 gap-4">
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

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={() => navigate('/grn')}>Cancel</Button>
          <Button icon={Package} loading={create.isPending} onClick={handleSubmit}>Create GRN</Button>
        </div>
      </Card>
    </div>
  );
};

export default GRNForm;
