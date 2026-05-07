const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');
const notificationService = require('../services/notification.service');
const excelService = require('../services/excel.service');

const getAll = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, status, priority, startDate, endDate, customerId } = req.query;

    let where = 'WHERE po.company_id = $1 AND po.deleted_at IS NULL';
    const params = [companyId];
    let idx = 2;

    if (search) { where += ` AND po.order_number ILIKE $${idx}`; params.push(`%${search}%`); idx++; }
    if (status) { where += ` AND po.status = $${idx}`; params.push(status); idx++; }
    if (priority) { where += ` AND po.priority = $${idx}`; params.push(priority); idx++; }
    if (customerId) { where += ` AND po.customer_id = $${idx}`; params.push(customerId); idx++; }
    if (startDate) { where += ` AND po.planned_start_date >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { where += ` AND po.planned_end_date <= $${idx}`; params.push(endDate); idx++; }

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT po.*, m.name AS product_name, m.code AS product_code, m.unit AS product_unit,
                c.name AS customer_name, ws.name AS current_stage_name, ws.color AS stage_color,
                wt.name AS workflow_name,
                u.first_name || ' ' || u.last_name AS created_by_name,
                CASE WHEN po.planned_end_date < CURRENT_DATE AND po.status NOT IN ('completed','cancelled') THEN TRUE ELSE FALSE END AS is_delayed
         FROM production_orders po
         LEFT JOIN materials m ON po.product_material_id = m.id
         LEFT JOIN customers c ON po.customer_id = c.id
         LEFT JOIN workflow_stages ws ON po.current_stage_id = ws.id
         LEFT JOIN workflow_templates wt ON po.workflow_template_id = wt.id
         LEFT JOIN users u ON po.created_by = u.id
         ${where}
         ORDER BY po.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM production_orders po ${where}`, params),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { id } = req.params;

    const [orderRes, stageLogs, materials] = await Promise.all([
      query(
        `SELECT po.*, m.name AS product_name, m.code AS product_code, m.unit AS product_unit,
                c.name AS customer_name, c.gst_number AS customer_gst,
                ws.name AS current_stage_name, ws.color AS stage_color,
                wt.name AS workflow_name, wt.id AS workflow_id
         FROM production_orders po
         LEFT JOIN materials m ON po.product_material_id = m.id
         LEFT JOIN customers c ON po.customer_id = c.id
         LEFT JOIN workflow_stages ws ON po.current_stage_id = ws.id
         LEFT JOIN workflow_templates wt ON po.workflow_template_id = wt.id
         WHERE po.id = $1 AND po.company_id = $2 AND po.deleted_at IS NULL`,
        [id, companyId]
      ),
      query(
        `SELECT psl.*, ws.name AS stage_name, ws.color AS stage_color, ws.sequence_order,
                u.first_name || ' ' || u.last_name AS operator_name
         FROM production_stage_logs psl
         JOIN workflow_stages ws ON psl.stage_id = ws.id
         LEFT JOIN users u ON psl.operator_id = u.id
         WHERE psl.production_order_id = $1
         ORDER BY ws.sequence_order`,
        [id]
      ),
      query(
        `SELECT pm.*, m.name AS material_name, m.code AS material_code, m.unit
         FROM production_materials pm
         JOIN materials m ON pm.material_id = m.id
         WHERE pm.production_order_id = $1`,
        [id]
      ),
    ]);

    if (!orderRes.rows[0]) return ApiResponse.notFound(res, 'Production order not found');

    ApiResponse.success(res, {
      ...orderRes.rows[0],
      stageLogs: stageLogs.rows,
      materials: materials.rows,
    });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const {
      salesOrderId, customerId, workflowTemplateId, productMaterialId,
      plannedQuantity, priority, plannedStartDate, plannedEndDate,
      batchNumber, lotNumber, notes, materials: matList,
    } = req.body;

    // Generate order number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countRes = await query(
      'SELECT COUNT(*) FROM production_orders WHERE company_id = $1 AND DATE(created_at) = CURRENT_DATE',
      [companyId]
    );
    const orderNumber = `PO-${dateStr}-${String(parseInt(countRes.rows[0].count) + 1).padStart(4, '0')}`;

    // Get first workflow stage
    const stagesRes = await query(
      'SELECT id FROM workflow_stages WHERE template_id = $1 AND is_active = TRUE ORDER BY sequence_order ASC LIMIT 1',
      [workflowTemplateId]
    );
    const firstStageId = stagesRes.rows[0]?.id;

    const result = await transaction(async (client) => {
      const po = await client.query(
        `INSERT INTO production_orders (
          company_id, order_number, sales_order_id, customer_id, workflow_template_id,
          product_material_id, planned_quantity, priority, planned_start_date, planned_end_date,
          batch_number, lot_number, notes, current_stage_id, created_by, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending')
        RETURNING *`,
        [
          companyId, orderNumber, salesOrderId || null, customerId || null,
          workflowTemplateId, productMaterialId, plannedQuantity,
          priority || 'normal', plannedStartDate || null, plannedEndDate || null,
          batchNumber || null, lotNumber || null, notes || null,
          firstStageId || null, req.user.id,
        ]
      );

      const poId = po.rows[0].id;

      // Create stage logs for all stages
      const allStages = await client.query(
        'SELECT id, sequence_order FROM workflow_stages WHERE template_id = $1 AND is_active = TRUE ORDER BY sequence_order',
        [workflowTemplateId]
      );

      for (const stage of allStages.rows) {
        await client.query(
          `INSERT INTO production_stage_logs (production_order_id, stage_id, status, created_by)
           VALUES ($1,$2,'pending',$3)`,
          [poId, stage.id, req.user.id]
        );
      }

      // Add materials
      if (matList && matList.length > 0) {
        for (const mat of matList) {
          await client.query(
            `INSERT INTO production_materials (production_order_id, material_id, planned_quantity, unit, warehouse_id)
             VALUES ($1,$2,$3,$4,$5)`,
            [poId, mat.materialId, mat.quantity, mat.unit, mat.warehouseId || null]
          );

          // Reserve stock
          await client.query(
            `UPDATE materials SET reserved_stock = reserved_stock + $1, current_stock = current_stock - $1
             WHERE id = $2 AND company_id = $3`,
            [mat.quantity, mat.materialId, companyId]
          );
        }
      }

      return po.rows[0];
    });

    // Notify
    await notificationService.broadcastToCompany(companyId, {
      type: 'new_order',
      title: 'New Production Order',
      message: `Production order ${orderNumber} has been created`,
      referenceType: 'production_orders',
      referenceId: result.id,
      excludeUserId: req.user.id,
    });

    ApiResponse.created(res, result, 'Production order created successfully');
  } catch (error) {
    next(error);
  }
};

