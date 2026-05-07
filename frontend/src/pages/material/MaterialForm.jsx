import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Upload, X, Package } from 'lucide-react';
import { materialAPI, warehouseAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { MATERIAL_UNITS } from '../../utils/constants';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '', code: '', description: '', categoryId: '', unit: 'kg',
  warehouseId: '', minimumStock: '0', maximumStock: '',
  unitCost: '', hsnCode: '', gstRate: '18',
  specifications: '',
};

const MaterialForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [categories, setCategories] = useState([]);

  const { data: matData } = useQuery({
    queryKey: ['material', id],
    queryFn: () => materialAPI.getById(id),
    enabled: isEdit,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-simple'],
    queryFn: () => warehouseAPI.getAll({ limit: 100 }),
  });

  const { data: catsData } = useQuery({
    queryKey: ['material-categories'],
    queryFn: () => materialAPI.getCategories(),
  });

  useEffect(() => {
    if (catsData?.data) setCategories(catsData.data);
  }, [catsData]);

  useEffect(() => {
    if (matData?.data) {
      const m = matData.data;
      setForm({
        name: m.name, code: m.code, description: m.description || '',
        categoryId: m.category_id || '', unit: m.unit, warehouseId: m.warehouse_id || '',
        minimumStock: m.minimum_stock || '0', maximumStock: m.maximum_stock || '',
        unitCost: m.unit_cost || '', hsnCode: m.hsn_code || '', gstRate: m.gst_rate || '18',
        specifications: m.specifications ? JSON.stringify(m.specifications, null, 2) : '',
      });
      if (m.image_url) setImagePreview(m.image_url);
    }
  }, [matData]);

  const save = useMutation({
    mutationFn: (formData) => isEdit ? materialAPI.update(id, formData) : materialAPI.create(formData),
    onSuccess: () => {
      toast.success(isEdit ? 'Material updated' : 'Material created');
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      navigate('/materials');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save material'),
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = () => {
    if (!form.name || !form.unit) {
      toast.error('Name and unit are required');
      return;
    }
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== '') formData.append(k, v); });
    if (imageFile) formData.append('image', imageFile);
    save.mutate(formData);
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const whList = warehouses?.data || [];

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/materials')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Material' : 'New Material'}</h1>
          <p className="text-sm text-gray-500">Raw material master record</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Material Name *</label>
            <input value={form.name} onChange={f('name')} className="input-field" placeholder="e.g. Natural Rubber" />
          </div>
          <div>
            <label className="label">Code *</label>
            <input value={form.code} onChange={f('code')} className="input-field" placeholder="MAT-001" />
          </div>
          <div>
            <label className="label">Category</label>
            <select value={form.categoryId} onChange={f('categoryId')} className="input-field">
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Unit *</label>
            <select value={form.unit} onChange={f('unit')} className="input-field">
              {MATERIAL_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Default Warehouse</label>
            <select value={form.warehouseId} onChange={f('warehouseId')} className="input-field">
              <option value="">Select warehouse...</option>
              {whList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <textarea value={form.description} onChange={f('description')} className="input-field resize-none" rows={2} />
          </div>
        </div>

        {/* Stock Levels */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Stock Settings</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Min Stock Level</label>
              <input type="number" value={form.minimumStock} onChange={f('minimumStock')} className="input-field" min="0" step="0.01" />
            </div>
            <div>
              <label className="label">Max Stock Level</label>
              <input type="number" value={form.maximumStock} onChange={f('maximumStock')} className="input-field" min="0" step="0.01" placeholder="Optional" />
            </div>
            <div>
              <label className="label">Unit Cost (₹)</label>
              <input type="number" value={form.unitCost} onChange={f('unitCost')} className="input-field" min="0" step="0.01" />
            </div>
          </div>
        </div>

        {/* Tax */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tax & Compliance</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">HSN Code</label>
              <input value={form.hsnCode} onChange={f('hsnCode')} className="input-field" placeholder="e.g. 4001" />
            </div>
            <div>
              <label className="label">GST Rate (%)</label>
              <select value={form.gstRate} onChange={f('gstRate')} className="input-field">
                {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Image Upload */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Image</p>
          <div className="flex items-start gap-4">
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="preview" className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
                <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <label className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 transition-colors">
                <Upload size={18} className="text-gray-400 mb-1" />
                <span className="text-xs text-gray-400">Upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            )}
            <p className="text-xs text-gray-400 mt-2">JPG, PNG up to 5MB. Used on reports and product pages.</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={() => navigate('/materials')}>Cancel</Button>
          <Button icon={Package} loading={save.isPending} onClick={handleSubmit}>
            {isEdit ? 'Update Material' : 'Create Material'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default MaterialForm;
