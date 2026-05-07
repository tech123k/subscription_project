const { query } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');

const getTemplates = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT wt.*, COUNT(ws.id) AS stage_count
       FROM workflow_templates wt
       LEFT JOIN workflow_stages ws ON ws.template_id = wt.id AND ws.is_active = TRUE
       WHERE wt.company_id = $1 AND wt.is_active = TRUE
       GROUP BY wt.id ORDER BY wt.created_at DESC`,
      [req.companyId]
    );
    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const getTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [tmplRes, stagesRes] = await Promise.all([
      query('SELECT * FROM workflow_templates WHERE id = $1 AND company_id = $2', [id, req.companyId]),
      query(
        `SELECT ws.*, r.name AS role_name FROM workflow_stages ws
         LEFT JOIN roles r ON ws.assigned_role = r.id
         WHERE ws.template_id = $1 AND ws.is_active = TRUE
         ORDER BY ws.sequence_order`,
        [id]
      ),
    ]);
    if (!tmplRes.rows[0]) return ApiResponse.notFound(res, 'Workflow template not found');
    ApiResponse.success(res, { ...tmplRes.rows[0], stages: stagesRes.rows });
  } catch (error) {
    next(error);
  }
};

const createTemplate = async (req, res, next) => {
  try {
    const { name, description, industryType, stages } = req.body;
    const companyId = req.companyId;

    const tmplRes = await query(
      'INSERT INTO workflow_templates (company_id, name, description, industry_type) VALUES ($1,$2,$3,$4) RETURNING *',
      [companyId, name, description || null, industryType || null]
    );

    const tmpl = tmplRes.rows[0];

    if (stages && stages.length > 0) {
      for (const [idx, stage] of stages.entries()) {
        await query(
          `INSERT INTO workflow_stages (company_id, template_id, name, code, description, sequence_order,
            department, color, icon, is_qc_stage, requires_approval, notify_on_enter, notify_on_complete,
            sla_hours, custom_fields)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            companyId, tmpl.id, stage.name,
            stage.code || stage.name.toUpperCase().replace(/\s+/g, '_'),
            stage.description || null, stage.sequenceOrder || idx + 1,
            stage.department || null, stage.color || '#3B82F6', stage.icon || null,
            stage.isQcStage || false, stage.requiresApproval || false,
            stage.notifyOnEnter !== false, stage.notifyOnComplete !== false,
            stage.slaHours || null, stage.customFields ? JSON.stringify(stage.customFields) : '[]',
          ]
        );
      }
    }

    const fullTemplate = await query(
      'SELECT * FROM workflow_stages WHERE template_id = $1 ORDER BY sequence_order',
      [tmpl.id]
    );

    ApiResponse.created(res, { ...tmpl, stages: fullTemplate.rows }, 'Workflow template created');
  } catch (error) {
    next(error);
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const result = await query(
      'UPDATE workflow_templates SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 AND company_id = $4 RETURNING *',
      [name, description, id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Template not found');
    ApiResponse.success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const addStage = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const { name, code, description, sequenceOrder, department, color, icon,
      isQcStage, requiresApproval, notifyOnEnter, notifyOnComplete, slaHours, customFields } = req.body;

    // Shift existing stages if needed
    if (sequenceOrder) {
      await query(
        'UPDATE workflow_stages SET sequence_order = sequence_order + 1 WHERE template_id = $1 AND sequence_order >= $2',
        [templateId, sequenceOrder]
      );
    }

    const maxOrder = await query(
      'SELECT COALESCE(MAX(sequence_order), 0) + 1 AS next_order FROM workflow_stages WHERE template_id = $1',
      [templateId]
    );

    const result = await query(
      `INSERT INTO workflow_stages (company_id, template_id, name, code, description, sequence_order,
        department, color, icon, is_qc_stage, requires_approval, notify_on_enter, notify_on_complete, sla_hours, custom_fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        req.companyId, templateId, name,
        code || name.toUpperCase().replace(/\s+/g, '_'),
        description || null, sequenceOrder || maxOrder.rows[0].next_order,
        department || null, color || '#3B82F6', icon || null,
        isQcStage || false, requiresApproval || false,
        notifyOnEnter !== false, notifyOnComplete !== false,
        slaHours || null, customFields ? JSON.stringify(customFields) : '[]',
      ]
    );

    ApiResponse.created(res, result.rows[0], 'Stage added');
  } catch (error) {
    next(error);
  }
};

const updateStage = async (req, res, next) => {
  try {
    const { stageId } = req.params;
    const {
      name, description, sequenceOrder, department, color, icon,
      isQcStage, requiresApproval, notifyOnEnter, notifyOnComplete, slaHours, customFields,
    } = req.body;

    const result = await query(
      `UPDATE workflow_stages SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        sequence_order = COALESCE($3, sequence_order), department = COALESCE($4, department),
        color = COALESCE($5, color), icon = COALESCE($6, icon),
        is_qc_stage = COALESCE($7, is_qc_stage), requires_approval = COALESCE($8, requires_approval),
        notify_on_enter = COALESCE($9, notify_on_enter), notify_on_complete = COALESCE($10, notify_on_complete),
        sla_hours = COALESCE($11, sla_hours), custom_fields = COALESCE($12, custom_fields)
       WHERE id = $13 AND company_id = $14 RETURNING *`,
      [
        name, description, sequenceOrder, department, color, icon,
        isQcStage, requiresApproval, notifyOnEnter, notifyOnComplete, slaHours,
        customFields ? JSON.stringify(customFields) : null, stageId, req.companyId,
      ]
    );

    if (!result.rows[0]) return ApiResponse.notFound(res, 'Stage not found');
    ApiResponse.success(res, result.rows[0], 'Stage updated');
  } catch (error) {
    next(error);
  }
};

const reorderStages = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const { stages } = req.body; // [{id, sequenceOrder}]

    for (const stage of stages) {
      await query(
        'UPDATE workflow_stages SET sequence_order = $1 WHERE id = $2 AND template_id = $3',
        [stage.sequenceOrder, stage.id, templateId]
      );
    }

    ApiResponse.success(res, null, 'Stages reordered');
  } catch (error) {
    next(error);
  }
};

const deleteStage = async (req, res, next) => {
  try {
    const { stageId } = req.params;
    await query('UPDATE workflow_stages SET is_active = FALSE WHERE id = $1 AND company_id = $2', [stageId, req.companyId]);
    ApiResponse.success(res, null, 'Stage removed');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTemplates, getTemplate, createTemplate, updateTemplate,
  addStage, updateStage, reorderStages, deleteStage,
};
