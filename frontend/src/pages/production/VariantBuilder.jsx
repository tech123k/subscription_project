import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Plus, Trash2, RefreshCw, Save, ArrowLeft,
  CheckCircle, Package, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { variantAPI, productAPI } from '../../services/api';
import Button from '../../components/ui/Button';

const VariantBuilder = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [skuPrefix, setSkuPrefix]           = useState('');
  const [selectedAttrs, setSelectedAttrs]   = useState([]);    // [{attributeId, selectedValueIds: []}]
  const [generated, setGenerated]           = useState([]);    // [{sku, name, attributeValues, saleRate, barcode}]
  const [editedVariants, setEdited]         = useState({});    // {sku -> {saleRate, barcode}}

  // Fetch product
  const { data: prodData } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productAPI.getOne(productId),
    staleTime: 60_000,
  });
  const product = prodData?.data;

  // Fetch attributes
  const { data: attrData } = useQuery({
    queryKey: ['attributes'],
    queryFn: variantAPI.getAttributes,
    staleTime: 60_000,
  });
  const attributes = attrData?.data || [];

  // Fetch existing variants
  const { data: variantData, refetch: refetchVariants } = useQuery({
    queryKey: ['variants', productId],
    queryFn: () => variantAPI.getVariants(productId),
    staleTime: 30_000,
  });
  const existingVariants = variantData?.data || [];

  useEffect(() => {
    if (product?.sku_prefix) setSkuPrefix(product.sku_prefix);
  }, [product]);

  // Generate combinations
  const genMut = useMutation({
    mutationFn: (payload) => variantAPI.generateCombinations(payload),
    onSuccess: (res) => {
      const combos = res?.data || [];
      // Backend already applies skuPrefix in the SKU — do NOT apply it again here
      setGenerated(combos.map(v => ({
        ...v,
        saleRate: product?.sale_rate || 0,
        barcode: '',
      })));
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  const handleGenerate = () => {
    const valid = selectedAttrs.filter(a => a.attributeId && a.selectedValueIds.length > 0);
    if (!valid.length) { toast.error('Select at least one attribute with values'); return; }
    genMut.mutate({ skuPrefix, attributes: valid.map(a => ({ attributeId: a.attributeId, valueIds: a.selectedValueIds })) });
  };

  // Save variants
  const saveMut = useMutation({
    mutationFn: (payload) => variantAPI.createVariants(productId, payload),
    onSuccess: (res) => {
      toast.success(`${res?.data?.length || 0} variant(s) saved!`);
      qc.invalidateQueries(['variants', productId]);
      qc.invalidateQueries(['products']);
      refetchVariants();
      setGenerated([]);
    },
    onError: (e) => toast.error(e?.message || 'Failed to save'),
  });

  const handleSave = () => {
    if (!generated.length) { toast.error('Generate variants first'); return; }
    const variants = generated.map(v => ({
      sku: editedVariants[v.sku]?.sku || v.sku,
      name: v.name,
      attributeValues: v.attributeValues,
      saleRate: editedVariants[v.sku]?.saleRate ?? v.saleRate,
      barcode: editedVariants[v.sku]?.barcode ?? v.barcode,
    }));
    saveMut.mutate({ variants, skuPrefix });
  };

  const addAttrRow = () => setSelectedAttrs(a => [...a, { attributeId: '', selectedValueIds: [] }]);
  const removeAttrRow = (i) => setSelectedAttrs(a => a.filter((_, idx) => idx !== i));

  const updateAttrRow = (i, field, value) => {
    setSelectedAttrs(a => a.map((row, idx) => idx === i
      ? { ...row, [field]: value, ...(field === 'attributeId' ? { selectedValueIds: [] } : {}) }
      : row
    ));
  };

  const toggleValue = (attrIdx, valueId) => {
    setSelectedAttrs(a => a.map((row, idx) => {
      if (idx !== attrIdx) return row;
      const ids = row.selectedValueIds.includes(valueId)
        ? row.selectedValueIds.filter(id => id !== valueId)
        : [...row.selectedValueIds, valueId];
      return { ...row, selectedValueIds: ids };
    }));
  };

  const updateGenerated = (sku, field, value) => {
    setEdited(prev => ({ ...prev, [sku]: { ...(prev[sku] || {}), [field]: value } }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Variant Builder</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {product ? `${product.name} (${product.code || 'no code'})` : '…'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Left: Configure */}
        <div className="col-span-2 space-y-4">
          {/* SKU Prefix */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">SKU Configuration</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-medium">SKU Prefix</label>
                <input value={skuPrefix} onChange={e => setSkuPrefix(e.target.value.toUpperCase())}
                  placeholder="e.g. SHOE or SHIRT"
                  className="w-full mt-1 text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-medium">Preview</label>
                <p className="mt-1 text-sm font-mono text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
                  {skuPrefix || 'PREFIX'}-M-RED
                </p>
              </div>
            </div>
          </div>

          {/* Attribute Selection */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Select Attributes & Values</h3>
              <Button variant="secondary" size="sm" icon={Plus} onClick={addAttrRow}>Add Attribute</Button>
            </div>

            {selectedAttrs.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">
                Click "Add Attribute" to start building variants
              </div>
            )}

            <div className="space-y-4">
              {selectedAttrs.map((row, i) => {
                const attr = attributes.find(a => a.id === row.attributeId);
                const values = attr?.values || [];
                return (
                  <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                    <div className="flex items-center gap-3 mb-3">
                      <select value={row.attributeId} onChange={e => updateAttrRow(i, 'attributeId', e.target.value)}
                        className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">Select Attribute…</option>
                        {attributes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <button onClick={() => removeAttrRow(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {attr && (
                      <div className="flex flex-wrap gap-2">
                        {values.map(v => {
                          const selected = row.selectedValueIds.includes(v.id);
                          return (
                            <button key={v.id} type="button" onClick={() => toggleValue(i, v.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                                selected
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
                              }`}>
                              {attr.data_type === 'color' && v.color_hex && (
                                <span className="w-3 h-3 rounded-full border border-white/40"
                                  style={{ background: v.color_hex }} />
                              )}
                              {v.display_name || v.value}
                            </button>
                          );
                        })}
                        {values.length === 0 && (
                          <span className="text-xs text-gray-400 italic">No values — add them in Attribute Master</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedAttrs.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button icon={RefreshCw} loading={genMut.isPending} onClick={handleGenerate}>
                  Generate Combinations ({selectedAttrs.reduce((s,a) => s + (a.selectedValueIds.length||0), 0)} values)
                </Button>
              </div>
            )}
          </div>

          {/* Generated Variants Table */}
          {generated.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  Generated Variants <span className="text-indigo-600">({generated.length})</span>
                </h3>
                <Button icon={Save} loading={saveMut.isPending} onClick={handleSave}>
                  Save All Variants
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[600px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wide">
                      <th className="px-3 py-2">Combination</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2 w-28">Sale Rate</th>
                      <th className="px-3 py-2 w-32">Barcode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {generated.map((v) => (
                      <tr key={v.sku} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(v.attributeValues || []).map((av, idx) => (
                              <span key={idx} className="inline-flex px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">
                                {av.attribute_name}: {av.display_name || av.value}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-700">
                          {editedVariants[v.sku]?.sku ?? v.sku}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min="0" step="0.01"
                            value={editedVariants[v.sku]?.saleRate ?? v.saleRate}
                            onChange={e => updateGenerated(v.sku, 'saleRate', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-300 text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={editedVariants[v.sku]?.barcode ?? v.barcode}
                            onChange={e => updateGenerated(v.sku, 'barcode', e.target.value)}
                            placeholder="Optional"
                            className="w-full px-2 py-1 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-300 font-mono"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right: Existing Variants */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Layers size={14} className="text-indigo-600" /> Existing Variants
              <span className="text-xs text-gray-400 font-normal">({existingVariants.length})</span>
            </h3>
            {existingVariants.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">No variants yet</div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {existingVariants.map(v => (
                  <div key={v.id} className={`border rounded-lg p-2.5 ${v.is_active ? 'border-gray-100 bg-gray-50' : 'border-red-100 bg-red-50/50'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold font-mono text-gray-800">{v.sku}</p>
                      {v.is_active
                        ? <CheckCircle size={12} className="text-emerald-500" />
                        : <AlertCircle size={12} className="text-red-400" />}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{v.name || '—'}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-gray-500">
                        Stock: <strong className="text-gray-700">{v.total_stock || 0}</strong>
                      </span>
                      {v.sale_rate > 0 && (
                        <span className="text-[10px] text-emerald-600 font-medium">₹{v.sale_rate}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Help card */}
          <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 text-xs text-indigo-700 space-y-1.5">
            <p className="font-semibold">How variants work</p>
            <p>1. Define attributes (Size, Color) in Attribute Master</p>
            <p>2. Select values → Generate combinations</p>
            <p>3. Edit SKUs/rates as needed → Save</p>
            <p>4. Manage stock per variant in Product detail</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariantBuilder;
