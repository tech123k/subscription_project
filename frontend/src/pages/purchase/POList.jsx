import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, Edit, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { poAPI } from '../../services/api';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';

const STATUS_COLORS = {
  draft: 'default',
  sent: 'warning',
  confirmed: 'info',
  partial: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  confirmed: 'Confirmed',
  partial: 'Partially Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUSES = ['', 'draft', 'sent', 'confirmed', 'partial', 'completed', 'cancelled'];

const POList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['po', page, search, status],
    queryFn: () => poAPI.getAll({ page, limit: 20, search, status }),
  });

  const pos = data?.data || [];
  const meta = data?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id) => poAPI.delete(id),
    onSuccess: () => {
      toast.success('Purchase Order cancelled');
      queryClient.invalidateQueries({ queryKey: ['po'] });
      setDeleteId(null);
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete PO'),
  });

  const columns = [
    {
      header: 'PO Number',
      cell: (row) => (
        <div>
          <p className="font-semibold text-sm text-gray-900">{row.po_number}</p>
          <p className="text-xs text-gray-500">{row.created_at ? format(new Date(row.created_at), 'MMM d, yyyy') : '—'}</p>
        </div>
      ),
    },
    { header: 'Supplier', cell: (r) => <span className="text-sm">{r.supplier_name || '—'}</span> },
    {
      header: 'Expected Delivery',
      cell: (r) => (
        <span className="text-sm text-gray-600">
          {r.expected_delivery ? format(new Date(r.expected_delivery), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    { header: 'Items', cell: (r) => <span className="text-sm font-medium">{r.item_count}</span> },
    {
      header: 'Total Amount',
      cell: (r) => (
        <span className="font-semibold text-sm">
          ₹{Number(r.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (r) => (
        <Badge variant={STATUS_COLORS[r.status] || 'default'}>
          {STATUS_LABELS[r.status] || r.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/po/${row.id}`); }}
            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
            title="View"
          >
            <Eye size={14} />
          </button>
          {['draft', 'sent'].includes(row.status) && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/po/${row.id}/edit`); }}
              className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"
              title="Edit"
            >
              <Edit size={14} />
            </button>
          )}
          {['draft', 'sent'].includes(row.status) && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
              title="Cancel PO"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} orders</p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/po/create')} size="sm">New PO</Button>
      </div>

      {/* Status tabs */}
      <div className="overflow-x-auto">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl min-w-max">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {s === '' ? 'All' : STATUS_LABELS[s] || s}
          </button>
        ))}
      </div>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search PO number or supplier..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table
          columns={columns}
          data={pos}
          loading={isLoading}
          onRowClick={(row) => navigate(`/po/${row.id}`)}
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

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Cancel Purchase Order"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Keep PO</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteId)}>
              Cancel PO
            </Button>
          </>
        }
      >
        <p className="text-gray-600 text-sm">Are you sure you want to cancel this Purchase Order? This cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default POList;
