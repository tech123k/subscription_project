import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, GripVertical, Trash2, Edit, Save, X, Settings, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { workflowAPI } from '../../services/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const STAGE_COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899'];

const StageCard = ({ stage, index, onEdit, onDelete }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-primary-300 transition-all group"
  >
    <div className="text-gray-300 cursor-grab">
      <GripVertical size={16} />
    </div>

    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ background: stage.color }}>
      {index + 1}
    </div>

    <div className="flex-1 min-w-0">
      <p className="font-semibold text-sm text-gray-900">{stage.name}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {stage.department && <span className="text-xs text-gray-500">{stage.department}</span>}
        {stage.is_qc_stage && <Badge variant="info">QC Stage</Badge>}
        {stage.requires_approval && <Badge variant="warning">Approval</Badge>}
        {stage.sla_hours && <span className="text-xs text-amber-600">SLA: {stage.sla_hours}h</span>}
      </div>
    </div>

    <ChevronRight size={16} className="text-gray-300" />

    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={() => onEdit(stage)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600">
        <Edit size={14} />
      </button>
      <button onClick={() => onDelete(stage.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
        <Trash2 size={14} />
      </button>
    </div>
  </motion.div>
);

const StageForm = ({ form, setForm, onSubmit, loading, isEdit }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="label">Stage Name *</label>
        <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          className="input-field" placeholder="e.g. Cutting" />
      </div>
      <div>
        <label className="label">Department</label>
        <input value={form.department} onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))}
          className="input-field" placeholder="e.g. Production" />
      </div>
      <div>
        <label className="label">Stage Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.color} onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
            className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
          <div className="flex gap-1.5">
            {STAGE_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                className="w-6 h-6 rounded border-2 transition-all" style={{ background: c, borderColor: form.color === c ? '#1e40af' : 'transparent' }} />
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="label">SLA Hours</label>
        <input type="number" value={form.slaHours} onChange={(e) => setForm(f => ({ ...f, slaHours: e.target.value }))}
          className="input-field" placeholder="e.g. 8" />
      </div>
    </div>

    <div className="flex items-center gap-6">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.isQcStage} onChange={(e) => setForm(f => ({ ...f, isQcStage: e.target.checked }))}
          className="w-4 h-4 rounded border-gray-300 text-primary-600" />
        <span className="text-sm text-gray-700">QC Stage</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm(f => ({ ...f, requiresApproval: e.target.checked }))}
          className="w-4 h-4 rounded border-gray-300 text-primary-600" />
        <span className="text-sm text-gray-700">Requires Approval</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.notifyOnComplete} onChange={(e) => setForm(f => ({ ...f, notifyOnComplete: e.target.checked }))}
          className="w-4 h-4 rounded border-gray-300 text-primary-600" />
        <span className="text-sm text-gray-700">Notify on Complete</span>
      </label>
    </div>

    <Button fullWidth onClick={onSubmit} loading={loading}>
      {isEdit ? 'Update Stage' : 'Add Stage'}
    </Button>
  </div>
);

