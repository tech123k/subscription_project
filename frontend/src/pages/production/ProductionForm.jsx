import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Factory, AlertTriangle, CheckCircle, Package, BookOpen } from 'lucide-react';
import { productionAPI, productAPI, customerAPI, workflowAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { PRIORITIES } from '../../utils/constants';
import { formatNumber } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ProductionForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    productId: '', customerId: '', workflowTemplateId: '',
    plannedQuantity: '', priority: 'normal',
    plannedStartDate: '', plannedEndDate: '', notes: '',
  });
  const [stockErrors, setStockErrors] = useState([]);

  const { data: products } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => productAPI.getAll({ isActive: 'true', limit: 500 }),
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-simple'],
    queryFn: () => customerAPI.getAll({ limit: 500 }),
  });

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowAPI.getTemplates,
  });

  // Fetch BOM when product + quantity are set
  const { data: bomData, isFetching: bomLoading } = useQuery({
    queryKey: ['bom-calc', form.productId, form.plannedQuantity],
    queryFn: () => productAPI.getBOMForQuantity(form.productId, Number(form.plannedQuantity)),
    enabled: Boolean(form.productId) && Number(form.plannedQuantity) > 0,
    staleTime: 30000,
  });

  // Clear stock errors when product/qty changes
  useEffect(() => { setStockErrors([]); }, [form.productId, form.plannedQuantity]);

  const create = useMutation({
    mutationFn: (d) => productionAPI.create(d),
    onSuccess: () => { toast.success('Production order created'); navigate('/production'); },
    onError: (err) => {
      if (err?.data && Array.isArray(err.data)) {
        setStockErrors(err.data);
      } else {
        toast.error(err?.message || 'Failed to create order');
      }
    },
  });

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const bomItems = bomData?.data?.bom_items || [];
  const selectedProduct = (products?.data || []).find((p) => p.id === form.productId);

  const handleSubmit = () => {
    if (!form.productId) { toast.error('Please select a product'); return; }
    if (!form.plannedQuantity || Number(form.plannedQuantity) <= 0) { toast.error('Planned quantity must be > 0'); return; }
    if (!form.workflowTemplateId) { toast.error('Please select a workflow template'); return; }

    if (!selectedProduct?.bom_id) {
      toast.error('This product has no BOM. Please create a BOM before placing a production order.');
      return;
    }

    // Client-side stock pre-check
    const shortages = bomItems
      .filter((i) => Number(i.required_quantity) > Number(i.current_stock || 0))
      .map((i) => ({
        name: i.material_name,
        code: i.material_code,
        unit: i.material_unit,
        required: Number(i.required_quantity),
        available: Number(i.current_stock || 0),
        shortage: +(Number(i.required_quantity) - Number(i.current_stock || 0)).toFixed(4),
      }));

    if (shortages.length > 0) {
      setStockErrors(shortages);
      return;
    }

    setStockErrors([]);
    create.mutate(form);
  };

  const custList = customers?.data || [];
  const wfList = workflows?.data || [];
  const prodList = products?.data || [];

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/production')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Production Order</h1>
          <p className="text-sm text-gray-500">Select a product — BOM materials are fetched automatically</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        {/* Product + Qty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Product *</label>
            <select value={form.productId} onChange={f('productId')} className="input-field">
              <option value="">— Select product —</option>
              {prodList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.code ? ` (${p.code})` : ''}
                  {!p.bom_id ? ' ⚠ No BOM' : ''}
                </option>
              ))}
            </select>
            {form.productId && !selectedProduct?.bom_id && (
              <div className="mt-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                <AlertTriangle size={13} />
                This product has no BOM.
                <button
                  onClick={() => navigate(`/production/products/${form.productId}/bom`)}
                  className="underline font-medium"
                >
                  Create BOM →
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="label">Planned Quantity *</label>
            <input
              type="number"
              value={form.plannedQuantity}
              onChange={f('plannedQuantity')}
              className="input-field"
              min="1"
              placeholder="e.g. 400"
            />
          </div>

          <div>
            <label className="label">Unit</label>
            <input
              value={selectedProduct?.unit || ''}
              readOnly
              className="input-field bg-gray-50 text-gray-500 cursor-not-allowed"
              placeholder="Auto from product"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Customer</label>
            <select value={form.customerId} onChange={f('customerId')} className="input-field">
              <option value="">— No customer —</option>
              {custList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Workflow Template *</label>
            <select value={form.workflowTemplateId} onChange={f('workflowTemplateId')} className="input-field">
              <option value="">— Select workflow —</option>
              {wfList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Priority</label>
            <select value={form.priority} onChange={f('priority')} className="input-field">
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* Timeline */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* BOM Preview — auto-loaded */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Bill of Materials
            </p>
            {form.productId && (
              <button
                onClick={() => navigate(`/production/products/${form.productId}/bom`)}
                className="text-xs text-primary-600 hover:underline flex items-center gap-1"
              >
                <BookOpen size={12} /> Edit BOM
              </button>
            )}
          </div>

          {!form.productId ? (
            <div className="flex items-center gap-2 text-gray-400 bg-gray-50 rounded-xl px-4 py-3 text-sm border border-dashed border-gray-200">
              <Package size={15} />
              Select a product to auto-load its Bill of Materials
            </div>
          ) : !selectedProduct?.bom_id ? (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-3 text-sm border border-amber-200">
              <AlertTriangle size={15} />
              No BOM defined for this product yet
            </div>
          ) : bomLoading ? (
            <div className="text-sm text-gray-400 py-3 text-center">Calculating materials…</div>
          ) : bomItems.length === 0 ? (
            <div className="text-sm text-gray-400 py-3 text-center">No BOM items found</div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-gray-500 text-left">
                    <th className="px-4 py-2.5">Material</th>
                    <th className="px-4 py-2.5 text-right">Qty/unit</th>
                    <th className="px-4 py-2.5 text-right">Waste%</th>
                    <th className="px-4 py-2.5 text-right">Required ({form.plannedQuantity || 0} units)</th>
                    <th className="px-4 py-2.5 text-right">Available</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bomItems.map((item, i) => {
                    const short = Number(item.required_quantity) > Number(item.current_stock || 0);
                    return (
                      <tr key={i} className={short ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-800">{item.material_name}</p>
                          <p className="text-gray-400">{item.material_code}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {formatNumber(item.quantity_per_unit)} {item.unit || item.material_unit}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500">
                          {item.waste_percentage > 0 ? `${item.waste_percentage}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                          {formatNumber(item.required_quantity)} {item.material_unit}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${short ? 'text-red-600' : 'text-green-700'}`}>
                          {formatNumber(item.current_stock || 0)} {item.material_unit}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {short ? (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-medium text-xs">
                              <AlertTriangle size={10} />
                              Short {formatNumber(Number(item.required_quantity) - Number(item.current_stock || 0))}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium text-xs">
                              <CheckCircle size={10} /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stock shortage error panel */}
        {stockErrors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-3">
              <AlertTriangle size={15} />
              Insufficient Stock — Cannot create production order
            </div>
            <div className="space-y-2">
              {stockErrors.map((e) => (
                <div key={e.code} className="grid grid-cols-4 gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-red-100">
                  <div className="col-span-2">
                    <p className="font-semibold text-gray-800">{e.name}</p>
                    <p className="text-gray-400">{e.code}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Required</p>
                    <p className="font-bold text-gray-800">{formatNumber(e.required)} {e.unit}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Available</p>
                    <p className="font-bold text-red-600">{formatNumber(e.available)} {e.unit}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-red-600 mt-2">Add stock via GRN before creating this production order.</p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <label className="label">Notes</label>
          <textarea value={form.notes} onChange={f('notes')} className="input-field resize-none" rows={2} />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={() => navigate('/production')}>Cancel</Button>
          <Button
            icon={Factory}
            loading={create.isPending}
            onClick={handleSubmit}
            disabled={bomLoading}
          >
            Create Order
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProductionForm;
