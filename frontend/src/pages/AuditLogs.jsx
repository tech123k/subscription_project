import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Shield, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { auditAPI } from '../services/api';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { humanize } from '../utils/helpers';

const actionColors = {
  create: 'text-green-700 bg-green-50',
  update: 'text-blue-700 bg-blue-50',
  delete: 'text-red-700 bg-red-50',
  login: 'text-purple-700 bg-purple-50',
  export: 'text-amber-700 bg-amber-50',
};

const AuditLogs = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detail, setDetail] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, search, action, entity, dateFrom, dateTo],
    queryFn: () => auditAPI.getAll({ page, limit: 30, search, action, entity, dateFrom, dateTo }),
  });

  const logs = data?.data || [];
  const meta = data?.meta;

  const columns = [
    {
      header: 'Action',
      cell: (r) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${actionColors[r.action] || 'text-gray-700 bg-gray-100'}`}>
          {r.action?.toUpperCase()}
        </span>
      ),
    },
    { header: 'Entity', cell: (r) => <span className="text-sm font-medium text-gray-900">{humanize(r.entity_type)}</span> },
    { header: 'Description', cell: (r) => <span className="text-sm text-gray-600 truncate max-w-[300px] block">{r.description || '—'}</span> },
    { header: 'User', cell: (r) => <div><p className="text-sm font-medium">{r.user_name || '—'}</p><p className="text-xs text-gray-400">{r.user_role?.replace(/_/g, ' ')}</p></div> },
    { header: 'IP Address', cell: (r) => <span className="text-xs font-mono text-gray-500">{r.ip_address || '—'}</span> },
    { header: 'Time', cell: (r) => <span className="text-xs text-gray-500 whitespace-nowrap">{format(new Date(r.created_at), 'MMM d, h:mm a')}</span> },
    {
      header: '',
      cell: (r) => (
        r.old_values || r.new_values ? (
          <button onClick={(e) => { e.stopPropagation(); setDetail(r); }}
            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600">
            <Eye size={14} />
          </button>
        ) : null
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all changes across the system</p>
        </div>
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500">{meta?.total || 0} events</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search description or user..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Actions</option>
            {['create', 'update', 'delete', 'login', 'export'].map((a) => (
              <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
            ))}
          </select>
          <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Entities</option>
            {['material', 'production_order', 'dispatch', 'invoice', 'user', 'warehouse', 'supplier', 'customer'].map((e) => (
              <option key={e} value={e}>{humanize(e)}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="From date" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="To date" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={logs} loading={isLoading} />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Change Detail</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            {detail.old_values && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Before</p>
                <pre className="text-xs bg-red-50 text-red-800 rounded-xl p-4 overflow-x-auto">{JSON.stringify(detail.old_values, null, 2)}</pre>
              </div>
            )}
            {detail.new_values && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">After</p>
                <pre className="text-xs bg-green-50 text-green-800 rounded-xl p-4 overflow-x-auto">{JSON.stringify(detail.new_values, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
