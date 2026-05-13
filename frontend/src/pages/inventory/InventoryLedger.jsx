import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  BookOpen, Search, Filter, RefreshCw, X, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, TrendingDown, Activity,
} from 'lucide-react';
import { ledgerAPI } from '../../services/api';
import Pagination from '../../components/ui/Pagination';

const MOVEMENT_LABELS = {
  grn_inward:           { label: 'GRN Inward',           dir: 'in',  cls: 'bg-emerald-50 text-emerald-700' },
  production_consume:   { label: 'Production Consume',   dir: 'out', cls: 'bg-red-50 text-red-600' },
  production_complete:  { label: 'Production Complete',  dir: 'in',  cls: 'bg-blue-50 text-blue-700' },
  dispatch_outward:     { label: 'Dispatch Outward',     dir: 'out', cls: 'bg-orange-50 text-orange-700' },
  transfer_in:          { label: 'Transfer In',          dir: 'in',  cls: 'bg-indigo-50 text-indigo-700' },
  transfer_out:         { label: 'Transfer Out',         dir: 'out', cls: 'bg-purple-50 text-purple-700' },
  adjustment_add:       { label: 'Adjustment +',        dir: 'in',  cls: 'bg-teal-50 text-teal-700' },
  adjustment_deduct:    { label: 'Adjustment −',        dir: 'out', cls: 'bg-rose-50 text-rose-700' },
  opening_balance:      { label: 'Opening Balance',      dir: 'in',  cls: 'bg-gray-100 text-gray-700' },
};

const ALL_TYPES = ['', ...Object.keys(MOVEMENT_LABELS)];

const fmtDate = (d) => d ? format(new Date(d), 'dd MMM yyyy HH:mm') : '—';
const fmtQty  = (n, dir) => {
  const v = Math.abs(Number(n));
  const sign = dir === 'out' ? '−' : '+';
  return `${sign}${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}`;
};

const SummaryChip = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${color}`}>
    <Icon size={14} />
    <div>
      <p className="text-[10px] uppercase font-medium opacity-70">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  </div>
);

const InventoryLedger = () => {
  const [page, setPage] = useState(1);
  const [movementType, setMovementType] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const params = {
    page, limit: 50,
    movementType: movementType || undefined,
    search: search || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ledger', params],
    queryFn:  () => ledgerAPI.getEntries(params),
    staleTime: 30_000,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['ledger-movement-summary'],
    queryFn:  () => ledgerAPI.getMovementSummary({ days: 30 }),
    staleTime: 60_000,
  });

  const entries = data?.data || [];
  const meta    = data?.meta;
  const summary = summaryData?.data || [];

  const totalIn  = summary.filter((s) => MOVEMENT_LABELS[s.movement_type]?.dir === 'in').reduce((a, b) => a + Number(b.total_quantity), 0);
  const totalOut = summary.filter((s) => MOVEMENT_LABELS[s.movement_type]?.dir === 'out').reduce((a, b) => a + Number(b.total_quantity), 0);

  const hasFilters = movementType || search || fromDate || toDate;
  const clearFilters = () => { setMovementType(''); setSearch(''); setFromDate(''); setToDate(''); setPage(1); };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory Ledger</h1>
          <p className="text-xs text-gray-400 mt-0.5">Complete stock movement history — all materials & products</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 30-day summary strips */}
      <div className="flex flex-wrap gap-3">
        <SummaryChip icon={TrendingUp}   label="Total In  (30d)" value={totalIn.toLocaleString('en-IN')}  color="border-emerald-200 bg-emerald-50 text-emerald-700" />
        <SummaryChip icon={TrendingDown} label="Total Out (30d)" value={totalOut.toLocaleString('en-IN')} color="border-red-200 bg-red-50 text-red-600" />
        {summary.slice(0, 5).map((s) => {
          const cfg = MOVEMENT_LABELS[s.movement_type];
          if (!cfg) return null;
          return (
            <SummaryChip key={s.movement_type} icon={cfg.dir === 'in' ? ArrowUpCircle : ArrowDownCircle}
              label={cfg.label} value={Number(s.total_quantity).toLocaleString('en-IN')}
              color={`border-gray-200 ${cfg.cls}`} />
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by ref # or notes…"
            className="w-full text-sm pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400 transition" />
        </div>
        <select value={movementType} onChange={(e) => { setMovementType(e.target.value); setPage(1); }}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-[170px]">
          {ALL_TYPES.map((t) => <option key={t} value={t}>{t ? (MOVEMENT_LABELS[t]?.label || t) : 'All Types'}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <X size={12} /> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{isLoading ? '…' : `${meta?.total ?? 0} entries`}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-28" />
                <div className="h-3 bg-gray-100 rounded w-40" />
                <div className="h-3 bg-gray-100 rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <BookOpen size={36} className="opacity-20" />
            <p className="text-sm">No ledger entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10">
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Warehouse</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance After</th>
                  <th className="px-4 py-3 font-semibold">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((e) => {
                  const cfg = MOVEMENT_LABELS[e.movement_type] || { label: e.movement_type, dir: Number(e.quantity) >= 0 ? 'in' : 'out', cls: 'bg-gray-100 text-gray-600' };
                  const isIn = Number(e.quantity) >= 0;
                  return (
                    <tr key={e.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3 text-[11px] text-gray-500 tabular-nums whitespace-nowrap">{fmtDate(e.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${cfg.cls}`}>
                          {isIn ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium text-gray-800 leading-tight">
                          {e.product_name || e.material_name || '—'}
                        </p>
                        {(e.product_code || e.material_code) && (
                          <p className="text-[11px] text-gray-400 font-mono">{e.product_code || e.material_code}</p>
                        )}
                        {e.variant_sku && (
                          <p className="text-[10px] text-indigo-500 font-mono">{e.variant_sku}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{e.warehouse_name || '—'}</td>
                      <td className="px-4 py-3">
                        {e.reference_number
                          ? <span className="text-[11px] font-mono text-indigo-600">{e.reference_number}</span>
                          : e.notes
                          ? <span className="text-[11px] text-gray-400 max-w-[120px] truncate block">{e.notes}</span>
                          : <span className="text-gray-300 text-[11px]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs font-bold">
                        <span className={isIn ? 'text-emerald-700' : 'text-red-600'}>
                          {fmtQty(e.quantity, isIn ? 'in' : 'out')} {e.unit || ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-600">
                        {e.balance_after != null ? Number(e.balance_after).toLocaleString('en-IN', { maximumFractionDigits: 4 }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-400 max-w-[100px] truncate">
                        {e.performed_by_name || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
};

export default InventoryLedger;
