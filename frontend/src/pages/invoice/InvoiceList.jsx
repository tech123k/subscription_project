import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, Search, FileText, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { invoiceAPI } from '../../services/api';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';

const InvoiceList = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search, paymentStatus],
    queryFn: () => invoiceAPI.getAll({ page, limit: 20, search, paymentStatus }),
  });

  const invoices = data?.data || [];
  const meta = data?.meta;

  const columns = [
    {
      header: 'Invoice',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary-500" />
          <div>
            <p className="font-semibold text-sm text-gray-900">{row.invoice_number}</p>
            <p className="text-xs text-gray-500">{format(new Date(row.invoice_date), 'MMM d, yyyy')}</p>
          </div>
        </div>
      ),
    },
    { header: 'Customer', cell: (row) => <span className="text-sm font-medium">{row.customer_name || '-'}</span> },
    {
      header: 'Net Amount',
      cell: (row) => (
        <span className="font-bold text-gray-900">
          ₹{Number(row.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Paid',
      cell: (row) => (
        <span className="text-green-600 font-medium">
          ₹{Number(row.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Balance',
      cell: (row) => (
        <span className={Number(row.balance_amount) > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
          ₹{Number(row.balance_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { header: 'Due Date', cell: (row) => row.due_date ? <span className="text-sm">{format(new Date(row.due_date), 'MMM d, yyyy')}</span> : '-' },
    { header: 'Payment', cell: (row) => <StatusBadge status={row.payment_status} /> },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${row.id}`); }}
            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600">
            <Eye size={15} />
          </button>
          <a href={invoiceAPI.getPDF(row.id)} download target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
            <Download size={15} />
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta?.total || 0} invoices</p>
        </div>
        <div className="flex gap-2">
          <a href={invoiceAPI.export()} download>
            <Button variant="secondary" icon={Download} size="sm">Export</Button>
          </a>
          <Button icon={Plus} onClick={() => navigate('/invoices/create')} size="sm">
            New Invoice
          </Button>
        </div>
      </div>

      {/* Payment status tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {['', 'unpaid', 'partial', 'paid'].map((s) => (
          <button
            key={s}
            onClick={() => { setPaymentStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              paymentStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search invoices..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={invoices} loading={isLoading} onRowClick={(row) => navigate(`/invoices/${row.id}`)} />
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
      </div>
    </div>
  );
};

export default InvoiceList;
