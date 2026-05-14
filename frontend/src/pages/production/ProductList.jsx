import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Package, Pencil, Trash2, BookOpen, X,
  CheckCircle, AlertTriangle, XCircle, BarChart2, ChevronDown,
  ChevronRight, Factory, Eye, RefreshCw, Boxes,
  Clock, MoreVertical, Power, PlayCircle, TrendingUp, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, isValid } from 'date-fns';
import { productAPI, variantAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

// ─── Constants ────────────────────────────────────────────────────────────────
const LOW = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const stockLevel = (stock, producedQty) => {
  if (Number(producedQty) === 0) return 'na';
  if (Number(stock) <= 0) return 'out';
  if (Number(stock) <= LOW) return 'low';
  return 'ok';
};

const LEVEL = {
  ok:  { dot: 'bg-emerald-500', text: 'text-emerald-700', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200'  },
  low: { dot: 'bg-amber-500',   text: 'text-amber-700',   pill: 'bg-amber-50 text-amber-700 border-amber-200'        },
  out: { dot: 'bg-red-500',     text: 'text-red-600',     pill: 'bg-red-50 text-red-600 border-red-200'              },
  na:  { dot: 'bg-gray-200',    text: 'text-gray-400',    pill: 'bg-gray-50 text-gray-400 border-gray-100'           },
};

const fmt = (n, unit = '') =>
  n == null ? '—' : `${Number(n).toLocaleString('en-IN')}${unit ? ' ' + unit : ''}`;

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isValid(dt) ? format(dt, 'dd MMM yyyy') : '—';
};

const fmtDateShort = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (!isValid(dt)) return '—';
  const diffDays = Math.floor((Date.now() - dt.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  return format(dt, 'dd MMM');
};

// ─── Stock dot ────────────────────────────────────────────────────────────────
const StockDot = ({ level }) => (
  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${LEVEL[level].dot}`} />
);

// ─── Summary card ─────────────────────────────────────────────────────────────
const SummaryCard = ({ icon: Icon, label, value, sub, iconBg }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 min-w-0">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <Icon size={17} className="text-white" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide truncate">{label}</p>
      <p className="text-xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
      {sub != null && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  </div>
);

// ─── 3-dot Actions dropdown ───────────────────────────────────────────────────
const ActionsMenu = ({ product, onView, onEdit, onBOM, onVariants, onCreatePO, onToggleActive, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [open]);

  const action = (fn) => { setOpen(false); fn(); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        aria-label="Product actions"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-100 rounded-xl shadow-lg z-[101] py-1 overflow-hidden">
            <MenuItem icon={Eye}        label="View History"            onClick={() => action(onView)} />
            <MenuItem icon={Pencil}     label="Edit Product"            onClick={() => action(onEdit)} />
            <MenuItem icon={BookOpen}   label="Manage BOM"              onClick={() => action(onBOM)} />
            {product.has_variants && (
              <MenuItem icon={Layers}   label="Manage Variants"         onClick={() => action(onVariants)} />
            )}
            <MenuItem icon={PlayCircle} label="Create Production Order" onClick={() => action(onCreatePO)} />
            <div className="border-t border-gray-100 my-1" />
            <MenuItem
              icon={Power}
              label={product.is_active ? 'Deactivate' : 'Activate'}
              onClick={() => action(onToggleActive)}
              className={product.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}
            />
            <MenuItem icon={Trash2} label="Delete Product" onClick={() => action(onDelete)} danger />
          </div>
        </>
      )}
    </div>
  );
};

const MenuItem = ({ icon: Icon, label, onClick, danger, className }) => (
  <button
    onClick={onClick}
    className={clsx(
      'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
      danger
        ? 'text-red-600 hover:bg-red-50'
        : className || 'text-gray-700 hover:bg-gray-50'
    )}
  >
    <Icon size={13} className="flex-shrink-0 opacity-70" />
    {label}
  </button>
);

// ─── Analytics section ─────────────────────────────────────────────────────────
const AnalyticsSection = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['product-analytics'],
    queryFn: productAPI.getAnalytics,
    staleTime: 5 * 60_000,
  });

  const analytics  = data?.data;
  const dailyData  = (analytics?.daily || []).map((r) => ({ date: r.date, qty: Number(r.quantity), label: fmtDate(r.date).slice(0, 6) }));
  const topProducts = analytics?.topProducts || [];
  const maxTop = topProducts.length > 0 ? Math.max(...topProducts.map((p) => Number(p.total_produced))) : 1;

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-4 h-44 animate-pulse" />)}
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 col-span-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Daily Production — Last 30 Days</p>
          {dailyData.length > 0 && (
            <span className="text-[11px] text-gray-400">Total: {fmt(dailyData.reduce((s, d) => s + d.qty, 0))}</span>
          )}
        </div>
        {dailyData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-gray-300">No production data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={dailyData} barSize={6} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [fmt(v), 'Produced']} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="qty" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Top Products by Output</p>
        {topProducts.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-gray-300">No data yet</div>
        ) : (
          <div className="space-y-2.5">
            {topProducts.map((p, i) => {
              const pct = Math.round((Number(p.total_produced) / maxTop) * 100);
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium text-gray-700 truncate max-w-[130px]">
                      <span className="text-gray-300 mr-1">#{i + 1}</span>{p.name}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-600 tabular-nums">{fmt(p.total_produced)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Production History Modal ──────────────────────────────────────────────────
const ProductHistoryModal = ({ product, onClose }) => {
  const [expandedId, setExpandedId] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['product-history', product.id],
    queryFn: () => productAPI.getHistory(product.id),
    staleTime: 60_000,
  });
  const history = data?.data || [];
  const toggle  = useCallback((id) => setExpandedId((p) => (p === id ? null : id)), []);
  const level   = stockLevel(product.current_stock, product.produced_qty);

  return (
    <Modal isOpen onClose={onClose} title="" size="xl">
      <div className="space-y-4 -mt-2">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-gray-900">{product.name}</p>
                {product.code && (
                  <span className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-mono">{product.code}</span>
                )}
                <Badge variant={product.is_active ? 'success' : 'default'}>{product.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{product.category && <span>{product.category} · </span>}Unit: <strong>{product.unit}</strong></p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Stock</p>
              <p className={`text-lg font-bold ${LEVEL[level].text}`}>{fmt(product.current_stock, product.unit)}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-indigo-100">
            {[
              { label: 'Total Produced', value: fmt(product.produced_qty, product.unit) },
              { label: 'Available',      value: fmt(product.available_stock, product.unit) },
              { label: 'Reserved',       value: fmt(product.reserved_stock, product.unit) },
            ].map((m) => (
              <div key={m.label} className="bg-white/60 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{m.label}</p>
                <p className="text-sm font-bold text-gray-800">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Production Orders <span className="font-normal text-gray-400">(last 20)</span></p>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center gap-2 text-gray-400">
              <Factory size={30} className="opacity-25" />
              <p className="text-sm">No production orders for this product yet</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[620px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-gray-500">
                      <th className="w-8 px-3 py-2.5" />
                      <th className="px-3 py-2.5">Order</th>
                      <th className="px-3 py-2.5 text-right">Planned</th>
                      <th className="px-3 py-2.5 text-right">Produced</th>
                      <th className="px-3 py-2.5 text-right">Rejected</th>
                      <th className="px-3 py-2.5">Completed</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {history.map((o) => {
                      const isExpanded = expandedId === o.id;
                      const hasMats    = o.materials_consumed?.length > 0;
                      const yieldPct   = Number(o.planned_quantity) > 0 ? ((Number(o.produced_quantity) / Number(o.planned_quantity)) * 100).toFixed(1) : null;
                      return (
                        <Fragment key={o.id}>
                          <tr className={`hover:bg-gray-50 transition-colors ${hasMats ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-indigo-50/60' : ''}`} onClick={() => hasMats && toggle(o.id)}>
                            <td className="px-3 py-2.5 text-gray-300">
                              {hasMats && (isExpanded ? <ChevronDown size={12} className="text-indigo-500" /> : <ChevronRight size={12} />)}
                            </td>
                            <td className="px-3 py-2.5 font-mono font-medium text-gray-800">{o.order_number}</td>
                            <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums">{fmt(o.planned_quantity)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              <span className="font-bold text-emerald-700">{fmt(o.produced_quantity)}</span>
                              {yieldPct && <span className={`ml-1 text-[10px] ${parseFloat(yieldPct) >= 90 ? 'text-emerald-500' : 'text-amber-500'}`}>{yieldPct}%</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {Number(o.rejected_quantity) > 0 ? <span className="text-red-500 font-medium">{fmt(o.rejected_quantity)}</span> : <span className="text-gray-200">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">{fmtDate(o.actual_end_date)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full font-medium capitalize text-[10px] ${
                                o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                o.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                o.status === 'cancelled'   ? 'bg-gray-100 text-gray-500' :
                                o.status === 'on_hold'     ? 'bg-orange-100 text-orange-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>{o.status.replace(/_/g, ' ')}</span>
                            </td>
                          </tr>
                          {isExpanded && hasMats && (
                            <tr>
                              <td colSpan={7} className="bg-indigo-50/40 px-6 py-3 border-t border-indigo-100">
                                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">Materials Consumed</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  {o.materials_consumed.map((mat, i) => (
                                    <div key={i} className="bg-white rounded-lg px-3 py-2 border border-indigo-100 shadow-sm">
                                      <p className="font-semibold text-gray-700 text-[11px] truncate">{mat.name}</p>
                                      {mat.code && <p className="text-gray-400 text-[10px] font-mono">{mat.code}</p>}
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-gray-400 text-[10px]">Plan: {fmt(mat.planned)} {mat.unit}</span>
                                        <span className="text-gray-200">·</span>
                                        <span className="text-emerald-600 text-[10px] font-medium">Used: {fmt(mat.actual)} {mat.unit}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ─── Delete confirm dialog ─────────────────────────────────────────────────────
const DeleteDialog = ({ product, onCancel, onConfirm, loading }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
          <Trash2 size={16} className="text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Delete Product?</h3>
          <p className="text-xs text-gray-400">{product.name}</p>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-5">This removes the product and its BOM permanently. Existing production orders are unaffected.</p>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>Delete</Button>
      </div>
    </div>
  </div>
);

// ─── Mobile Product Card ───────────────────────────────────────────────────────
const MobileProductCard = ({ product, onView, onEdit, onBOM, onVariants, onCreatePO, onToggleActive, onDelete }) => {
  const level  = stockLevel(product.current_stock, product.produced_qty);
  const lvlCfg = LEVEL[level];
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`w-1.5 h-10 rounded-full flex-shrink-0 mt-0.5 ${lvlCfg.dot}`} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{product.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {product.code && <span className="text-[10px] font-mono text-gray-400">{product.code}</span>}
              {product.category && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{product.category}</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${product.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                {product.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
        <ActionsMenu product={product} onView={onView} onEdit={onEdit} onBOM={onBOM} onCreatePO={onCreatePO} onToggleActive={onToggleActive} onDelete={onDelete} />
      </div>

      {/* Stock grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Stock',     value: level !== 'na' ? fmt(product.current_stock) : '—', color: lvlCfg.text },
          { label: 'Available', value: level !== 'na' ? fmt(product.available_stock) : '—', color: 'text-gray-700' },
          { label: 'Reserved',  value: Number(product.reserved_stock) > 0 ? fmt(product.reserved_stock) : '—', color: 'text-amber-700' },
        ].map((m) => (
          <div key={m.label} className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">{m.label}</p>
            <p className={`text-sm font-bold tabular-nums ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {product.last_production_date ? (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {fmtDateShort(product.last_production_date)}
            </span>
          ) : (
            <span>Never produced</span>
          )}
          <span>·</span>
          <span>Total: {fmt(product.produced_qty)} {product.unit}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {product.has_variants && (
            <button
              onClick={onVariants}
              className="text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md"
            >
              <Layers size={9} className="inline mr-0.5" />
              {Number(product.variant_count) > 0 ? `${product.variant_count} Variants` : 'Variants'}
            </button>
          )}
          {product.bom_id ? (
            <button onClick={onBOM} className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
              <CheckCircle size={9} className="inline mr-0.5" />{product.bom_item_count} BOM
            </button>
          ) : (
            <button onClick={onBOM} className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
              <XCircle size={9} className="inline mr-0.5" />No BOM
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Skeleton rows ─────────────────────────────────────────────────────────────
const TableSkeleton = () => (
  <div className="divide-y divide-gray-50">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
        <div className="w-1.5 h-8 bg-gray-100 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-gray-100 rounded w-36" />
          <div className="h-2.5 bg-gray-100 rounded w-20" />
        </div>
        <div className="h-3 bg-gray-100 rounded w-16" />
        <div className="h-3 bg-gray-100 rounded w-16" />
        <div className="h-3 bg-gray-100 rounded w-16" />
        <div className="h-3 bg-gray-100 rounded w-20" />
        <div className="h-6 bg-gray-100 rounded-full w-16" />
        <div className="h-6 bg-gray-100 rounded-full w-16" />
        <div className="h-6 bg-gray-100 rounded w-8" />
      </div>
    ))}
  </div>
);

// ─── Filter options ────────────────────────────────────────────────────────────
const STOCK_FILTERS = [
  { value: '',        label: 'All Stock' },
  { value: 'healthy', label: '● Healthy' },
  { value: 'low',     label: '● Low Stock' },
  { value: 'out',     label: '● Out of Stock' },
];

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const ProductList = () => {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebounced]       = useState('');
  const [category,        setCategory]        = useState('');
  const [stockStatus,     setStockStatus]     = useState('');
  const [isActive,        setIsActive]        = useState('');
  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const [historyProduct,  setHistoryProduct]  = useState(null);
  const [showAnalytics,   setShowAnalytics]   = useState(false);
  const [expandedVariantId, setExpandedVariantId] = useState(null); // productId whose variants are open

  // Lazy-load variants for the expanded product row
  const { data: expandedVariantsData, isLoading: variantsLoading } = useQuery({
    queryKey: ['variants', expandedVariantId],
    queryFn:  () => variantAPI.getVariants(expandedVariantId),
    enabled:  Boolean(expandedVariantId),
    staleTime: 30_000,
  });
  const expandedVariants = expandedVariantsData?.data || [];

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filters = {
    search:      debouncedSearch || undefined,
    category:    category || undefined,
    isActive:    isActive !== '' ? isActive : undefined,
    stockStatus: stockStatus || undefined,
    limit: 200,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['products', filters],
    queryFn:  () => productAPI.getAll(filters),
    staleTime: 30_000,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['products-summary'],
    queryFn:  productAPI.getSummary,
    staleTime: 60_000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn:  productAPI.getCategories,
    staleTime: 5 * 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => productAPI.delete(id),
    onSuccess: () => {
      toast.success('Product deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-summary'] });
    },
    onError: (err) => toast.error(err?.message || 'Delete failed'),
  });

  // Toggle active/inactive
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => productAPI.update(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? 'Product activated' : 'Product deactivated');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-summary'] });
    },
    onError: (err) => toast.error(err?.message || 'Failed to update status'),
  });

  const products   = data?.data || [];
  const summary    = summaryData?.data || {};
  const categories = categoriesData?.data || [];

  const hasFilters = debouncedSearch || category || stockStatus || isActive;
  const clearFilters = () => { setSearch(''); setCategory(''); setStockStatus(''); setIsActive(''); };

  // ── Action handlers (shared by desktop table and mobile cards) ───────────────
  const handlers = (p) => ({
    onView:         () => setHistoryProduct(p),
    onEdit:         () => navigate(`/production/products/${p.id}/edit`),
    onBOM:          () => navigate(`/production/products/${p.id}/bom`),
    onVariants:     () => navigate(`/production/products/${p.id}/variants`),
    onCreatePO:     () => navigate(`/production/create?productId=${p.id}`),
    onToggleActive: () => toggleActiveMutation.mutate({ id: p.id, isActive: !p.is_active }),
    onDelete:       () => setDeleteTarget(p),
  });

  const toggleVariantExpand = (productId) =>
    setExpandedVariantId((prev) => (prev === productId ? null : productId));

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Product Master</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {summary.total_products ?? '—'} products · {summary.active_products ?? '—'} active · {summary.products_with_bom ?? '—'} with BOM
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Refresh">
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <Button variant="secondary" icon={BarChart2} onClick={() => setShowAnalytics((v) => !v)}>
            {showAnalytics ? 'Hide Analytics' : 'Analytics'}
          </Button>
          <Button icon={Plus} onClick={() => navigate('/production/products/new')}>New Product</Button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={Boxes}         label="Total Products"    value={summary.total_products}  sub={`${summary.active_products ?? 0} active`}          iconBg="bg-indigo-500" />
        <SummaryCard icon={Factory}       label="Produced Today"    value={fmt(summary.produced_today)} sub="units"                                          iconBg="bg-emerald-500" />
        <SummaryCard icon={AlertTriangle} label="Low / Out"         value={`${summary.low_stock ?? 0} / ${summary.out_of_stock ?? 0}`} sub="needs attention" iconBg={summary.out_of_stock > 0 ? 'bg-red-500' : summary.low_stock > 0 ? 'bg-amber-500' : 'bg-gray-400'} />
        <SummaryCard icon={CheckCircle}   label="BOM Coverage"      value={summary.products_with_bom} sub={`${Math.round(((summary.products_with_bom || 0) / (summary.total_products || 1)) * 100)}% of products`} iconBg="bg-blue-500" />
      </div>

      {/* ── Analytics panel ── */}
      {showAnalytics && <AnalyticsSection />}

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            className="w-full text-sm pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 placeholder-gray-400 transition"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-[140px]">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} className={`text-sm px-3 py-2 rounded-lg border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-[140px] ${stockStatus === 'out' ? 'border-red-300 text-red-700' : stockStatus === 'low' ? 'border-amber-300 text-amber-700' : stockStatus === 'healthy' ? 'border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-700'}`}>
          {STOCK_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={isActive} onChange={(e) => setIsActive(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-[120px]">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors">
            <X size={12} /> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 font-medium tabular-nums">
          {isLoading ? '…' : `${products.length} result${products.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Mobile cards (sm and below) ── */}
      <div className="block sm:hidden space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-32 animate-pulse" />)
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-14 flex flex-col items-center gap-3 text-gray-400">
            <Package size={32} className="opacity-20" />
            <p className="text-sm">{hasFilters ? 'No products match your filters.' : 'No products yet.'}</p>
            {hasFilters
              ? <button onClick={clearFilters} className="text-xs text-indigo-500 hover:underline">Clear filters</button>
              : <Button icon={Plus} onClick={() => navigate('/production/products/new')}>New Product</Button>
            }
          </div>
        ) : (
          products.map((p) => <MobileProductCard key={p.id} product={p} {...handlers(p)} />)
        )}
      </div>

      {/* ── Desktop table (hidden on mobile) ── */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? <TableSkeleton /> : products.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <Package size={36} className="opacity-20" />
            <p className="text-sm">{hasFilters ? 'No products match your filters.' : 'No products yet. Create your first product to get started.'}</p>
            {hasFilters
              ? <button onClick={clearFilters} className="text-xs text-indigo-500 hover:underline">Clear filters</button>
              : <Button icon={Plus} onClick={() => navigate('/production/products/new')}>New Product</Button>
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead className="bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10">
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Unit</th>
                  <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Available</th>
                  <th className="px-4 py-3 text-right font-semibold">Reserved</th>
                  <th className="px-4 py-3 text-right font-semibold">Produced</th>
                  <th className="px-4 py-3 font-semibold">Last Production</th>
                  <th className="px-4 py-3 font-semibold">BOM</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => {
                  const level       = stockLevel(p.current_stock, p.produced_qty);
                  const lvlCfg      = LEVEL[level];
                  const h           = handlers(p);
                  const isExpanded  = expandedVariantId === p.id;

                  return (
                    <Fragment key={p.id}>
                    <tr className={clsx(
                      'hover:bg-gray-50/80 transition-colors group',
                      isExpanded && 'bg-indigo-50/40'
                    )}>
                      {/* Product name + code */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${lvlCfg.dot}`} />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-900 text-[13px] leading-tight">{p.name}</p>
                              {p.has_variants && Number(p.variant_count) > 0 && (
                                <button
                                  onClick={() => toggleVariantExpand(p.id)}
                                  className={clsx(
                                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors',
                                    isExpanded
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                                  )}
                                >
                                  <Layers size={9} />
                                  {p.variant_count} variant{p.variant_count !== 1 ? 's' : ''}
                                  {isExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                                </button>
                              )}
                              {p.has_variants && Number(p.variant_count) === 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                                  <Layers size={9} /> No variants
                                </span>
                              )}
                            </div>
                            {p.code && <p className="text-[11px] text-gray-400 font-mono mt-0.5">{p.code}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        {p.category
                          ? <span className="inline-flex px-2 py-0.5 text-[11px] bg-gray-100 text-gray-600 rounded font-medium">{p.category}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-3.5 text-xs text-gray-500 font-medium">{p.unit}</td>

                      {/* Current stock */}
                      <td className="px-4 py-3.5 text-right">
                        {level !== 'na' ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-semibold tabular-nums ${lvlCfg.pill}`}>
                            <StockDot level={level} />{fmt(p.current_stock)}
                          </span>
                        ) : <span className="text-[11px] text-gray-300">—</span>}
                      </td>

                      {/* Available */}
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {level !== 'na'
                          ? <span className={`text-xs font-semibold ${lvlCfg.text}`}>{fmt(p.available_stock)}</span>
                          : <span className="text-[11px] text-gray-300">—</span>}
                      </td>

                      {/* Reserved */}
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {Number(p.reserved_stock) > 0
                          ? <span className="text-xs text-amber-700 font-semibold">{fmt(p.reserved_stock)}</span>
                          : <span className="text-[11px] text-gray-300">—</span>}
                      </td>

                      {/* Produced lifetime */}
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {Number(p.produced_qty) > 0
                          ? <span className="text-xs font-semibold text-gray-700">{fmt(p.produced_qty)}</span>
                          : <span className="text-[11px] text-gray-300">—</span>}
                      </td>

                      {/* Last production */}
                      <td className="px-4 py-3.5">
                        {p.last_production_date ? (
                          <span className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Clock size={10} className="text-gray-300" />{fmtDateShort(p.last_production_date)}
                          </span>
                        ) : <span className="text-[11px] text-gray-300">Never</span>}
                      </td>

                      {/* BOM */}
                      <td className="px-4 py-3.5">
                        {p.bom_id ? (
                          <button onClick={h.onBOM} className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors">
                            <CheckCircle size={10} />{p.bom_item_count} mat.
                          </button>
                        ) : (
                          <button onClick={h.onBOM} className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md hover:bg-amber-100 transition-colors">
                            <XCircle size={10} />No BOM
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${p.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions — 3-dot dropdown, always visible */}
                      <td className="px-4 py-3.5 text-right">
                        <ActionsMenu product={p} {...h} />
                      </td>
                    </tr>

                    {/* ── Expandable variant panel ── */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={11} className="bg-indigo-50/60 border-b border-indigo-100 px-6 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                              <Layers size={11} /> Variants — {p.name}
                            </p>
                            <button
                              onClick={() => navigate(`/production/products/${p.id}/variants`)}
                              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              Manage variants →
                            </button>
                          </div>

                          {variantsLoading ? (
                            <div className="grid grid-cols-4 gap-2">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-16 bg-white/70 rounded-lg animate-pulse" />
                              ))}
                            </div>
                          ) : expandedVariants.length === 0 ? (
                            <div className="text-center py-4 text-xs text-indigo-400">
                              No variants yet.{' '}
                              <button
                                onClick={() => navigate(`/production/products/${p.id}/variants`)}
                                className="underline font-medium"
                              >
                                Add variants →
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                              {expandedVariants.map((v) => {
                                const attrPairs = (v.attribute_values || []).map(
                                  (av) => av.display_name || av.value
                                ).join(' / ');
                                const totalStock = Number(v.current_stock || 0);
                                return (
                                  <div
                                    key={v.id}
                                    className={clsx(
                                      'bg-white rounded-lg border px-3 py-2.5 text-xs',
                                      v.is_active ? 'border-indigo-100' : 'border-red-100 opacity-60'
                                    )}
                                  >
                                    <p className="font-mono font-semibold text-gray-800 text-[11px] truncate">{v.sku}</p>
                                    {attrPairs && (
                                      <p className="text-[10px] text-indigo-600 mt-0.5 truncate">{attrPairs}</p>
                                    )}
                                    <div className="flex items-center justify-between mt-1.5">
                                      <span className="text-gray-400 text-[10px]">Stock</span>
                                      <span className={clsx(
                                        'font-bold tabular-nums text-[11px]',
                                        totalStock <= 0 ? 'text-red-500' : totalStock <= 20 ? 'text-amber-600' : 'text-emerald-700'
                                      )}>
                                        {totalStock.toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {historyProduct && <ProductHistoryModal product={historyProduct} onClose={() => setHistoryProduct(null)} />}

      {deleteTarget && (
        <DeleteDialog
          product={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        />
      )}
    </div>
  );
};

export default ProductList;
