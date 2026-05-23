import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, CreditCard, AlertTriangle, BarChart3 } from 'lucide-react';
import { saasAdminAPI } from '../../services/api';
import { clsx } from 'clsx';

const fmt    = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const KPI = ({ title, value, sub, icon: Icon, color = 'indigo' }) => {
  const bg = { indigo:'bg-indigo-50', emerald:'bg-emerald-50', amber:'bg-amber-50', red:'bg-red-50' }[color];
  const ic = { indigo:'text-indigo-600', emerald:'text-emerald-600', amber:'text-amber-600', red:'text-red-500' }[color];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
          <Icon size={18} className={ic} />
        </div>
        <span className="text-xs font-medium text-gray-500">{title}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
};

const Revenue = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['saas-revenue'],
    queryFn: saasAdminAPI.getRevenue,
    staleTime: 60_000,
  });
  const d = data?.data;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...(d?.monthlyRevenue || []).map(r => parseFloat(r.revenue || 0)), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Revenue Analytics</h1>
        <p className="text-xs text-gray-400 mt-0.5">SaaS subscription metrics and billing overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI title="MRR" value={fmt(d?.mrr)} sub="Monthly Recurring Revenue" icon={TrendingUp} color="indigo" />
        <KPI title="ARR" value={fmt(d?.arr)} sub="Annual Recurring Revenue" icon={BarChart3} color="emerald" />
        <KPI title="Active Subscriptions" value={d?.summary?.active_subs || 0} sub={`${d?.summary?.trial_subs || 0} on trial`} icon={Users} color="amber" />
        <KPI title="Cancelled / Expired" value={(parseInt(d?.summary?.cancelled_subs || 0) + parseInt(d?.summary?.expired_subs || 0))} sub="Total churned" icon={AlertTriangle} color="red" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Revenue by plan */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Revenue by Plan</h3>
          <div className="space-y-3">
            {(d?.byPlan || []).map(p => (
              <div key={p.code}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{p.name}</span>
                  <span className="text-xs text-gray-500">{p.companies} co · {fmt(p.mrr_contribution)}/mo</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                    style={{ width: `${Math.min(100, (parseFloat(p.mrr_contribution) / (parseFloat(d?.mrr) || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {(!d?.byPlan || d.byPlan.length === 0) && (
              <p className="text-xs text-gray-400 text-center py-4">No active subscriptions yet</p>
            )}
          </div>
        </div>

        {/* Monthly revenue chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Monthly Revenue (Last 12 Mo)</h3>
          {(!d?.monthlyRevenue || d.monthlyRevenue.length === 0) ? (
            <p className="text-xs text-gray-400 text-center py-4">No payments recorded yet</p>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {d.monthlyRevenue.map(r => (
                <div key={r.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div
                    className="w-full bg-indigo-500 rounded-t-sm hover:bg-indigo-600 transition-colors cursor-default"
                    style={{ height: `${(parseFloat(r.revenue) / maxRevenue) * 100}%`, minHeight: '4px' }}
                    title={`${r.month}: ${fmt(r.revenue)}`}
                  />
                  <span className="text-[9px] text-gray-400 truncate w-full text-center">
                    {r.month.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent payments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Recent Payments</h3>
          <CreditCard size={16} className="text-gray-400" />
        </div>
        {(!d?.recentPayments || d.recentPayments.length === 0) ? (
          <div className="py-8 text-center text-xs text-gray-400">No payments yet</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] text-gray-400 uppercase tracking-wide text-left">
                <th className="px-5 py-2.5">Company</th>
                <th className="px-5 py-2.5">Invoice</th>
                <th className="px-5 py-2.5">Date</th>
                <th className="px-5 py-2.5 text-right">Amount</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {d.recentPayments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5 font-medium text-gray-800">{p.company_name}</td>
                  <td className="px-5 py-2.5 font-mono text-indigo-700">{p.invoice_number || '—'}</td>
                  <td className="px-5 py-2.5 text-gray-500">{fmtDate(p.paid_at)}</td>
                  <td className="px-5 py-2.5 text-right font-semibold">{fmt(p.amount)}</td>
                  <td className="px-5 py-2.5">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium',
                      p.status === 'captured' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Revenue;
