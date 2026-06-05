const { query } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const excelService = require('../services/excel.service');

const stockReport = async (req, res, next) => {
  try {
    const { warehouseId, categoryId, lowStock, format } = req.query;
    const companyId = req.companyId;

    let where = 'WHERE m.company_id = $1 AND m.deleted_at IS NULL AND m.is_active = TRUE';
    const params = [companyId];
    let idx = 2;

    if (warehouseId) { where += ` AND m.warehouse_id = $${idx}`; params.push(warehouseId); idx++; }
    if (categoryId) { where += ` AND m.category_id = $${idx}`; params.push(categoryId); idx++; }
    if (lowStock === 'true') where += ' AND m.current_stock <= m.minimum_stock';

    const result = await query(
      `SELECT m.id, m.code, m.name, m.unit, m.current_stock, m.reserved_stock,
              m.damaged_stock, m.in_production_stock, m.in_transit_stock,
              m.minimum_stock, m.reorder_level, m.purchase_rate,
              (m.current_stock * m.purchase_rate) AS stock_value,
              mc.name AS category_name, w.name AS warehouse_name,
              CASE WHEN m.current_stock <= m.minimum_stock THEN 'Low' ELSE 'OK' END AS stock_status
       FROM materials m
       LEFT JOIN material_categories mc ON m.category_id = mc.id
       LEFT JOIN warehouses w ON m.warehouse_id = w.id
       ${where}
       ORDER BY m.name`,
      params
    );

    if (format === 'excel') {
      const wb = excelService.exportMaterials(result.rows);
      const buffer = excelService.toBuffer(wb);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="stock_report.xlsx"');
      return res.send(buffer);
    }

    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const productionReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status, format } = req.query;
    const companyId = req.companyId;

    let where = 'WHERE po.company_id = $1 AND po.deleted_at IS NULL';
    const params = [companyId];
    let idx = 2;

    if (status) { where += ` AND po.status = $${idx}`; params.push(status); idx++; }
    if (startDate) { where += ` AND po.created_at >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { where += ` AND po.created_at <= $${idx}`; params.push(endDate); idx++; }

    const result = await query(
      `SELECT po.order_number, m.name AS product_name, c.name AS customer_name,
              po.status, po.priority, po.planned_quantity, po.produced_quantity,
              po.rejected_quantity, po.wastage_quantity,
              ROUND((po.rejected_quantity / NULLIF(po.produced_quantity, 0) * 100)::numeric, 2) AS rejection_rate,
              po.planned_start_date, po.planned_end_date, po.actual_start_date, po.actual_end_date,
              ws.name AS current_stage, wt.name AS workflow
       FROM production_orders po
       LEFT JOIN materials m ON po.product_material_id = m.id
       LEFT JOIN customers c ON po.customer_id = c.id
       LEFT JOIN workflow_stages ws ON po.current_stage_id = ws.id
       LEFT JOIN workflow_templates wt ON po.workflow_template_id = wt.id
       ${where}
       ORDER BY po.created_at DESC`,
      params
    );

    if (format === 'excel') {
      const wb = excelService.exportProductionOrders(result.rows);
      const buffer = excelService.toBuffer(wb);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="production_report.xlsx"');
      return res.send(buffer);
    }

    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const financialReport = async (req, res, next) => {
  try {
    const { startDate, endDate, format } = req.query;
    const companyId = req.companyId;

    const [invoices, summary] = await Promise.all([
      query(
        `SELECT i.invoice_number, c.name AS customer_name, i.invoice_date, i.due_date,
                i.subtotal, i.total_tax_amount, i.net_amount, i.paid_amount, i.balance_amount, i.payment_status
         FROM invoices i
         LEFT JOIN customers c ON i.customer_id = c.id
         WHERE i.company_id = $1 AND i.deleted_at IS NULL
         ${startDate ? 'AND i.invoice_date >= $2' : ''}
         ${endDate ? `AND i.invoice_date <= $${startDate ? 3 : 2}` : ''}
         ORDER BY i.invoice_date DESC`,
        [companyId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])]
      ),
      query(
        `SELECT
           COALESCE(SUM(net_amount), 0) AS total_revenue,
           COALESCE(SUM(total_tax_amount), 0) AS total_tax,
           COALESCE(SUM(paid_amount), 0) AS total_collected,
           COALESCE(SUM(balance_amount), 0) AS total_outstanding,
           COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_count,
           COUNT(*) FILTER (WHERE payment_status = 'partial') AS partial_count,
           COUNT(*) FILTER (WHERE payment_status = 'unpaid') AS unpaid_count
         FROM invoices WHERE company_id = $1 AND deleted_at IS NULL`,
        [companyId]
      ),
    ]);

    if (format === 'excel') {
      const wb = excelService.exportInvoices(invoices.rows);
      const buffer = excelService.toBuffer(wb);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="financial_report.xlsx"');
      return res.send(buffer);
    }

    ApiResponse.success(res, { invoices: invoices.rows, summary: summary.rows[0] });
  } catch (error) {
    next(error);
  }
};

const dispatchReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status, format } = req.query;
    const companyId = req.companyId;

    let where = 'WHERE d.company_id = $1 AND d.deleted_at IS NULL';
    const params = [companyId];
    let idx = 2;

    if (status) { where += ` AND d.status = $${idx}`; params.push(status); idx++; }
    if (startDate) { where += ` AND d.dispatch_date >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { where += ` AND d.dispatch_date <= $${idx}`; params.push(endDate); idx++; }

    const result = await query(
      `SELECT d.*, c.name AS customer_name, i.invoice_number,
              CASE WHEN d.expected_delivery_date < CURRENT_DATE AND d.status NOT IN ('delivered','returned') THEN TRUE ELSE FALSE END AS is_delayed
       FROM dispatches d
       LEFT JOIN customers c ON d.customer_id = c.id
       LEFT JOIN invoices i ON d.invoice_id = i.id
       ${where} ORDER BY d.dispatch_date DESC`,
      params
    );

    if (format === 'excel') {
      const wb = excelService.exportDispatches(result.rows);
      const buffer = excelService.toBuffer(wb);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="dispatch_report.xlsx"');
      return res.send(buffer);
    }

    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const stockTransactionReport = async (req, res, next) => {
  try {
    const { materialId, startDate, endDate, transactionType, format } = req.query;
    const companyId = req.companyId;

    let where = 'WHERE st.company_id = $1';
    const params = [companyId];
    let idx = 2;

    if (materialId) { where += ` AND st.material_id = $${idx}`; params.push(materialId); idx++; }
    if (transactionType) { where += ` AND st.transaction_type = $${idx}`; params.push(transactionType); idx++; }
    if (startDate) { where += ` AND st.created_at >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { where += ` AND st.created_at <= $${idx}`; params.push(endDate); idx++; }

    const result = await query(
      `SELECT st.*, m.name AS material_name, m.code AS material_code,
              w.name AS warehouse_name, u.first_name || ' ' || u.last_name AS user_name
       FROM stock_transactions st
       JOIN materials m ON st.material_id = m.id
       LEFT JOIN warehouses w ON st.warehouse_id = w.id
       LEFT JOIN users u ON st.performed_by = u.id
       ${where}
       ORDER BY st.created_at DESC LIMIT 1000`,
      params
    );

    if (format === 'excel') {
      const wb = excelService.exportStockTransactions(result.rows);
      const buffer = excelService.toBuffer(wb);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="stock_transactions.xlsx"');
      return res.send(buffer);
    }

    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const auditReport = async (req, res, next) => {
  try {
    const { module, action, userId, startDate, endDate, format } = req.query;
    const companyId = req.companyId;

    let where = 'WHERE al.company_id = $1';
    const params = [companyId];
    let idx = 2;

    if (module) { where += ` AND al.module = $${idx}`; params.push(module); idx++; }
    if (action) { where += ` AND al.action = $${idx}`; params.push(action); idx++; }
    if (userId) { where += ` AND al.user_id = $${idx}`; params.push(userId); idx++; }
    if (startDate) { where += ` AND al.created_at >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { where += ` AND al.created_at <= $${idx}`; params.push(endDate); idx++; }

    const result = await query(
      `SELECT al.* FROM audit_logs al ${where} ORDER BY al.created_at DESC LIMIT 500`,
      params
    );

    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const fulfillmentReport = async (req, res, next) => {
  try {
    const companyId = req.companyId;

    const result = await query(
      `SELECT
         so.order_number,
         so.status                                               AS order_status,
         so.created_at                                           AS order_date,
         c.name                                                  AS customer_name,
         m.code                                                  AS item_code,
         m.name                                                  AS item_name,
         soi.quantity                                            AS ordered_qty,
         COALESCE(soi.dispatched_quantity, 0)                   AS dispatched_qty,
         (soi.quantity - COALESCE(soi.dispatched_quantity, 0))  AS pending_qty,
         soi.unit,
         m.current_stock                                         AS available_stock,
         CASE
           WHEN m.current_stock >= (soi.quantity - COALESCE(soi.dispatched_quantity, 0)) THEN 'sufficient'
           WHEN m.current_stock > 0                                                       THEN 'partial'
           ELSE 'out_of_stock'
         END                                                     AS stock_status,
         'material'                                              AS item_type
       FROM sales_orders so
       JOIN customers c              ON so.customer_id  = c.id
       JOIN sales_order_items soi    ON so.id           = soi.sales_order_id
       JOIN materials m              ON soi.material_id = m.id
       WHERE so.company_id = $1
         AND so.status NOT IN ('delivered','cancelled')
         AND soi.material_id IS NOT NULL

       UNION ALL

       SELECT
         so.order_number,
         so.status,
         so.created_at,
         c.name,
         p.code,
         p.name,
         soi.quantity,
         COALESCE(soi.dispatched_quantity, 0),
         (soi.quantity - COALESCE(soi.dispatched_quantity, 0)),
         soi.unit,
         GREATEST(0, p.current_stock - p.reserved_stock),
         CASE
           WHEN GREATEST(0, p.current_stock - p.reserved_stock) >= (soi.quantity - COALESCE(soi.dispatched_quantity, 0)) THEN 'sufficient'
           WHEN GREATEST(0, p.current_stock - p.reserved_stock) > 0                                                      THEN 'partial'
           ELSE 'out_of_stock'
         END,
         'product'
       FROM sales_orders so
       JOIN customers c              ON so.customer_id  = c.id
       JOIN sales_order_items soi    ON so.id           = soi.sales_order_id
       JOIN products p               ON soi.product_id  = p.id
       WHERE so.company_id = $1
         AND so.status NOT IN ('delivered','cancelled')
         AND soi.product_id IS NOT NULL

       ORDER BY
         CASE stock_status WHEN 'out_of_stock' THEN 0 WHEN 'partial' THEN 1 ELSE 2 END,
         order_date DESC`,
      [companyId, companyId]
    );

    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  stockReport, productionReport, financialReport, dispatchReport,
  stockTransactionReport, auditReport, fulfillmentReport,
};