const updateStage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const {
      stageId, status, inputQuantity, outputQuantity, rejectionQuantity,
      wastageQuantity, operatorId, machineId, notes, images,
    } = req.body;

    const orderRes = await query(
      'SELECT * FROM production_orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [id, companyId]
    );
    if (!orderRes.rows[0]) return ApiResponse.notFound(res, 'Production order not found');
    const order = orderRes.rows[0];

    await transaction(async (client) => {
      // Update stage log
      const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
      const startedAt = status === 'in_progress' ? 'COALESCE(started_at, NOW())' : 'started_at';

      await client.query(
        `UPDATE production_stage_logs SET
          status = $1, input_quantity = COALESCE($2, input_quantity),
          output_quantity = COALESCE($3, output_quantity), rejection_quantity = COALESCE($4, rejection_quantity),
          wastage_quantity = COALESCE($5, wastage_quantity), operator_id = COALESCE($6, operator_id),
          machine_id = COALESCE($7, machine_id), notes = COALESCE($8, notes),
          images = COALESCE($9::jsonb, images),
          started_at = ${startedAt}, completed_at = ${completedAt === 'NULL' ? 'NULL' : completedAt}
         WHERE production_order_id = $10 AND stage_id = $11`,
        [
          status, inputQuantity, outputQuantity, rejectionQuantity,
          wastageQuantity, operatorId || null, machineId || null, notes,
          images ? JSON.stringify(images) : null, id, stageId,
        ]
      );

      // If stage completed, advance to next stage
      if (status === 'completed') {
        const nextStageRes = await client.query(
          `SELECT ws2.id FROM workflow_stages ws1
           JOIN workflow_stages ws2 ON ws2.template_id = ws1.template_id AND ws2.sequence_order = ws1.sequence_order + 1
           WHERE ws1.id = $1 AND ws2.is_active = TRUE`,
          [stageId]
        );

        if (nextStageRes.rows[0]) {
          await client.query(
            'UPDATE production_orders SET current_stage_id = $1, status = $2 WHERE id = $3',
            [nextStageRes.rows[0].id, 'in_progress', id]
          );

          // Notify next stage department
          setImmediate(() => {
            notificationService.notifyWorkflowStage(companyId, nextStageRes.rows[0].id, id, order.order_number).catch(() => {});
          });
        } else {
          // All stages complete
          const produced = parseFloat(outputQuantity || 0);
          const rejected = parseFloat(rejectionQuantity || 0);
          await client.query(
            `UPDATE production_orders SET status = 'completed', actual_end_date = NOW(),
             produced_quantity = produced_quantity + $1, rejected_quantity = rejected_quantity + $2
             WHERE id = $3`,
            [produced, rejected, id]
          );

          // Release reserved stock and add to finished goods
          await notificationService.broadcastToCompany(companyId, {
            type: 'production_complete',
            title: 'Production Complete',
            message: `Production order ${order.order_number} has been completed`,
            referenceType: 'production_orders',
            referenceId: id,
            priority: 'high',
          });
        }
      }
    });

    ApiResponse.success(res, null, 'Stage updated successfully');
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const result = await query(
      `UPDATE production_orders SET status = $1, notes = COALESCE($2, notes)
       WHERE id = $3 AND company_id = $4 AND deleted_at IS NULL RETURNING order_number`,
      [status, notes, id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Production order not found');
    ApiResponse.success(res, null, 'Status updated successfully');
  } catch (error) {
    next(error);
  }
};

const exportOrders = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT po.*, m.name AS product_name, c.name AS customer_name, ws.name AS current_stage_name,
              CASE WHEN po.planned_end_date < CURRENT_DATE AND po.status NOT IN ('completed','cancelled') THEN TRUE ELSE FALSE END AS is_delayed
       FROM production_orders po
       LEFT JOIN materials m ON po.product_material_id = m.id
       LEFT JOIN customers c ON po.customer_id = c.id
       LEFT JOIN workflow_stages ws ON po.current_stage_id = ws.id
       WHERE po.company_id = $1 AND po.deleted_at IS NULL
       ORDER BY po.created_at DESC`,
      [req.companyId]
    );

    const wb = excelService.exportProductionOrders(result.rows);
    const buffer = excelService.toBuffer(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="production_orders.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getOne, create, updateStage, updateStatus, exportOrders };
