import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CheckCircle, XCircle, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { grnAPI } from '../../services/api';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';

const GRNList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [qcStatus, setQcStatus] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, poId }
  const [editForm, setEditForm] = useState({ qcStatus: '', acceptedQuantity: '', rejectedQuantity: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['grn', page, search, qcStatus],
    queryFn: () => grnAPI.getAll({ page, limit: 20, search, qcStatus }),
  });

  const grns = data?.data || [];
  const meta = data?.meta;

  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({
      qcStatus: row.qc_status || 'pending',
      acceptedQuantity: row.accepted_quantity ?? '',
      rejectedQuantity: row.rejected_quantity ?? '',
      notes: row.notes || '',
    });
  };

  const handleAcceptedChange = (val) => {
    const accepted = Number(val);
    const received = Number(editRow?.received_quantity || 0);
    setEditForm((p) => ({
      ...p,
      acceptedQuantity: val,
      rejectedQuantity: String(Math.max(0, received - accepted)),
    }));
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => grnAPI.update(id, data),
    onSuccess: () => {
      toast.success('GRN updated');
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      if (editRow?.po_id) {
        queryClient.invalidateQueries({ queryKey: ['po', editRow.po_id] });
        queryClient.invalidateQueries({ queryKey: ['po'] });
      }
      setEditRow(null);
    },
    onError: (err) => toast.error(err?.message || 'Failed to update GRN'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }) => grnAPI.delete(id),
    onSuccess: () => {
      toast.success('GRN deleted and stock reversed');
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      if (deleteTarget?.poId) {
        queryClient.invalidateQueries({ queryKey: ['po', deleteTarget.poId] });
        queryClient.invalidateQueries({ queryKey: ['po'] });
      }
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete GRN'),
  });

  const handleEditSubmit = () => {
    updateMutation.mutate({
      id: editRow.id,
      data: {
        qcStatus: editForm.qcStatus,
        acceptedQuantity: Number(editForm.acceptedQuantity),
        rejectedQuantity: Number(editForm.rejectedQuantity),
        notes: editForm.notes,
      },
    });
  };

  const columns = [
    {
      header: 'GRN',
      cell: (row) => (
        <div>
          <p className="font-semibold text-sm text-gray-900">{row.grn_number}</p>
          <p className="text-xs text-gray-500">{row.created_at ? format(new Date(row.created_at), 'MMM d, yyyy') : '—'}</p>
        </div>
      ),
    },
    { header: 'Material', cell: (r) => <div><p className="text-sm font-medium">{r.material_name}</p><p className="text-xs text-gray-400">{r.material_code}</p></div> },
    { header: 'Supplier', cell: (r) => <span className="text-sm">{r.supplier_name || '—'}</span> },
    {
      header: 'Received Qty',
      cell: (r) => <span className="font-bold text-sm">{Number(r.received_quantity).toFixed(2)} {r.unit}</span>,
    },
    {
      header: 'Accepted / Rejected',
      cell: (r) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle size={11} />
            <span>{Number(r.accepted_quantity).toFixed(2)}</span>
          </div>
          {Number(r.rejected_quantity) > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <XCircle size={11} />
              <span>{Number(r.rejected_quantity).toFixed(2)}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Unit Cost',
      cell: (r) => <span className="text-sm">₹{Number(r.unit_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>,
    },
    { header: 'QC Status', cell: (r) => <StatusBadge status={r.qc_status} /> },
    { header: 'Invoice No', cell: (r) => <span className="text-xs font-mono text-gray-600">{r.supplier_invoice_number || '—'}</span> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
            className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"
            title="Edit GRN"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: row.id, poId: row.po_id }); }}
            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
            title="Delete GRN"
          >
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
          <h1 className="text-xl font-bold text-gray-900">Goods Receipt Notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} GRNs</p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/grn/create')} size="sm">New GRN</Button>
      </div>

      {/* QC Status tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto">
        <div className="flex gap-1 min-w-max">
        {['', 'pending', 'approved', 'rejected', 'conditional'].map((s) => (
          <button key={s} onClick={() => { setQcStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${qcStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        </div>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search GRN number or supplier..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={grns} loading={isLoading} />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editRow}
        onClose={() => setEditRow(null)}
        title={`Edit GRN — ${editRow?.grn_number}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button loading={updateMutation.isPending} onClick={handleEditSubmit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">QC Status</label>
            <select
              value={editForm.qcStatus}
              onChange={(e) => setEditForm((p) => ({ ...p, qcStatus: e.target.value }))}
              className="input-field"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="conditional">Conditional</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Accepted Qty</label>
              <input
                type="number"
                value={editForm.acceptedQuantity}
                onChange={(e) => handleAcceptedChange(e.target.value)}
                className="input-field"
                min="0"
                max={editRow?.received_quantity}
                step="0.01"
              />
            </div>
            <div>
              <label className="label">Rejected Qty</label>
              <input
                type="number"
                value={editForm.rejectedQuantity}
                onChange={(e) => setEditForm((p) => ({ ...p, rejectedQuantity: e.target.value }))}
                className="input-field"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              className="input-field resize-none"
              rows={2}
            />
          </div>
          <p className="text-xs text-gray-400">
            Received: <span className="font-medium">{Number(editRow?.received_quantity || 0).toFixed(2)} {editRow?.unit}</span>
            {' · '}Changing QC status or accepted qty will automatically adjust material stock.
          </p>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete GRN"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget)}>
              Delete & Reverse Stock
            </Button>
          </>
        }
      >
        <p className="text-gray-600 text-sm">
          This will cancel the GRN and <strong>reverse the stock addition</strong> that was made when it was received. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default GRNList;
