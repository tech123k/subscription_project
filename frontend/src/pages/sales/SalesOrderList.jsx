import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Plus, Search, RefreshCw, Eye, Trash2, X,
  ShoppingCart, Clock, CheckCircle, AlertTriangle, TrendingUp,
  Package, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { salesOrderAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed:  { label: 'Confirmed',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  processing: { label: 'Processing', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  partial:    { label: 'Partial',    cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  dispatched: { label: 'Dispatched', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  completed:  { label: 'Completed',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-50 text-red-600 border-red-200' },
};

const fmt = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—';

const SummaryCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={17} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const STATUSES = ['', 'pending', 'confirmed', 'processing', 'partial', 'dispatched', 'completed', 'cancelled'];

const SalesOrderList = () => {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const filters = { page, limit: 20, search: search || undefined, status: status || undefined };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sales-orders', filters],
    queryFn:  () => salesOrderAPI.getAll(filters),
    staleTime: 30_000,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['sales-orders-summary'],
    queryFn:  salesOrderAPI.getSummary,
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => salesOrderAPI.delete(id),
    onSuccess: () => {
      toast.success('Order deleted');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
    },
    onError: (e) => toast.error(e?.message || 'Delete failed'),
  });

  const orders = data?.data || [];
  const meta   = data?.meta;
  const s      = summaryData?.data || {};

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Orders</h1>
          <p className="text-xs text-gray-400 mt-0.5">OMS — order lifecycle management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <Button icon={Plus} onClick={() => navigate('/sales-orders/create')}>New Order</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={ShoppingCart} label="Pending Orders" value={s.pending_orders} sub={fmt(s.pending_value)} color="bg-amber-500" />
        <SummaryCard icon={TrendingUp}   label="Processing"     value={s.processing_orders} color="bg-indigo-500" />
        <SummaryCard icon={Clock}        label="Overdue"         value={s.overdue_orders} sub="past delivery date" color={s.overdue_orders > 0 ? 'bg-red-500' : 'bg-gray-400'} />
        <SummaryCard icon={CheckCircle}  label="Completed"       value={s.completed_orders} sub={fmt(s.total_order_value) + ' total'} color="bg-emerald-500" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by order # or customer…"
            className="w-full text-sm pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400 transition"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 min-w-[140px]"
        >
          {STATUSES.map((st) => (
            <option key={st} value={st}>{st ? STATUS_CONFIG[st]?.label : 'All Status'}</option>
          ))}
        </select>
        {(search || status) && (
          <button onClick={() => { setSearch(''); setStatus(''); setPage(1); }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <X size={12} /> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{isLoading ? '…' : `${meta?.total ?? 0} orders`}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-28" />
                <div className="h-3 bg-gray-100 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <ShoppingCart size={36} className="opacity-20" />
            <p className="text-sm">No orders found.</p>
            <Button icon={Plus} onClick={() => navigate('/sales-orders/create')}>New Order</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10">
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Order #</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Delivery</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => {
                  const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                  const isOverdue = o.expected_delivery_date && new Date(o.expected_delivery_date) < new Date() && !['completed', 'cancelled'].includes(o.status);
                  return (
                    <tr key={o.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-indigo-700">
                        {o.order_number}
                        {o.backorder_of && <span className="ml-1 text-[10px] bg-orange-100 text-orange-600 px-1 rounded">BO</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-[13px]">{o.customer_name || '—'}</p>
                        {o.customer_phone && <p className="text-[11px] text-gray-400">{o.customer_phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(o.order_date)}</td>
                      <td className="px-4 py-3 text-xs">
                        {o.expected_delivery_date ? (
                          <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                            {isOverdue && '⚠ '}{fmtDate(o.expected_delivery_date)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{o.item_count ?? 0} items</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800 tabular-nums">{fmt(o.net_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => navigate(`/sales-orders/${o.id}`)} title="View" className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600">
                            <Eye size={13} />
                          </button>
                          {o.status === 'pending' && (
                            <button onClick={() => setDeleteId(o.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                              <Trash2 size={13} />
                            </button>
                          )}
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

      {meta && meta.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Order?</h3>
            <p className="text-sm text-gray-500 mb-5">Only pending orders can be deleted. This is permanent.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleteId)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOrderList;
