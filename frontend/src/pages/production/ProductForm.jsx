import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package } from 'lucide-react';
import { productAPI, materialAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import toast from 'react-hot-toast';

const UNITS = ['pieces', 'pairs', 'kg', 'grams', 'liters', 'meters', 'boxes', 'sets', 'units'];

const ProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '', code: '', category: '', unit: 'pieces', description: '', isActive: true,
    finishedGoodsMaterialId: '',
  });

  const { data: existing } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productAPI.getOne(id),
    enabled: isEdit,
  });

  const { data: materialsData } = useQuery({
    queryKey: ['materials-simple'],
    queryFn: () => materialAPI.getAll({ limit: 500 }),
  });

  useEffect(() => {
    if (existing?.data) {
      const p = existing.data;
      setForm({
        name: p.name || '',
        code: p.code || '',
        category: p.category || '',
        unit: p.unit || 'pieces',
        description: p.description || '',
        isActive: p.is_active ?? true,
        finishedGoodsMaterialId: p.finished_goods_material_id || '',
      });
    }
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (d) => isEdit ? productAPI.update(id, d) : productAPI.create(d),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Product updated' : 'Product created');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      const newId = res?.data?.id || id;
      // After create, go to BOM builder
      if (!isEdit && newId) navigate(`/production/products/${newId}/bom`);
      else navigate('/production/products');
    },
    onError: (err) => toast.error(err?.message || 'Failed to save product'),
  });

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (!form.unit.trim()) { toast.error('Unit is required'); return; }
    mutation.mutate(form);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/production/products')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Product' : 'New Product'}</h1>
          <p className="text-sm text-gray-500">{isEdit ? 'Update product details' : 'Create product, then define its BOM'}</p>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="label">Product Name *</label>
          <input value={form.name} onChange={f('name')} className="input-field" placeholder="e.g. Casual Shoe" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Product Code</label>
            <input value={form.code} onChange={f('code')} className="input-field" placeholder="e.g. CS-001" />
          </div>
          <div>
            <label className="label">Category</label>
            <input value={form.category} onChange={f('category')} className="input-field" placeholder="e.g. Footwear" />
          </div>
        </div>

        <div>
          <label className="label">Unit *</label>
          <select value={form.unit} onChange={f('unit')} className="input-field">
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            <option value="custom">Other</option>
          </select>
          {form.unit === 'custom' && (
            <input
              className="input-field mt-2"
              placeholder="Enter custom unit"
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
            />
          )}
        </div>

        <div>
          <label className="label">Description</label>
          <textarea value={form.description} onChange={f('description')} className="input-field resize-none" rows={2} />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="label">Finished Goods Material (optional)</label>
          <select
            value={form.finishedGoodsMaterialId}
            onChange={f('finishedGoodsMaterialId')}
            className="input-field"
          >
            <option value="">— None (don't add to inventory on completion) —</option>
            {(materialsData?.data || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name} (Stock: {m.current_stock} {m.unit})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            When production completes, produced quantity will be added to this material's stock.
          </p>
        </div>

        {isEdit && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={() => navigate('/production/products')}>Cancel</Button>
          <Button icon={Package} loading={mutation.isPending} onClick={handleSubmit}>
            {isEdit ? 'Save Changes' : 'Create & Define BOM →'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProductForm;
