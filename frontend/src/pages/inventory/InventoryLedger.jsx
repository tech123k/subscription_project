import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  BookOpen, Search, RefreshCw, X, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, TrendingDown, ChevronDown, ExternalLink, MoreVertical,
  Package, Truck, Factory, ClipboardList, Warehouse, AlertCircle,
} from 'lucide-react';
import { ledgerAPI, warehouseAPI } from '../../services/api';
import Pagination from '../../components/ui/Pagination';
import { clsx } from 'clsx';

// ─── Movement config ──────────────────────────────────────────────────────────
const MOVEMENT_META = {
  grn_inward:          { label: 'GRN Inward',           dir: 'in',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ArrowUpCircle,   navType: 'grn' },
  production_consume:  { label: 'Production Consume',   dir: 'out', cls: 'bg-red-50 text-red-600 border-red-200',             icon: ArrowDownCircle, navType: 'production' },
  production_complete: { label: 'Production Output',    dir: 'in',  cls: 'bg-blue-50 text-blue-700 border-blue-200',          icon: ArrowUpCircle,   navType: 'production' },
  dispatch_outward:    { label: 'Dispatch Outward',     dir: 'out', cls: 'bg-orange-50 text-orange-700 border-orange-200',    icon: ArrowDownCircle, navType: 'dispatch' },
  transfer_in:         { label: 'Transfer In',          dir: 'in',  cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',    icon: ArrowUpCircle,   navType: null },
  transfer_out:        { label: 'Transfer Out',         dir: 'out', cls: 'bg-purple-50 text-purple-700 border-purple-200',    icon: ArrowDownCircle, navType: null },
  adjustment_add:      { label: 'Adjustment +',         dir: 'in',  cls: 'bg-teal-50 text-teal-700 border-teal-200',         icon: ArrowUpCircle,   navType: null },
  adjustment_deduct:   { label: 'Adjustment −',         dir: 'out', cls: 'bg-rose-50 text-rose-700 border-rose-200',         icon: ArrowDownCircle, navType: null },
  opening_balance:     { label: 'Opening Balance',      dir: 'in',  cls: 'bg-gray-100 text-gray-700 border-gray-200',        icon: ArrowUpCircle,   navType: null },
};

const NAV_ROUTES = {
  grn:        (refId) => `/grn/${refId}`,
  production: (refId) => `/production/${refId}`,
  dispatch:   (refId) => `/dispatches/${refId}`,
};

const ALL_MOVEMENT_TYPES = ['', ...Object.keys(MOVEMENT_META)];

const fmtDateTime = (d) => d ? format(new Date(d), 'dd MMM yyyy, HH:mm') : '—';
const fmtDateOnly = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—';

const fmtQty = (qty, dir) => {
  const v    = Math.abs(Number(qty));
  const sign = dir === 'out' ? '−' : '+';
  return `${sign}${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}`;
};

// ─── Summary chip ─────────────────────────────────────────────────────────────
const SummaryChip = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${color} flex-shrink-0`}>
    <Icon size={13} />
    <div>
      <p className="text-[10px] uppercase font-medium opacity-60 leading-none">{label}</p>
      <p className="text-sm font-bold tabular-nums leading-tight">{value}</p>
    </div>
  </div>
);

// ─── Row action menu ──────────────────────────────────────────────────────────
const RowActions = ({ entry, meta }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    document.addEventListener('touchstart', fn);
    return () => { document.removeEventListener('mousedown', fn); document.removeEventListener('touchstart', fn); };
  }, [open]);

  const navRoute = meta?.navType ? NAV_ROUTES[meta.navType]?.(entry.reference_id) : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1 rounded-md hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors"
      >
        <MoreVertical size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-[101] py-1 overflow-hidden">
            {navRoute && (
              <button
                onClick={() => { setOpen(false); navigate(navRoute); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink size={12} className="text-gray-400" />
                Open Reference
              </button>
            )}
            <button
              onClick={() => { setOpen(false); navigator.clipboard?.writeText(entry.reference_number || entry.id); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ClipboardList size={12} className="text-gray-400" />
              Copy Ref #
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Mobile ledger card ────────────────────────────────────────────────────────
const MobileLedgerCard = ({ entry }) => {
  const isIn  = Number(entry.quantity) >= 0;
  const meta  = MOVEMENT_META[entry.movement_type] || { label: entry.movement_type, dir: isIn ? 'in' : 'out', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  const Icon  = meta.icon || (isIn ? ArrowUpCircle : ArrowDownCircle);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.cls} flex-shrink-0`}>
            <Icon size={9} /> {meta.label}
          </span>
        </div>
        <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${isIn ? 'text-emerald-700' : 'text-red-600'}`}>
          {fmtQty(entry.quantity, meta.dir)} {entry.unit || ''}
        </span>
      </div>

      <div>
        <p className="text-[13px] font-semibold text-gray-800 leading-tight">
          {entry.product_name || entry.material_name || '—'}
        </p>
        {(entry.product_code || entry.material_code) && (
          <p className="text-[11px] text-gray-400 font-mono">{entry.product_code || entry.material_code}</p>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-50">
        <span>{fmtDateOnly(entry.created_at)}</span>
        <div className="flex items-center gap-2">
          {entry.warehouse_name && <span>{entry.warehouse_name}</span>}
          {entry.balance_after != null && (
            <span>Balance: <strong className="text-gray-600">{Number(entry.balance_after).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></span>
          )}
        </div>
      </div>

      {entry.reference_number && (
        <p className="text-[10px] font-mono text-indigo-500 truncate">{entry.reference_number}</p>
      )}
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const TableSkeleton = () => (
  <div className="divide-y divide-gray-50">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
        <div className="h-3 bg-gray-100 rounded w-28 flex-shrink-0" />
        <div className="h-6 bg-gray-100 rounded-full w-32 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-gray-100 rounded w-40" />
          <div className="h-2.5 bg-gray-100 rounded w-24" />
        </div>
        <div className="h-3 bg-gray-100 rounded w-20 flex-shrink-0" />
        <div className="h-3 bg-gray-100 rounded w-16 ml-auto flex-shrink-0" />
      </div>
    ))}
  </div>
);

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const InventoryLedger = () => {
  const [page,         setPage]         = useState(1);
  const [movementType, setMovementType] = useState('');
  const [search,       setSearch]       = useState('');
  const [fromDate,     setFromDate]     = useState('');
  const [toDate,       setToDate]       = useState('');
  const [warehouseId,  setWarehouseId]  = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  const params = {
    page, limit: 50,
    movementType: movementType || undefined,
    search:       search       || undefined,
    fromDate:     fromDate     || undefined,
    toDate:       toDate       || undefined,
    warehouseId:  warehouseId  || undefined,
  };

  const { data, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: ['ledger', params],
    queryFn:  () => ledgerAPI.getEntries(params),
    staleTime: 30_000,
    retry: 2,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['ledger-movement-summary'],
    queryFn:  () => ledgerAPI.getMovementSummary({ days: 30 }),
    staleTime: 60_000,
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn:  () => warehouseAPI.getAll({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  const entries    = data?.data  || [];
  const meta       = data?.meta;
  const summary    = summaryData?.data || [];
  const warehouses = warehousesData?.data || [];

  const totalIn  = summary.filter((s) => MOVEMENT_META[s.movement_type]?.dir === 'in').reduce((a, b) => a + Number(b.total_quantity), 0);
  const totalOut = summary.filter((s) => MOVEMENT_META[s.movement_type]?.dir === 'out').reduce((a, b) => a + Number(b.total_quantity), 0);

  const hasFilters   = movementType || search || fromDate || toDate || warehouseId;
  const activeCount  = [movementType, search, fromDate || toDate, warehouseId].filter(Boolean).length;

  const clearFilters = () => {
    setMovementType('');
    setSearch('');
    setFromDate('');
    setToDate('');
    setWarehouseId('');
    setPage(1);
  };

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory Ledger</h1>
          <p className="text-xs text-gray-400 mt-0.5">Complete stock movement history — all materials &amp; products</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={clsx('sm:hidden flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors', showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600')}
          >
            Filters {activeCount > 0 && <span className="bg-indigo-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeCount}</span>}
            <ChevronDown size={14} className={clsx('transition-transform', showFilters && 'rotate-180')} />
          </button>
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── 30-day summary strip ── */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-0.5">
        <SummaryChip icon={TrendingUp}   label="Total In (30d)"  value={totalIn.toLocaleString('en-IN')}  color="border-emerald-200 bg-emerald-50 text-emerald-700" />
        <SummaryChip icon={TrendingDown} label="Total Out (30d)" value={totalOut.toLocaleString('en-IN')} color="border-red-200 bg-red-50 text-red-600" />
        {summary.slice(0, 4).map((s) => {
          const cfg = MOVEMENT_META[s.movement_type];
          if (!cfg) return null;
          const Icon = cfg.dir === 'in' ? ArrowUpCircle : ArrowDownCircle;
          return (
            <SummaryChip key={s.movement_type} icon={Icon} label={cfg.label} value={Number(s.total_quantity).toLocaleString('en-IN')} color={`border-gray-200 ${cfg.cls}`} />
          );
        })}
      </div>

      {/* ── Filters (desktop always visible, mobile collapsible) ── */}
      <div className={clsx('bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3', !showFilters && 'hidden sm:block')}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by ref # or notes…"
              className="w-full text-sm pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400 transition"
            />
          </div>

          {/* Movement type */}
          <select
            value={movementType} onChange={(e) => { setMovementType(e.target.value); setPage(1); }}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-[170px]"
          >
            {ALL_MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t ? (MOVEMENT_META[t]?.label || t) : 'All Types'}</option>
            ))}
          </select>

          {/* Warehouse */}
          {warehouses.length > 0 && (
            <select
              value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-[150px]"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}

          {/* Date range */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date" value={fromDate} max={toDate || undefined}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <span className="text-xs text-gray-400 flex-shrink-0">to</span>
            <input
              type="date" value={toDate} min={fromDate || undefined}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
              <X size={12} /> Clear
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
            {isLoading ? '…' : `${meta?.total ?? 0} entries`}
          </span>
        </div>
      </div>

      {/* ── Error state ── */}
      {isError && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-3 text-red-600 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          Failed to load ledger entries. <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {/* ── Mobile cards ── */}
      <div className="block sm:hidden space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-28 animate-pulse" />)
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-14 flex flex-col items-center gap-3 text-gray-400">
            <BookOpen size={32} className="opacity-20" />
            <p className="text-sm text-center px-4">
              {hasFilters ? 'No entries match your filters.' : 'No ledger entries yet.\n\nEntries are created automatically when you complete GRN, Production, or Dispatch operations.'}
            </p>
            {hasFilters && <button onClick={clearFilters} className="text-xs text-indigo-500 hover:underline">Clear filters</button>}
          </div>
        ) : (
          entries.map((e) => <MobileLedgerCard key={e.id} entry={e} />)
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? <TableSkeleton /> : entries.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <BookOpen size={36} className="opacity-20" />
            <p className="text-sm font-medium text-center">
              {hasFilters ? 'No entries match your filters.' : 'No ledger entries yet'}
            </p>
            {!hasFilters && (
              <p className="text-xs text-gray-300 text-center max-w-xs">
                Entries are created automatically when you approve a GRN, complete a Production Order, or create a Dispatch.
              </p>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-indigo-500 hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10">
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Date &amp; Time</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Warehouse</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance After</th>
                  <th className="px-4 py-3 font-semibold">By</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((e) => {
                  const isIn = Number(e.quantity) >= 0;
                  const meta = MOVEMENT_META[e.movement_type] || {
                    label: e.movement_type,
                    dir:   isIn ? 'in' : 'out',
                    cls:   'bg-gray-100 text-gray-600 border-gray-200',
                    icon:  isIn ? ArrowUpCircle : ArrowDownCircle,
                  };
                  const Icon = meta.icon;

                  return (
                    <tr key={e.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3 text-[11px] text-gray-500 tabular-nums whitespace-nowrap">
                        {fmtDateTime(e.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.cls}`}>
                          <Icon size={9} /> {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium text-gray-800 leading-tight">
                          {e.product_name || e.material_name || '—'}
                        </p>
                        {(e.product_code || e.material_code) && (
                          <p className="text-[11px] text-gray-400 font-mono">{e.product_code || e.material_code}</p>
                        )}
                        {e.variant_sku && <p className="text-[10px] text-indigo-500 font-mono">{e.variant_sku}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{e.warehouse_name || '—'}</td>
                      <td className="px-4 py-3">
                        {e.reference_number
                          ? <span className="text-[11px] font-mono text-indigo-600">{e.reference_number}</span>
                          : e.notes
                          ? <span className="text-[11px] text-gray-400 max-w-[120px] truncate block">{e.notes}</span>
                          : <span className="text-gray-300 text-[11px]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={`text-sm font-bold ${isIn ? 'text-emerald-700' : 'text-red-600'}`}>
                          {fmtQty(e.quantity, meta.dir)} {e.unit || ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-600">
                        {e.balance_after != null
                          ? Number(e.balance_after).toLocaleString('en-IN', { maximumFractionDigits: 4 })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-400 max-w-[90px] truncate">
                        {e.performed_by_name || '—'}
                      </td>
                      <td className="px-2 py-3">
                        <RowActions entry={e} meta={meta} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      )}
    </div>
  );
};

export default InventoryLedger;
