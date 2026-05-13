import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart, Factory, Truck, FileText, Package, AlertTriangle,
  TrendingUp, Clock, CheckCircle, ArrowUpRight, ArrowDownRight,
  Zap, BarChart3, Activity, RefreshCw,
} from 'lucide-react';
import { dashboardAPI } from '../services/api';
import { StatusBadge } from '../components/ui/Badge';
import { SkeletonCard } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

/* ── helpers ── */
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtK = (v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`);

const PeriodSelect = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-white text-slate-700 transition-all cursor-pointer"
  >
    <option value="7">Last 7 days</option>
    <option value="30">Last 30 days</option>
    <option value="90">Last 90 days</option>
    <option value="365">Last year</option>
  </select>
);

/* ── KPI Card ── */
const KpiCard = ({ title, value, subtitle, icon: Icon, color = 'primary', trend, urgent }) => {
  const palettes = {
    primary: { ring: 'ring-primary-100', iconBg: 'bg-primary-50',   iconColor: 'text-primary-600', accent: 'bg-primary-500' },
    success: { ring: 'ring-emerald-100', iconBg: 'bg-emerald-50',   iconColor: 'text-emerald-600', accent: 'bg-emerald-500' },
    warning: { ring: 'ring-amber-100',   iconBg: 'bg-amber-50',     iconColor: 'text-amber-600',   accent: 'bg-amber-500' },
    danger:  { ring: 'ring-red-100',     iconBg: 'bg-red-50',       iconColor: 'text-red-600',     accent: 'bg-red-500' },
    purple:  { ring: 'ring-violet-100',  iconBg: 'bg-violet-50',    iconColor: 'text-violet-600',  accent: 'bg-violet-500' },
    info:    { ring: 'ring-sky-100',     iconBg: 'bg-sky-50',       iconColor: 'text-sky-600',     accent: 'bg-sky-500' },
  };
  const p = palettes[color] || palettes.primary;

  return (
    <div className={`relative bg-white rounded-2xl border border-slate-100 shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden ${urgent ? 'ring-2 ring-red-200' : ''}`}>
      {/* top accent stripe */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${p.accent}`} />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${p.iconBg}`}>
            <Icon size={19} className={p.iconColor} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl sm:text-[1.6rem] font-extrabold text-slate-900 tracking-tight leading-none">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1.5 font-medium">{subtitle}</p>}
      </div>
    </div>
  );
};

/* ── Custom tooltip for charts ── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-dropdown px-3.5 py-2.5 text-xs">
      <p className="text-slate-500 mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>
          {typeof p.value === 'number' && p.name === 'revenue' ? `₹${fmt(p.value)}` : p.value}
        </p>
      ))}
    </div>
  );
};

/* ── Section header ── */
const SectionHead = ({ icon: Icon, title, action, actionLabel = 'View All' }) => (
  <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
    <div className="flex items-center gap-2.5">
      {Icon && <Icon size={15} className="text-slate-400" />}
      <h3 className="font-bold text-slate-900 text-sm tracking-tight">{title}</h3>
    </div>
    {action && (
      <button onClick={action} className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
        {actionLabel}
      </button>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════ */

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [period, setPeriod] = useState('30');

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats', period],
    queryFn: () => dashboardAPI.getStats(period),
  });

  const { data: chartsRes, isLoading: chartsLoading } = useQuery({
    queryKey: ['dashboard', 'charts', period],
    queryFn: () => dashboardAPI.getCharts(period),
  });

  const { data: lowStockRes } = useQuery({
    queryKey: ['dashboard', 'low-stock'],
    queryFn: () => dashboardAPI.getLowStock(),
  });

  const { data: timelineRes } = useQuery({
    queryKey: ['dashboard', 'timeline'],
    queryFn: () => dashboardAPI.getProductionTimeline(),
  });

  const s   = statsRes?.data;
  const c   = chartsRes?.data;
  const ls  = lowStockRes?.data || [];
  const tl  = timelineRes?.data || [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-5 sm:space-y-6 page-enter">

      {/* ── Hero banner ─────────────────────────────── */}
      <div className="relative bg-gradient-to-r from-primary-600 via-primary-700 to-violet-700 rounded-2xl p-5 sm:p-7 overflow-hidden shadow-lg shadow-primary-900/20">
        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute top-4 right-20 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-6 left-1/3 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-primary-200 text-sm font-semibold mb-1">
              {greeting}, {user?.firstName || 'there'} 👋
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Operations Dashboard
            </h1>
            <p className="text-primary-200 text-sm mt-1">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <PeriodSelect value={period} onChange={setPeriod} />
          </div>
        </div>
      </div>

      {/* ── Low stock alert banner ───────────────────── */}
      {ls.length > 0 && (
        <div className="alert-warning flex-wrap gap-3 sm:flex-nowrap">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">
              {ls.length} material{ls.length > 1 ? 's' : ''} below minimum stock level
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Immediate restocking is recommended</p>
          </div>
          <button
            onClick={() => navigate('/materials?lowStock=true')}
            className="text-sm font-bold text-amber-800 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap"
          >
            View Materials →
          </button>
        </div>
      )}

      {/* ── 8 KPI cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statsLoading ? (
          [...Array(8)].map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              title="Total Revenue"
              value={`₹${fmt(s?.revenue?.total_revenue)}`}
              subtitle={`Past ${period} days`}
              icon={TrendingUp}
              color="primary"
            />
            <KpiCard
              title="Running Orders"
              value={s?.production?.running || 0}
              subtitle={s?.production?.delayed > 0 ? `${s.production.delayed} delayed` : 'On schedule'}
              icon={Factory}
              color={s?.production?.delayed > 0 ? 'warning' : 'success'}
              urgent={s?.production?.delayed > 0}
            />
            <KpiCard
              title="In Transit"
              value={s?.dispatches?.in_transit || 0}
              subtitle="Pending dispatch"
              icon={Truck}
              color="info"
            />
            <KpiCard
              title="Outstanding"
              value={fmtK(s?.pendingInvoices?.amount || 0)}
              subtitle={`${s?.pendingInvoices?.count || 0} invoice${s?.pendingInvoices?.count !== 1 ? 's' : ''}`}
              icon={FileText}
              color="danger"
              urgent={(s?.pendingInvoices?.count || 0) > 0}
            />
            <KpiCard
              title="Sales Orders"
              value={s?.orders?.total || 0}
              subtitle={`${s?.orders?.pending || 0} pending`}
              icon={ShoppingCart}
              color="purple"
            />
            <KpiCard
              title="Stock Value"
              value={fmtK(s?.stock?.stock_value || 0)}
              subtitle={`${s?.stock?.total_materials || 0} materials`}
              icon={Package}
              color="success"
            />
            <KpiCard
              title="Completed"
              value={s?.production?.completed || 0}
              subtitle="Production orders"
              icon={CheckCircle}
              color="success"
            />
            <KpiCard
              title="Low Stock"
              value={s?.stock?.low_stock_count || 0}
              subtitle="Need restocking"
              icon={AlertTriangle}
              color={s?.stock?.low_stock_count > 0 ? 'danger' : 'success'}
              urgent={s?.stock?.low_stock_count > 0}
            />
          </>
        )}
      </div>

      {/* ── Charts row ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* Revenue Area Chart — 2/3 width */}
        <div className="card lg:col-span-2">
          <SectionHead icon={BarChart3} title="Revenue Trend" />
          <div className="p-4 sm:p-6">
            {chartsLoading ? (
              <div className="skeleton h-48 w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={c?.revenueChart || []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v) => v?.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v) => fmtK(v)}
                    width={48}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    fill="url(#revGrad)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Production Donut — 1/3 width */}
        <div className="card">
          <SectionHead icon={Zap} title="Production Status" />
          <div className="p-4 sm:p-5 flex flex-col items-center">
            {chartsLoading ? (
              <div className="skeleton h-40 w-40 rounded-full" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={c?.productionChart || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      dataKey="count"
                      nameKey="status"
                      paddingAngle={3}
                    >
                      {(c?.productionChart || []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => [v, name]}
                      contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* legend */}
                <div className="w-full space-y-1.5 mt-1">
                  {(c?.productionChart || []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-600 capitalize">{item.status}</span>
                      </div>
                      <span className="font-bold text-slate-800">{item.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom row ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

        {/* Low Stock Alerts */}
        <div className="card">
          <SectionHead
            icon={AlertTriangle}
            title="Low Stock Alerts"
            action={ls.length > 0 ? () => navigate('/materials?lowStock=true') : undefined}
          />
          <div className="divide-y divide-slate-50">
            {ls.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center justify-between px-5 sm:px-6 py-3.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{item.code} · {item.warehouse_name}</p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-sm font-bold text-red-600">{item.current_stock} <span className="font-normal text-slate-400">{item.unit}</span></p>
                  <p className="text-xs text-slate-400">Min: {item.minimum_stock}</p>
                </div>
              </div>
            ))}
            {!ls.length && (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={22} className="text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700">All stock levels healthy</p>
                <p className="text-xs text-slate-400 mt-0.5">No restocking needed right now</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Production */}
        <div className="card">
          <SectionHead
            icon={Activity}
            title="Active Production"
            action={() => navigate('/production')}
          />
          <div className="divide-y divide-slate-50">
            {tl.slice(0, 6).map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/production/${item.id}`)}
                className="flex items-center justify-between px-5 sm:px-6 py-3.5 cursor-pointer hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-offset-1"
                    style={{ background: item.stage_color || '#6366f1', ringColor: item.stage_color || '#6366f1' }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.order_number}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{item.product_name} · {item.current_stage}</p>
                  </div>
                </div>
                <div className="ml-3 flex-shrink-0">
                  {item.is_delayed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      <Clock size={11} /> Delayed
                    </span>
                  ) : (
                    <StatusBadge status={item.status} />
                  )}
                </div>
              </div>
            ))}
            {!tl.length && (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <RefreshCw size={22} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No active production orders</p>
                <p className="text-xs text-slate-400 mt-0.5">Start a production order to see it here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
