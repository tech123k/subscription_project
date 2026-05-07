import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Search, Users, CheckCircle, XCircle, Edit, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { superAdminAPI } from '../../services/api';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { humanize, formatDate } from '../../utils/helpers';
import { SUBSCRIPTION_PLANS } from '../../utils/constants';
import toast from 'react-hot-toast';

const planColors = { trial: 'default', basic: 'info', professional: 'warning', enterprise: 'success' };

const CompanyList = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-companies', page, search, plan],
    queryFn: () => superAdminAPI.getCompanies({ page, limit: 20, search, plan }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => superAdminAPI.toggleCompany(id, { isActive }),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    },
  });

  const extendTrial = useMutation({
    mutationFn: ({ id, days }) => superAdminAPI.extendSubscription(id, { days }),
    onSuccess: () => {
      toast.success('Subscription extended');
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    },
  });

  const companies = data?.data || [];
  const meta = data?.meta;

  const columns = [
    {
      header: 'Company',
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.logo_url ? (
            <img src={row.logo_url} alt={row.name} className="w-9 h-9 rounded-lg object-contain border border-gray-100" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
              <Building2 size={16} className="text-primary-600" />
            </div>
          )}
          <div>
            <p className="font-semibold text-sm text-gray-900">{row.name}</p>
            <p className="text-xs text-gray-500">{humanize(row.industry_type || '')} • {row.subdomain || row.id.slice(0, 8)}</p>
          </div>
        </div>
      ),
    },
    { header: 'Admin', cell: (r) => <div><p className="text-sm font-medium">{r.admin_name || '—'}</p><p className="text-xs text-gray-400">{r.admin_email}</p></div> },
    {
      header: 'Plan',
      cell: (r) => <Badge variant={planColors[r.subscription_plan] || 'default'}>{r.subscription_plan}</Badge>,
    },
    {
      header: 'Subscription',
      cell: (r) => (
        <div className="text-xs">
          <p className="font-medium text-gray-900">Expires: {formatDate(r.subscription_expires_at)}</p>
          {new Date(r.subscription_expires_at) < new Date() && (
            <span className="text-red-600 font-semibold">Expired</span>
          )}
        </div>
      ),
    },
    {
      header: 'Users',
      cell: (r) => (
        <div className="flex items-center gap-1 text-sm">
          <Users size={13} className="text-gray-400" />
          <span className="font-medium">{r.user_count || 0}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} />,
    },
    { header: 'Joined', cell: (r) => <span className="text-xs text-gray-500">{formatDate(r.created_at)}</span> },
    {
      header: '',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); toggle.mutate({ id: r.id, isActive: !r.is_active }); }}
            className={`p-1.5 rounded transition-colors ${r.is_active ? 'hover:bg-red-50 text-gray-400 hover:text-red-600' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'}`}
            title={r.is_active ? 'Deactivate' : 'Activate'}
          >
            {r.is_active ? <XCircle size={15} /> : <CheckCircle size={15} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const days = prompt(`Extend subscription for ${r.name} by how many days?`);
              if (!days || isNaN(days)) return;
              extendTrial.mutate({ id: r.id, days: Number(days) });
            }}
            className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"
            title="Extend Subscription"
          >
            <Shield size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">All Companies</h1>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Super Admin</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} companies registered</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search company name or email..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Plans</option>
            {SUBSCRIPTION_PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Companies', value: meta?.total || 0 },
          { label: 'Active', value: meta?.active || 0, color: 'text-green-600' },
          { label: 'Trial', value: meta?.trial || 0, color: 'text-amber-600' },
          { label: 'Expired', value: meta?.expired || 0, color: 'text-red-600' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color || 'text-gray-900'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={companies} loading={isLoading} />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
      </div>
    </div>
  );
};

export default CompanyList;
