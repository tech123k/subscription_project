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
        `SELECT po.*,
                COALESCE(pr.name, po.product_name) AS product_name,
                COALESCE(pr.unit, po.unit::text) AS product_unit,
                pr.code AS product_code,
                c.name AS customer_name, ws.name AS current_stage_name, ws.color AS stage_color,
                wt.name AS workflow_name,
                u.first_name || ' ' || u.last_name AS created_by_name,
                CASE WHEN po.planned_end_date < CURRENT_DATE AND po.status::text NOT IN ('completed','cancelled') THEN TRUE ELSE FALSE END AS is_delayed
         FROM production_orders po
         LEFT JOIN products pr ON po.product_id = pr.id
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

    const [orderRes, stageLogs, materials, revertLogs] = await Promise.all([
      query(
        `SELECT po.*,
                COALESCE(pr.name, po.product_name) AS product_name,
                COALESCE(pr.unit, po.unit::text) AS product_unit,
                pr.code AS product_code, pr.category AS product_category,
                c.name AS customer_name, c.gst_number AS customer_gst,
                ws.name AS current_stage_name, ws.color AS stage_color,
                wt.name AS workflow_name, wt.id AS workflow_id
         FROM production_orders po
         LEFT JOIN products pr ON po.product_id = pr.id
         LEFT JOIN customers c ON po.customer_id = c.id
         LEFT JOIN workflow_stages ws ON po.current_stage_id = ws.id
         LEFT JOIN workflow_templates wt ON po.workflow_template_id = wt.id
         WHERE po.id = $1 AND po.company_id = $2 AND po.deleted_at IS NULL`,
        [id, companyId]
      ),
      query(
        `SELECT psl.*, ws.name AS stage_name, ws.color AS stage_color, ws.sequence_order,
                ws.is_qc_stage, ws.department,
                psl.output_quantity AS produced_quantity,
                u.first_name || ' ' || u.last_name AS operator_name,
                cb.first_name || ' ' || cb.last_name AS completed_by_name
         FROM production_stage_logs psl
         JOIN workflow_stages ws ON psl.stage_id = ws.id
         LEFT JOIN users u  ON psl.operator_id  = u.id
         LEFT JOIN users cb ON psl.completed_by = cb.id
         WHERE psl.production_order_id = $1
         ORDER BY ws.sequence_order`,
        [id]
      ),
      query(
        `SELECT pm.*,
                m.name AS material_name, m.code AS material_code,
                m.unit::text AS unit, m.current_stock, m.reserved_stock,
                COALESCE(pm.actual_quantity, 0) AS actual_quantity,
                COALESCE(pm.variance_quantity, 0) AS variance_quantity,
                COALESCE(pm.wastage_quantity, 0)  AS wastage_quantity,
                -- remaining = planned - actual (0 when complete)
                GREATEST(0, pm.planned_quantity - COALESCE(pm.actual_quantity, 0)) AS remaining_quantity
         FROM production_materials pm
         JOIN materials m ON pm.material_id = m.id
         WHERE pm.production_order_id = $1
         ORDER BY pm.id`,
        [id]
      ),
      query(
        `SELECT psr.id, psr.created_at, psr.reason, psr.from_stage_id, psr.to_stage_id,
                ws_from.name AS from_stage_name, ws_to.name AS to_stage_name,
                u.first_name || ' ' || u.last_name AS reverted_by_name
         FROM production_stage_reverts psr
         JOIN workflow_stages ws_from ON psr.from_stage_id = ws_from.id
         JOIN workflow_stages ws_to   ON psr.to_stage_id   = ws_to.id
         LEFT JOIN users u ON psr.reverted_by = u.id
         WHERE psr.production_order_id = $1
         ORDER BY psr.created_at DESC`,
        [id]
      ),
    ]);

    if (!orderRes.rows[0]) return ApiResponse.notFound(res, 'Production order not found');

    ApiResponse.success(res, {
      ...orderRes.rows[0],
      stage_logs: stageLogs.rows,
      materials: materials.rows,
      revert_logs: revertLogs.rows,
    });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const {
      productId, salesOrderId, customerId,
      plannedQuantity, priority, plannedStartDate, plannedEndDate,
      notes,
    } = req.body;

    const workflowTemplateId = req.body.workflowTemplateId || null;

    if (!workflowTemplateId) return ApiResponse.badRequest(res, 'A workflow template is required');
    if (!productId) return ApiResponse.badRequest(res, 'A product is required');
    if (!plannedQuantity || Number(plannedQuantity) <= 0) return ApiResponse.badRequest(res, 'Planned quantity must be > 0');

    // Load product
    const productRes = await query(
      'SELECT id, name, unit FROM products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL AND is_active = TRUE',
      [productId, companyId]
    );
    if (!productRes.rows[0]) return ApiResponse.notFound(res, 'Product not found');
    const product = productRes.rows[0];

    // Load active BOM and calculate required materials
    const bomItemsRes = await query(
      `SELECT bi.material_id, m.name, m.code, m.unit::text AS unit, m.current_stock,
              bi.quantity_per_unit, bi.waste_percentage,
              ROUND(bi.quantity_per_unit * $2 * (1 + bi.waste_percentage / 100.0), 4) AS required_quantity
       FROM bill_of_materials b
       JOIN bom_items bi ON bi.bom_id = b.id
       JOIN materials m ON m.id = bi.material_id AND m.deleted_at IS NULL
       WHERE b.product_id = $1 AND b.is_active = TRUE
       ORDER BY bi.sequence_order`,
      [productId, Number(plannedQuantity)]
    );

    if (bomItemsRes.rows.length === 0) {
      return ApiResponse.badRequest(res, 'This product has no active BOM. Please create a BOM before creating a production order.');
    }

    const bomMaterials = bomItemsRes.rows;

    // Server-side stock validation
    const shortages = [];
    for (const item of bomMaterials) {
      const available = Number(item.current_stock || 0);
      const required = Number(item.required_quantity);
      if (required > available) {
        shortages.push({
          name: item.name,
          code: item.code,
          unit: item.unit,
          required,
          available,
          shortage: +(required - available).toFixed(4),
        });
      }
    }
    if (shortages.length > 0) {
      return ApiResponse.badRequest(res, `Insufficient stock for ${shortages.length} material(s)`, shortages);
    }

    // Get active BOM id for snapshot reference
    const bomIdRes = await query(
      'SELECT id FROM bill_of_materials WHERE product_id = $1 AND is_active = TRUE LIMIT 1',
      [productId]
    );
    const bomId = bomIdRes.rows[0]?.id || null;

    // Generate order number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countRes = await query(
      'SELECT COUNT(*) FROM production_orders WHERE company_id = $1 AND DATE(created_at) = CURRENT_DATE',
      [companyId]
    );
    const orderNumber = `PRD-${dateStr}-${String(parseInt(countRes.rows[0].count) + 1).padStart(4, '0')}`;

    // Get first workflow stage
    const stagesRes = await query(
      'SELECT id FROM workflow_stages WHERE template_id = $1 AND is_active = TRUE ORDER BY sequence_order ASC LIMIT 1',
      [workflowTemplateId]
    );
    const firstStageId = stagesRes.rows[0]?.id || null;

    const result = await transaction(async (client) => {
      const po = await client.query(
        `INSERT INTO production_orders (
          company_id, order_number, product_id, bom_id, sales_order_id, customer_id,
          workflow_template_id, product_name, unit, planned_quantity, priority,
          planned_start_date, planned_end_date, notes, current_stage_id, created_by, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending')
        RETURNING *`,
        [
          companyId, orderNumber, productId, bomId,
          salesOrderId || null, customerId || null,
          workflowTemplateId, product.name, product.unit,
          Number(plannedQuantity), priority || 'normal',
          plannedStartDate || null, plannedEndDate || null,
          notes || null, firstStageId, req.user.id,
        ]
      );

      const poId = po.rows[0].id;

      // Create stage logs for all stages
      const allStages = await client.query(
        'SELECT id FROM workflow_stages WHERE template_id = $1 AND is_active = TRUE ORDER BY sequence_order',
        [workflowTemplateId]
      );
      for (const stage of allStages.rows) {
        await client.query(
          `INSERT INTO production_stage_logs (production_order_id, stage_id, status, created_by)
           VALUES ($1,$2,'pending',$3)`,
          [poId, stage.id, req.user.id]
        );
      }

      // Reserve BOM materials from stock
      for (const mat of bomMaterials) {
        await client.query(
          `INSERT INTO production_materials (production_order_id, material_id, planned_quantity, unit)
           VALUES ($1,$2,$3,$4)`,
          [poId, mat.material_id, mat.required_quantity, mat.unit]
        );
        await client.query(
          `UPDATE materials
             SET reserved_stock = reserved_stock + $1,
                 current_stock  = GREATEST(0, current_stock - $1)
           WHERE id = $2 AND company_id = $3`,
          [mat.required_quantity, mat.material_id, companyId]
        );
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
      const isCompleting = status === 'completed';

      // All CASE conditions use $1::text to avoid enum type inference conflict.
      // production_stage_logs.status was previously an enum; columns are now VARCHAR.
      await client.query(
        `UPDATE production_stage_logs SET
          status             = $1::text,
          input_quantity     = COALESCE($2, input_quantity),
          output_quantity    = COALESCE($3, output_quantity),
          rejection_quantity = COALESCE($4, rejection_quantity),
          wastage_quantity   = COALESCE($5, wastage_quantity),
          operator_id        = COALESCE($6::uuid, operator_id),
          machine_id         = COALESCE($7, machine_id),
          notes              = COALESCE($8, notes),
          images             = COALESCE($9::jsonb, images),
          completed_by       = CASE WHEN $1::text = 'completed' THEN $10::uuid ELSE completed_by END,
          started_at         = CASE WHEN $1::text = 'in_progress' THEN COALESCE(started_at, NOW()) ELSE started_at END,
          completed_at       = CASE WHEN $1::text = 'completed'   THEN NOW() ELSE NULL END
         WHERE production_order_id = $11::uuid AND stage_id = $12::uuid`,
        [
          status,
          inputQuantity    ?? null,
          outputQuantity   ?? null,
          rejectionQuantity ?? null,
          wastageQuantity  ?? null,
          operatorId || null,
          machineId  || null,
          notes      ?? null,
          images ? JSON.stringify(images) : null,
          req.user.id,
          id,
          stageId,
        ]
      );

      // Accumulate rejected qty across all stages (parts can be rejected at any stage)
      if (isCompleting && parseFloat(rejectionQuantity || 0) > 0) {
        await client.query(
          `UPDATE production_orders SET rejected_quantity = rejected_quantity + $1 WHERE id = $2`,
          [parseFloat(rejectionQuantity), id]
        );
      }

      if (isCompleting) {
        const nextStageRes = await client.query(
          `SELECT ws2.id FROM workflow_stages ws1
           JOIN workflow_stages ws2 ON ws2.template_id = ws1.template_id
             AND ws2.sequence_order = ws1.sequence_order + 1
           WHERE ws1.id = $1 AND ws2.is_active = TRUE`,
          [stageId]
        );

        if (nextStageRes.rows[0]) {
          // ── Not the final stage — advance workflow ──────────────────────────
          const nextStageId = nextStageRes.rows[0].id;
          await client.query(
            'UPDATE production_orders SET current_stage_id = $1, status = $2 WHERE id = $3',
            [nextStageId, 'in_progress', id]
          );
          await client.query(
            `UPDATE production_stage_logs SET status = 'in_progress', started_at = NOW()
             WHERE production_order_id = $1 AND stage_id = $2 AND status = 'pending'`,
            [id, nextStageId]
          );
          setImmediate(() => {
            notificationService.notifyWorkflowStage(companyId, nextStageId, id, order.order_number).catch(() => {});
          });
        } else {
          // ── Final stage complete ────────────────────────────────────────────
          const producedQty = parseFloat(outputQuantity || 0);
          const plannedQty  = parseFloat(order.planned_quantity || 0);

          // produced_quantity = FINAL stage output only (not accumulated)
          await client.query(
            `UPDATE production_orders
               SET status = 'completed', actual_end_date = NOW(),
                   produced_quantity = $1, finished_goods_added = FALSE
             WHERE id = $2`,
            [producedQty, id]
          );

          // ── Actual material consumption tracking ──────────────────────────
          // Materials were reserved at order creation. On completion, mark actual consumption.
          // Actual consumed = planned qty (100% consumed). Wastage is in the yield loss (planned 400, got 390 pairs → 10 pairs worth of waste).
          const materialsRes = await client.query(
            'SELECT material_id, planned_quantity FROM production_materials WHERE production_order_id = $1',
            [id]
          );

          for (const mat of materialsRes.rows) {
            const planned = parseFloat(mat.planned_quantity || 0);
            // actual_quantity = planned (all materials consumed by production process)
            // variance_quantity = 0 (no excess consumption, yield loss is captured in produced_quantity vs planned_quantity)
            await client.query(
              `UPDATE production_materials
                 SET actual_quantity   = $1,
                     wastage_quantity  = 0,
                     variance_quantity = 0
               WHERE production_order_id = $2 AND material_id = $3`,
              [planned, id, mat.material_id]
            );
            // Clear reserved_stock — materials are now consumed
            await client.query(
              `UPDATE materials
                 SET reserved_stock = GREATEST(0, reserved_stock - $1)
               WHERE id = $2 AND company_id = $3`,
              [planned, mat.material_id, companyId]
            );
          }

          // ── Add produced qty to finished goods inventory (if configured) ──
          const fgRes = await client.query(
            `SELECT p.finished_goods_material_id
             FROM production_orders po
             JOIN products p ON po.product_id = p.id
             WHERE po.id = $1 AND p.finished_goods_material_id IS NOT NULL`,
            [id]
          );

          if (fgRes.rows[0]?.finished_goods_material_id && producedQty > 0) {
            const fgMatId = fgRes.rows[0].finished_goods_material_id;
            await client.query(
              `UPDATE materials SET current_stock = current_stock + $1 WHERE id = $2`,
              [producedQty, fgMatId]
            );
            await client.query(
              `UPDATE production_orders SET finished_goods_added = TRUE WHERE id = $1`,
              [id]
            );
          }

          // ── Update product's own FG stock ledger (primary, always runs) ──
          // This is the authoritative FG stock — independent of the materials system.
          if (order.product_id && producedQty > 0) {
            await client.query(
              `UPDATE products
                 SET current_stock        = GREATEST(0, current_stock + $1),
                     produced_qty         = produced_qty + $1,
                     last_production_date = NOW()
               WHERE id = $2 AND company_id = $3`,
              [producedQty, order.product_id, companyId]
            );
          }

          setImmediate(() => {
            notificationService.broadcastToCompany(companyId, {
              type: 'production_complete',
              title: 'Production Complete',
              message: `Production order ${order.order_number} has been completed`,
              referenceType: 'production_orders',
              referenceId: id,
              priority: 'high',
            }).catch(() => {});
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

const revertStage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const { stageId, reason } = req.body;

    if (!reason?.trim()) {
      return ApiResponse.badRequest(res, 'A reason is required to revert a stage');
    }

    const orderRes = await query(
      'SELECT * FROM production_orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [id, companyId]
    );
    if (!orderRes.rows[0]) return ApiResponse.notFound(res, 'Production order not found');
    if (orderRes.rows[0].status !== 'in_progress') {
      return ApiResponse.badRequest(res, 'Only in-progress orders can have stages reverted');
    }

    // Get the current stage's sequence position
    const fromStageRes = await query(
      'SELECT id, name, sequence_order, template_id FROM workflow_stages WHERE id = $1',
      [stageId]
    );
    if (!fromStageRes.rows[0]) return ApiResponse.notFound(res, 'Stage not found');
    const fromStage = fromStageRes.rows[0];

    if (fromStage.sequence_order <= 1) {
      return ApiResponse.badRequest(res, 'Cannot revert from the first stage');
    }

    // Find the previous stage in the same template
    const toStageRes = await query(
      `SELECT id, name FROM workflow_stages
       WHERE template_id = $1 AND sequence_order = $2 AND is_active = TRUE`,
      [fromStage.template_id, fromStage.sequence_order - 1]
    );
    if (!toStageRes.rows[0]) return ApiResponse.badRequest(res, 'No previous stage found');
    const toStage = toStageRes.rows[0];

    await transaction(async (client) => {
      // Reset current (from) stage log back to pending — clear all output data
      await client.query(
        `UPDATE production_stage_logs
         SET status = 'pending', output_quantity = NULL, rejection_quantity = NULL,
             wastage_quantity = NULL, input_quantity = NULL,
             started_at = NULL, completed_at = NULL, notes = NULL
         WHERE production_order_id = $1 AND stage_id = $2`,
        [id, fromStage.id]
      );

      // Reactivate previous (to) stage log — keep its started_at, only clear completed_at
      await client.query(
        `UPDATE production_stage_logs
         SET status = 'in_progress', completed_at = NULL
         WHERE production_order_id = $1 AND stage_id = $2`,
        [id, toStage.id]
      );

      // Point the order back to the previous stage
      await client.query(
        `UPDATE production_orders SET current_stage_id = $1, updated_at = NOW() WHERE id = $2`,
        [toStage.id, id]
      );

      // Record the revert in audit history
      await client.query(
        `INSERT INTO production_stage_reverts
           (production_order_id, from_stage_id, to_stage_id, reason, reverted_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, fromStage.id, toStage.id, reason.trim(), req.user.id]
      );
    });

    ApiResponse.success(res, null, `Reverted from "${fromStage.name}" back to "${toStage.name}"`);
  } catch (error) {
    next(error);
  }
};

const exportOrders = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT po.*,
              COALESCE(pr.name, po.product_name) AS product_name,
              COALESCE(pr.unit, po.unit::text)   AS product_unit,
              pr.code AS product_code,
              c.name  AS customer_name,
              ws.name AS current_stage_name,
              CASE WHEN po.planned_end_date < CURRENT_DATE AND po.status::text NOT IN ('completed','cancelled') THEN TRUE ELSE FALSE END AS is_delayed
       FROM production_orders po
       LEFT JOIN products pr ON po.product_id = pr.id
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

module.exports = { getAll, getOne, create, updateStage, revertStage, updateStatus, exportOrders };
