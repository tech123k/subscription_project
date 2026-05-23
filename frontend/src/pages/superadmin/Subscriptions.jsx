import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle, Clock, XCircle, AlertTriangle, Zap, MinusCircle } from 'lucide-react';
import { saasAdminAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const STATUS_STYLE = {
  active:    'bg-emerald-50 text-emerald-700',
  trial:     'bg-blue-50 text-blue-700',
  past_due:  'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-600',
  expired:   'bg-gray-100 text-gray-600',
  none:      'bg-gray-50 text-gray-400',
};
const STATUS_ICON = {
  active: CheckCircle, trial: Clock, past_due: AlertTriangle,
  cancelled: XCircle,  expired: XCircle, none: MinusCircle,
};

const PLANS = [
  { code: 'starter',    label: 'Starter    — ₹999/mo' },
  { code: 'growth',     label: 'Growth     — ₹2499/mo' },
  { code: 'enterprise', label: 'Enterprise — ₹4999/mo' },
];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── Activate / Create Subscription Modal ──────────────────────────────────────
const ActivateModal = ({ row, onClose, onDone }) => {
  const [plan,  setPlan]  = useState(row.plan_code || 'growth');
  const [days,  setDays]  = useState(30);
  const [cycle, setCycle] = useState(row.billing_cycle || 'monthly');

  const mutation = useMutation({
    mutationFn: (body) =>
      row.id
        ? saasAdminAPI.manualActivate(row.id, body)          // existing sub row
        : saasAdminAPI.manualCreate({ ...body, companyId: row.company_id }), // no sub yet
    onSuccess: () => {
      toast.success(`✓ Activated on ${plan} for ${days} days`);
      onDone();
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message || 'Failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        {/* Header */}
        <div>
          <h3 className="font-semibold text-gray-900">Manually Activate Subscription</h3>
          <p className="text-xs text-gray-400 mt-0.5">{row.company_name} · No Razorpay needed</p>
        </div>

        {/* Plan */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
          <select
            value={plan}
            onChange={e => setPlan(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {PLANS.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>

        {/* Billing Cycle */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Billing Cycle</label>
          <div className="flex gap-2">
            {['monthly', 'yearly'].map(c => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={clsx(
                  'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
                  cycle === c
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {[30, 90, 180, 365].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={clsx(
                  'py-1 rounded-lg text-[11px] font-medium border transition-colors',
                  days === d
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                )}
              >
                {d === 365 ? '1 yr' : `${d}d`}
              </button>
            ))}
          </div>
          <input
            type="number" min="1" value={days}
            onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Preview */}
        <div className="bg-emerald-50 rounded-xl px-3 py-2.5 text-xs text-emerald-700 space-y-0.5">
          <p>Status → <strong>active</strong></p>
          <p>Plan   → <strong className="capitalize">{plan}</strong> ({cycle})</p>
          <p>Expiry → <strong>
            {new Date(Date.now() + days * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </strong></p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ planCode: plan, billingCycle: cycle, durationDays: days })}
          >
            Activate
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Extend Modal ──────────────────────────────────────────────────────────────
const ExtendModal = ({ row, onClose, onDone }) => {
  const [days, setDays] = useState(30);

  const mutation = useMutation({
    mutationFn: () => saasAdminAPI.extendSubscription(row.id, { days }),
    onSuccess: () => {
      toast.success(`Extended by ${days} days`);
      onDone();
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message || 'Failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Extend Subscription</h3>
        <p className="text-sm text-gray-500">{row.company_name}</p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Extend by (days)</label>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {[30, 90, 180, 365].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={clsx('py-1 rounded-lg text-[11px] font-medium border transition-colors',
                  days === d ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-gray-500 border-gray-200')}>
                {d === 365 ? '1 yr' : `${d}d`}
              </button>
            ))}
          </div>
          <input
            type="number" min="1" value={days}
            onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Extend
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const Subscriptions = () => {
  const qc = useQueryClient();
  const [filterStatus,   setFilterStatus]   = useState('');
  const [activateTarget, setActivateTarget] = useState(null);
  const [extendTarget,   setExtendTarget]   = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['saas-subscriptions', filterStatus],
    queryFn: () => saasAdminAPI.getAllSubscriptions({ status: filterStatus || undefined }),
    staleTime: 30_000,
  });
  const rows = data?.data || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['saas-subscriptions'] });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Subscriptions</h1>
          <p className="text-xs text-gray-400 mt-0.5">Company-wise subscription management</p>
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All Companies</option>
          <option value="none">No Subscription</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] text-gray-400 uppercase tracking-wide text-left">
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Billing</th>
                <th className="px-5 py-3">Expiry</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">No companies found</td>
                </tr>
              ) : rows.map(row => {
                const status = row.status || 'none';
                const Icon   = STATUS_ICON[status] || MinusCircle;
                return (
                  <tr key={row.company_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-800">{row.company_name}</p>
                      <p className="text-gray-400 text-[10px]">{row.company_email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-700">{row.plan_name || '—'}</p>
                      {row.monthly_price && <p className="text-gray-400">₹{row.monthly_price}/mo</p>}
                    </td>
                    <td className="px-5 py-3 capitalize text-gray-600">{row.billing_cycle || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {status === 'trial' ? fmtDate(row.trial_ends_at) : fmtDate(row.expiry_date)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize',
                        STATUS_STYLE[status]
                      )}>
                        <Icon size={10} />
                        {status === 'none' ? 'No Sub' : status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setActivateTarget(row)}
                          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                        >
                          <Zap size={11} /> Activate
                        </button>
                        {row.id && (
                          <button
                            onClick={() => setExtendTarget(row)}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                          >
                            <Calendar size={11} /> Extend
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

      {/* Modals */}
      {activateTarget && (
        <ActivateModal
          row={activateTarget}
          onClose={() => setActivateTarget(null)}
          onDone={refresh}
        />
      )}
      {extendTarget && (
        <ExtendModal
          row={extendTarget}
          onClose={() => setExtendTarget(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
};

export default Subscriptions;
