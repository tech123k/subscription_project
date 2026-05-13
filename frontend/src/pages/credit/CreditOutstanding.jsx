import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CreditCard, Search, X, RefreshCw, AlertTriangle,
  CheckCircle, TrendingUp, ChevronDown, ChevronRight, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { creditAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';

const fmtMoney = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate  = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—';

const SummaryCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={17} className="text-white" />
    </div>
    <div>
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value ?? '—'}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Payment form modal ────────────────────────────────────────────────────────
const PaymentModal = ({ customer, onClose }) => {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const payMut = useMutation({
    mutationFn: (data) => creditAPI.recordPayment(customer.id, data),
    onSuccess: () => {
      toast.success('Payment recorded');
      qc.invalidateQueries({ queryKey: ['credit-outstanding'] });
      qc.invalidateQueries({ queryKey: ['customer-credit', customer.id] });
      onClose();
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  return (
    <Modal isOpen onClose={onClose} title={`Record Payment — ${customer.name}`} size="sm">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
          <p>Outstanding: <strong>{fmtMoney(customer.outstanding_amount)}</strong></p>
          {Number(customer.overdue_amount) > 0 && <p className="mt-0.5">Overdue: <strong className="text-red-600">{fmtMoney(customer.overdue_amount)}</strong></p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount ₹ *</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Reference / Cheque #</label>
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR / Cheque number…"
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Optional…" />
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={payMut.isPending} onClick={() => {
            if (!amount || parseFloat(amount) <= 0) { toast.error('Enter valid amount'); return; }
            payMut.mutate({ amount: parseFloat(amount), paymentDate: date, referenceNumber: ref || undefined, notes: notes || undefined });
          }}>Record Payment</Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Credit limit settings modal ──────────────────────────────────────────────
const CreditSettingsModal = ({ customer, onClose }) => {
  const qc = useQueryClient();
  const [limit, setLimit]     = useState(customer.credit_limit || '');
  const [days, setDays]       = useState(customer.credit_days || '');
  const [blocking, setBlocking] = useState(customer.order_blocking_enabled || false);

  const mut = useMutation({
    mutationFn: (data) => creditAPI.updateCreditSettings(customer.id, data),
    onSuccess: () => {
      toast.success('Credit settings updated');
      qc.invalidateQueries({ queryKey: ['credit-outstanding'] });
      onClose();
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  return (
    <Modal isOpen onClose={onClose} title={`Credit Settings — ${customer.name}`} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Credit Limit ₹</label>
          <input type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0 = no limit" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Credit Days</label>
          <input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="e.g. 30" />
        </div>
        <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg p-3">
          <div>
            <p className="text-sm font-medium text-red-900">Block orders on overdue</p>
            <p className="text-xs text-red-600 mt-0.5">Prevent new orders when credit limit is exceeded</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} className="sr-only peer" />
            <div className="w-10 h-5 bg-gray-200 peer-checked:bg-red-500 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={mut.isPending} onClick={() => mut.mutate({ creditLimit: parseFloat(limit) || 0, creditDays: parseInt(days) || 0, orderBlockingEnabled: blocking })}>
            Save Settings
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────
const CreditOutstanding = () => {
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [settingsCustomer, setSettingsCustomer] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const params = { page, limit: 25, search: search || undefined, overdue: overdueOnly ? 'true' : undefined };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['credit-outstanding', params],
    queryFn:  () => creditAPI.getOutstandingList(params),
    staleTime: 30_000,
  });

  const { data: detailData } = useQuery({
    queryKey: ['customer-credit', expandedId],
    queryFn:  () => creditAPI.getCustomerCredit(expandedId),
    enabled:  !!expandedId,
    staleTime: 30_000,
  });

  const list    = data?.data?.customers || [];
  const meta    = data?.data?.pagination;
  const summary = data?.data?.summary || {};

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Credit & Outstanding</h1>
          <p className="text-xs text-gray-400 mt-0.5">Customer receivables and credit management</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={TrendingUp}    label="Total Outstanding" value={fmtMoney(summary.total_outstanding)} color="bg-amber-500" />
        <SummaryCard icon={AlertTriangle} label="Total Overdue"     value={fmtMoney(summary.total_overdue)}    color={Number(summary.total_overdue) > 0 ? 'bg-red-500' : 'bg-gray-400'} />
        <SummaryCard icon={CreditCard}    label="Overdue Customers" value={summary.overdue_customers ?? 0}     sub="need attention" color={Number(summary.overdue_customers) > 0 ? 'bg-red-500' : 'bg-gray-400'} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by customer name…"
            className="w-full text-sm pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder-gray-400 transition" />
        </div>
        <button
          onClick={() => { setOverdueOnly(!overdueOnly); setPage(1); }}
          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${overdueOnly ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
        >
          <AlertTriangle size={12} /> Overdue Only
        </button>
        {(search || overdueOnly) && (
          <button onClick={() => { setSearch(''); setOverdueOnly(false); setPage(1); }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <X size={12} /> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{isLoading ? '…' : `${meta?.total ?? 0} customers`}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 animate-pulse m-2 rounded" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <CreditCard size={36} className="opacity-20" />
            <p className="text-sm">No outstanding amounts found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10">
              <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Credit Limit</th>
                <th className="px-4 py-3 font-semibold">Outstanding</th>
                <th className="px-4 py-3 font-semibold">Overdue</th>
                <th className="px-4 py-3 font-semibold">Utilization</th>
                <th className="px-4 py-3 font-semibold">Last Payment</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((c) => {
                const isExpanded = expandedId === c.id;
                const isOverdue = Number(c.overdue_amount) > 0;
                const utilPct = Number(c.utilization_pct);
                const detail = detailData?.data;

                return (
                  <>
                    <tr key={c.id} className={`hover:bg-gray-50/80 transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-4 py-3 text-gray-300 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                        {isExpanded ? <ChevronDown size={13} className="text-indigo-500" /> : <ChevronRight size={13} />}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 text-[13px]">{c.name}</p>
                        <p className="text-[11px] text-gray-400">{c.code}</p>
                        {c.order_blocking_enabled && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Blocking enabled</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 tabular-nums">
                        {Number(c.credit_limit) > 0 ? fmtMoney(c.credit_limit) : <span className="text-gray-300">No limit</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold tabular-nums text-amber-700">{fmtMoney(c.outstanding_amount)}</td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {isOverdue
                          ? <span className="font-bold text-red-600">{fmtMoney(c.overdue_amount)}</span>
                          : <span className="text-emerald-600 flex items-center gap-1"><CheckCircle size={11} /> Nil</span>}
                      </td>
                      <td className="px-4 py-3">
                        {Number(c.credit_limit) > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${utilPct >= 90 ? 'bg-red-500' : utilPct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, utilPct)}%` }} />
                            </div>
                            <span className={`text-[11px] font-medium tabular-nums ${utilPct >= 90 ? 'text-red-600' : utilPct >= 70 ? 'text-amber-600' : 'text-gray-600'}`}>
                              {utilPct}%
                            </span>
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(c.last_payment_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setPaymentCustomer(c)}
                            className="text-[11px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors">
                            + Payment
                          </button>
                          <button onClick={() => setSettingsCustomer(c)}
                            className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium transition-colors">
                            Settings
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded: aging + recent transactions */}
                    {isExpanded && detail && (
                      <tr>
                        <td colSpan={8} className="bg-indigo-50/30 px-6 py-4 border-t border-indigo-100">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Aging buckets */}
                            <div>
                              <p className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide mb-2">Aging Analysis</p>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'Current (not due)', value: detail.aging?.current_due },
                                  { label: '1–30 days',         value: detail.aging?.days_1_30 },
                                  { label: '31–60 days',        value: detail.aging?.days_31_60 },
                                  { label: '61–90 days',        value: detail.aging?.days_61_90 },
                                  { label: '90+ days',          value: detail.aging?.days_90_plus },
                                ].map((b) => (
                                  <div key={b.label} className="flex justify-between text-xs bg-white rounded px-3 py-1.5 border border-indigo-100">
                                    <span className="text-gray-600">{b.label}</span>
                                    <span className={`font-semibold tabular-nums ${Number(b.value) > 0 && b.label !== 'Current (not due)' ? 'text-red-600' : 'text-gray-800'}`}>
                                      {fmtMoney(b.value || 0)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Recent transactions */}
                            <div>
                              <p className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide mb-2">Recent Transactions</p>
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {(detail.transactions || []).slice(0, 8).map((tx) => (
                                  <div key={tx.id} className="flex items-center justify-between text-xs bg-white rounded px-3 py-1.5 border border-indigo-100">
                                    <div>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tx.transaction_type === 'payment' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {tx.transaction_type}
                                      </span>
                                      {tx.reference_number && <span className="ml-1.5 text-gray-400 font-mono">{tx.reference_number}</span>}
                                    </div>
                                    <div className="text-right">
                                      <span className={`font-semibold tabular-nums ${Number(tx.amount) < 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {Number(tx.amount) < 0 ? '−' : '+'}{fmtMoney(Math.abs(tx.amount))}
                                      </span>
                                      <p className="text-[10px] text-gray-400">{fmtDate(tx.created_at)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}

      {paymentCustomer && <PaymentModal customer={paymentCustomer} onClose={() => setPaymentCustomer(null)} />}
      {settingsCustomer && <CreditSettingsModal customer={settingsCustomer} onClose={() => setSettingsCustomer(null)} />}
    </div>
  );
};

export default CreditOutstanding;
