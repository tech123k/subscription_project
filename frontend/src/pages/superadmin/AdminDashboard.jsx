import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Users, Building2, CreditCard, CheckCircle, Clock,
  XCircle, AlertTriangle, ArrowRight, Zap, BarChart3,
} from 'lucide-react';
import { saasAdminAPI } from '../../services/api';
import { clsx } from 'clsx';

const fmt = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_STYLE = {
  active:    { pill: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
  trial:     { pill: 'bg-blue-50 text-blue-700',       icon: Clock },
  past_due:  { pill: 'bg-amber-50 text-amber-700',     icon: AlertTriangle },
  cancelled: { pill: 'bg-red-50 text-red-600',         icon: XCircle },
  expired:   { pill: 'bg-gray-100 text-gray-500',      icon: XCircle },
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPI = ({ label, value, sub, icon: Icon, color, onClick }) => {
  const colors = {
    indigo:  { bg: 'bg-indigo-50',  ic: 'text-indigo-600',  border: 'hover:border-indigo-200' },
    emerald: { bg: 'bg-emerald-50', ic: 'text-emerald-600', border: 'hover:border-emerald-200' },
    amber:   { bg: 'bg-amber-50',   ic: 'text-amber-600',   border: 'hover:border-amber-200' },
    red:     { bg: 'bg-red-50',     ic: 'text-red-500',     border: 'hover:border-red-200' },
    blue:    { bg: 'bg-blue-50',    ic: 'text-blue-600',    border: 'hover:border-blue-200' },
  }[color] || {};

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all duration-150',
        onClick && 'cursor-pointer hover:shadow-md ' + colors.border
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', colors.bg)}>
          <Icon size={18} className={colors.ic} />
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
};

// ── Quick Action ──────────────────────────────────────────────────────────────
const Action = ({ label, desc, icon: Icon, color, to, navigate }) => (
  <button
    onClick={() => navigate(to)}
    className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-150 text-left group"
  >
    <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
      <Icon size={18} className="text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-800">{label}</p>
      <p className="text-xs text-gray-400 truncate">{desc}</p>
    </div>
    <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
  </button>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: revData, isLoading: revLoading } = useQuery({
    queryKey: ['saas-revenue'],
    queryFn:  saasAdminAPI.getRevenue,
    staleTime: 60_000,
  });

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['saas-subscriptions', ''],
    queryFn:  () => saasAdminAPI.getAllSubscriptions({ limit: 8 }),
    staleTime: 30_000,
  });

  const rev  = revData?.data;
  const subs = subData?.data || [];

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">{today}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full">
          <Zap size={11} /> SaaS Control Center
        </span>
      </div>

      {/* KPI Row */}
      {revLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPI label="MRR"  value={fmt(rev?.mrr)} sub="Monthly Recurring Revenue"
            icon={TrendingUp} color="indigo" onClick={() => navigate('/admin/revenue')} />
          <KPI label="ARR"  value={fmt(rev?.arr)} sub="Annual Recurring Revenue"
            icon={BarChart3} color="emerald" onClick={() => navigate('/admin/revenue')} />
          <KPI label="Active Subs" value={rev?.summary?.active_subs || 0}
            sub={`${rev?.summary?.trial_subs || 0} on trial`}
            icon={Users} color="blue" onClick={() => navigate('/admin/subscriptions')} />
          <KPI label="Churned" value={
            (parseInt(rev?.summary?.cancelled_subs || 0) + parseInt(rev?.summary?.expired_subs || 0))
          } sub="Cancelled + Expired" icon={AlertTriangle} color="red" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Companies */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Recent Companies</h2>
            <button
              onClick={() => navigate('/admin/subscriptions')}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>

          {subLoading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-50">
                <tr className="text-[10px] text-gray-400 uppercase tracking-wide text-left">
                  <th className="px-5 py-2.5">Company</th>
                  <th className="px-5 py-2.5">Plan</th>
                  <th className="px-5 py-2.5">Expiry</th>
                  <th className="px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400">
                      No companies yet — run the SQL migration first
                    </td>
                  </tr>
                ) : subs.map(s => {
                  const status = s.status || 'none';
                  const st = STATUS_STYLE[status];
                  const Icon = st?.icon || CheckCircle;
                  return (
                    <tr key={s.company_id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate('/admin/subscriptions')}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-800">{s.company_name}</p>
                        <p className="text-gray-400 text-[10px]">{s.company_email}</p>
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-700 capitalize">{s.plan_name || '—'}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {status === 'trial' ? fmtDate(s.trial_ends_at) : fmtDate(s.expiry_date)}
                      </td>
                      <td className="px-5 py-3">
                        {st ? (
                          <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize', st.pill)}>
                            <Icon size={9} /> {status}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-[10px]">No sub</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions + Plan Breakdown */}
        <div className="space-y-5">

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Quick Actions</h2>
            <Action label="Manage Subscriptions" desc="Activate, extend, change plans"
              icon={CreditCard} color="bg-indigo-500" to="/admin/subscriptions" navigate={navigate} />
            <Action label="Revenue Analytics" desc="MRR, ARR, payment history"
              icon={TrendingUp} color="bg-emerald-500" to="/admin/revenue" navigate={navigate} />
            <Action label="All Companies" desc="View and manage companies"
              icon={Building2} color="bg-violet-500" to="/companies" navigate={navigate} />
          </div>

          {/* Plan breakdown */}
          {!revLoading && rev?.byPlan?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Revenue by Plan</h2>
              <div className="space-y-3">
                {rev.byPlan.map(p => (
                  <div key={p.code}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 capitalize">{p.name}</span>
                      <span className="text-xs text-gray-400">{p.companies} co · {fmt(p.mrr_contribution)}/mo</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                        style={{ width: `${Math.min(100, (parseFloat(p.mrr_contribution) / (parseFloat(rev?.mrr) || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
