import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, CheckCircle, Send, Truck, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { poAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/helpers';

const STATUS_COLORS = {
  draft: 'default', sent: 'warning', confirmed: 'info',
  partial: 'warning', completed: 'success', cancelled: 'danger',
};

const STATUS_LABELS = {
  draft: 'Draft', sent: 'Sent', confirmed: 'Confirmed',
  partial: 'Partially Received', completed: 'Completed', cancelled: 'Cancelled',
};

const STATUS_FLOW = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent to Supplier' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'partial', label: 'Partially Received' },
  { key: 'completed', label: 'Completed' },
];

const PODetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['po', id],
    queryFn: () => poAPI.getById(id),
  });

  const po = data?.data;
  const items = po?.items || [];
  const grns = po?.grns || [];

  const statusMutation = useMutation({
    mutationFn: (status) => poAPI.updateStatus(id, status),
    onSuccess: (_, status) => {
      toast.success(`PO marked as ${STATUS_LABELS[status] || status}`);
      queryClient.invalidateQueries({ queryKey: ['po'] });
    },
    onError: (err) => toast.error(err?.message || 'Failed to update status'),
  });

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-48" />
      <div className="card p-6 h-48 bg-gray-50" />
    </div>
  );

  const canEdit = ['draft', 'sent'].includes(po?.status);
  const totalOrdered = items.reduce((s, i) => s + Number(i.quantity), 0);
  const totalReceived = items.reduce((s, i) => s + Number(i.received_quantity || 0), 0);
  const fulfillmentPct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/po')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{po?.po_number}</h1>
              <Badge variant={STATUS_COLORS[po?.status] || 'default'}>
                {STATUS_LABELS[po?.status] || po?.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              {po?.supplier_name || 'No supplier'} · {po?.order_date ? format(new Date(po.order_date), 'MMM d, yyyy') : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="secondary" icon={Edit} size="sm" onClick={() => navigate(`/po/${id}/edit`)}>
              Edit
            </Button>
          )}
          {po?.status === 'draft' && (
            <Button size="sm" icon={Send} onClick={() => statusMutation.mutate('sent')} loading={statusMutation.isPending}>
              Send to Supplier
            </Button>
          )}
          {po?.status === 'sent' && (
            <Button size="sm" icon={CheckCircle} onClick={() => statusMutation.mutate('confirmed')} loading={statusMutation.isPending}>
              Mark Confirmed
            </Button>
          )}
          {['confirmed', 'partial'].includes(po?.status) && (
            <Button
              size="sm"
              icon={Truck}
              onClick={() => navigate(`/grn/create?poId=${id}`)}
            >
              Create GRN
            </Button>
          )}
        </div>
      </div>

      {/* Status stepper */}
      <div className="card p-4">
        <div className="flex items-center gap-0">
          {STATUS_FLOW.map((step, idx) => {
            const steps = ['draft', 'sent', 'confirmed', 'partial', 'completed'];
            const currentIdx = steps.indexOf(po?.status);
            const stepIdx = steps.indexOf(step.key);
            const isDone = stepIdx <= currentIdx && po?.status !== 'cancelled';
            const isCurrent = stepIdx === currentIdx;

            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                    ${isDone ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {isDone && !isCurrent ? <CheckCircle size={14} /> : idx + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center ${isCurrent ? 'text-primary-700 font-semibold' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
                {idx < STATUS_FLOW.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 mx-1 ${stepIdx < currentIdx && po?.status !== 'cancelled' ? 'bg-primary-600' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
          {po?.status === 'cancelled' && (
            <div className="flex items-center gap-2 ml-4 text-red-600">
              <XCircle size={16} />
              <span className="text-sm font-medium">Cancelled</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Summary cards */}
        <div className="col-span-3 grid grid-cols-4 gap-4">
          {[
            { label: 'Total Value', value: formatCurrency(po?.total_amount || 0), color: 'text-gray-900' },
            { label: 'Items Ordered', value: String(items.length), color: 'text-gray-900' },
            { label: 'Fulfillment', value: `${fulfillmentPct}%`, color: fulfillmentPct === 100 ? 'text-green-600' : 'text-amber-600' },
            { label: 'Expected Delivery', value: po?.expected_delivery ? format(new Date(po.expected_delivery), 'MMM d, yyyy') : '—', color: 'text-gray-900' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Items Table */}
        <div className="col-span-2 card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Order Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Material</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Ordered</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Received</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Rate</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => {
                  const received = Number(item.received_quantity || 0);
                  const ordered = Number(item.quantity);
                  const pct = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.material_name}</p>
                        <p className="text-xs text-gray-400">{item.material_code}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">{Number(item.quantity).toFixed(2)}</span>
                        <span className="text-gray-400 text-xs ml-1">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${pct >= 100 ? 'text-green-600' : pct > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {received.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">({pct}%)</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">₹{Number(item.rate).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-700 text-sm">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-primary-700">
                    ₹{Number(po?.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right panel — Info + GRNs */}
        <div className="space-y-4">
          {/* Order Info */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Order Info</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Supplier', value: po?.supplier_name || '—' },
                { label: 'Warehouse', value: po?.warehouse_name || '—' },
                { label: 'Payment Terms', value: po?.payment_terms || '—' },
                { label: 'Order Date', value: po?.order_date ? format(new Date(po.order_date), 'MMM d, yyyy') : '—' },
                { label: 'Exp. Delivery', value: po?.expected_delivery ? format(new Date(po.expected_delivery), 'MMM d, yyyy') : '—' },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium text-gray-900 text-right max-w-[140px] truncate">{r.value}</span>
                </div>
              ))}
            </div>
            {po?.notes && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{po.notes}</p>
              </div>
            )}
          </div>

          {/* Linked GRNs */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">
              Receipts (GRNs)
              <span className="ml-2 text-xs text-gray-400 font-normal">{grns.length} entries</span>
            </h3>
            {grns.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No GRNs yet</p>
            ) : (
              <div className="space-y-2">
                {grns.map((g) => (
                  <div key={g.id} className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-gray-900">{g.grn_number}</p>
                      <p className="text-gray-400">{g.material_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-700">+{Number(g.accepted_quantity).toFixed(2)}</p>
                      <p className="text-gray-400">{g.created_at ? format(new Date(g.created_at), 'MMM d') : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PODetail;
