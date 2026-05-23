import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileText, ChevronDown, ChevronRight, XCircle,
  Filter, Printer, Calendar,
} from 'lucide-react';
import { accountingAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const TYPES = [
  { value: '', label: 'All Types' },
  { value: 'payment',     label: 'Payment' },
  { value: 'receipt',     label: 'Receipt' },
  { value: 'journal',     label: 'Journal' },
  { value: 'contra',      label: 'Contra' },
  { value: 'sales',       label: 'Sales' },
  { value: 'purchase',    label: 'Purchase' },
  { value: 'debit_note',  label: 'Debit Note' },
  { value: 'credit_note', label: 'Credit Note' },
];

const TYPE_BADGE = {
  payment:     'bg-red-50 text-red-700',
  receipt:     'bg-emerald-50 text-emerald-700',
  journal:     'bg-indigo-50 text-indigo-700',
  contra:      'bg-orange-50 text-orange-700',
  sales:       'bg-teal-50 text-teal-700',
  purchase:    'bg-violet-50 text-violet-700',
  debit_note:  'bg-yellow-50 text-yellow-700',
  credit_note: 'bg-sky-50 text-sky-700',
};

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

const DayBook = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [from, setFrom] = useState(today());
  const [to, setTo]     = useState(today());
  const [type, setType] = useState('');
  const [expanded, setExpanded] = useState({});

  const params = { from, to, ...(type ? { type } : {}) };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['day-book', params],
    queryFn: () => accountingAPI.getDayBook(params),
    staleTime: 30_000,
  });
  const vouchers = data?.data || [];

  const cancelMutation = useMutation({
    mutationFn: (id) => accountingAPI.cancelVoucher(id),
    onSuccess: () => {
      toast.success('Voucher cancelled');
      qc.invalidateQueries({ queryKey: ['day-book'] });
      qc.invalidateQueries({ queryKey: ['vouchers'] });
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const totalAmount = vouchers.reduce((s, v) => s + parseFloat(v.total_amount || 0), 0);
  const totalDr = vouchers.reduce((s, v) =>
    s + (v.entries || []).filter(e => e.entry_type === 'debit').reduce((a, e) => a + parseFloat(e.amount), 0), 0
  );
  const totalCr = vouchers.reduce((s, v) =>
    s + (v.entries || []).filter(e => e.entry_type === 'credit').reduce((a, e) => a + parseFloat(e.amount), 0), 0
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Day Book</h1>
          <p className="text-xs text-gray-400 mt-0.5">All vouchers — date-wise register</p>
        </div>
        <Button icon={Plus} size="sm" onClick={() => navigate('/accounting/voucher/new')}>
          New Voucher
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" size="sm" icon={Filter} onClick={refetch}>Apply</Button>
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>
          </div>
        </div>

        {/* Summary strip */}
        {vouchers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-6 text-xs">
            <div><span className="text-gray-400">Vouchers: </span><span className="font-semibold text-gray-800">{vouchers.length}</span></div>
            <div><span className="text-gray-400">Total Dr: </span><span className="font-semibold text-blue-700">{fmt(totalDr)}</span></div>
            <div><span className="text-gray-400">Total Cr: </span><span className="font-semibold text-purple-700">{fmt(totalCr)}</span></div>
          </div>
        )}
      </div>

      {/* Voucher List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : vouchers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <FileText size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm text-gray-500">No vouchers for selected period</p>
          <button onClick={() => navigate('/accounting/voucher/new')}
            className="mt-2 text-xs text-indigo-600 hover:underline">
            Create first voucher →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {vouchers.map(v => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Voucher header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(v.id)}
              >
                <span className={clsx('flex-shrink-0', expanded[v.id] ? 'text-gray-600' : 'text-gray-300')}>
                  {expanded[v.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>

                <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', TYPE_BADGE[v.voucher_type] || 'bg-gray-100 text-gray-600')}>
                  {v.voucher_type.replace(/_/g, ' ')}
                </span>

                <span className="text-sm font-bold text-gray-900 font-mono">{v.voucher_number}</span>

                <span className="text-xs text-gray-500">
                  {new Date(v.voucher_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                </span>

                {v.narration && (
                  <span className="text-xs text-gray-400 flex-1 truncate hidden sm:block">{v.narration}</span>
                )}

                <span className="ml-auto text-sm font-semibold text-gray-900 font-mono">
                  {fmt(v.total_amount)}
                </span>

                <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full',
                  v.status === 'posted' ? 'bg-emerald-50 text-emerald-700' :
                  v.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600')}>
                  {v.status}
                </span>
              </div>

              {/* Expanded entries */}
              {expanded[v.id] && (
                <div className="border-t border-gray-100 px-4 pb-3">
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="text-[10px] text-gray-400 uppercase tracking-wide text-left">
                        <th className="pb-1.5">Account</th>
                        <th className="pb-1.5 text-right text-blue-600">Debit</th>
                        <th className="pb-1.5 text-right text-purple-600">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(v.entries || []).map((e, i) => (
                        <tr key={i}>
                          <td className="py-1.5 text-gray-700">{e.account_name}</td>
                          <td className="py-1.5 text-right font-mono text-blue-700">
                            {e.entry_type === 'debit' ? fmt(e.amount) : ''}
                          </td>
                          <td className="py-1.5 text-right font-mono text-purple-700">
                            {e.entry_type === 'credit' ? fmt(e.amount) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {v.status === 'posted' && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (window.confirm('Cancel this voucher?')) cancelMutation.mutate(v.id); }}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        <XCircle size={12} /> Cancel Voucher
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DayBook;
