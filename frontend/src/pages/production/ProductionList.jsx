import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Search, Clock, Factory, CheckCircle, XCircle, Eye, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { productionAPI } from '../../services/api';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { usePermission } from '../../hooks/usePermission';

const priorityColor = { high: 'danger', normal: 'default', low: 'info', urgent: 'danger' };

const ProductionList = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['production', page, search, status, priority],
    queryFn: () => productionAPI.getAll({ page, limit: 20, search, status, priority }),
  });

  const orders = data?.data || [];
  const meta = data?.meta;

  const columns = [
    {
      header: 'Order',
      cell: (row) => (
        <div>
          <p className="font-semibold text-sm text-gray-900">{row.order_number}</p>
          <p className="text-xs text-gray-500">{row.product_name}</p>
        </div>
      ),
    },
    { header: 'Customer', cell: (row) => <span className="text-sm">{row.customer_name || '-'}</span> },
    {
      header: 'Progress',
      cell: (row) => {
        const pct = row.planned_quantity > 0 ? Math.round((row.produced_quantity / row.planned_quantity) * 100) : 0;
        return (
          <div className="w-32">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">{row.produced_quantity}/{row.planned_quantity}</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Current Stage',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.stage_color && <div className="w-2 h-2 rounded-full" style={{ background: row.stage_color }} />}
          <span className="text-sm">{row.current_stage_name || 'Not Started'}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.status} />
          {row.is_delayed && (
            <Badge variant="danger" dot>Delayed</Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Priority',
      cell: (row) => <Badge variant={priorityColor[row.priority] || 'default'}>{row.priority}</Badge>,
    },
    {
      header: 'Planned Date',
      cell: (row) => (
        <div className="text-xs">
          <p>{row.planned_start_date ? format(new Date(row.planned_start_date), 'MMM d') : '-'}</p>
          <p className="text-gray-400">→ {row.planned_end_date ? format(new Date(row.planned_end_date), 'MMM d') : '-'}</p>
        </div>
      ),
    },
    {
      header: '',
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/production/${row.id}`); }}
          className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  const statusStats = [
    { label: 'Pending', value: data?.meta?.stats?.pending || 0, color: 'text-amber-600', icon: Clock },
    { label: 'Running', value: data?.meta?.stats?.running || 0, color: 'text-blue-600', icon: Factory },
    { label: 'Completed', value: data?.meta?.stats?.completed || 0, color: 'text-green-600', icon: CheckCircle },
    { label: 'Delayed', value: data?.meta?.stats?.delayed || 0, color: 'text-red-600', icon: XCircle },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Production Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} orders</p>
        </div>
        <div className="flex gap-2">
          <a href={productionAPI.export()} download>
            <Button variant="secondary" icon={Download} size="sm">Export</Button>
          </a>
          <Button icon={Plus} onClick={() => navigate('/production/create')} size="sm">
            New Order
          </Button>
          {can('create') && (
            <Button variant="secondary" onClick={() => navigate('/production/workflows')} size="sm">
              Workflows
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search orders..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table
          columns={columns}
          data={orders}
          loading={isLoading}
          onRowClick={(row) => navigate(`/production/${row.id}`)}
        />
        {meta && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
};

export default ProductionList;
