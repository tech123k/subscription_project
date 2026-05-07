import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Package, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { grnAPI } from '../../services/api';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';

const GRNList = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [qcStatus, setQcStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['grn', page, search, qcStatus],
    queryFn: () => grnAPI.getAll({ page, limit: 20, search, qcStatus }),
  });

  const grns = data?.data || [];
  const meta = data?.meta;

  const columns = [
    {
      header: 'GRN',
      cell: (row) => (
        <div>
          <p className="font-semibold text-sm text-gray-900">{row.grn_number}</p>
          <p className="text-xs text-gray-500">{format(new Date(row.received_date), 'MMM d, yyyy')}</p>
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
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Goods Receipt Notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} GRNs</p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/grn/create')} size="sm">New GRN</Button>
      </div>

      {/* QC Status tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {['', 'pending', 'approved', 'rejected', 'conditional'].map((s) => (
          <button key={s} onClick={() => { setQcStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${qcStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search GRN number or material..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={grns} loading={isLoading} />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
      </div>
    </div>
  );
};

export default GRNList;
