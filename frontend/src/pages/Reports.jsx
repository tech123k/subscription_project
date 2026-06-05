import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Factory, Truck, FileText, Download, Filter, ClipboardCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportAPI } from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { format } from 'date-fns';

const REPORT_TYPES = [
  { id: 'stock',       label: 'Stock Report',       icon: Package,        color: 'text-blue-600 bg-blue-50',    exportFn: 'exportStock' },
  { id: 'fulfillment', label: 'Order Fulfillment',  icon: ClipboardCheck, color: 'text-teal-600 bg-teal-50',   exportFn: null },
  { id: 'production',  label: 'Production Report',  icon: Factory,        color: 'text-purple-600 bg-purple-50', exportFn: 'exportProduction' },
  { id: 'financial',   label: 'Financial Report',   icon: FileText,       color: 'text-green-600 bg-green-50',  exportFn: 'exportFinancial' },
  { id: 'dispatch',    label: 'Dispatch Report',    icon: Truck,          color: 'text-amber-600 bg-amber-50',  exportFn: 'exportDispatch' },
];

/* ── blob download helper ── */
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const Reports = () => {
  const [activeReport, setActiveReport] = useState('stock');
  const [dateRange, setDateRange]       = useState({ startDate: '', endDate: '' });
  const [status, setStatus]             = useState('');
  const [exporting, setExporting]       = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report', activeReport, dateRange, status],
    queryFn: () => reportAPI[activeReport]({ ...dateRange, status }),
  });

  const reportData = activeReport === 'financial' ? data?.data?.invoices : data?.data;
  const summary    = activeReport === 'financial' ? data?.data?.summary  : null;
  const activeType = REPORT_TYPES.find(r => r.id === activeReport);

  const handleExport = async () => {
    if (!activeType?.exportFn) { toast.error('Export not available for this report'); return; }
    setExporting(true);
    const tid = toast.loading('Preparing Excel…');
    try {
      const params = { ...dateRange, status };
      const blob   = await reportAPI[activeType.exportFn](params);
      const date   = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `${activeReport}_report_${date}.xlsx`);
      toast.success('Download started', { id: tid });
    } catch {
      toast.error('Export failed — please try again', { id: tid });
    } finally {
      setExporting(false);
    }
  };

  const getColumns = () => {
    if (activeReport === 'fulfillment') return [
      { header: 'Order No',    accessor: 'order_number' },
      { header: 'Customer',    accessor: 'customer_name' },
      { header: 'Item',        cell: (r) => (
          <div>
            <p className="font-medium text-sm text-gray-900">{r.item_name}</p>
            <p className="text-xs text-gray-400">{r.item_code} · {r.item_type}</p>
          </div>
        )
      },
      { header: 'Ordered',     cell: (r) => `${Number(r.ordered_qty).toFixed(2)} ${r.unit}` },
      { header: 'Pending',     cell: (r) => (
          <span className={Number(r.pending_qty) > 0 ? 'font-semibold text-orange-600' : 'text-gray-400'}>
            {Number(r.pending_qty).toFixed(2)} {r.unit}
          </span>
        )
      },
      { header: 'Available Stock', cell: (r) => (
          <span className={
            r.stock_status === 'out_of_stock' ? 'font-bold text-red-600' :
            r.stock_status === 'partial'      ? 'font-semibold text-orange-600' :
            'text-green-600 font-medium'
          }>
            {Number(r.available_stock).toFixed(2)} {r.unit}
          </span>
        )
      },
      { header: 'Status', cell: (r) => {
          const map = { sufficient: ['In Stock', 'text-green-700 bg-green-50'], partial: ['Partial', 'text-orange-700 bg-orange-50'], out_of_stock: ['Out of Stock', 'text-red-700 bg-red-50'] };
          const [label, cls] = map[r.stock_status] || ['Unknown', 'text-gray-500 bg-gray-50'];
          return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
        }
      },
      { header: 'Order Status', cell: (r) => <StatusBadge status={r.order_status} /> },
    ];

    if (activeReport === 'stock') return [
      { header: 'Code',         accessor: 'code' },
      { header: 'Material',     accessor: 'name' },
      { header: 'Category',     accessor: 'category_name' },
      { header: 'Unit',         accessor: 'unit' },
      { header: 'Current Stock', cell: (r) => (
          <span className={r.current_stock <= r.minimum_stock ? 'text-red-600 font-bold' : ''}>
            {Number(r.current_stock).toFixed(2)}
          </span>
        )
      },
      { header: 'Min Stock',    accessor: 'minimum_stock' },
      { header: 'Stock Value',  cell: (r) => `₹${Number(r.stock_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
      { header: 'Warehouse',    accessor: 'warehouse_name' },
      { header: 'Status',       cell: (r) => <StatusBadge status={r.stock_status === 'Low' ? 'low' : 'ok'} /> },
    ];

    if (activeReport === 'production') return [
      { header: 'Order No',    accessor: 'order_number' },
      { header: 'Product',     accessor: 'product_name' },
      { header: 'Customer',    accessor: 'customer_name' },
      { header: 'Status',      cell: (r) => <StatusBadge status={r.status} /> },
      { header: 'Planned Qty', accessor: 'planned_quantity' },
      { header: 'Produced',    accessor: 'produced_quantity' },
      { header: 'Rejected',    accessor: 'rejected_quantity' },
      { header: 'Rejection %', cell: (r) => `${r.rejection_rate || 0}%` },
      { header: 'Stage',       accessor: 'current_stage' },
    ];

    if (activeReport === 'financial') return [
      { header: 'Invoice No', accessor: 'invoice_number' },
      { header: 'Customer',   accessor: 'customer_name' },
      { header: 'Date',       cell: (r) => format(new Date(r.invoice_date), 'MMM d, yyyy') },
      { header: 'Net Amount', cell: (r) => `₹${Number(r.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { header: 'Paid',       cell: (r) => `₹${Number(r.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { header: 'Balance',    cell: (r) => (
          <span className={Number(r.balance_amount) > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}>
            {`₹${Number(r.balance_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </span>
        )
      },
      { header: 'Status', cell: (r) => <StatusBadge status={r.payment_status} /> },
    ];

    if (activeReport === 'dispatch') return [
      { header: 'Dispatch No',   accessor: 'dispatch_number' },
      { header: 'Customer',      accessor: 'customer_name' },
      { header: 'Vehicle',       accessor: 'vehicle_number' },
      { header: 'Transport',     accessor: 'transport_name' },
      { header: 'Dispatch Date', cell: (r) => r.dispatch_date ? format(new Date(r.dispatch_date), 'MMM d, yyyy') : '-' },
      { header: 'Status',        cell: (r) => <StatusBadge status={r.status} /> },
      { header: 'Delayed',       cell: (r) => r.is_delayed
          ? <span className="text-red-600 text-xs font-semibold">Yes</span>
          : <span className="text-emerald-600 text-xs">No</span>
      },
    ];

    return [];
  };

  return (
    <div className="space-y-5 page-enter">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Analyze and export your business data</p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || isLoading}
          loading={exporting}
          icon={exporting ? undefined : Download}
        >
          {exporting ? 'Exporting…' : 'Export Excel'}
        </Button>
      </div>

      {/* ── Report Type Selector ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.id}
            onClick={() => { setActiveReport(rt.id); setStatus(''); }}
            className={`card p-4 text-left transition-all duration-150 ${
              activeReport === rt.id
                ? 'ring-2 ring-primary-500 shadow-md'
                : 'hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${rt.color}`}>
              <rt.icon size={20} />
            </div>
            <p className="font-semibold text-sm text-slate-900">{rt.label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {reportData && activeReport === rt.id ? `${reportData.length} records` : 'Click to view'}
            </p>
          </button>
        ))}
      </div>

      {/* ── Financial Summary ── */}
      {activeReport === 'financial' && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Revenue',  value: `₹${Number(summary.total_revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,   color: 'text-slate-900' },
            { label: 'Collected',      value: `₹${Number(summary.total_collected).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,  color: 'text-emerald-600' },
            { label: 'Outstanding',    value: `₹${Number(summary.total_outstanding).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'text-red-600' },
            { label: 'Total Tax',      value: `₹${Number(summary.total_tax).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,        color: 'text-slate-900' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">From</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(d => ({ ...d, startDate: e.target.value }))}
              className="input-field !w-auto !py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">To</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(d => ({ ...d, endDate: e.target.value }))}
              className="input-field !w-auto !py-1.5 text-sm"
            />
          </div>
          {(activeReport === 'production' || activeReport === 'dispatch') && (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field !w-auto !py-1.5 text-sm"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="pending">Pending</option>
            </select>
          )}
          <Button variant="secondary" size="sm" icon={Filter} onClick={() => refetch()}>
            Apply
          </Button>
          {(dateRange.startDate || dateRange.endDate || status) && (
            <button
              onClick={() => { setDateRange({ startDate: '', endDate: '' }); setStatus(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* ── Report Table ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeType && (
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeType.color}`}>
                <activeType.icon size={14} />
              </div>
            )}
            <h3 className="font-bold text-slate-900 text-sm">{activeType?.label}</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {reportData?.length ?? 0} records
          </span>
        </div>
        <Table columns={getColumns()} data={reportData || []} loading={isLoading} />
      </div>
    </div>
  );
};

export default Reports;
