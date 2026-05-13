import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Tag, ChevronDown, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { variantAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const DATA_TYPES = [
  { value: 'text',   label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'color',  label: 'Color' },
];

// ─── Value Form ───────────────────────────────────────────────────────────────
const ValueForm = ({ attributeId, dataType, onClose }) => {
  const [value, setValue]           = useState('');
  const [displayName, setDisplay]   = useState('');
  const [colorHex, setColorHex]     = useState('#000000');
  const qc = useQueryClient();

  const addMut = useMutation({
    mutationFn: (data) => variantAPI.addAttributeValue(attributeId, data),
    onSuccess: () => {
      toast.success('Value added');
      qc.invalidateQueries(['attributes']);
      setValue(''); setDisplay('');
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    addMut.mutate({ value: value.trim(), displayName: displayName.trim() || undefined, colorHex: dataType === 'color' ? colorHex : undefined });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 mt-3 bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200">
      <div className="flex-1 min-w-[120px]">
        <label className="text-[10px] text-gray-500 font-medium uppercase">Value *</label>
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. Medium"
          className="w-full mt-0.5 text-sm px-2.5 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      </div>
      <div className="flex-1 min-w-[120px]">
        <label className="text-[10px] text-gray-500 font-medium uppercase">Display Name</label>
        <input value={displayName} onChange={e => setDisplay(e.target.value)} placeholder="e.g. Medium (M)"
          className="w-full mt-0.5 text-sm px-2.5 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      </div>
      {dataType === 'color' && (
        <div>
          <label className="text-[10px] text-gray-500 font-medium uppercase">Colour</label>
          <input type="color" value={colorHex} onChange={e => setColorHex(e.target.value)}
            className="block mt-0.5 h-9 w-16 cursor-pointer rounded border border-gray-200" />
        </div>
      )}
      <Button type="submit" loading={addMut.isPending} icon={Plus} size="sm">Add</Button>
      <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-red-500">Cancel</button>
    </form>
  );
};

// ─── Attribute Card ───────────────────────────────────────────────────────────
const AttributeCard = ({ attr }) => {
  const [expanded, setExpanded]     = useState(false);
  const [showAddValue, setShowAdd]  = useState(false);
  const qc = useQueryClient();

  const delValueMut = useMutation({
    mutationFn: (id) => variantAPI.deleteAttributeValue(id),
    onSuccess: () => { toast.success('Value removed'); qc.invalidateQueries(['attributes']); },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  const activeValues = (attr.values || []).filter(v => v.is_active);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(x => !x)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Tag size={14} className="text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{attr.name}</p>
            <p className="text-[10px] text-gray-400 font-mono">{attr.code} · {attr.data_type}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            {activeValues.length} values
          </span>
          {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50">
          {/* Values grid */}
          <div className="mt-3 flex flex-wrap gap-2">
            {activeValues.map((v) => (
              <div key={v.id} className="group flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                {attr.data_type === 'color' && v.color_hex && (
                  <span className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                    style={{ background: v.color_hex }} />
                )}
                <span className="text-xs font-medium text-gray-700">{v.display_name || v.value}</span>
                <span className="text-[10px] text-gray-400 font-mono">{v.value}</span>
                <button
                  onClick={() => delValueMut.mutate(v.id)}
                  className="ml-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {activeValues.length === 0 && (
              <span className="text-xs text-gray-400 italic">No values yet</span>
            )}
          </div>

          {showAddValue ? (
            <ValueForm attributeId={attr.id} dataType={attr.data_type} onClose={() => setShowAdd(false)} />
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Plus size={12} /> Add value
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AttributeMaster = () => {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState({ name: '', code: '', dataType: 'text', isRequired: false, sortOrder: 0 });
  const [values, setValues]         = useState([{ value: '', displayName: '' }]);

  const { data, isLoading } = useQuery({
    queryKey: ['attributes'],
    queryFn: variantAPI.getAttributes,
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (payload) => variantAPI.createAttribute(payload),
    onSuccess: () => {
      toast.success('Attribute created');
      qc.invalidateQueries(['attributes']);
      setShowCreate(false);
      setForm({ name: '', code: '', dataType: 'text', isRequired: false, sortOrder: 0 });
      setValues([{ value: '', displayName: '' }]);
    },
    onError: (e) => toast.error(e?.message || 'Failed to create attribute'),
  });

  const handleCodeFromName = (name) => {
    const code = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    setForm(f => ({ ...f, name, code }));
  };

  const addValueRow = () => setValues(v => [...v, { value: '', displayName: '' }]);
  const removeValueRow = (i) => setValues(v => v.filter((_, idx) => idx !== i));
  const updateValueRow = (i, field, val) => setValues(v => v.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return toast.error('Name and code required');
    createMut.mutate({
      ...form,
      values: values.filter(v => v.value.trim()),
    });
  };

  const attrs = data?.data || [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attribute Master</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Define product attributes (Size, Color, etc.) for variant generation
          </p>
        </div>
        <Button icon={Plus} onClick={() => setShowCreate(true)}>New Attribute</Button>
      </div>

      {/* Attribute list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : attrs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <Tag size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No attributes yet.</p>
          <p className="text-xs text-gray-300 mt-1">Create Size, Color, Material etc. to build product variants.</p>
          <div className="mt-4"><Button icon={Plus} onClick={() => setShowCreate(true)}>Create First Attribute</Button></div>
        </div>
      ) : (
        <div className="space-y-3">
          {attrs.map(attr => <AttributeCard key={attr.id} attr={attr} />)}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Attribute" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Attribute Name *</label>
              <input value={form.name} onChange={e => handleCodeFromName(e.target.value)}
                placeholder="e.g. Size"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SIZE"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Type</label>
              <select value={form.dataType} onChange={e => setForm(f => ({ ...f, dataType: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {DATA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="required" checked={form.isRequired}
                onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))}
                className="w-4 h-4 rounded text-indigo-600" />
              <label htmlFor="required" className="text-sm text-gray-700">Required attribute</label>
            </div>
          </div>

          {/* Initial values */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">Initial Values (optional)</label>
              <button type="button" onClick={addValueRow} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <Plus size={11} /> Add row
              </button>
            </div>
            <div className="space-y-2">
              {values.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={row.value} onChange={e => updateValueRow(i, 'value', e.target.value)}
                    placeholder="Value (e.g. S)"
                    className="flex-1 text-sm px-2.5 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <input value={row.displayName} onChange={e => updateValueRow(i, 'displayName', e.target.value)}
                    placeholder="Display (e.g. Small)"
                    className="flex-1 text-sm px-2.5 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  {values.length > 1 && (
                    <button type="button" onClick={() => removeValueRow(i)} className="text-red-400 hover:text-red-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending}>Create Attribute</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AttributeMaster;
