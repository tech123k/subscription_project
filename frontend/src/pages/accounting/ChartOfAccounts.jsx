import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen, Layers, Edit2, RefreshCw, ChevronRight, X } from 'lucide-react';
import { accountingAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const TYPE_COLORS = {
  cash: 'bg-emerald-50 text-emerald-700',
  bank: 'bg-sky-50 text-sky-700',
  debtor: 'bg-violet-50 text-violet-700',
  creditor: 'bg-orange-50 text-orange-700',
  income: 'bg-teal-50 text-teal-700',
  expense: 'bg-red-50 text-red-700',
  stock: 'bg-amber-50 text-amber-700',
  duty_tax: 'bg-pink-50 text-pink-700',
  capital: 'bg-indigo-50 text-indigo-700',
  loan: 'bg-yellow-50 text-yellow-700',
  fixed_asset: 'bg-blue-50 text-blue-700',
  other: 'bg-gray-50 text-gray-700',
};

const ACCOUNT_TYPES = [
  'cash','bank','debtor','creditor','income','expense',
  'stock','duty_tax','capital','loan','fixed_asset','other',
];

const NATURES = { debit: 'Dr (Assets/Expenses)', credit: 'Cr (Liabilities/Income)' };

// ── Account Form Modal ─────────────────────────────────────────────────────────
const AccountModal = ({ open, onClose, groups, editData }) => {
  const qc = useQueryClient();
  const isEdit = Boolean(editData);
  const [form, setForm] = useState(editData ? {
    name: editData.name,
    code: editData.code || '',
    accountGroupId: editData.account_group_id,
    accountType: editData.account_type,
    openingBalance: editData.opening_balance || 0,
    openingBalanceType: editData.opening_balance_type || 'debit',
    gstApplicable: editData.gst_applicable || false,
    gstin: editData.gstin || '',
    notes: editData.notes || '',
    isActive: editData.is_active ?? true,
  } : {
    name: '', code: '', accountGroupId: '', accountType: 'other',
    openingBalance: 0, openingBalanceType: 'debit',
    gstApplicable: false, gstin: '', notes: '', isActive: true,
  });

  const mutation = useMutation({
    mutationFn: isEdit
      ? (d) => accountingAPI.updateAccount(editData.id, d)
      : (d) => accountingAPI.createAccount(d),
    onSuccess: () => {
      toast.success(isEdit ? 'Account updated' : 'Account created');
      qc.invalidateQueries({ queryKey: ['accounts'] });
      onClose();
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit Account' : 'New Ledger Account'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Account Name <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={f('name')} placeholder="e.g. HDFC Bank Current A/c"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
              <input value={form.code} onChange={f('code')} placeholder="e.g. BANK-001"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type <span className="text-red-400">*</span></label>
              <select value={form.accountType} onChange={f('accountType')}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Account Group <span className="text-red-400">*</span></label>
              <select value={form.accountGroupId} onChange={f('accountGroupId')}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">— Select Group —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.parent_name ? `  → ${g.name}` : g.name} ({g.nature})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Opening Balance (₹)</label>
              <input type="number" min="0" step="0.01" value={form.openingBalance} onChange={f('openingBalance')}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Balance Type</label>
              <select value={form.openingBalanceType} onChange={f('openingBalanceType')}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="debit">Debit (Dr)</option>
                <option value="credit">Credit (Cr)</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="gstApp" checked={form.gstApplicable}
                onChange={e => setForm(p => ({ ...p, gstApplicable: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 rounded" />
              <label htmlFor="gstApp" className="text-sm text-gray-700">GST Applicable</label>
            </div>
            {form.gstApplicable && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
                <input value={form.gstin} onChange={f('gstin')} placeholder="22AAAAA0000A1Z5"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={f('notes')} rows={2}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate(form)}>
            {isEdit ? 'Save Changes' : 'Create Account'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ChartOfAccounts = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | { type: 'account', data? }
  const [filterGroup, setFilterGroup] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  const { data: groupsData } = useQuery({
    queryKey: ['account-groups'],
    queryFn: accountingAPI.getAccountGroups,
    staleTime: 5 * 60_000,
  });
  const groups = groupsData?.data || [];

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts', filterGroup, filterType, search],
    queryFn: () => accountingAPI.getAccounts({ groupId: filterGroup || undefined, type: filterType || undefined, search: search || undefined }),
    staleTime: 60_000,
  });
  const accounts = accountsData?.data || [];

  const initMutation = useMutation({
    mutationFn: accountingAPI.init,
    onSuccess: () => {
      toast.success('Chart of Accounts initialised with default accounts');
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['account-groups'] });
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  // Group accounts by group name for display
  const grouped = accounts.reduce((acc, a) => {
    const key = a.group_name;
    if (!acc[key]) acc[key] = { nature: a.group_nature, items: [] };
    acc[key].items.push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage ledger masters for double-entry accounting</p>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && groups.length === 0 && (
            <Button variant="secondary" icon={RefreshCw} size="sm" loading={initMutation.isPending} onClick={() => initMutation.mutate()}>
              Init Default COA
            </Button>
          )}
          <Button icon={Plus} size="sm" onClick={() => setModal({ type: 'account' })}>
            New Account
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts…"
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">All Types</option>
          {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {/* Account table grouped by group */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <BookOpen size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm text-gray-500 font-medium">No accounts found</p>
          <p className="text-xs text-gray-400 mt-1">Click "Init Default COA" to seed standard accounts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([groupName, { nature, items }]) => (
            <div key={groupName} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className={clsx(
                'px-4 py-2.5 flex items-center gap-2 border-b',
                nature === 'debit' ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100'
              )}>
                <Layers size={14} className={nature === 'debit' ? 'text-blue-600' : 'text-purple-600'} />
                <span className={clsx('text-xs font-bold uppercase tracking-wide', nature === 'debit' ? 'text-blue-700' : 'text-purple-700')}>
                  {groupName}
                </span>
                <span className={clsx('ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium', nature === 'debit' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600')}>
                  {nature === 'debit' ? 'Dr nature' : 'Cr nature'}
                </span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-[10px] text-gray-400 uppercase tracking-wide text-left">
                    <th className="px-4 py-2">Account Name</th>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2 text-right">Opening Bal.</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {a.name}
                        {a.is_system && (
                          <span className="ml-2 text-[9px] bg-gray-100 text-gray-500 px-1 rounded">SYSTEM</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-500">{a.code || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={clsx('px-2 py-0.5 rounded text-[10px] font-medium', TYPE_COLORS[a.account_type] || TYPE_COLORS.other)}>
                          {a.account_type.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {parseFloat(a.opening_balance) !== 0
                          ? `₹${parseFloat(a.opening_balance).toLocaleString('en-IN')} ${a.opening_balance_type.toUpperCase()}`
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', a.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                          {a.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {!a.is_system && (
                          <button onClick={() => setModal({ type: 'account', data: a })}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                            <Edit2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'account' && (
        <AccountModal
          open
          groups={groups}
          editData={modal.data || null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default ChartOfAccounts;
