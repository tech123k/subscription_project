import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Upload, Search, AlertTriangle, Eye, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const downloadBlob = async (apiFn, filename) => {
  try {
    const blob = await apiFn();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Download failed');
  }
};
import { materialAPI } from '../../services/api';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { usePermission } from '../../hooks/usePermission';

const MaterialList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ lowStock: '', categoryId: '', warehouseId: '' });
  const [deleteId, setDeleteId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['materials', page, search, filters],
    queryFn: () => materialAPI.getAll({ page, limit: 20, search, ...filters }),
  });

  const { data: categories } = useQuery({
    queryKey: ['material-categories'],
    queryFn: materialAPI.getCategories,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => materialAPI.delete(id),
    onSuccess: () => {
      toast.success('Material deleted');
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setDeleteId(null);
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete material'),
  });

  const materials = data?.data || [];
  const meta = data?.meta;

  const columns = [
    {
      header: 'Material',
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.image_url ? (
            <img src={row.image_url} alt={row.name} className="w-10 h-10 rounded-lg object-cover border" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold">
              {row.code?.slice(0, 2)}
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900 text-sm">{row.name}</p>
            <p className="text-xs text-gray-500">{row.code} • {row.category_name || 'Uncategorized'}</p>
          </div>
        </div>
      ),
    },
    { header: 'Unit', accessor: 'unit', cell: (row) => <span className="uppercase text-xs font-medium">{row.unit}</span> },
    { header: 'HSN Code', accessor: 'hsn_code', cell: (row) => <span className="text-gray-600">{row.hsn_code || '-'}</span> },
    {
      header: 'Current Stock',
      cell: (row) => (
        <div>
          <span className={`font-semibold text-sm ${row.current_stock <= row.minimum_stock ? 'text-red-600' : 'text-gray-900'}`}>
            {Number(row.current_stock).toFixed(2)} {row.unit}
          </span>
          {row.current_stock <= row.minimum_stock && (
            <div className="flex items-center gap-1 mt-0.5">
              <AlertTriangle size={10} className="text-red-500" />
              <span className="text-xs text-red-500">Low Stock</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Purchase Rate',
      cell: (row) => <span className="font-medium">₹{Number(row.purchase_rate).toFixed(2)}</span>,
    },
    {
      header: 'Stock Value',
      cell: (row) => (
        <span className="text-primary-700 font-semibold">
          ₹{(row.current_stock * row.purchase_rate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      ),
    },
    { header: 'Warehouse', accessor: 'warehouse_name', cell: (row) => <span className="text-gray-600 text-sm">{row.warehouse_name || '-'}</span> },
    {
      header: 'Status',
      cell: (row) => <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/materials/${row.id}`); }} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="View">
            <Eye size={15} />
          </button>
          {can('edit') && (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/materials/${row.id}/edit`); }} className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600" title="Edit">
              <Edit size={15} />
            </button>
          )}
          {can('delete') && (
            <button onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Material Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} materials</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadBlob(materialAPI.template, 'material_template.xlsx')} className="btn-secondary flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-200">
            <Download size={15} /> Template
          </button>
          <button onClick={() => downloadBlob(materialAPI.export, 'materials.xlsx')} className="btn-secondary flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-200">
            <Download size={15} /> Export
          </button>
          {can('import') && (
            <Button variant="secondary" icon={Upload} onClick={() => navigate('/materials/import')} size="sm">
              Import
            </Button>
          )}
          {can('create') && (
            <Button icon={Plus} onClick={() => navigate('/materials/create')} size="sm">
              Add Material
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
              placeholder="Search materials..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={filters.categoryId}
            onChange={(e) => { setFilters((f) => ({ ...f, categoryId: e.target.value })); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {categories?.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={filters.lowStock}
            onChange={(e) => { setFilters((f) => ({ ...f, lowStock: e.target.value })); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Stock</option>
            <option value="true">Low Stock Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table columns={columns} data={materials} loading={isLoading} onRowClick={(row) => navigate(`/materials/${row.id}`)} />
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

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Material"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteId)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 text-sm">Are you sure you want to delete this material? This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default MaterialList;
