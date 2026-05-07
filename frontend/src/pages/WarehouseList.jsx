import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Warehouse, MapPin, Edit, Trash2, Package, Eye } from 'lucide-react';
import { warehouseAPI } from '../services/api';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/Badge';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '', code: '', address: '', city: '', state: '', pincode: '',
  contactPerson: '', phone: '', isDefault: false,
};

const WarehouseList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses', page, search],
    queryFn: () => warehouseAPI.getAll({ page, limit: 20, search }),
  });

  const warehouses = data?.data || [];
  const meta = data?.meta;

  const upsert = useMutation({
    mutationFn: (d) => editing ? warehouseAPI.update(editing.id, d) : warehouseAPI.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Warehouse updated' : 'Warehouse created');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id) => warehouseAPI.delete(id),
    onSuccess: () => {
      toast.success('Warehouse deleted');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (w) => {
    setEditing(w);
    setForm({
      name: w.name, code: w.code || '', address: w.address || '',
      city: w.city || '', state: w.state || '', pincode: w.pincode || '',
      contactPerson: w.contact_person || '', phone: w.phone || '',
      isDefault: w.is_default || false,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const columns = [
    {
      header: 'Warehouse',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <Warehouse size={16} className="text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-gray-900">{row.name}</p>
              {row.is_default && <span className="text-xs bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded font-medium">Default</span>}
            </div>
            <p className="text-xs text-gray-500">{row.code || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Location',
      cell: (r) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <MapPin size={12} className="text-gray-400" />
          {[r.city, r.state].filter(Boolean).join(', ') || '—'}
        </div>
      ),
    },
    { header: 'Contact', cell: (r) => <div className="text-xs"><p>{r.contact_person || '—'}</p><p className="text-gray-400">{r.phone || ''}</p></div> },
    {
      header: 'Materials',
      cell: (r) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Package size={13} className="text-gray-400" />
          <span className="font-medium">{r.material_count || 0}</span>
          <span className="text-gray-400">items</span>
        </div>
      ),
    },
    {
      header: '',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/warehouses/${r.id}`); }}
            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600">
            <Eye size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600">
            <Edit size={14} />
          </button>
          {!r.is_default && (
            <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this warehouse?')) remove.mutate(r.id); }}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Warehouses</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} warehouses</p>
        </div>
        <Button icon={Plus} onClick={openCreate} size="sm">New Warehouse</Button>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search warehouses..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={warehouses} loading={isLoading}
          onRowClick={(row) => navigate(`/warehouses/${row.id}`)} />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Warehouse' : 'New Warehouse'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button loading={upsert.isPending} onClick={() => upsert.mutate(form)}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Warehouse Name *</label>
              <input value={form.name} onChange={f('name')} className="input-field" placeholder="e.g. Main Warehouse" />
            </div>
            <div>
              <label className="label">Code</label>
              <input value={form.code} onChange={f('code')} className="input-field" placeholder="WH-01" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isDefault}
                  onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                <span className="text-sm text-gray-700">Set as Default</span>
              </label>
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input value={form.contactPerson} onChange={f('contactPerson')} className="input-field" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={f('phone')} className="input-field" type="tel" />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Address</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Address</label>
                <input value={form.address} onChange={f('address')} className="input-field" />
              </div>
              <div>
                <label className="label">City</label>
                <input value={form.city} onChange={f('city')} className="input-field" />
              </div>
              <div>
                <label className="label">State</label>
                <input value={form.state} onChange={f('state')} className="input-field" />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input value={form.pincode} onChange={f('pincode')} className="input-field" />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WarehouseList;
