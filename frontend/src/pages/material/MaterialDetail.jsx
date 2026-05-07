import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Package, TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { materialAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { formatCurrency, formatNumber, humanize } from '../../utils/helpers';

const txIcon = { inward: TrendingUp, outward: TrendingDown, transfer: ArrowLeftRight, adjustment: Package, production_reserve: Package, production_issue: Package };
const txColor = { inward: 'text-green-600 bg-green-50', outward: 'text-red-600 bg-red-50', transfer: 'text-blue-600 bg-blue-50', adjustment: 'text-amber-600 bg-amber-50', production_reserve: 'text-purple-600 bg-purple-50', production_issue: 'text-orange-600 bg-orange-50' };

const MaterialDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['material', id],
    queryFn: () => materialAPI.getById(id),
  });

  const { data: txData } = useQuery({
    queryKey: ['material-transactions', id],
    queryFn: () => materialAPI.getTransactions(id, { limit: 50 }),
  });

  const mat = data?.data;
  const transactions = txData?.data || [];

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-48" />
      <div className="card p-6 h-48 bg-gray-50" />
    </div>
  );

  const isLow = Number(mat?.current_stock) <= Number(mat?.minimum_stock);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/materials')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{mat?.name}</h1>
              {isLow && <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">Low Stock</span>}
            </div>
            <p className="text-sm text-gray-500">{mat?.code} • {mat?.category_name || 'Uncategorized'}</p>
          </div>
        </div>
        <Button variant="secondary" icon={Edit} size="sm" onClick={() => navigate(`/materials/${id}/edit`)}>Edit</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Current Stock', value: `${formatNumber(mat?.current_stock)} ${mat?.unit}`, color: isLow ? 'text-red-600' : 'text-gray-900' },
          { label: 'In Production', value: `${formatNumber(mat?.in_production_stock)} ${mat?.unit}`, color: 'text-purple-600' },
          { label: 'In Transit', value: `${formatNumber(mat?.in_transit_stock)} ${mat?.unit}`, color: 'text-blue-600' },
          { label: 'Stock Value', value: formatCurrency(mat?.stock_value || 0, 0), color: 'text-green-600' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Details */}
        <div className="col-span-1 card p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-4">Details</h3>
          {mat?.image_url && (
            <img src={mat.image_url} alt={mat.name} className="w-full h-32 object-cover rounded-xl mb-4 border border-gray-100" />
          )}
          <div className="space-y-3 text-sm">
            {[
              { label: 'Unit', value: mat?.unit },
              { label: 'Min Stock', value: `${formatNumber(mat?.minimum_stock)} ${mat?.unit}` },
              { label: 'Max Stock', value: mat?.maximum_stock ? `${formatNumber(mat?.maximum_stock)} ${mat?.unit}` : '—' },
              { label: 'Unit Cost', value: mat?.unit_cost ? formatCurrency(mat?.unit_cost) : '—' },
              { label: 'HSN Code', value: mat?.hsn_code || '—' },
              { label: 'GST Rate', value: mat?.gst_rate ? `${mat.gst_rate}%` : '—' },
              { label: 'Warehouse', value: mat?.warehouse_name || '—' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-gray-500">{item.label}</span>
                <span className="font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
          {mat?.description && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700">{mat.description}</p>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="col-span-2 card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Stock Transaction History</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {transactions.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">No transactions yet</div>
            )}
            {transactions.map((tx) => {
              const Icon = txIcon[tx.transaction_type] || Package;
              const color = txColor[tx.transaction_type] || 'text-gray-600 bg-gray-50';
              return (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{humanize(tx.transaction_type)}</p>
                    <p className="text-xs text-gray-500 truncate">{tx.reference_number || tx.notes || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.quantity > 0 ? '+' : ''}{formatNumber(tx.quantity)}
                    </p>
                    <p className="text-xs text-gray-400">{format(new Date(tx.created_at), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialDetail;
