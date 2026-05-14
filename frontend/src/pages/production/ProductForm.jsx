import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Package, Layers, ChevronRight, Info,
  Tag, Percent, Hash, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { productAPI, materialAPI, variantAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const UNITS = ['pieces', 'pairs', 'kg', 'grams', 'liters', 'meters', 'boxes', 'sets', 'units'];
const GST_OPTIONS = [0, 5, 12, 18, 28];

// ─── Section heading ──────────────────────────────────────────────────────────
const Section = ({ title, subtitle, children, className }) => (
  <div className={clsx('space-y-4', className)}>
    <div>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

// ─── Field label ──────────────────────────────────────────────────────────────
const Label = ({ children, required }) => (
  <label className="block text-xs font-medium text-gray-600 mb-1">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const Input = ({ className, ...props }) => (
  <input
    className={clsx(
      'w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white',
      'focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300',
      'placeholder-gray-300 transition',
      className
    )}
    {...props}
  />
);

const Select = ({ className, children, ...props }) => (
  <select
    className={clsx(
      'w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white',
      'focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300',
      'transition text-gray-700',
      className
    )}
    {...props}
  >
    {children}
  </select>
);

// ─── Attribute value pills ────────────────────────────────────────────────────
const ValuePill = ({ value, selected, colorHex, dataType, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all',
      selected
        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
        : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
    )}
  >
    {dataType === 'color' && colorHex && (
      <span
        className={clsx('w-3 h-3 rounded-full flex-shrink-0 border', selected ? 'border-white/50' : 'border-gray-200')}
        style={{ background: colorHex }}
      />
    )}
    {value}
  </button>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const ProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '',
    code: '',
    category: '',
    unit: 'pairs',
    description: '',
    isActive: true,
    finishedGoodsMaterialId: '',
    // Pricing
    saleRate: '',
    hsnCode: '',
    gstPercent: 0,
    // Variants
    hasVariants: false,
    skuPrefix: '',
  });

  // Fetch existing product for edit
  const { data: existing } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productAPI.getOne(id),
    enabled: isEdit,
  });

  // Materials for FG link
  const { data: materialsData } = useQuery({
    queryKey: ['materials-simple'],
    queryFn: () => materialAPI.getAll({ limit: 500 }),
    staleTime: 5 * 60_000,
  });

  // Attributes for variant builder preview
  const { data: attrData } = useQuery({
    queryKey: ['attributes'],
    queryFn: variantAPI.getAttributes,
    staleTime: 5 * 60_000,
  });
  const attributes = attrData?.data || [];

  useEffect(() => {
    if (existing?.data) {
      const p = existing.data;
      setForm({
        name:                    p.name || '',
        code:                    p.code || '',
        category:                p.category || '',
        unit:                    p.unit || 'pairs',
        description:             p.description || '',
        isActive:                p.is_active ?? true,
        finishedGoodsMaterialId: p.finished_goods_material_id || '',
        saleRate:                p.sale_rate != null ? String(p.sale_rate) : '',
        hsnCode:                 p.hsn_code || '',
        gstPercent:              p.gst_percent ?? 0,
        hasVariants:             p.has_variants || false,
        skuPrefix:               p.sku_prefix || '',
      });
    }
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (d) => isEdit ? productAPI.update(id, d) : productAPI.create(d),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Product updated' : 'Product created');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      const newId = res?.data?.id || id;
      if (!isEdit && newId) {
        // Redirect based on whether variants are enabled
        if (form.hasVariants) {
          navigate(`/production/products/${newId}/variants`);
        } else {
          navigate(`/production/products/${newId}/bom`);
        }
      } else {
        navigate('/production/products');
      }
    },
    onError: (err) => toast.error(err?.message || 'Failed to save product'),
  });

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (k) => setForm((p) => ({ ...p, [k]: !p[k] }));

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (!form.unit.trim()) { toast.error('Unit is required'); return; }
    mutation.mutate({
      ...form,
      saleRate:               form.saleRate !== '' ? parseFloat(form.saleRate) : 0,
      gstPercent:             parseFloat(form.gstPercent) || 0,
      finishedGoodsMaterialId: form.finishedGoodsMaterialId || null,
    });
  };

  const skuPreview = form.skuPrefix
    ? `${form.skuPrefix.toUpperCase()}-BLK-6`
    : 'PREFIX-BLK-6';

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/production/products')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit Product' : 'New Product'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isEdit ? 'Update product details' : 'Create a product — then define its BOM or variants'}
          </p>
        </div>
      </div>

      {/* ── Core Details ── */}
      <Card className="p-5 space-y-5">
        <Section title="Basic Information">
          <div>
            <Label required>Product Name</Label>
            <Input
              value={form.name}
              onChange={f('name')}
              placeholder="e.g. Ladies Sandal 3100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Product Code</Label>
              <Input value={form.code} onChange={f('code')} placeholder="e.g. 3100" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={f('category')} placeholder="e.g. Footwear" />
            </div>
          </div>

          <div>
            <Label required>Unit</Label>
            <Select value={form.unit} onChange={f('unit')}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              <option value="custom">Other…</option>
            </Select>
            {form.unit === 'custom' && (
              <Input
                className="mt-2"
                placeholder="Enter custom unit"
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              />
            )}
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={f('description')}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              rows={2}
              placeholder="Optional description…"
            />
          </div>
        </Section>

        {/* ── Pricing ── */}
        <Section
          title="Pricing & Tax"
          subtitle="Optional — used on sales orders and invoices"
          className="border-t border-gray-100 pt-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Sale Rate (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.saleRate}
                  onChange={f('saleRate')}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label>HSN Code</Label>
              <Input
                value={form.hsnCode}
                onChange={f('hsnCode')}
                placeholder="e.g. 6402"
              />
            </div>
            <div>
              <Label>GST %</Label>
              <Select value={form.gstPercent} onChange={f('gstPercent')}>
                {GST_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}%</option>
                ))}
              </Select>
            </div>
          </div>
        </Section>

        {/* ── Finished Goods ── */}
        <Section
          title="Finished Goods Material"
          subtitle="When production completes, add produced quantity to this material's stock"
          className="border-t border-gray-100 pt-5"
        >
          <Select
            value={form.finishedGoodsMaterialId}
            onChange={f('finishedGoodsMaterialId')}
          >
            <option value="">— None —</option>
            {(materialsData?.data || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name} (Stock: {m.current_stock} {m.unit})
              </option>
            ))}
          </Select>
        </Section>

        {isEdit && (
          <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700 select-none cursor-pointer">
              Active
            </label>
          </div>
        )}
      </Card>

      {/* ── Variants Section ── */}
      <Card className="p-5 space-y-4">
        {/* Toggle header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-800">Variants &amp; Attributes</h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Enable for products with size, colour, or other combinations
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggle('hasVariants')}
            className={clsx(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
              form.hasVariants ? 'bg-indigo-600' : 'bg-gray-200'
            )}
          >
            <span
              className={clsx(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                form.hasVariants ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        {form.hasVariants && (
          <div className="space-y-4 animate-fade-in">
            {/* SKU Prefix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>SKU Prefix</Label>
                <Input
                  value={form.skuPrefix}
                  onChange={(e) => setForm((p) => ({ ...p, skuPrefix: e.target.value.toUpperCase() }))}
                  placeholder="e.g. 3100 or SHOE"
                  className="font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Used to auto-generate variant SKUs
                </p>
              </div>
              <div>
                <Label>SKU Preview</Label>
                <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm font-mono text-indigo-700">
                  {skuPreview}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Format: PREFIX-COLOR-SIZE
                </p>
              </div>
            </div>

            {/* Info box about next step */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 space-y-0.5">
                <p className="font-semibold">After saving, you'll be taken to the Variant Builder.</p>
                <p>There you can select attributes (Size, Colour…), pick values, and auto-generate all SKU combinations.</p>
                {attributes.length === 0 && (
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5">
                    No attributes defined yet. Go to{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/production/attributes')}
                      className="underline font-medium"
                    >
                      Attribute Master
                    </button>{' '}
                    to add Size, Colour, etc.
                  </p>
                )}
                {attributes.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="text-blue-500">Available attributes:</span>
                    {attributes.map((a) => (
                      <span key={a.id} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                        {a.name} ({a.values?.length || 0} values)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!form.hasVariants && (
          <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
            <Layers size={20} className="mx-auto mb-1.5 opacity-30" />
            Enable variants for products like<br />
            <em>"Ladies Sandal 3100 / Black / Size 6"</em>
          </div>
        )}
      </Card>

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={() => navigate('/production/products')}>
          Cancel
        </Button>
        <Button
          icon={form.hasVariants ? Layers : Package}
          loading={mutation.isPending}
          onClick={handleSubmit}
        >
          {isEdit
            ? 'Save Changes'
            : form.hasVariants
              ? 'Create & Configure Variants →'
              : 'Create & Define BOM →'}
        </Button>
      </div>
    </div>
  );
};

export default ProductForm;
