import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Warehouse, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import { warehouseAPI } from '../services/api';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { formatCurrency, formatNumber } from '../utils/helpers';

const WarehouseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse', id],
    queryFn: () => warehouseAPI.getById(id),
  });

  const warehouse = data?.data;
  const stocks = warehouse?.stocks || [];
  const lowStockCount = stocks.filter((s) => s.current_stock <= s.minimum_stock).length;

  const columns = [
    { header: 'Code', accessor: 'code' },
    {
      header: 'Material',
      cell: (r) => (
        <div>
          <p className="font-medium text-sm text-gray-900">{r.name}</p>
          <p className="text-xs text-gray-500">{r.category_name || '—'}</p>
        </div>
      ),
    },
    { header: 'Unit', accessor: 'unit' },
    {
      header: 'Current Stock',
      cell: (r) => (
        <span className={`font-bold text-sm ${r.current_stock <= r.minimum_stock ? 'text-red-600' : 'text-gray-900'}`}>
          {formatNumber(r.current_stock)}
        </span>
      ),
    },
    { header: 'Min Stock', cell: (r) => <span className="text-sm">{formatNumber(r.minimum_stock)}</span> },
    {
      header: 'Stock Value',
      cell: (r) => <span className="text-sm font-medium">{formatCurrency(r.stock_value || 0, 0)}</span>,
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.current_stock <= r.minimum_stock ? 'low' : 'ok'} />,
    },
  ];

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-48" />
      <div className="card p-6 h-32 bg-gray-50" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/warehouses')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{warehouse?.name}</h1>
          <p className="text-sm text-gray-500">{warehouse?.code} • {[warehouse?.city, warehouse?.state].filter(Boolean).join(', ')}</p>
        </div>
        {warehouse?.is_default && (
          <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full font-medium">Default</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Materials', value: stocks.length, icon: Package, color: 'text-blue-600 bg-blue-50' },
          { label: 'Low Stock Items', value: lowStockCount, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
          {
            label: 'Total Stock Value',
            value: formatCurrency(stocks.reduce((a, s) => a + (Number(s.stock_value) || 0), 0), 0),
            icon: TrendingUp, color: 'text-green-600 bg-green-50',
          },
          { label: 'Warehouse Code', value: warehouse?.code || '—', icon: Warehouse, color: 'text-amber-600 bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4 text-sm">Warehouse Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Address', value: warehouse?.address },
            { label: 'City', value: warehouse?.city },
            { label: 'State', value: warehouse?.state },
            { label: 'Pincode', value: warehouse?.pincode },
            { label: 'Contact Person', value: warehouse?.contact_person },
            { label: 'Phone', value: warehouse?.phone },
          ].map((item, i) => (
            <div key={i}>
              <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
              <p className="font-medium text-gray-900">{item.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stock table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Stock Inventory</h3>
          <span className="text-sm text-gray-500">{stocks.length} materials</span>
        </div>
        <Table columns={columns} data={stocks} />
      </div>
    </div>
  );
};

export default WarehouseDetail;
