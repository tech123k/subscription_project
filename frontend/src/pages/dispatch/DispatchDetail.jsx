import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Truck, MapPin, CheckCircle, Clock, Package } from 'lucide-react';
import { dispatchAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { usePermission } from '../../hooks/usePermission';
import toast from 'react-hot-toast';

const STATUS_FLOW = ['ready', 'dispatched', 'in_transit', 'delivered'];

const DispatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();

  const { data, isLoading } = useQuery({
    queryKey: ['dispatch', id],
    queryFn: () => dispatchAPI.getById(id),
  });

  const updateStatus = useMutation({
    mutationFn: ({ status, notes }) => dispatchAPI.updateStatus(id, { status, notes }),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['dispatch', id] });
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update status'),
  });

  const dispatch = data?.data;
  const tracking = dispatch?.tracking || [];
  const currentIdx = STATUS_FLOW.indexOf(dispatch?.status);
  const nextStatus = STATUS_FLOW[currentIdx + 1];

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-48" />
      <div className="card p-6 h-48 bg-gray-50" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dispatches')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{dispatch?.dispatch_number}</h1>
              <StatusBadge status={dispatch?.status} />
              {dispatch?.is_delayed && <Badge variant="danger" dot>Delayed</Badge>}
            </div>
            <p className="text-sm text-gray-500">{dispatch?.customer_name} • {dispatch?.invoice_number || 'No invoice'}</p>
          </div>
        </div>
        {can('update') && nextStatus && (
          <Button size="sm" icon={Truck} loading={updateStatus.isPending}
            onClick={() => {
              const notes = prompt(`Mark as "${nextStatus}"? Add notes (optional):`) ?? null;
              if (notes === null) return;
              updateStatus.mutate({ status: nextStatus, notes });
            }}>
            Mark as {nextStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Button>
        )}
      </div>

      {/* Progress tracker */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          {STATUS_FLOW.map((s, idx) => {
            const done = idx <= currentIdx;
            const active = idx === currentIdx;
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                    done ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
                  } ${active ? 'ring-2 ring-primary-200' : ''}`}>
                    {done ? <CheckCircle size={16} className="text-primary-600" /> : <Clock size={16} className="text-gray-300" />}
                  </div>
                  <p className={`text-xs mt-1 font-medium ${done ? 'text-primary-700' : 'text-gray-400'}`}>
                    {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </p>
                </div>
                {idx < STATUS_FLOW.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-5 ${idx < currentIdx ? 'bg-primary-400' : 'bg-gray-100'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Tracking history */}
        <div className="col-span-2 card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Tracking History</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {tracking.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">No tracking updates yet</div>
            )}
            {tracking.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <div className="w-2 h-2 rounded-full bg-primary-400 mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={entry.status} />
                    <p className="text-xs text-gray-400">{formatDate(entry.timestamp, 'MMM d, yyyy h:mm a')}</p>
                  </div>
                  {entry.location && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin size={11} />{entry.location}
                    </div>
                  )}
                  {entry.notes && <p className="text-xs text-gray-600 mt-1">{entry.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="col-span-1 space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Shipment Details</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Vehicle', value: dispatch?.vehicle_number },
                { label: 'Vehicle Type', value: dispatch?.vehicle_type },
                { label: 'Transport', value: dispatch?.transport_name },
                { label: 'Driver', value: dispatch?.driver_name },
                { label: 'Driver Phone', value: dispatch?.driver_phone },
                { label: 'LR Number', value: dispatch?.lr_number },
                { label: 'E-Way Bill', value: dispatch?.e_way_bill_number },
                { label: 'Dispatch Date', value: formatDate(dispatch?.dispatch_date) },
                { label: 'Expected Delivery', value: formatDate(dispatch?.expected_delivery_date) },
                { label: 'Actual Delivery', value: formatDate(dispatch?.actual_delivery_date) },
              ].map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Destination</h3>
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                {dispatch?.destination_address && <p className="text-gray-700">{dispatch.destination_address}</p>}
                <p className="text-gray-600">{[dispatch?.destination_city, dispatch?.destination_state].filter(Boolean).join(', ')}</p>
                {dispatch?.destination_pincode && <p className="text-gray-400">{dispatch.destination_pincode}</p>}
              </div>
            </div>
            {dispatch?.freight_amount && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-500">Freight</span>
                <span className="font-medium">{formatCurrency(dispatch.freight_amount)} ({dispatch.freight_paid_by})</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispatchDetail;
