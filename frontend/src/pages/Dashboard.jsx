import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import {
  ShoppingCart, Factory, Truck, FileText, Package, AlertTriangle,
  TrendingUp, Clock, CheckCircle, XCircle, RefreshCw, MoreHorizontal,
} from 'lucide-react';
import { dashboardAPI } from '../services/api';
import { StatCard } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import Skeleton, { SkeletonCard } from '../components/ui/Skeleton';
import { format } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const PeriodSelect = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
  >
    <option value="7">Last 7 days</option>
    <option value="30">Last 30 days</option>
    <option value="90">Last 90 days</option>
    <option value="365">Last year</option>
  </select>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats', period],
    queryFn: () => dashboardAPI.getStats(period),
  });

  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ['dashboard', 'charts', period],
    queryFn: () => dashboardAPI.getCharts(period),
  });

  const { data: lowStock } = useQuery({
    queryKey: ['dashboard', 'low-stock'],
    queryFn: () => dashboardAPI.getLowStock(),
  });

  const { data: timeline } = useQuery({
    queryKey: ['dashboard', 'timeline'],
    queryFn: () => dashboardAPI.getProductionTimeline(),
  });

  const s = stats?.data;
  const c = charts?.data;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>

      {/* Alert banner for low stock */}
      {lowStock?.data?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 flex items-start sm:items-center gap-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              {lowStock.data.length} material{lowStock.data.length > 1 ? 's' : ''} at low stock level
            </p>
            <p className="text-xs text-red-600 mt-0.5">Immediate restocking required</p>
          </div>
          <button
            onClick={() => navigate('/materials?lowStock=true')}
            className="text-sm text-red-700 font-medium hover:text-red-900 underline flex-shrink-0"
          >
            View All
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statsLoading ? (
          [...Array(8)].map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Revenue"
              value={`₹${Number(s?.revenue?.total_revenue || 0).toLocaleString('en-IN')}`}
              subtitle={`${period} day period`}
              icon={TrendingUp}
              color="primary"
            />
            <StatCard
              title="Running Production"
              value={s?.production?.running || 0}
              subtitle={`${s?.production?.delayed || 0} delayed`}
              icon={Factory}
              color={s?.production?.delayed > 0 ? 'warning' : 'success'}
            />
            <StatCard
              title="Pending Dispatch"
              value={s?.dispatches?.in_transit || 0}
              subtitle="In transit"
              icon={Truck}
              color="info"
            />
            <StatCard
              title="Outstanding"
              value={`₹${Number(s?.pendingInvoices?.amount || 0).toLocaleString('en-IN')}`}
              subtitle={`${s?.pendingInvoices?.count || 0} invoices`}
              icon={FileText}
              color="danger"
            />
            <StatCard
              title="Total Orders"
              value={s?.orders?.total || 0}
              subtitle={`${s?.orders?.pending || 0} pending`}
              icon={ShoppingCart}
              color="purple"
            />
            <StatCard
              title="Stock Value"
              value={`₹${Number(s?.stock?.stock_value || 0).toLocaleString('en-IN')}`}
              subtitle={`${s?.stock?.total_materials || 0} materials`}
              icon={Package}
              color="success"
            />
            <StatCard
              title="Completed Production"
              value={s?.production?.completed || 0}
              subtitle="This period"
              icon={CheckCircle}
              color="success"
            />
            <StatCard
              title="Low Stock Items"
              value={s?.stock?.low_stock_count || 0}
              subtitle="Need restocking"
              icon={AlertTriangle}
              color={s?.stock?.low_stock_count > 0 ? 'danger' : 'success'}
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue Chart */}
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="font-semibold text-gray-900">Revenue Trend</h3>
          </div>
          {chartsLoading ? (
            <Skeleton className="h-40 sm:h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={c?.revenueChart || []}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v?.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} width={45} />
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Production Status Pie */}
        <div className="card p-4 sm:p-6">
          <h3 className="font-semibold text-gray-900 mb-4 sm:mb-6">Production Status</h3>
          {chartsLoading ? (
            <Skeleton className="h-40 sm:h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={c?.productionChart || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  dataKey="count"
                  nameKey="status"
                  label={({ status, count }) => `${status}: ${count}`}
                  labelLine={false}
                >
                  {(c?.productionChart || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Low Stock Table */}
        <div className="card">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Low Stock Alerts</h3>
            <button onClick={() => navigate('/materials?lowStock=true')} className="text-xs text-primary-600 font-medium">View All</button>
          </div>
          <div className="divide-y divide-gray-50">
            {(lowStock?.data || []).slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 sm:px-6 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 truncate">{item.code} • {item.warehouse_name}</p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-sm font-bold text-red-600">{item.current_stock} {item.unit}</p>
                  <p className="text-xs text-gray-400">Min: {item.minimum_stock}</p>
                </div>
              </div>
            ))}
            {!(lowStock?.data?.length) && (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                <CheckCircle size={24} className="mx-auto mb-2 text-green-400" />
                All stock levels are healthy
              </div>
            )}
          </div>
        </div>

        {/* Production Timeline */}
        <div className="card">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Active Production</h3>
            <button onClick={() => navigate('/production')} className="text-xs text-primary-600 font-medium">View All</button>
          </div>
          <div className="divide-y divide-gray-50">
            {(timeline?.data || []).slice(0, 6).map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/production/${item.id}`)}
                className="flex items-center justify-between px-4 sm:px-6 py-3 cursor-pointer hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: item.stage_color || '#3b82f6' }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.order_number}</p>
                    <p className="text-xs text-gray-500 truncate">{item.product_name} • {item.current_stage}</p>
                  </div>
                </div>
                <div className="ml-3 flex-shrink-0">
                  {item.is_delayed ? (
                    <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                      <Clock size={12} /> Delayed
                    </span>
                  ) : (
                    <StatusBadge status={item.status} />
                  )}
                </div>
              </div>
            ))}
            {!(timeline?.data?.length) && (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No active production orders</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
