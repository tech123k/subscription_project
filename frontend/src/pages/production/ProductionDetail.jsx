import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, ChevronRight, Package } from 'lucide-react';
import { format } from 'date-fns';
import { productionAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import { formatNumber, formatDate } from '../../utils/helpers';
import { usePermission } from '../../hooks/usePermission';
import toast from 'react-hot-toast';

const stageStatusIcon = {
  completed: CheckCircle,
  in_progress: Clock,
  pending: Clock,
  failed: AlertCircle,
};
const stageStatusColor = {
  completed: 'text-green-600',
  in_progress: 'text-blue-600 animate-pulse',
  pending: 'text-gray-300',
  failed: 'text-red-600',
};

const ProductionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();

  const { data, isLoading } = useQuery({
    queryKey: ['production-detail', id],
    queryFn: () => productionAPI.getById(id),
  });

  const advanceStage = useMutation({
    mutationFn: ({ stageId, producedQty, rejectedQty, notes }) =>
      productionAPI.updateStage(id, { stageId, producedQty, rejectedQty, notes }),
    onSuccess: () => {
      toast.success('Stage advanced');
      queryClient.invalidateQueries({ queryKey: ['production-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['production'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to advance stage'),
  });

  const order = data?.data;
  const stages = order?.stage_logs || [];
  const currentStageIdx = stages.findIndex((s) => s.status === 'in_progress');
  const currentStage = stages[currentStageIdx];

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-48" />
      <div className="card p-6 h-48 bg-gray-50" />
    </div>
  );

  const pct = order?.planned_quantity > 0
    ? Math.round((order.produced_quantity / order.planned_quantity) * 100) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/production')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{order?.order_number}</h1>
              <StatusBadge status={order?.status} />
              {order?.is_delayed && <Badge variant="danger" dot>Delayed</Badge>}
            </div>
            <p className="text-sm text-gray-500">{order?.product_name} • {order?.customer_name || 'Internal'}</p>
          </div>
        </div>
        {can('update') && currentStage && (
          <Button size="sm" onClick={() => {
            const producedQty = prompt('Produced quantity for this stage?');
            if (!producedQty) return;
            const rejectedQty = prompt('Rejected quantity (0 if none)?') || '0';
            const notes = prompt('Notes (optional)?') || '';
            advanceStage.mutate({ stageId: currentStage.stage_id, producedQty: Number(producedQty), rejectedQty: Number(rejectedQty), notes });
          }} loading={advanceStage.isPending}>
            Complete Stage
          </Button>
        )}
      </div>

      {/* Progress */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Production Progress</h3>
          <span className="text-sm font-bold text-primary-600">{pct}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Planned', value: `${formatNumber(order?.planned_quantity)} ${order?.unit || ''}` },
            { label: 'Produced', value: `${formatNumber(order?.produced_quantity)} ${order?.unit || ''}` },
            { label: 'Rejected', value: `${formatNumber(order?.rejected_quantity)} ${order?.unit || ''}` },
            { label: 'Priority', value: <Badge variant={order?.priority === 'urgent' ? 'danger' : order?.priority === 'high' ? 'warning' : 'default'}>{order?.priority}</Badge> },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className="font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Stage Timeline */}
        <div className="col-span-2 card p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-5">Stage Timeline</h3>
          <div className="relative">
            {stages.map((stage, idx) => {
              const Icon = stageStatusIcon[stage.status] || Clock;
              const color = stageStatusColor[stage.status] || 'text-gray-300';
              return (
                <div key={stage.id} className="flex gap-4 pb-6 last:pb-0 relative">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 ${
                      stage.status === 'completed' ? 'border-green-500 bg-green-50' :
                      stage.status === 'in_progress' ? 'border-blue-500 bg-blue-50' :
                      'border-gray-200 bg-white'
                    }`}>
                      <Icon size={14} className={color} />
                    </div>
                    {idx < stages.length - 1 && (
                      <div className={`flex-1 w-0.5 mt-1 ${stage.status === 'completed' ? 'bg-green-200' : 'bg-gray-100'}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900">{stage.stage_name}</p>
                        {stage.is_qc_stage && <Badge variant="info">QC</Badge>}
                        {stage.department && <span className="text-xs text-gray-400">{stage.department}</span>}
                      </div>
                      <StatusBadge status={stage.status} />
                    </div>
                    {stage.started_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Started: {formatDate(stage.started_at)}
                        {stage.completed_at && ` → Completed: ${formatDate(stage.completed_at)}`}
                      </p>
                    )}
                    {(stage.produced_quantity || stage.rejected_quantity) && (
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {stage.produced_quantity && <span className="text-green-600">Produced: {formatNumber(stage.produced_quantity)}</span>}
                        {stage.rejected_quantity && Number(stage.rejected_quantity) > 0 && <span className="text-red-600">Rejected: {formatNumber(stage.rejected_quantity)}</span>}
                      </div>
                    )}
                    {stage.notes && <p className="text-xs text-gray-500 mt-1 italic">{stage.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info panel */}
        <div className="col-span-1 space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Order Info</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Customer', value: order?.customer_name || '—' },
                { label: 'Workflow', value: order?.workflow_name || '—' },
                { label: 'Planned Start', value: formatDate(order?.planned_start_date) },
                { label: 'Planned End', value: formatDate(order?.planned_end_date) },
                { label: 'Actual Start', value: formatDate(order?.actual_start_date) },
                { label: 'Actual End', value: formatDate(order?.actual_end_date) },
              ].map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
            {order?.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Bill of Materials */}
          {order?.materials?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Bill of Materials</h3>
              <div className="space-y-2">
                {order.materials.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Package size={13} className="text-gray-400" />
                      <span className="text-gray-700">{m.material_name}</span>
                    </div>
                    <span className="font-medium">{formatNumber(m.quantity)} {m.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductionDetail;
