import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, User, Phone, Mail, Edit, Trash2, MapPin } from 'lucide-react';
import { customerAPI } from '../services/api';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '', code: '', contactPerson: '', phone: '', email: '',
  gstNumber: '', address: '', city: '', state: '', pincode: '',
  creditLimit: '', creditDays: 30,
};

const CustomerList = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => customerAPI.getAll({ page, limit: 20, search }),
  });

  const customers = data?.data || [];
  const meta = data?.meta;

  const upsert = useMutation({
    mutationFn: (d) => editing ? customerAPI.update(editing.id, d) : customerAPI.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Customer updated' : 'Customer created');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id) => customerAPI.delete(id),
    onSuccess: () => {
      toast.success('Customer deleted');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name, code: c.code || '', contactPerson: c.contact_person || '',
      phone: c.phone || '', email: c.email || '', gstNumber: c.gst_number || '',
      address: c.address || '', city: c.city || '', state: c.state || '',
      pincode: c.pincode || '', creditLimit: c.credit_limit || '',
      creditDays: c.credit_days || 30,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const columns = [
    {
      header: 'Customer',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
            <User size={16} className="text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">{row.name}</p>
            <p className="text-xs text-gray-500">{row.code || '—'}</p>
          </div>
        </div>
      ),
    },
    { header: 'Contact', cell: (r) => <span className="text-sm">{r.contact_person || '—'}</span> },
    {
      header: 'Phone / Email',
      cell: (r) => (
        <div className="text-xs space-y-0.5">
          {r.phone && <div className="flex items-center gap-1 text-gray-600"><Phone size={11} />{r.phone}</div>}
          {r.email && <div className="flex items-center gap-1 text-gray-500"><Mail size={11} />{r.email}</div>}
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
    { header: 'GST', cell: (r) => <span className="text-xs font-mono text-gray-600">{r.gst_number || '—'}</span> },
    {
      header: 'Credit',
      cell: (r) => (
        <div className="text-xs">
          {r.credit_limit ? <p className="font-medium">₹{Number(r.credit_limit).toLocaleString('en-IN')}</p> : <p className="text-gray-400">No limit</p>}
          <p className="text-gray-500">{r.credit_days ?? 30}d</p>
        </div>
      ),
    },
    {
      header: '',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600">
            <Edit size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this customer?')) remove.mutate(r.id); }}
            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} customers</p>
        </div>
        <Button icon={Plus} onClick={openCreate} size="sm">New Customer</Button>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={customers} loading={isLoading} />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Customer' : 'New Customer'} size="lg"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Customer Name *</label>
              <input value={form.name} onChange={f('name')} className="input-field" placeholder="e.g. XYZ Industries" />
            </div>
            <div>
              <label className="label">Code</label>
              <input value={form.code} onChange={f('code')} className="input-field" placeholder="CUS-001" />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input value={form.contactPerson} onChange={f('contactPerson')} className="input-field" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={f('phone')} className="input-field" type="tel" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={form.email} onChange={f('email')} className="input-field" type="email" />
            </div>
            <div>
              <label className="label">GST Number</label>
              <input value={form.gstNumber} onChange={f('gstNumber')} className="input-field" placeholder="22AAAAA0000A1Z5" />
            </div>
            <div>
              <label className="label">Credit Days</label>
              <input value={form.creditDays} onChange={f('creditDays')} className="input-field" type="number" min="0" />
            </div>
            <div>
              <label className="label">Credit Limit (₹)</label>
              <input value={form.creditLimit} onChange={f('creditLimit')} className="input-field" type="number" min="0" placeholder="Leave blank for no limit" />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Address</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

export default CustomerList;
