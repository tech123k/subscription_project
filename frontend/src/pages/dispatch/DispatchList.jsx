import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, Search, MapPin, Truck, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { dispatchAPI } from '../../services/api';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';

const DispatchList = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['dispatches', page, search, status],
    queryFn: () => dispatchAPI.getAll({ page, limit: 20, search, status }),
  });

  const dispatches = data?.data || [];
  const meta = data?.meta;

  const columns = [
    {
      header: 'Dispatch',
      cell: (row) => (
        <div>
          <p className="font-semibold text-sm text-gray-900">{row.dispatch_number}</p>
          <p className="text-xs text-gray-500">{row.invoice_number || 'No invoice'}</p>
        </div>
      ),
    },
    { header: 'Customer', cell: (row) => <span className="text-sm font-medium">{row.customer_name || '-'}</span> },
    {
      header: 'Vehicle / Transport',
      cell: (row) => (
        <div className="flex items-start gap-2">
          <Truck size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">{row.vehicle_number || '-'}</p>
            <p className="text-xs text-gray-500">{row.transport_name || '-'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Destination',
      cell: (row) => (
        <div className="flex items-start gap-2">
          <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm">{row.destination_city || '-'}</p>
            <p className="text-xs text-gray-500">{row.destination_state}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Dispatch Date',
      cell: (row) => (
        <div className="text-sm">
          <p>{row.dispatch_date ? format(new Date(row.dispatch_date), 'MMM d, yyyy') : '-'}</p>
          <p className="text-xs text-gray-500">
            {row.expected_delivery_date ? `Due: ${format(new Date(row.expected_delivery_date), 'MMM d')}` : ''}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.status} />
          {row.is_delayed && <Badge variant="danger" dot>Delayed</Badge>}
        </div>
      ),
    },
    {
      header: 'LR Number',
      cell: (row) => <span className="text-sm text-gray-600 font-mono">{row.lr_number || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dispatches</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} dispatches</p>
        </div>
        <div className="flex gap-2">
          <a href={dispatchAPI.export()} download>
            <Button variant="secondary" icon={Download} size="sm">Export</Button>
          </a>
          <Button icon={Plus} onClick={() => navigate('/dispatches/create')} size="sm">
            New Dispatch
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {['', 'ready', 'dispatched', 'in_transit', 'delivered'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === '' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search dispatch or vehicle..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table
          columns={columns}
          data={dispatches}
          loading={isLoading}
          onRowClick={(row) => navigate(`/dispatches/${row.id}`)}
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

export default DispatchList;
