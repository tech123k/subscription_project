import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Shield, UserCheck, Edit, Trash2, Key } from 'lucide-react';
import { userAPI } from '../services/api';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/Badge';
import { getInitials, formatDate } from '../utils/helpers';
import { USER_ROLES } from '../utils/constants';
import toast from 'react-hot-toast';

const roleColors = {
  super_admin: 'bg-red-100 text-red-700',
  company_admin: 'bg-purple-100 text-purple-700',
  department_user: 'bg-blue-100 text-blue-700',
  read_only: 'bg-gray-100 text-gray-600',
};

const emptyForm = { fullName: '', email: '', password: '', role: 'department_user', department: '', phone: '' };

const UserManagement = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => userAPI.getAll({ search }),
  });

  const users = data?.data || [];

  const upsert = useMutation({
    mutationFn: (d) => editing ? userAPI.update(editing.id, d) : userAPI.create(d),
    onSuccess: () => {
      toast.success(editing ? 'User updated' : 'User created');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save user'),
  });

  const remove = useMutation({
    mutationFn: (id) => userAPI.delete(id),
    onSuccess: () => {
      toast.success('User removed');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password }) => userAPI.resetPassword(id, { password }),
    onSuccess: () => toast.success('Password reset'),
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ fullName: u.full_name, email: u.email, password: '', role: u.role, department: u.department || '', phone: u.phone || '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleResetPassword = (u) => {
    const pw = prompt(`New password for ${u.full_name}?`);
    if (!pw || pw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    resetPassword.mutate({ id: u.id, password: pw });
  };

  const columns = [
    {
      header: 'User',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold">
            {getInitials(row.full_name)}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">{row.full_name}</p>
            <p className="text-xs text-gray-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Role',
      cell: (r) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${roleColors[r.role] || 'bg-gray-100 text-gray-600'}`}>
          {r.role?.replace(/_/g, ' ')}
        </span>
      ),
    },
    { header: 'Department', cell: (r) => <span className="text-sm text-gray-600">{r.department || '—'}</span> },
    { header: 'Phone', cell: (r) => <span className="text-sm text-gray-600">{r.phone || '—'}</span> },
    { header: 'Status', cell: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} /> },
    { header: 'Joined', cell: (r) => <span className="text-xs text-gray-500">{formatDate(r.created_at)}</span> },
    {
      header: '',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600">
            <Edit size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleResetPassword(r); }}
            className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600" title="Reset Password">
            <Key size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Remove this user?')) remove.mutate(r.id); }}
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
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} users</p>
        </div>
        <Button icon={Plus} onClick={openCreate} size="sm">Add User</Button>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={users} loading={isLoading} />
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit User' : 'Add User'}
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
              <label className="label">Full Name *</label>
              <input value={form.fullName} onChange={f('fullName')} className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="label">Email *</label>
              <input value={form.email} onChange={f('email')} className="input-field" type="email" disabled={!!editing} />
            </div>
            {!editing && (
              <div className="col-span-2">
                <label className="label">Password *</label>
                <input value={form.password} onChange={f('password')} className="input-field" type="password" />
              </div>
            )}
            <div>
              <label className="label">Role *</label>
              <select value={form.role} onChange={f('role')} className="input-field">
                {USER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <input value={form.department} onChange={f('department')} className="input-field" placeholder="e.g. Production" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={f('phone')} className="input-field" type="tel" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UserManagement;