const WorkflowBuilder = () => {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showNewStage, setShowNewStage] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '' });
  const [stageForm, setStageForm] = useState({
    name: '', code: '', department: '', color: '#3B82F6',
    isQcStage: false, requiresApproval: false, slaHours: '',
    notifyOnComplete: true,
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowAPI.getTemplates,
  });

  const { data: templateDetail } = useQuery({
    queryKey: ['workflow', selectedTemplate],
    queryFn: () => workflowAPI.getTemplate(selectedTemplate),
    enabled: !!selectedTemplate,
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data) => workflowAPI.createTemplate(data),
    onSuccess: (res) => {
      toast.success('Workflow template created');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setSelectedTemplate(res.data.id);
      setShowNewTemplate(false);
      setTemplateForm({ name: '', description: '' });
    },
  });

  const addStageMutation = useMutation({
    mutationFn: (data) => workflowAPI.addStage(selectedTemplate, data),
    onSuccess: () => {
      toast.success('Stage added');
      queryClient.invalidateQueries({ queryKey: ['workflow', selectedTemplate] });
      setShowNewStage(false);
      setStageForm({ name: '', code: '', department: '', color: '#3B82F6', isQcStage: false, requiresApproval: false, slaHours: '', notifyOnComplete: true });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, data }) => workflowAPI.updateStage(id, data),
    onSuccess: () => {
      toast.success('Stage updated');
      queryClient.invalidateQueries({ queryKey: ['workflow', selectedTemplate] });
      setEditingStage(null);
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id) => workflowAPI.deleteStage(id),
    onSuccess: () => {
      toast.success('Stage removed');
      queryClient.invalidateQueries({ queryKey: ['workflow', selectedTemplate] });
    },
  });

  const stages = templateDetail?.data?.stages || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Workflow Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">Customize production workflows for your industry</p>
        </div>
        <Button icon={Plus} onClick={() => setShowNewTemplate(true)} size="sm">
          New Workflow
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Template List */}
        <div className="col-span-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Workflow Templates</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {isLoading ? (
                <div className="p-4 text-sm text-gray-400">Loading...</div>
              ) : (templates?.data || []).map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedTemplate === tmpl.id ? 'bg-primary-50 border-l-2 border-primary-500' : ''}`}
                >
                  <p className="font-medium text-sm text-gray-900">{tmpl.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tmpl.stage_count} stages</p>
                </button>
              ))}
              {!(templates?.data?.length) && (
                <div className="p-6 text-center text-gray-400 text-sm">No workflows yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Stage Builder */}
        <div className="col-span-8">
          {selectedTemplate ? (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-gray-900">{templateDetail?.data?.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{stages.length} stages configured</p>
                </div>
                <Button icon={Plus} onClick={() => setShowNewStage(true)} size="sm">
                  Add Stage
                </Button>
              </div>

              {/* Visual Flow */}
              <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-2">
                {stages.map((stage, idx) => (
                  <div key={stage.id} className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md"
                        style={{ background: stage.color }}>
                        {idx + 1}
                      </div>
                      <p className="text-xs mt-1 text-gray-600 font-medium max-w-[60px] truncate">{stage.name}</p>
                    </div>
                    {idx < stages.length - 1 && (
                      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                    )}
                  </div>
                ))}
                {!stages.length && (
                  <p className="text-sm text-gray-400">Add stages to build your workflow</p>
                )}
              </div>

              {/* Stage List */}
              <div className="space-y-2">
                {stages.map((stage, idx) => (
                  <StageCard
                    key={stage.id}
                    stage={stage}
                    index={idx}
                    onEdit={(s) => { setEditingStage(s); setStageForm({ name: s.name, department: s.department || '', color: s.color, isQcStage: s.is_qc_stage, requiresApproval: s.requires_approval, slaHours: s.sla_hours || '', notifyOnComplete: s.notify_on_complete }); setShowNewStage(true); }}
                    onDelete={(id) => deleteStageMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center text-gray-400">
              <Settings size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-500">Select a workflow template</p>
              <p className="text-sm mt-1">Or create a new one to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* New Template Modal */}
      <Modal isOpen={showNewTemplate} onClose={() => setShowNewTemplate(false)} title="New Workflow Template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewTemplate(false)}>Cancel</Button>
            <Button loading={createTemplateMutation.isPending}
              onClick={() => createTemplateMutation.mutate({ name: templateForm.name, description: templateForm.description, stages: [] })}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Template Name *</label>
            <input value={templateForm.name} onChange={(e) => setTemplateForm(f => ({ ...f, name: e.target.value }))}
              className="input-field" placeholder="e.g. Footwear Manufacturing" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={templateForm.description} onChange={(e) => setTemplateForm(f => ({ ...f, description: e.target.value }))}
              className="input-field resize-none" rows={3} placeholder="Describe this workflow..." />
          </div>
        </div>
      </Modal>

      {/* Add/Edit Stage Modal */}
      <Modal
        isOpen={showNewStage}
        onClose={() => { setShowNewStage(false); setEditingStage(null); }}
        title={editingStage ? 'Edit Stage' : 'Add Stage'}
      >
        <StageForm
          form={stageForm}
          setForm={setStageForm}
          isEdit={!!editingStage}
          loading={addStageMutation.isPending || updateStageMutation.isPending}
          onSubmit={() => {
            if (editingStage) {
              updateStageMutation.mutate({ id: editingStage.id, data: stageForm });
            } else {
              addStageMutation.mutate(stageForm);
            }
          }}
        />
      </Modal>
    </div>
  );
};

export default WorkflowBuilder;
