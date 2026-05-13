import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle, Clock, Play, Flag, RotateCcw, Package,
  AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart2, User,
} from 'lucide-react';
import { format } from 'date-fns';
import { productionAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatNumber, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Complete Stage Modal — captures input, output, rejected, wastage
// ─────────────────────────────────────────────────────────────────────────────
const CompleteStageModal = ({ stage, orderId, plannedQty, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    inputQty: String(plannedQty || ''),
    outputQty: String(plannedQty || ''),
    rejectedQty: '0',
    wastageQty: '0',
    notes: '',
  });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => productionAPI.updateStage(orderId, {
      stageId: stage.stage_id,
      status: 'completed',
      inputQuantity: Number(form.inputQty),
      outputQuantity: Number(form.outputQty),
      rejectionQuantity: Number(form.rejectedQty),
      wastageQuantity: Number(form.wastageQty),
      notes: form.notes || null,
    }),
    onSuccess: () => { toast.success(`${stage.stage_name} completed`); onSuccess(); onClose(); },
    onError: (err) => toast.error(err?.message || 'Failed to complete stage'),
  });

  const outNum = Number(form.outputQty) || 0;
  const rejNum = Number(form.rejectedQty) || 0;
  const wasteNum = Number(form.wastageQty) || 0;
  const yield_ = outNum > 0 ? ((outNum / (outNum + rejNum + wasteNum)) * 100).toFixed(1) : '—';

  return (
    <Modal isOpen onClose={onClose} title={`Complete Stage: ${stage.stage_name}`} size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}
            disabled={!form.outputQty || Number(form.outputQty) < 0}>
            Mark Complete
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Input Quantity</label>
            <input type="number" value={form.inputQty} onChange={f('inputQty')}
              className="input-field" min="0" step="0.01" placeholder="0" />
          </div>
          <div>
            <label className="label">Output Quantity *</label>
            <input type="number" value={form.outputQty} onChange={f('outputQty')}
              className="input-field" min="0" step="0.01" placeholder="0" autoFocus />
          </div>
          <div>
            <label className="label">Rejected Qty</label>
            <input type="number" value={form.rejectedQty} onChange={f('rejectedQty')}
              className="input-field" min="0" step="0.01" placeholder="0" />
          </div>
          <div>
            <label className="label">Wastage Qty</label>
            <input type="number" value={form.wastageQty} onChange={f('wastageQty')}
              className="input-field" min="0" step="0.01" placeholder="0" />
          </div>
        </div>

        {/* Yield preview */}
        {outNum > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-2.5 text-sm text-blue-800 flex items-center justify-between">
            <span>Stage Yield</span>
            <span className="font-bold text-blue-900">{yield_}%</span>
          </div>
        )}

        <div>
          <label className="label">Notes</label>
          <textarea value={form.notes} onChange={f('notes')} className="input-field resize-none"
            rows={2} placeholder="Optional observations..." />
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Revert Stage Modal
// ─────────────────────────────────────────────────────────────────────────────
const RevertStageModal = ({ stage, prevStageName, orderId, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => productionAPI.revertStage(orderId, { stageId: stage.stage_id, reason }),
    onSuccess: () => { toast.success(`Reverted to ${prevStageName}`); onSuccess(); onClose(); },
    onError: (err) => toast.error(err?.message || 'Failed to revert stage'),
  });

  return (
    <Modal isOpen onClose={onClose} title="Revert Stage" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}
            disabled={!reason.trim()}>
            Confirm Revert
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Reverting workflow</p>
            <p className="mt-0.5">
              <span className="font-medium">{stage.stage_name}</span> → <span className="font-medium">{prevStageName}</span>
            </p>
            <p className="text-xs mt-1 text-amber-600">All output data for {stage.stage_name} will be cleared.</p>
          </div>
        </div>
        <div>
          <label className="label">Reason <span className="text-red-500">*</span></label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            className="input-field resize-none" rows={3}
            placeholder="e.g. Quality issue found, needs rework..." autoFocus />
          <p className="text-xs text-gray-400 mt-1">Required — saved in audit history</p>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BOM / Materials Panel (full table)
