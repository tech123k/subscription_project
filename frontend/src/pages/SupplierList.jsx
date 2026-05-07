import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Building2, Phone, Mail, Edit, Trash2, MapPin } from 'lucide-react';
import { supplierAPI } from '../services/api';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/Badge';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '', code: '', contactPerson: '', phone: '', email: '',
  gstNumber: '', address: '', city: '', state: '', pincode: '',
  bankName: '', bankAccount: '', bankIfsc: '', creditDays: 30,
};

const SupplierList = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => supplierAPI.getAll({ page, limit: 20, search }),
  });

  const suppliers = data?.data || [];
  const meta = data?.meta;

  const upsert = useMutation({
    mutationFn: (d) => editing ? supplierAPI.update(editing.id, d) : supplierAPI.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Supplier updated' : 'Supplier created');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id) => supplierAPI.delete(id),
    onSuccess: () => {
      toast.success('Supplier deleted');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name, code: s.code || '', contactPerson: s.contact_person || '',
      phone: s.phone || '', email: s.email || '', gstNumber: s.gst_number || '',
      address: s.address || '', city: s.city || '', state: s.state || '',
      pincode: s.pincode || '', bankName: s.bank_name || '',
      bankAccount: s.bank_account || '', bankIfsc: s.bank_ifsc || '',
      creditDays: s.credit_days || 30,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const columns = [
    {
      header: 'Supplier',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
            <Building2 size={16} className="text-primary-600" />
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
    { header: 'Credit Days', cell: (r) => <span className="text-sm">{r.credit_days ?? 30}d</span> },
    {
      header: '',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600">
            <Edit size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this supplier?')) remove.mutate(r.id); }}
            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} suppliers</p>
        </div>
        <Button icon={Plus} onClick={openCreate} size="sm">New Supplier</Button>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search suppliers..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={suppliers} loading={isLoading} />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Supplier' : 'New Supplier'} size="lg"
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
              <label className="label">Supplier Name *</label>
              <input value={form.name} onChange={f('name')} className="input-field" placeholder="e.g. ABC Traders" />
            </div>
            <div>
              <label className="label">Code</label>
              <input value={form.code} onChange={f('code')} className="input-field" placeholder="SUP-001" />
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

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bank Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Bank Name</label>
                <input value={form.bankName} onChange={f('bankName')} className="input-field" />
              </div>
              <div>
                <label className="label">Account Number</label>
                <input value={form.bankAccount} onChange={f('bankAccount')} className="input-field" />
              </div>
              <div>
                <label className="label">IFSC Code</label>
                <input value={form.bankIfsc} onChange={f('bankIfsc')} className="input-field" />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SupplierList;
