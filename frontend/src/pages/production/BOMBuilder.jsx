import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Save, AlertCircle, CheckCircle, GripVertical } from 'lucide-react';
import { bomAPI, materialAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { formatNumber } from '../../utils/helpers';
import toast from 'react-hot-toast';

const emptyItem = { materialId: '', quantityPerUnit: '', unit: '', wastePercentage: '0', notes: '' };

const BOMBuilder = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [items, setItems] = useState([{ ...emptyItem }]);
  const [notes, setNotes] = useState('');
  const [previewQty, setPreviewQty] = useState('100');

  const { data: bomData, isLoading } = useQuery({
    queryKey: ['bom', productId],
    queryFn: () => bomAPI.getByProduct(productId),
  });

  const { data: materialsData } = useQuery({
    queryKey: ['materials-simple'],
    queryFn: () => materialAPI.getAll({ limit: 500 }),
  });

  // Seed form when BOM loads
  useEffect(() => {
    const bom = bomData?.data?.bom;
    if (bom) {
      setNotes(bom.notes || '');
      if (bom.items?.length > 0) {
        setItems(bom.items.map((i) => ({
          materialId: i.material_id,
          quantityPerUnit: String(i.quantity_per_unit),
          unit: i.unit || i.material_unit || '',
          wastePercentage: String(i.waste_percentage ?? 0),
          notes: i.notes || '',
        })));
      }
    }
  }, [bomData]);

  const saveMutation = useMutation({
    mutationFn: (d) => bomAPI.upsert(productId, d),
    onSuccess: () => {
      toast.success('BOM saved successfully');
      queryClient.invalidateQueries({ queryKey: ['bom', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error(err?.message || 'Failed to save BOM'),
  });

  const matList = materialsData?.data || [];
  const product = bomData?.data?.product;

  const setItem = (idx, key, val) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      if (key === 'materialId') {
        const mat = matList.find((m) => m.id === val);
        if (mat) next[idx].unit = mat.unit || '';
      }
      return next;
    });
  };

  const addItem = () => setItems((p) => [...p, { ...emptyItem }]);
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const handleSave = () => {
    const validItems = items.filter((i) => i.materialId && i.quantityPerUnit && Number(i.quantityPerUnit) > 0);
    if (validItems.length === 0) { toast.error('Add at least one material with quantity > 0'); return; }
    saveMutation.mutate({ items: validItems, notes });
  };

  // Calculate preview quantities
  const previewQtyNum = parseFloat(previewQty) || 0;
  const previewItems = items
    .filter((i) => i.materialId && i.quantityPerUnit)
    .map((i) => {
      const mat = matList.find((m) => m.id === i.materialId);
      const qtyPerUnit = parseFloat(i.quantityPerUnit) || 0;
      const waste = parseFloat(i.wastePercentage) || 0;
      const required = +(qtyPerUnit * previewQtyNum * (1 + waste / 100)).toFixed(4);
      const available = Number(mat?.current_stock || 0);
      return {
        name: mat?.name || '—',
        code: mat?.code,
        unit: i.unit || mat?.unit,
        required,
        available,
        short: required > available,
        shortage: +(required - available).toFixed(4),
      };
    });

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/production/products')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            Bill of Materials — {product?.name || '…'}
          </h1>
          <p className="text-sm text-gray-500">Define materials required per unit of this product</p>
        </div>
        <Button icon={Save} loading={saveMutation.isPending} onClick={handleSave}>Save BOM</Button>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* BOM Editor */}
        <div className="col-span-3 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Materials</p>
              <Button variant="secondary" size="sm" icon={Plus} onClick={addItem}>Add Row</Button>
            </div>

            {isLoading ? (
              <p className="text-sm text-gray-400 py-4 text-center">Loading...</p>
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-medium px-1">
                  <div className="col-span-5">Material</div>
                  <div className="col-span-2">Qty / unit</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Waste %</div>
                  <div className="col-span-1"></div>
                </div>

                {items.map((item, idx) => {
                  const mat = matList.find((m) => m.id === item.materialId);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <select
                            value={item.materialId}
                            onChange={(e) => setItem(idx, 'materialId', e.target.value)}
                            className="input-field text-xs"
                          >
                            <option value="">Select material…</option>
                            {matList.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.code} — {m.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={item.quantityPerUnit}
                            onChange={(e) => setItem(idx, 'quantityPerUnit', e.target.value)}
                            className="input-field text-xs"
                            placeholder="0"
                            min="0"
                            step="0.0001"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            value={item.unit}
                            onChange={(e) => setItem(idx, 'unit', e.target.value)}
                            className="input-field text-xs"
                            placeholder="unit"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={item.wastePercentage}
                            onChange={(e) => setItem(idx, 'wastePercentage', e.target.value)}
                            className="input-field text-xs"
                            placeholder="0"
                            min="0"
                            max="99"
                            step="0.1"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          {items.length > 1 && (
                            <button
                              onClick={() => removeItem(idx)}
                              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Stock hint */}
                      {mat && (
                        <p className="text-xs text-gray-400 ml-1">
                          Stock: {formatNumber(mat.current_stock || 0)} {mat.unit}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="label">BOM Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field resize-none"
                rows={2}
                placeholder="Optional notes about this BOM…"
              />
            </div>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="col-span-2 space-y-4">
          <Card className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Material Preview
            </p>
            <div className="mb-3">
              <label className="label">Production Quantity</label>
              <input
                type="number"
                value={previewQty}
                onChange={(e) => setPreviewQty(e.target.value)}
                className="input-field"
                min="1"
                placeholder="100"
              />
              <p className="text-xs text-gray-400 mt-1">Enter qty to preview required materials</p>
            </div>

            {previewQtyNum > 0 && previewItems.length > 0 ? (
              <div className="space-y-2">
                {previewItems.map((pi, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2.5 border text-xs ${
                      pi.short
                        ? 'border-red-200 bg-red-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800">{pi.name}</span>
                      {pi.short ? (
                        <AlertCircle size={12} className="text-red-500" />
                      ) : (
                        <CheckCircle size={12} className="text-green-500" />
                      )}
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Required</span>
                      <span className="font-medium text-gray-800">{formatNumber(pi.required)} {pi.unit}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Available</span>
                      <span className={`font-medium ${pi.short ? 'text-red-600' : 'text-green-700'}`}>
                        {formatNumber(pi.available)} {pi.unit}
                      </span>
                    </div>
                    {pi.short && (
                      <div className="mt-1 text-red-600 font-medium">
                        Short by {formatNumber(pi.shortage)} {pi.unit}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">
                Add materials and set a quantity to see the preview
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BOMBuilder;
