import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, Package, Factory, Truck, FileText, Download, Filter } from 'lucide-react';
import { reportAPI } from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { format } from 'date-fns';

const REPORT_TYPES = [
  { id: 'stock', label: 'Stock Report', icon: Package, color: 'text-blue-600 bg-blue-50' },
  { id: 'production', label: 'Production Report', icon: Factory, color: 'text-purple-600 bg-purple-50' },
  { id: 'financial', label: 'Financial Report', icon: FileText, color: 'text-green-600 bg-green-50' },
  { id: 'dispatch', label: 'Dispatch Report', icon: Truck, color: 'text-amber-600 bg-amber-50' },
];

const Reports = () => {
  const [activeReport, setActiveReport] = useState('stock');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [status, setStatus] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report', activeReport, dateRange, status],
    queryFn: () => {
      const params = { ...dateRange, status };
      return reportAPI[activeReport](params);
    },
  });

  const reportData = activeReport === 'financial' ? data?.data?.invoices : data?.data;
  const summary = activeReport === 'financial' ? data?.data?.summary : null;

  const getColumns = () => {
    if (activeReport === 'stock') return [
      { header: 'Code', accessor: 'code' },
      { header: 'Material', accessor: 'name' },
      { header: 'Category', accessor: 'category_name' },
      { header: 'Unit', accessor: 'unit' },
      { header: 'Current Stock', cell: (r) => <span className={r.current_stock <= r.minimum_stock ? 'text-red-600 font-bold' : ''}>{Number(r.current_stock).toFixed(2)}</span> },
      { header: 'Min Stock', accessor: 'minimum_stock' },
      { header: 'Stock Value', cell: (r) => `₹${Number(r.stock_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
      { header: 'Warehouse', accessor: 'warehouse_name' },
      { header: 'Status', cell: (r) => <StatusBadge status={r.stock_status === 'Low' ? 'low' : 'ok'} /> },
    ];

    if (activeReport === 'production') return [
      { header: 'Order No', accessor: 'order_number' },
      { header: 'Product', accessor: 'product_name' },
      { header: 'Customer', accessor: 'customer_name' },
      { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
      { header: 'Planned Qty', accessor: 'planned_quantity' },
      { header: 'Produced', accessor: 'produced_quantity' },
      { header: 'Rejected', accessor: 'rejected_quantity' },
      { header: 'Rejection %', cell: (r) => `${r.rejection_rate || 0}%` },
      { header: 'Stage', accessor: 'current_stage' },
    ];

    if (activeReport === 'financial') return [
      { header: 'Invoice No', accessor: 'invoice_number' },
      { header: 'Customer', accessor: 'customer_name' },
      { header: 'Date', cell: (r) => format(new Date(r.invoice_date), 'MMM d, yyyy') },
      { header: 'Net Amount', cell: (r) => `₹${Number(r.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { header: 'Paid', cell: (r) => `₹${Number(r.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { header: 'Balance', cell: (r) => <span className={Number(r.balance_amount) > 0 ? 'text-red-600' : 'text-gray-400'}>`₹${Number(r.balance_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`</span> },
      { header: 'Status', cell: (r) => <StatusBadge status={r.payment_status} /> },
    ];

    if (activeReport === 'dispatch') return [
      { header: 'Dispatch No', accessor: 'dispatch_number' },
      { header: 'Customer', accessor: 'customer_name' },
      { header: 'Vehicle', accessor: 'vehicle_number' },
      { header: 'Transport', accessor: 'transport_name' },
      { header: 'Dispatch Date', cell: (r) => r.dispatch_date ? format(new Date(r.dispatch_date), 'MMM d, yyyy') : '-' },
      { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
      { header: 'Delayed', cell: (r) => r.is_delayed ? <span className="text-red-600 text-xs font-medium">Yes</span> : <span className="text-green-600 text-xs">No</span> },
    ];

    return [];
  };

  const handleExport = () => {
    const params = new URLSearchParams({ ...dateRange, status, format: 'excel' });
    window.location.href = `/api/reports/${activeReport}?${params}`;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Analyze and export business data</p>
        </div>
        <Button icon={Download} onClick={handleExport} size="sm">Export Excel</Button>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.id}
            onClick={() => setActiveReport(rt.id)}
            className={`card p-4 text-left transition-all ${activeReport === rt.id ? 'border-primary-500 border-2' : 'hover:border-gray-300'}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${rt.color}`}>
              <rt.icon size={20} />
            </div>
            <p className="font-semibold text-sm text-gray-900">{rt.label}</p>
          </button>
        ))}
      </div>

      {/* Financial Summary */}
      {activeReport === 'financial' && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue', value: `₹${Number(summary.total_revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
            { label: 'Collected', value: `₹${Number(summary.total_collected).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'text-green-600' },
            { label: 'Outstanding', value: `₹${Number(summary.total_outstanding).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'text-red-600' },
            { label: 'Total Tax', value: `₹${Number(summary.total_tax).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color || 'text-gray-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From:</label>
            <input type="date" value={dateRange.startDate}
              onChange={(e) => setDateRange(d => ({ ...d, startDate: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To:</label>
            <input type="date" value={dateRange.endDate}
              onChange={(e) => setDateRange(d => ({ ...d, endDate: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {(activeReport === 'production' || activeReport === 'dispatch') && (
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="pending">Pending</option>
            </select>
          )}
          <Button variant="secondary" size="sm" onClick={() => refetch()} icon={Filter}>Apply</Button>
        </div>
      </Card>

      {/* Report Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{REPORT_TYPES.find(r => r.id === activeReport)?.label}</h3>
          <span className="text-sm text-gray-500">{reportData?.length || 0} records</span>
        </div>
        <Table columns={getColumns()} data={reportData || []} loading={isLoading} />
      </div>
    </div>
  );
};

export default Reports;
