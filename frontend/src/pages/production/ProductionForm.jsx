import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Factory } from 'lucide-react';
import { productionAPI, customerAPI, workflowAPI, materialAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { PRIORITIES } from '../../utils/constants';
import toast from 'react-hot-toast';

const emptyMaterial = { materialId: '', quantity: '', unit: '' };

const ProductionForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    productName: '', customerId: '', workflowTemplateId: '',
    plannedQuantity: '', unit: '', priority: 'normal',
    plannedStartDate: '', plannedEndDate: '',
    notes: '', materials: [{ ...emptyMaterial }],
  });

  const { data: customers } = useQuery({ queryKey: ['customers-simple'], queryFn: () => customerAPI.getAll({ limit: 500 }) });
  const { data: workflows } = useQuery({ queryKey: ['workflows'], queryFn: workflowAPI.getTemplates });
  const { data: materials } = useQuery({ queryKey: ['materials-simple'], queryFn: () => materialAPI.getAll({ limit: 500 }) });

  const create = useMutation({
    mutationFn: (d) => productionAPI.create(d),
    onSuccess: () => {
      toast.success('Production order created');
      navigate('/production');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create order'),
  });

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const setMaterial = (idx, key, val) => {
    setForm((p) => {
      const mats = [...p.materials];
      mats[idx] = { ...mats[idx], [key]: val };
      if (key === 'materialId') {
        const mat = (materials?.data || []).find((m) => m.id === val);
        if (mat) mats[idx].unit = mat.unit;
      }
      return { ...p, materials: mats };
    });
  };

  const addMaterial = () => setForm((p) => ({ ...p, materials: [...p.materials, { ...emptyMaterial }] }));
  const removeMaterial = (idx) => setForm((p) => ({ ...p, materials: p.materials.filter((_, i) => i !== idx) }));

  const handleSubmit = () => {
    if (!form.productName || !form.plannedQuantity || !form.unit) {
      toast.error('Product name, quantity and unit are required');
      return;
    }
    const materials = form.materials.filter((m) => m.materialId && m.quantity);
    create.mutate({ ...form, materials });
  };

  const custList = customers?.data || [];
  const wfList = workflows?.data || [];
  const matList = materials?.data || [];

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/production')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Production Order</h1>
          <p className="text-sm text-gray-500">Create a new manufacturing order</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Product Name *</label>
            <input value={form.productName} onChange={f('productName')} className="input-field" placeholder="e.g. Men's Casual Shoes - Size 42" />
          </div>

          <div>
            <label className="label">Customer</label>
            <select value={form.customerId} onChange={f('customerId')} className="input-field">
              <option value="">No customer</option>
              {custList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Workflow Template</label>
            <select value={form.workflowTemplateId} onChange={f('workflowTemplateId')} className="input-field">
              <option value="">Default workflow</option>
              {wfList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Planned Quantity *</label>
            <input type="number" value={form.plannedQuantity} onChange={f('plannedQuantity')} className="input-field" min="1" />
          </div>

          <div>
            <label className="label">Unit *</label>
            <input value={form.unit} onChange={f('unit')} className="input-field" placeholder="e.g. pairs, pieces, kg" />
          </div>

          <div>
            <label className="label">Priority</label>
            <select value={form.priority} onChange={f('priority')} className="input-field">
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Planned Start Date</label>
              <input type="date" value={form.plannedStartDate} onChange={f('plannedStartDate')} className="input-field" />
            </div>
            <div>
              <label className="label">Planned End Date</label>
              <input type="date" value={form.plannedEndDate} onChange={f('plannedEndDate')} className="input-field" />
            </div>
          </div>
        </div>

        {/* Bill of Materials */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bill of Materials</p>
            <Button variant="secondary" size="sm" icon={Plus} onClick={addMaterial}>Add Material</Button>
          </div>
          <div className="space-y-2">
            {form.materials.map((mat, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <select value={mat.materialId} onChange={(e) => setMaterial(idx, 'materialId', e.target.value)}
                    className="input-field">
                    <option value="">Select material...</option>
                    {matList.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <input type="number" value={mat.quantity} onChange={(e) => setMaterial(idx, 'quantity', e.target.value)}
                    className="input-field" placeholder="Qty" min="0" step="0.01" />
                </div>
                <div className="col-span-2">
                  <input value={mat.unit} onChange={(e) => setMaterial(idx, 'unit', e.target.value)}
                    className="input-field" placeholder="Unit" />
                </div>
                <div className="col-span-1 flex justify-center">
                  {form.materials.length > 1 && (
                    <button onClick={() => removeMaterial(idx)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="label">Notes</label>
          <textarea value={form.notes} onChange={f('notes')} className="input-field resize-none" rows={2} />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={() => navigate('/production')}>Cancel</Button>
          <Button icon={Factory} loading={create.isPending} onClick={handleSubmit}>Create Order</Button>
        </div>
      </Card>
    </div>
  );
};

export default ProductionForm;
