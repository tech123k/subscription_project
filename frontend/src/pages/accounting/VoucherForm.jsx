import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { accountingAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const VOUCHER_TYPES = [
  { value: 'payment',     label: 'Payment',     color: 'text-red-600 bg-red-50',     hint: 'Cash/Bank going out' },
  { value: 'receipt',     label: 'Receipt',     color: 'text-emerald-600 bg-emerald-50', hint: 'Cash/Bank coming in' },
  { value: 'journal',     label: 'Journal',     color: 'text-indigo-600 bg-indigo-50',   hint: 'General adjustments' },
  { value: 'contra',      label: 'Contra',      color: 'text-orange-600 bg-orange-50',   hint: 'Bank ↔ Cash transfers' },
  { value: 'sales',       label: 'Sales',       color: 'text-teal-600 bg-teal-50',       hint: 'Customer invoice entry' },
  { value: 'purchase',    label: 'Purchase',    color: 'text-violet-600 bg-violet-50',   hint: 'Supplier bill entry' },
  { value: 'debit_note',  label: 'Debit Note',  color: 'text-yellow-700 bg-yellow-50',  hint: 'Purchase return / debit' },
  { value: 'credit_note', label: 'Credit Note', color: 'text-sky-600 bg-sky-50',         hint: 'Sales return / credit' },
];

const emptyEntry = () => ({ id: crypto.randomUUID(), accountId: '', entryType: 'debit', amount: '', narration: '' });

const VoucherForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const [voucherType, setVoucherType] = useState(searchParams.get('type') || 'payment');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [entries, setEntries] = useState([emptyEntry(), emptyEntry()]);

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountingAPI.getAccounts({ active: 'true' }),
    staleTime: 5 * 60_000,
  });
  const accounts = accountsData?.data || [];

  // Recalculate balance
  const totalDr = entries.filter(e => e.entryType === 'debit').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalCr = entries.filter(e => e.entryType === 'credit').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const diff = Math.abs(totalDr - totalCr);
  const balanced = diff < 0.01 && totalDr > 0;

  // When voucher type changes, set sensible defaults
  useEffect(() => {
    if (voucherType === 'payment' || voucherType === 'receipt') {
      // Keep entries but reset
    }
  }, [voucherType]);

  const mutation = useMutation({
    mutationFn: (data) => accountingAPI.createVoucher(data),
    onSuccess: (res) => {
      toast.success(`Voucher ${res?.data?.voucher_number} posted!`);
      qc.invalidateQueries({ queryKey: ['vouchers'] });
      navigate('/accounting/day-book');
    },
    onError: (e) => toast.error(e?.message || 'Failed to save voucher'),
  });

  const handleSubmit = () => {
    if (!balanced) { toast.error('Voucher is unbalanced — Debit must equal Credit'); return; }
    const valid = entries.filter(e => e.accountId && parseFloat(e.amount) > 0);
    if (valid.length < 2) { toast.error('At least 2 valid entries required'); return; }

    mutation.mutate({
      voucherType,
      voucherDate,
      narration,
      referenceNumber,
      entries: valid.map(e => ({
        accountId: e.accountId,
        entryType: e.entryType,
        amount: parseFloat(e.amount),
        narration: e.narration || null,
      })),
    });
  };

  const addEntry = (type = 'debit') => setEntries(p => [...p, { ...emptyEntry(), entryType: type }]);
  const removeEntry = (id) => setEntries(p => p.filter(e => e.id !== id));
  const updateEntry = (id, field, value) => setEntries(p => p.map(e => e.id === id ? { ...e, [field]: value } : e));

  const debitEntries  = entries.filter(e => e.entryType === 'debit');
  const creditEntries = entries.filter(e => e.entryType === 'credit');

  const selectedType = VOUCHER_TYPES.find(t => t.value === voucherType);

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Voucher</h1>
          <p className="text-xs text-gray-400 mt-0.5">Double-entry accounting — Debit must equal Credit</p>
        </div>
      </div>

      {/* Voucher Type Selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">Voucher Type</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VOUCHER_TYPES.map(t => (
            <button key={t.value} type="button" onClick={() => setVoucherType(t.value)}
              className={clsx(
                'rounded-xl border-2 px-3 py-2 text-left transition-all',
                voucherType === t.value
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-100 hover:border-indigo-200 bg-white'
              )}>
              <p className={clsx('text-xs font-bold', voucherType === t.value ? 'text-indigo-700' : 'text-gray-800')}>
                {t.label}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{t.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Voucher Metadata */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date <span className="text-red-400">*</span></label>
            <input type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ref. Number</label>
            <input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)}
              placeholder="e.g. INV-001, CH-123"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Narration</label>
            <input value={narration} onChange={e => setNarration(e.target.value)}
              placeholder="Being payment of…"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
      </div>

      {/* Dr/Cr Entries — split columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Debit Entries */}
        <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden">
          <div className="bg-blue-50 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Debit (Dr)</span>
            <span className="text-xs font-mono text-blue-600">₹{totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-3 space-y-2">
            {debitEntries.map(e => (
              <EntryRow key={e.id} entry={e} accounts={accounts} onUpdate={updateEntry} onRemove={removeEntry}
                canRemove={debitEntries.length > 1} />
            ))}
            <button onClick={() => addEntry('debit')}
              className="w-full text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 py-1.5 hover:bg-blue-50 rounded-lg px-2 transition-colors">
              <Plus size={13} /> Add Debit Entry
            </button>
          </div>
        </div>

        {/* Credit Entries */}
        <div className="bg-white rounded-2xl border-2 border-purple-100 shadow-sm overflow-hidden">
          <div className="bg-purple-50 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Credit (Cr)</span>
            <span className="text-xs font-mono text-purple-600">₹{totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-3 space-y-2">
            {creditEntries.map(e => (
              <EntryRow key={e.id} entry={e} accounts={accounts} onUpdate={updateEntry} onRemove={removeEntry}
                canRemove={creditEntries.length > 1} />
            ))}
            <button onClick={() => addEntry('credit')}
              className="w-full text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 py-1.5 hover:bg-purple-50 rounded-lg px-2 transition-colors">
              <Plus size={13} /> Add Credit Entry
            </button>
          </div>
        </div>
      </div>

      {/* Balance Status */}
      <div className={clsx(
        'flex items-center gap-3 rounded-xl px-4 py-3 border',
        balanced
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      )}>
        {balanced
          ? <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
          : <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />}
        <div className="flex-1 text-xs">
          {balanced
            ? <span className="text-emerald-700 font-semibold">Voucher is balanced — ₹{totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            : <span className="text-amber-700">
                Unbalanced: Dr ₹{totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })} vs
                Cr ₹{totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                {' '}— difference ₹{diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        <Button loading={mutation.isPending} disabled={!balanced} onClick={handleSubmit}>
          Post Voucher
        </Button>
      </div>
    </div>
  );
};

// ── Entry Row ──────────────────────────────────────────────────────────────────
const EntryRow = ({ entry, accounts, onUpdate, onRemove, canRemove }) => (
  <div className="flex items-center gap-2">
    <select
      value={entry.accountId}
      onChange={e => onUpdate(entry.id, 'accountId', e.target.value)}
      className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-0"
    >
      <option value="">— Account —</option>
      {accounts.map(a => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
    <input
      type="number" min="0" step="0.01"
      value={entry.amount}
      onChange={e => onUpdate(entry.id, 'amount', e.target.value)}
      placeholder="0.00"
      className="w-24 text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right font-mono"
    />
    {canRemove && (
      <button onClick={() => onRemove(entry.id)}
        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0 transition-colors">
        <Trash2 size={12} />
      </button>
    )}
  </div>
);

export default VoucherForm;
