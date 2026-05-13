import { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Package, Pencil, Trash2, BookOpen, X,
  CheckCircle, AlertTriangle, XCircle, BarChart2, ChevronDown,
  ChevronRight, Factory, Eye, RefreshCw, TrendingUp, Boxes,
  Filter, ArrowUpRight, Clock, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, isValid } from 'date-fns';
import { productAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const LOW = 100; // pairs below this = "low stock"

// ─── Stock helpers ─────────────────────────────────────────────────────────────
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

// ─── Sub-components (defined outside to avoid re-creation on parent render) ───

const StockDot = ({ level }) => (
  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${LEVEL[level].dot}`} />
);

const StockCell = ({ value, unit, level }) => {
  if (level === 'na') return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums ${LEVEL[level].text}`}>
      <StockDot level={level} />
      {fmt(value, unit)}
    </span>
  );
};

// ─── Summary cards ─────────────────────────────────────────────────────────────
const SummaryCard = ({ icon: Icon, label, value, sub, iconBg, trend }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 min-w-0">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <Icon size={17} className="text-white" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide truncate">{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
      {sub != null && (
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>
      )}
    </div>
    {trend != null && (
      <ArrowUpRight size={14} className={trend >= 0 ? 'text-emerald-500' : 'text-red-400'} />
    )}
  </div>
);

// ─── Analytics section ─────────────────────────────────────────────────────────
const AnalyticsSection = ({ companyId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['product-analytics'],
    queryFn: productAPI.getAnalytics,
    staleTime: 5 * 60_000,
  });

  const analytics = data?.data;

  const dailyData = (analytics?.daily || []).map((r) => ({
    date: r.date,
    qty:  Number(r.quantity),
    label: fmtDate(r.date).slice(0, 6),
  }));

  const monthlyData = (analytics?.monthly || []).map((r) => ({
    month: r.month_start,
    qty:   Number(r.quantity),
    label: format(new Date(r.month_start), 'MMM yy'),
  }));

  const topProducts = analytics?.topProducts || [];

  const maxTop = topProducts.length > 0
    ? Math.max(...topProducts.map((p) => Number(p.total_produced)))
    : 1;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-4 h-44 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Daily production — last 30 days */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 col-span-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Daily Production — Last 30 Days</p>
          {dailyData.length > 0 && (
            <span className="text-[11px] text-gray-400">
              Total: {fmt(dailyData.reduce((s, d) => s + d.qty, 0))} pairs
            </span>
          )}
        </div>
        {dailyData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-gray-300">No production data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={dailyData} barSize={6} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
                formatter={(v) => [fmt(v, 'pairs'), 'Produced']}
                labelFormatter={(l) => `Date: ${l}`}
                cursor={{ fill: '#f9fafb' }}
              />
              <Bar dataKey="qty" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top 5 products */}
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
                      <span className="text-gray-300 mr-1">#{i + 1}</span> {p.name}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-600 tabular-nums">
                      {fmt(p.total_produced)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
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

  const toggle = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const level = stockLevel(product.current_stock, product.produced_qty);

  return (
    <Modal isOpen onClose={onClose} title="" size="xl">
      {/* Custom header inside body */}
      <div className="space-y-4 -mt-2">
        {/* Product identity strip */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-gray-900">{product.name}</p>
                {product.code && (
                  <span className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-mono">
                    {product.code}
                  </span>
                )}
                <Badge variant={product.is_active ? 'success' : 'default'}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {product.category && <span>{product.category} · </span>}
                Unit: <strong>{product.unit}</strong>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Current Stock</p>
              <p className={`text-lg font-bold ${LEVEL[level].text}`}>
                {fmt(product.current_stock, product.unit)}
              </p>
            </div>
          </div>

          {/* Stock metric row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-indigo-100">
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

        {/* History table */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Production Orders <span className="font-normal text-gray-400">(last 20)</span>
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center gap-2 text-gray-400">
              <Factory size={30} className="opacity-25" />
              <p className="text-sm">No production orders for this product yet</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-gray-500">
                    <th className="w-8 px-3 py-2.5" />
                    <th className="px-3 py-2.5">Order</th>
                    <th className="px-3 py-2.5 text-right">Planned</th>
                    <th className="px-3 py-2.5 text-right">Produced</th>
                    <th className="px-3 py-2.5 text-right">Rejected</th>
                    <th className="px-3 py-2.5">Completed</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.map((o) => {
                    const isExpanded = expandedId === o.id;
                    const hasMats = o.materials_consumed?.length > 0;
                    const yieldPct = Number(o.planned_quantity) > 0
                      ? ((Number(o.produced_quantity) / Number(o.planned_quantity)) * 100).toFixed(1)
                      : null;

                    return (
                      <Fragment key={o.id}>
                        <tr
                          className={`hover:bg-gray-50 transition-colors ${
                            hasMats ? 'cursor-pointer' : ''
                          } ${isExpanded ? 'bg-indigo-50/60' : ''}`}
                          onClick={() => hasMats && toggle(o.id)}
                        >
                          <td className="px-3 py-2.5 text-gray-300">
                            {hasMats && (
                              isExpanded
                                ? <ChevronDown size={12} className="text-indigo-500" />
                                : <ChevronRight size={12} />
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-medium text-gray-800">
                            {o.order_number}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums">
                            {fmt(o.planned_quantity)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className="font-bold text-emerald-700">{fmt(o.produced_quantity)}</span>
                            {yieldPct && (
                              <span className={`ml-1 text-[10px] ${parseFloat(yieldPct) >= 90 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {yieldPct}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {Number(o.rejected_quantity) > 0
                              ? <span className="text-red-500 font-medium">{fmt(o.rejected_quantity)}</span>
                              : <span className="text-gray-200">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500">{fmtDate(o.actual_end_date)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full font-medium capitalize ${
                              o.status === 'completed'  ? 'bg-emerald-100 text-emerald-700' :
                              o.status === 'in_progress'? 'bg-blue-100 text-blue-700'     :
                              o.status === 'cancelled'  ? 'bg-gray-100 text-gray-500'     :
                              o.status === 'on_hold'    ? 'bg-orange-100 text-orange-700' :
                                                          'bg-amber-100 text-amber-700'
                            }`}>
                              {o.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 max-w-[90px] truncate">
                            {o.created_by_name || '—'}
                          </td>
                        </tr>

                        {/* Expanded materials row */}
                        {isExpanded && hasMats && (
                          <tr>
                            <td colSpan={8} className="bg-indigo-50/40 px-6 py-3 border-t border-indigo-100">
                              <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                                Materials Consumed
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {o.materials_consumed.map((mat, i) => (
                                  <div key={i} className="bg-white rounded-lg px-3 py-2 border border-indigo-100 shadow-sm">
                                    <p className="font-semibold text-gray-700 text-[11px] truncate">{mat.name}</p>
                                    {mat.code && (
                                      <p className="text-gray-400 text-[10px] font-mono">{mat.code}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-gray-400 text-[10px]">
                                        Plan: {fmt(mat.planned)} {mat.unit}
                                      </span>
                                      <span className="text-gray-200">·</span>
                                      <span className="text-emerald-600 text-[10px] font-medium">
                                        Used: {fmt(mat.actual)} {mat.unit}
                                      </span>
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
          )}
        </div>
      </div>
    </Modal>
  );
};

// ─── Delete confirm dialog ─────────────────────────────────────────────────────
const DeleteDialog = ({ product, onCancel, onConfirm, loading }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
      <p className="text-sm text-gray-500 mb-5">
        This removes the product and its BOM permanently. Existing production orders are unaffected.
      </p>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>Delete</Button>
      </div>
    </div>
  </div>
);

// ─── STOCK STATUS FILTER options ───────────────────────────────────────────────
const STOCK_FILTERS = [
  { value: '',        label: 'All Stock' },
  { value: 'healthy', label: '● Healthy' },
  { value: 'low',     label: '● Low Stock' },
  { value: 'out',     label: '● Out of Stock' },
];

// ─── Main component ────────────────────────────────────────────────────────────
const ProductList = () => {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [search,      setSearch]      = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [category,    setCategory]    = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [isActive,    setIsActive]    = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [showAnalytics,  setShowAnalytics]  = useState(false);

  // Debounce search by 350 ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filters = {
    search: debouncedSearch || undefined,
    category: category || undefined,
    isActive: isActive !== '' ? isActive : undefined,
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

  const products   = data?.data || [];
  const summary    = summaryData?.data || {};
  const categories = categoriesData?.data || [];

  const activeFilters = [category, stockStatus, isActive].filter(Boolean).length;
  const hasFilters = debouncedSearch || activeFilters > 0;

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setStockStatus('');
    setIsActive('');
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Product Master</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {summary.total_products ?? '—'} products ·{' '}
            {summary.active_products ?? '—'} active ·{' '}
            {summary.products_with_bom ?? '—'} with BOM
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <Button
            variant="secondary"
            icon={BarChart2}
            onClick={() => setShowAnalytics((v) => !v)}
          >
            {showAnalytics ? 'Hide Analytics' : 'Analytics'}
          </Button>
          <Button icon={Plus} onClick={() => navigate('/production/products/new')}>
            New Product
          </Button>
        </div>
      </div>

      {/* ── Summary cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={Boxes}
          label="Total Products"
          value={summary.total_products}
          sub={`${summary.active_products ?? 0} active`}
          iconBg="bg-indigo-500"
        />
        <SummaryCard
          icon={Factory}
          label="Produced Today"
          value={fmt(summary.produced_today)}
          sub="pairs"
          iconBg="bg-emerald-500"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Low / Out of Stock"
          value={`${summary.low_stock ?? 0} / ${summary.out_of_stock ?? 0}`}
          sub={summary.low_stock > 0 || summary.out_of_stock > 0 ? 'needs attention' : 'all good'}
          iconBg={
            summary.out_of_stock > 0 ? 'bg-red-500' :
            summary.low_stock > 0    ? 'bg-amber-500' : 'bg-gray-400'
          }
        />
        <SummaryCard
          icon={CheckCircle}
          label="Active BOM Products"
          value={summary.products_with_bom}
          sub={`${Math.round(((summary.products_with_bom || 0) / (summary.total_products || 1)) * 100)}% coverage`}
          iconBg="bg-blue-500"
        />
      </div>

      {/* ── Analytics panel (toggleable) ────────────────────────────────── */}
      {showAnalytics && <AnalyticsSection />}

      {/* ── Filters bar ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            className="w-full text-sm pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 placeholder-gray-400 transition"
          />
        </div>

        {/* Category */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-[140px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Stock status */}
        <select
          value={stockStatus}
          onChange={(e) => setStockStatus(e.target.value)}
          className={`text-sm px-3 py-2 rounded-lg border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-[140px] ${
            stockStatus === 'out' ? 'border-red-300 text-red-700' :
            stockStatus === 'low' ? 'border-amber-300 text-amber-700' :
            stockStatus === 'healthy' ? 'border-emerald-300 text-emerald-700' :
            'border-gray-200 text-gray-700'
          }`}
        >
          {STOCK_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Active / Inactive */}
        <select
          value={isActive}
          onChange={(e) => setIsActive(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-[120px]"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}

        {/* Result count */}
        <span className="ml-auto text-xs text-gray-400 font-medium tabular-nums">
          {isLoading ? '…' : `${products.length} result${products.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Product table ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-20" />
                <div className="h-3 bg-gray-100 rounded w-16 ml-auto" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <Package size={36} className="opacity-20" />
            <p className="text-sm">
              {hasFilters ? 'No products match your filters.' : 'No products yet. Create your first product to get started.'}
            </p>
            {hasFilters ? (
              <button onClick={clearFilters} className="text-xs text-indigo-500 hover:underline">Clear filters</button>
            ) : (
              <Button icon={Plus} onClick={() => navigate('/production/products/new')}>New Product</Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10">
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Unit</th>
                  <th className="px-4 py-3 text-right font-semibold">Current Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Produced</th>
                  <th className="px-4 py-3 text-right font-semibold">Available</th>
                  <th className="px-4 py-3 text-right font-semibold">Reserved</th>
                  <th className="px-4 py-3 font-semibold">Last Production</th>
                  <th className="px-4 py-3 font-semibold">BOM</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => {
                  const level  = stockLevel(p.current_stock, p.produced_qty);
                  const lvlCfg = LEVEL[level];

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50/80 transition-colors group"
                    >
                      {/* Product name + code */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${lvlCfg.dot}`} />
                          <div>
                            <p className="font-semibold text-gray-900 text-[13px] leading-tight">
                              {p.name}
                            </p>
                            {p.code && (
                              <p className="text-[11px] text-gray-400 font-mono mt-0.5">{p.code}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 text-sm text-gray-500">
                        {p.category
                          ? <span className="inline-flex px-2 py-0.5 text-[11px] bg-gray-100 text-gray-600 rounded font-medium">{p.category}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-3.5 text-xs text-gray-500 font-medium">{p.unit}</td>

                      {/* Current Stock */}
                      <td className="px-4 py-3.5 text-right">
                        {level !== 'na' ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-semibold tabular-nums ${lvlCfg.pill}`}>
                            <StockDot level={level} />
                            {fmt(p.current_stock)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
                        )}
                      </td>

                      {/* Produced (lifetime) */}
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {Number(p.produced_qty) > 0 ? (
                          <span className="text-xs font-semibold text-gray-700">
                            {fmt(p.produced_qty)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
                        )}
                      </td>

                      {/* Available */}
                      <td className="px-4 py-3.5 text-right">
                        <StockCell value={p.available_stock} unit="" level={level} />
                      </td>

                      {/* Reserved */}
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {level !== 'na' && Number(p.reserved_stock) > 0 ? (
                          <span className="text-xs text-amber-700 font-semibold">
                            {fmt(p.reserved_stock)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
                        )}
                      </td>

                      {/* Last Production */}
                      <td className="px-4 py-3.5">
                        {p.last_production_date ? (
                          <span className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Clock size={10} className="text-gray-300" />
                            {fmtDateShort(p.last_production_date)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-300">Never</span>
                        )}
                      </td>

                      {/* BOM */}
                      <td className="px-4 py-3.5">
                        {p.bom_id ? (
                          <button
                            onClick={() => navigate(`/production/products/${p.id}/bom`)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle size={10} /> {p.bom_item_count} materials
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/production/products/${p.id}/bom`)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md hover:bg-amber-100 transition-colors"
                            title="Define BOM"
                          >
                            <XCircle size={10} /> No BOM
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-400 border border-gray-200'
                        }`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* View history */}
                          <button
                            onClick={() => setHistoryProduct(p)}
                            title="Production history"
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                          >
                            <Eye size={13} />
                          </button>
                          {/* BOM */}
                          <button
                            onClick={() => navigate(`/production/products/${p.id}/bom`)}
                            title="Manage BOM"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <BookOpen size={13} />
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => navigate(`/production/products/${p.id}/edit`)}
                            title="Edit product"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(p)}
                            title="Delete product"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {historyProduct && (
        <ProductHistoryModal
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      )}

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
