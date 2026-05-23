import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Crown, CheckCircle, AlertTriangle, Clock, Download,
  CreditCard, ArrowUpRight, XCircle, Zap, RefreshCw,
} from 'lucide-react';
import { subscriptionAPI, billingAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const STATUS_STYLE = {
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  trial:     'bg-blue-50 text-blue-700 border-blue-200',
  past_due:  'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
  expired:   'bg-gray-50 text-gray-600 border-gray-200',
  legacy:    'bg-purple-50 text-purple-700 border-purple-200',
};

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const BillingDashboard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn:  subscriptionAPI.getMySubscription,
    staleTime: 60_000,
  });
  const sub = subData?.data;

  const { data: histData } = useQuery({
    queryKey: ['billing-history'],
    queryFn:  subscriptionAPI.getBillingHistory,
    staleTime: 60_000,
  });
  const history = histData?.data || [];

  const { data: invData } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn:  subscriptionAPI.getInvoices,
    staleTime: 60_000,
  });
  const invoices = invData?.data || [];

  const cancelMutation = useMutation({
    mutationFn: () => billingAPI.cancelSubscription({ cancelReason: 'User requested cancellation' }),
    onSuccess: () => {
      toast.success('Subscription cancelled. Access continues until expiry.');
      qc.invalidateQueries({ queryKey: ['my-subscription'] });
      qc.invalidateQueries({ queryKey: ['accessible-modules'] });
      setCancelConfirm(false);
    },
    onError: (e) => toast.error(e?.message || 'Failed to cancel'),
  });

  if (subLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  const isActive   = sub?.status === 'active';
  const isTrial    = sub?.status === 'trial';
  const isExpired  = ['expired', 'cancelled'].includes(sub?.status);
  const isLegacy   = sub?.status === 'legacy';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage your plan, payments, and invoices</p>
        </div>
        {(isExpired || !sub) && (
          <Button icon={Zap} onClick={() => navigate('/billing/plans')}>
            Upgrade Now
          </Button>
        )}
      </div>

      {/* Current Subscription Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown size={18} className="text-yellow-300" />
              <span className="text-sm font-medium text-indigo-200">
                {isLegacy ? 'Grandfathered Access' : 'Current Plan'}
              </span>
            </div>
            <h2 className="text-3xl font-bold">{sub?.plan_name || 'Legacy'}</h2>
            {sub?.billing_cycle && (
              <p className="text-indigo-200 text-sm mt-1 capitalize">
                {sub.billing_cycle} billing
                {isActive && sub.next_billing_date && ` · renews ${fmtDate(sub.next_billing_date)}`}
              </p>
            )}
          </div>
          <span className={clsx(
            'px-3 py-1 rounded-full text-xs font-bold border capitalize',
            STATUS_STYLE[sub?.status] || 'bg-gray-50 text-gray-600 border-gray-200'
          )}>
            {sub?.status || 'Unknown'}
          </span>
        </div>

        {/* Trial countdown */}
        {isTrial && sub?.daysLeft != null && (
          <div className="mt-4 bg-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
            <Clock size={16} className="text-yellow-300 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                {sub.daysLeft > 0 ? `${sub.daysLeft} days left in trial` : 'Trial expired'}
              </p>
              <p className="text-xs text-indigo-200 mt-0.5">
                {sub.daysLeft > 0
                  ? 'Upgrade now to keep uninterrupted access'
                  : 'Subscribe to restore access to all modules'}
              </p>
            </div>
            <Button variant="secondary" size="sm" className="ml-auto bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => navigate('/billing/plans')}>
              Upgrade
            </Button>
          </div>
        )}

        {/* Expiry warning */}
        {isActive && sub?.expiry_date && (
          <div className="mt-4 flex gap-6 text-sm">
            <div>
              <p className="text-indigo-300 text-xs">Start Date</p>
              <p className="font-semibold">{fmtDate(sub.start_date)}</p>
            </div>
            <div>
              <p className="text-indigo-300 text-xs">Expires</p>
              <p className="font-semibold">{fmtDate(sub.expiry_date)}</p>
            </div>
            <div>
              <p className="text-indigo-300 text-xs">Next Billing</p>
              <p className="font-semibold">{fmtDate(sub.next_billing_date)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => navigate('/billing/plans')}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-100">
            <ArrowUpRight size={18} className="text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">Change Plan</p>
            <p className="text-xs text-gray-400">Upgrade or downgrade</p>
          </div>
        </button>

        <button onClick={() => {}}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100">
            <Download size={18} className="text-emerald-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">Download Invoice</p>
            <p className="text-xs text-gray-400">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} available</p>
          </div>
        </button>

        {(isActive || isTrial) && (
          <button onClick={() => setCancelConfirm(true)}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-red-300 hover:bg-red-50 transition-all group">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center group-hover:bg-red-100">
              <XCircle size={18} className="text-red-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">Cancel Subscription</p>
              <p className="text-xs text-gray-400">Access until expiry date</p>
            </div>
          </button>
        )}
      </div>

      {/* Plan features */}
      {sub?.features && Array.isArray(sub.features) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Included in Your Plan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sub.features.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-gray-600">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Payment History</h3>
            <CreditCard size={16} className="text-gray-400" />
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] text-gray-400 uppercase tracking-wide text-left">
                <th className="px-5 py-2.5">Invoice</th>
                <th className="px-5 py-2.5">Plan</th>
                <th className="px-5 py-2.5">Period</th>
                <th className="px-5 py-2.5 text-right">Amount</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-indigo-700">{p.invoice_number || '—'}</td>
                  <td className="px-5 py-3 text-gray-700">{p.plan_name || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {p.billing_period_start ? `${fmtDate(p.billing_period_start)} – ${fmtDate(p.billing_period_end)}` : fmtDate(p.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(p.amount)}</td>
                  <td className="px-5 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium',
                      p.status === 'captured' ? 'bg-emerald-50 text-emerald-700' :
                      p.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600')}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Cancel Subscription?</h3>
                <p className="text-xs text-gray-500 mt-0.5">You'll keep access until {fmtDate(sub?.expiry_date)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">After cancellation, all modules except Dashboard will be locked.</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setCancelConfirm(false)}>Keep Plan</Button>
              <Button variant="danger" className="flex-1" loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}>
                Yes, Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingDashboard;