// ─────────────────────────────────────────────────────────────────────────────
const BOMPanel = ({ materials, orderStatus }) => {
  const isComplete = orderStatus === 'completed';

  if (!materials?.length) return null;

  const totalPlanned = materials.reduce((s, m) => s + Number(m.planned_quantity || 0), 0);
  const totalActual  = materials.reduce((s, m) => s + Number(m.actual_quantity || 0), 0);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 text-sm">
          Bill of Materials
          <span className="ml-2 text-xs font-normal text-gray-400">({materials.length} materials)</span>
        </h3>
        {isComplete && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            Consumed
          </span>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs min-w-[500px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-gray-500 text-left">
              <th className="px-3 py-2.5">Material</th>
              <th className="px-3 py-2.5 text-right">Planned</th>
              <th className="px-3 py-2.5 text-right">Consumed</th>
              <th className="px-3 py-2.5 text-right">Remaining</th>
              <th className="px-3 py-2.5 text-right">Variance</th>
              <th className="px-3 py-2.5 text-right">Stock Now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {materials.map((m, i) => {
              const planned   = Number(m.planned_quantity || 0);
              const actual    = Number(m.actual_quantity || 0);
              const remaining = Number(m.remaining_quantity || 0);
              const variance  = Number(m.variance_quantity || 0);
              const stockNow  = Number(m.current_stock || 0);
              const isLowStock = stockNow <= 0;

              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Package size={12} className="text-gray-400 shrink-0" />
                      <div>
                        <p className="font-medium text-gray-800">{m.material_name}</p>
                        {m.material_code && <p className="text-gray-400">{m.material_code}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-700 font-medium">
                    {formatNumber(planned)} <span className="text-gray-400">{m.unit}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isComplete
                      ? <span className="font-semibold text-gray-900">{formatNumber(actual)} <span className="text-gray-400 font-normal">{m.unit}</span></span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isComplete
                      ? <span className="text-gray-400">—</span>
                      : <span className="font-medium text-blue-700">{formatNumber(remaining)} <span className="text-gray-400 font-normal">{m.unit}</span></span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isComplete ? (
                      variance > 0
                        ? <span className="text-red-600 font-medium flex items-center justify-end gap-0.5"><TrendingUp size={11} />+{formatNumber(variance)}</span>
                        : variance < 0
                          ? <span className="text-green-600 font-medium flex items-center justify-end gap-0.5"><TrendingDown size={11} />{formatNumber(variance)}</span>
                          : <span className="text-gray-400 flex items-center justify-end gap-0.5"><Minus size={11} /> 0</span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-medium ${isLowStock ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatNumber(stockNow)} <span className={`font-normal ${isLowStock ? 'text-red-400' : 'text-gray-400'}`}>{m.unit}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {isComplete && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr className="text-xs font-semibold text-gray-700">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{formatNumber(totalPlanned)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(totalActual)}</td>
                <td className="px-3 py-2 text-right text-gray-400">—</td>
                <td className="px-3 py-2 text-right text-gray-400">—</td>
                <td className="px-3 py-2 text-right text-gray-400">—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage History Log
// ─────────────────────────────────────────────────────────────────────────────
const StageHistoryPanel = ({ stages, unit }) => {
  const donStages = stages.filter((s) => s.status === 'completed' || s.started_at);
  if (donStages.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
        <BarChart2 size={15} className="text-gray-400" />
        Stage Activity Log
      </h3>
      <div className="rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-gray-500 text-left">
              <th className="px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Stage</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Input</th>
              <th className="px-3 py-2.5 text-right">Output</th>
              <th className="px-3 py-2.5 text-right">Rejected</th>
              <th className="px-3 py-2.5 text-right">Wastage</th>
              <th className="px-3 py-2.5 text-right">Yield %</th>
              <th className="px-3 py-2.5">Completed By</th>
              <th className="px-3 py-2.5">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stages.map((s, idx) => {
              const out     = Number(s.produced_quantity || s.output_quantity || 0);
              const rej     = Number(s.rejection_quantity || 0);
              const waste   = Number(s.wastage_quantity || 0);
              const inp     = Number(s.input_quantity || 0);
              const total   = out + rej + waste;
              const yieldPct = total > 0 ? ((out / total) * 100).toFixed(1) : '—';
              const isDone  = s.status === 'completed';
              const isActive = s.status === 'in_progress';
              const duration = s.started_at && s.completed_at
                ? Math.round((new Date(s.completed_at) - new Date(s.started_at)) / 60000)
                : null;

              return (
                <tr key={s.id} className={isDone ? 'bg-white' : isActive ? 'bg-blue-50' : 'bg-gray-50 opacity-60'}>
                  <td className="px-3 py-2.5 text-gray-400 font-medium">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-gray-800">{s.stage_name}</p>
                    {s.department && <p className="text-gray-400">{s.department}</p>}
                    {s.notes && <p className="text-gray-400 italic mt-0.5">"{s.notes}"</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                      isDone ? 'bg-green-100 text-green-700' :
                      isActive ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {isDone && <CheckCircle size={9} />}
                      {isActive && <Clock size={9} />}
                      {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {inp > 0 ? `${formatNumber(inp)} ${unit}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                    {isDone ? `${formatNumber(out)} ${unit}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {rej > 0
                      ? <span className="text-red-600 font-medium">{formatNumber(rej)} {unit}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {waste > 0
                      ? <span className="text-amber-600 font-medium">{formatNumber(waste)} {unit}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isDone
                      ? <span className={`font-semibold ${parseFloat(yieldPct) >= 95 ? 'text-green-700' : parseFloat(yieldPct) >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{yieldPct}%</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {s.completed_by_name || s.operator_name
                      ? <span className="flex items-center gap-1 text-gray-600"><User size={10} />{s.completed_by_name || s.operator_name}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {s.completed_at
                      ? <span>{format(new Date(s.completed_at), 'MMM d, h:mm a')}{duration !== null && <span className="text-gray-400 ml-1">({duration}m)</span>}</span>
                      : s.started_at ? <span className="text-blue-500">{format(new Date(s.started_at), 'MMM d, h:mm a')}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Variance Panel — planned vs actual consumption summary
// ─────────────────────────────────────────────────────────────────────────────
const VariancePanel = ({ materials, order }) => {
  if (!materials?.length || order?.status !== 'completed') return null;

  const totalRejected = Number(order?.rejected_quantity || 0);
  const totalWastage  = stages => stages.reduce((s, st) => s + Number(st.wastage_quantity || 0), 0);

  const yieldPct = order.planned_quantity > 0
    ? ((Number(order.produced_quantity) / Number(order.planned_quantity)) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
        <TrendingUp size={15} className="text-gray-400" />
        Production Variance Report
      </h3>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Planned Output</p>
          <p className="text-xl font-bold text-gray-900">{formatNumber(order.planned_quantity)}</p>
          <p className="text-xs text-gray-400">{order.product_unit}</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-green-50 border border-green-100">
          <p className="text-xs text-gray-500 mb-1">Actual Output</p>
          <p className="text-xl font-bold text-green-700">{formatNumber(order.produced_quantity)}</p>
          <p className="text-xs text-gray-400">{order.product_unit}</p>
        </div>
        <div className={`text-center p-3 rounded-xl border ${parseFloat(yieldPct) >= 95 ? 'bg-green-50 border-green-100' : parseFloat(yieldPct) >= 80 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-gray-500 mb-1">Yield Rate</p>
          <p className={`text-xl font-bold ${parseFloat(yieldPct) >= 95 ? 'text-green-700' : parseFloat(yieldPct) >= 80 ? 'text-amber-700' : 'text-red-700'}`}>{yieldPct}%</p>
          <p className="text-xs text-gray-400">efficiency</p>
        </div>
      </div>

      {/* Material variance table */}
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-gray-500 text-left">
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2 text-right">Planned</th>
              <th className="px-3 py-2 text-right">Consumed</th>
              <th className="px-3 py-2 text-right">Variance</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {materials.map((m, i) => {
              const planned  = Number(m.planned_quantity || 0);
              const actual   = Number(m.actual_quantity || 0);
              const variance = Number(m.variance_quantity || 0);

              return (
                <tr key={i}>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{m.material_name}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{formatNumber(planned)} {m.unit}</td>
                  <td className="px-3 py-2.5 text-right text-gray-800 font-medium">{formatNumber(actual)} {m.unit}</td>
                  <td className="px-3 py-2.5 text-right">
                    {variance > 0
                      ? <span className="text-red-600 font-medium">+{formatNumber(variance)}</span>
                      : variance < 0
                        ? <span className="text-green-600 font-medium">{formatNumber(variance)}</span>
                        : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {variance > 0
                      ? <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Over-used</span>
                      : variance < 0
                        ? <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Saved</span>
                        : <span className="text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">On-plan</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalRejected > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <span className="text-red-700 font-medium">Total Rejected across all stages</span>
          <span className="font-bold text-red-700">{formatNumber(totalRejected)} {order.product_unit}</span>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const ProductionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [completingStage, setCompletingStage] = useState(null);
  const [revertingStage, setRevertingStage] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['production-detail', id],
    queryFn: () => productionAPI.getById(id),
  });

  const startStage = useMutation({
    mutationFn: (stageId) => productionAPI.updateStage(id, { stageId, status: 'in_progress' }),
    onSuccess: () => { toast.success('Stage started'); invalidate(); },
    onError: (err) => toast.error(err?.message || 'Failed to start stage'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['production'] });
  };

  const order  = data?.data;
  const stages = order?.stage_logs || [];
  const revertLogs = order?.revert_logs || [];
  const materials  = order?.materials  || [];

  const currentStage    = stages.find((s) => s.stage_id === order?.current_stage_id);
  const currentStageIdx = stages.findIndex((s) => s.stage_id === order?.current_stage_id);
  const completedCount  = stages.filter((s) => s.status === 'completed').length;
  const stagePct  = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  // Quantity progress: show stage-based progress during production,
  // actual yield only when the order is fully completed.
  const isComplete   = order?.status === 'completed';
  const producedQty  = Number(order?.produced_quantity || 0);
  const plannedQty   = Number(order?.planned_quantity  || 1);
  const qtyPct = isComplete
    ? Math.min(100, Math.round((producedQty / plannedQty) * 100))
    : stagePct;

  const isOrderActive = ['pending', 'in_progress'].includes(order?.status);

  const revertedFromMap = {};
  for (const log of revertLogs) {
    if (!revertedFromMap[log.from_stage_id]) revertedFromMap[log.from_stage_id] = log;
  }

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-48" />
      <div className="card p-6 h-48 bg-gray-50" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/production')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{order?.order_number}</h1>
              <StatusBadge status={order?.status} />
              {order?.is_delayed && <Badge variant="danger" dot>Delayed</Badge>}
              {isComplete && order?.finished_goods_added && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">FG Added</span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {order?.product_name}
              {order?.product_code && <span className="text-gray-400"> · {order.product_code}</span>}
              {order?.customer_name && <span> · {order.customer_name}</span>}
            </p>
          </div>
        </div>
        {order?.status === 'pending' && currentStage && (
          <Button icon={Play} size="sm" onClick={() => startStage.mutate(currentStage.stage_id)} loading={startStage.isPending}>
            Start Production
          </Button>
        )}
      </div>

      {/* Progress cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Workflow Progress</p>
            <span className="text-sm font-bold text-primary-600">{stagePct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${stagePct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{completedCount} of {stages.length} stages complete</span>
            {revertLogs.length > 0 && (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <RotateCcw size={11} /> {revertLogs.length} revert{revertLogs.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">
              {isComplete ? 'Final Output' : 'Production Progress'}
            </p>
            <span className={`text-sm font-bold ${isComplete && qtyPct < 95 ? 'text-amber-600' : 'text-primary-600'}`}>
              {isComplete ? `${qtyPct}% yield` : `${stagePct}%`}
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all duration-500 ${
              isComplete && qtyPct < 80 ? 'bg-red-400' :
              isComplete && qtyPct < 95 ? 'bg-amber-400' : 'bg-green-500'
            }`} style={{ width: `${isComplete ? qtyPct : stagePct}%` }} />
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Planned: <strong className="text-gray-800">{formatNumber(plannedQty)} {order?.product_unit}</strong></span>
            {isComplete && (
              <span>Produced: <strong className="text-green-700">{formatNumber(producedQty)} {order?.product_unit}</strong></span>
            )}
            {Number(order?.rejected_quantity) > 0 && (
              <span>Rejected: <strong className="text-red-600">{formatNumber(order.rejected_quantity)}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Main grid: Timeline + Right panel */}
      <div className="grid grid-cols-3 gap-5">
        {/* Stage Timeline */}
        <div className="col-span-2 card p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-5">Workflow Stages</h3>
          {stages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No stages configured</p>
          ) : (
            <div className="space-y-0">
              {stages.map((stage, idx) => {
                const isCurrent = stage.stage_id === order?.current_stage_id;
                const isDone    = stage.status === 'completed';
                const isActive  = stage.status === 'in_progress';
                const isPending = stage.status === 'pending';
                const wasReverted = !!revertedFromMap[stage.stage_id];
                const out  = Number(stage.produced_quantity || 0);
                const rej  = Number(stage.rejection_quantity || 0);
                const waste = Number(stage.wastage_quantity || 0);

                return (
                  <div key={stage.id} className="flex gap-4 relative">
                    {idx < stages.length - 1 && (
                      <div className={`absolute left-4 top-8 bottom-0 w-0.5 ${isDone ? 'bg-green-200' : wasReverted ? 'bg-amber-200' : 'bg-gray-100'}`} />
                    )}
                    <div className="flex-shrink-0 z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        isDone      ? 'border-green-500 bg-green-50' :
                        isActive    ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-50' :
                        wasReverted ? 'border-amber-400 bg-amber-50' :
                                      'border-gray-200 bg-white'
                      }`}>
                        {isDone      ? <CheckCircle size={14} className="text-green-600" /> :
                         isActive    ? <Clock size={14} className="text-blue-600" /> :
                         wasReverted ? <RotateCcw size={13} className="text-amber-500" /> :
                                       <span className="text-xs text-gray-400 font-medium">{idx + 1}</span>}
                      </div>
                    </div>

                    <div className={`flex-1 pb-6 ${idx === stages.length - 1 ? 'pb-0' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-sm ${
                              isDone ? 'text-gray-600' : isActive ? 'text-blue-700' :
                              wasReverted ? 'text-amber-700' : 'text-gray-400'
                            }`}>{stage.stage_name}</p>
                            {stage.is_qc_stage && <Badge variant="info">QC</Badge>}
                            {stage.department && <span className="text-xs text-gray-400">{stage.department}</span>}
                            {wasReverted && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Reverted</span>}
                          </div>

                          {stage.started_at && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Started {format(new Date(stage.started_at), 'MMM d, h:mm a')}
                              {stage.completed_at && ` → ${format(new Date(stage.completed_at), 'MMM d, h:mm a')}`}
                            </p>
                          )}

                          {isDone && (out > 0 || rej > 0 || waste > 0) && (
                            <div className="flex items-center gap-3 mt-1 text-xs">
                              {out > 0 && <span className="text-green-600">Output: {formatNumber(out)} {order?.product_unit}</span>}
                              {rej > 0 && <span className="text-red-600">Rejected: {formatNumber(rej)}</span>}
                              {waste > 0 && <span className="text-amber-600">Wastage: {formatNumber(waste)}</span>}
                            </div>
                          )}

                          {stage.completed_by_name && isDone && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <User size={10} /> {stage.completed_by_name}
                            </p>
                          )}

                          {stage.notes && <p className="text-xs text-gray-500 mt-1 italic">"{stage.notes}"</p>}

                          {wasReverted && revertedFromMap[stage.stage_id] && (
                            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1.5 border border-amber-200">
                              <RotateCcw size={11} className="shrink-0 mt-0.5" />
                              <span>
                                <span className="font-medium">Reverted to {revertedFromMap[stage.stage_id].to_stage_name}</span>
                                {' — '}"{revertedFromMap[stage.stage_id].reason}"
                                <span className="text-amber-500 ml-1">
                                  · {format(new Date(revertedFromMap[stage.stage_id].created_at), 'MMM d, h:mm a')}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>

                        {isOrderActive && isCurrent && (
                          <div className="flex items-center gap-2 shrink-0">
                            {isPending && (
                              <Button size="sm" variant="secondary" icon={Play}
                                onClick={() => startStage.mutate(stage.stage_id)}
                                loading={startStage.isPending}>Start</Button>
                            )}
                            {isActive && (
                              <>
                                {currentStageIdx > 0 && (
                                  <Button size="sm" variant="secondary"
                                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                                    icon={RotateCcw}
                                    onClick={() => setRevertingStage(stage)}>Revert</Button>
                                )}
                                <Button size="sm" icon={Flag} onClick={() => setCompletingStage(stage)}>Complete</Button>
                              </>
                            )}
                          </div>
                        )}

                        {isDone && idx === stages.length - 1 && isComplete && (
                          <Badge variant="success">Order Complete</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Order Info</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Priority', value: <Badge variant={order?.priority === 'urgent' ? 'danger' : order?.priority === 'high' ? 'warning' : 'default'}>{order?.priority}</Badge> },
                { label: 'Customer', value: order?.customer_name || '—' },
                { label: 'Workflow', value: order?.workflow_name || '—' },
                { label: 'Current Stage', value: order?.current_stage_name || (isComplete ? 'Complete' : '—') },
                { label: 'Planned Start', value: formatDate(order?.planned_start_date) },
                { label: 'Planned End',   value: formatDate(order?.planned_end_date) },
                { label: 'Actual Start',  value: formatDate(order?.actual_start_date) },
                { label: 'Actual End',    value: formatDate(order?.actual_end_date) },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-900 text-right">{item.value}</span>
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

          {revertLogs.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                <RotateCcw size={14} className="text-amber-500" />
                Revert History
                <span className="text-xs font-normal text-gray-400">({revertLogs.length})</span>
              </h3>
              <div className="space-y-3">
                {revertLogs.map((log) => (
                  <div key={log.id} className="text-xs border-l-2 border-amber-300 pl-3 space-y-0.5">
                    <p className="font-medium text-gray-800">{log.from_stage_name} → {log.to_stage_name}</p>
                    <p className="text-gray-500 italic">"{log.reason}"</p>
                    <p className="text-gray-400">{log.reverted_by_name} · {format(new Date(log.created_at), 'MMM d, h:mm a')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-width BOM table */}
      <BOMPanel materials={materials} orderStatus={order?.status} />

      {/* Stage Activity Log */}
      <StageHistoryPanel stages={stages} unit={order?.product_unit} />

      {/* Variance Report — only on completion */}
      <VariancePanel materials={materials} order={order} />

      {/* Modals */}
      {completingStage && (
        <CompleteStageModal
          stage={completingStage}
          orderId={id}
          plannedQty={order?.planned_quantity}
          onClose={() => setCompletingStage(null)}
          onSuccess={invalidate}
        />
      )}
      {revertingStage && (
        <RevertStageModal
          stage={revertingStage}
          prevStageName={currentStageIdx > 0 ? stages[currentStageIdx - 1]?.stage_name : ''}
          orderId={id}
          onClose={() => setRevertingStage(null)}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
};

export default ProductionDetail;
