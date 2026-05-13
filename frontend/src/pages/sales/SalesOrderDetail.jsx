import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Clock, Package, Truck, Copy, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { salesOrderAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed:  { label: 'Confirmed',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  processing: { label: 'Processing', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  partial:    { label: 'Partial',    cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  dispatched: { label: 'Dispatched', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  completed:  { label: 'Completed',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-50 text-red-600 border-red-200' },
};

const NEXT_STATUS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['partial', 'dispatched', 'cancelled'],
  partial:    ['dispatched', 'completed'],
  dispatched: ['completed'],
};

const fmtDate = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—';
const fmtMoney = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-xs font-medium text-gray-800 text-right max-w-[200px]">{value || '—'}</span>
  </div>
);

const SalesOrderDetail = () => {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [backorderConfirm, setBackorderConfirm] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales-order', id],
    queryFn:  () => salesOrderAPI.getOne(id),
    staleTime: 30_000,
  });

  const statusMut = useMutation({
    mutationFn: ({ status, cancellationReason }) => salesOrderAPI.updateStatus(id, { status, cancellationReason }),
    onSuccess: () => {
      toast.success('Status updated');
      setCancelModal(false);
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  const backorderMut = useMutation({
    mutationFn: () => salesOrderAPI.createBackorder(id),
    onSuccess: (res) => {
      toast.success('Backorder created');
      setBackorderConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      navigate(`/sales-orders/${res.data.id}`);
    },
    onError: (e) => toast.error(e?.message || 'Failed'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
      </div>
    );
  }

  const so = data?.data;
  if (!so) return <div className="text-center py-20 text-gray-400">Order not found</div>;

  const sc = STATUS_CONFIG[so.status] || STATUS_CONFIG.pending;
  const nextStatuses = NEXT_STATUS[so.status] || [];
  const hasPendingItems = so.items?.some((it) => (it.quantity - it.dispatched_quantity - it.backorder_quantity) > 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales-orders')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{so.order_number}</h1>
              {so.backorder_of_number && (
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                  BO of {so.backorder_of_number}
                </span>
              )}
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sc.cls}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{so.customer_name} · Ordered {fmtDate(so.order_date)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <RefreshCw size={14} />
          </button>

          {/* Status actions */}
          {nextStatuses.filter((s) => s !== 'cancelled').map((st) => (
            <Button
              key={st}
              variant="secondary"
              size="sm"
              loading={statusMut.isPending}
              onClick={() => statusMut.mutate({ status: st })}
            >
              Mark {STATUS_CONFIG[st]?.label}
            </Button>
          ))}

          {/* Backorder */}
          {hasPendingItems && ['partial', 'dispatched'].includes(so.status) && (
            <Button variant="secondary" size="sm" icon={Copy} onClick={() => setBackorderConfirm(true)}>
              Create Backorder
            </Button>
          )}

          {/* Cancel */}
          {nextStatuses.includes('cancelled') && (
            <Button variant="danger" size="sm" icon={XCircle} onClick={() => setCancelModal(true)}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Order info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 col-span-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Order Information</p>
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <InfoRow label="Customer"    value={so.customer_name} />
              <InfoRow label="Phone"       value={so.customer_phone} />
              <InfoRow label="Warehouse"   value={so.warehouse_name} />
              <InfoRow label="Channel"     value={so.channel} />
              <InfoRow label="Priority"    value={so.priority} />
            </div>
            <div>
              <InfoRow label="Order Date"    value={fmtDate(so.order_date)} />
              <InfoRow label="Delivery Date" value={fmtDate(so.expected_delivery_date)} />
              <InfoRow label="Payment Terms" value={so.payment_terms} />
              <InfoRow label="Created By"    value={so.created_by_name} />
              <InfoRow label="Notes"         value={so.notes} />
            </div>
          </div>
          {so.shipping_address && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">Shipping Address</p>
              <p className="text-xs text-gray-700">{so.shipping_address}</p>
            </div>
          )}
        </div>

        {/* Amounts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Financials</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium">{fmtMoney(so.total_amount)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Tax</span>
              <span className="tabular-nums font-medium">{fmtMoney(so.tax_amount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-100 pt-2">
              <span>Net Total</span>
              <span className="tabular-nums">{fmtMoney(so.net_amount)}</span>
            </div>
          </div>

          {/* Credit info */}
          {so.credit_limit > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <p className="text-[10px] text-gray-400 uppercase font-medium mb-2">Credit</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Limit</span>
                  <span>{fmtMoney(so.credit_limit)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Outstanding</span>
                  <span className={Number(so.outstanding_amount) > 0 ? 'text-red-600 font-medium' : ''}>{fmtMoney(so.outstanding_amount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Order Items</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-2.5 font-semibold">Product</th>
                <th className="px-4 py-2.5 font-semibold">Variant</th>
                <th className="px-4 py-2.5 text-right font-semibold">Ordered</th>
                <th className="px-4 py-2.5 text-right font-semibold">Dispatched</th>
                <th className="px-4 py-2.5 text-right font-semibold">Pending</th>
                <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(so.items || []).map((item) => {
                const pending = Number(item.quantity) - Number(item.dispatched_quantity) - Number(item.backorder_quantity);
                return (
                  <tr key={item.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 text-[13px]">{item.product_name || item.material_name || '—'}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{item.product_code || item.material_code}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {item.variant_sku || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs font-semibold text-gray-800">
                      {Number(item.quantity).toLocaleString()} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-emerald-700 font-semibold">
                      {Number(item.dispatched_quantity) > 0 ? Number(item.dispatched_quantity).toLocaleString() : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs">
                      {pending > 0 ? <span className="text-amber-700 font-semibold">{pending.toLocaleString()}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-600">{fmtMoney(item.rate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs font-semibold text-gray-800">{fmtMoney(item.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal isOpen={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Order" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">This will release all reserved stock. This action cannot be undone.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cancellation Reason</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-300"
              placeholder="Enter reason…"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setCancelModal(false)}>Back</Button>
            <Button variant="danger" loading={statusMut.isPending} onClick={() => statusMut.mutate({ status: 'cancelled', cancellationReason: cancelReason })}>
              Cancel Order
            </Button>
          </div>
        </div>
      </Modal>

      {/* Backorder confirm */}
      <Modal isOpen={backorderConfirm} onClose={() => setBackorderConfirm(false)} title="Create Backorder" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">A new order will be created for all pending (un-dispatched) items.</p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setBackorderConfirm(false)}>Cancel</Button>
            <Button loading={backorderMut.isPending} onClick={() => backorderMut.mutate()}>
              Create Backorder
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SalesOrderDetail;
