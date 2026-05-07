const { query } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');

const getStats = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { period = '30' } = req.query;
    const days = parseInt(period);

    const [
      orderStats, productionStats, dispatchStats, stockStats,
      revenueStats, lowStockCount, pendingInvoices,
    ] = await Promise.all([
      // Sales order stats
      query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending,
           COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${days} days') AS period_total
         FROM sales_orders WHERE company_id = $1 AND deleted_at IS NULL`,
        [companyId]
      ),
      // Production stats
      query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending,
           COUNT(*) FILTER (WHERE status = 'in_progress') AS running,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed,
           COUNT(*) FILTER (WHERE planned_end_date < CURRENT_DATE AND status NOT IN ('completed','cancelled')) AS delayed,
           COALESCE(SUM(produced_quantity), 0) AS total_produced,
           COALESCE(SUM(rejected_quantity), 0) AS total_rejected
         FROM production_orders WHERE company_id = $1 AND deleted_at IS NULL
         AND created_at >= NOW() - INTERVAL '${days} days'`,
        [companyId]
      ),
      // Dispatch stats
      query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'dispatched') AS in_transit,
           COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
           COUNT(*) FILTER (WHERE expected_delivery_date < CURRENT_DATE AND status NOT IN ('delivered','returned')) AS delayed
         FROM dispatches WHERE company_id = $1 AND deleted_at IS NULL
         AND created_at >= NOW() - INTERVAL '${days} days'`,
        [companyId]
      ),
      // Stock stats
      query(
        `SELECT
           COUNT(*) AS total_materials,
           COALESCE(SUM(current_stock * purchase_rate), 0) AS stock_value,
           COUNT(*) FILTER (WHERE current_stock <= minimum_stock) AS low_stock_count,
           COUNT(*) FILTER (WHERE current_stock = 0) AS out_of_stock
         FROM materials WHERE company_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [companyId]
      ),
      // Revenue stats
      query(
        `SELECT
           COALESCE(SUM(net_amount), 0) AS total_revenue,
           COALESCE(SUM(net_amount) FILTER (WHERE payment_status = 'paid'), 0) AS paid_revenue,
           COALESCE(SUM(balance_amount) FILTER (WHERE payment_status != 'paid'), 0) AS pending_revenue,
           COUNT(*) AS total_invoices
         FROM invoices WHERE company_id = $1 AND deleted_at IS NULL
         AND invoice_date >= NOW() - INTERVAL '${days} days'`,
        [companyId]
      ),
      query(
        `SELECT COUNT(*) FROM materials WHERE company_id = $1 AND current_stock <= minimum_stock AND is_active = TRUE AND deleted_at IS NULL`,
        [companyId]
      ),
      query(
        `SELECT COUNT(*), COALESCE(SUM(balance_amount), 0) AS amount
         FROM invoices WHERE company_id = $1 AND payment_status != 'paid' AND deleted_at IS NULL`,
        [companyId]
      ),
    ]);

    ApiResponse.success(res, {
      orders: orderStats.rows[0],
      production: productionStats.rows[0],
      dispatches: dispatchStats.rows[0],
      stock: stockStats.rows[0],
      revenue: revenueStats.rows[0],
      lowStockCount: parseInt(lowStockCount.rows[0].count),
      pendingInvoices: {
        count: parseInt(pendingInvoices.rows[0].count),
        amount: parseFloat(pendingInvoices.rows[0].amount),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getCharts = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { period = '30' } = req.query;

    const [revenueChart, productionChart, dispatchChart, topProducts] = await Promise.all([
      // Revenue last N days
      query(
        `SELECT DATE(invoice_date) AS date, COALESCE(SUM(net_amount), 0) AS revenue, COUNT(*) AS invoices
         FROM invoices
         WHERE company_id = $1 AND deleted_at IS NULL
         AND invoice_date >= NOW() - INTERVAL '${period} days'
         GROUP BY DATE(invoice_date) ORDER BY date`,
        [companyId]
      ),
      // Production per status
      query(
        `SELECT status, COUNT(*) AS count FROM production_orders
         WHERE company_id = $1 AND deleted_at IS NULL
         AND created_at >= NOW() - INTERVAL '${period} days'
         GROUP BY status`,
        [companyId]
      ),
      // Dispatch per status
      query(
        `SELECT status, COUNT(*) AS count FROM dispatches
         WHERE company_id = $1 AND deleted_at IS NULL
         AND created_at >= NOW() - INTERVAL '${period} days'
         GROUP BY status`,
        [companyId]
      ),
      // Top 10 products by production
      query(
        `SELECT m.name, m.code, SUM(po.produced_quantity) AS total_produced,
                SUM(po.rejected_quantity) AS total_rejected
         FROM production_orders po
         JOIN materials m ON po.product_material_id = m.id
         WHERE po.company_id = $1 AND po.deleted_at IS NULL
         AND po.created_at >= NOW() - INTERVAL '${period} days'
         GROUP BY m.id, m.name, m.code
         ORDER BY total_produced DESC LIMIT 10`,
        [companyId]
      ),
    ]);

    ApiResponse.success(res, {
      revenueChart: revenueChart.rows,
      productionChart: productionChart.rows,
      dispatchChart: dispatchChart.rows,
      topProducts: topProducts.rows,
    });
  } catch (error) {
    next(error);
  }
};

const getWarehouseStock = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT w.id, w.name, w.code,
              COUNT(m.id) AS material_count,
              COALESCE(SUM(m.current_stock * m.purchase_rate), 0) AS stock_value,
              COALESCE(SUM(m.current_stock), 0) AS total_quantity
       FROM warehouses w
       LEFT JOIN materials m ON m.warehouse_id = w.id AND m.deleted_at IS NULL
       WHERE w.company_id = $1 AND w.deleted_at IS NULL
       GROUP BY w.id, w.name, w.code
       ORDER BY stock_value DESC`,
      [req.companyId]
    );
    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const getProductionTimeline = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT po.id, po.order_number, po.status, po.priority,
              po.planned_start_date, po.planned_end_date, po.actual_start_date, po.actual_end_date,
              m.name AS product_name,
              ws.name AS current_stage, ws.color AS stage_color,
              CASE WHEN po.planned_end_date < CURRENT_DATE AND po.status NOT IN ('completed','cancelled') THEN TRUE ELSE FALSE END AS is_delayed
       FROM production_orders po
       LEFT JOIN materials m ON po.product_material_id = m.id
       LEFT JOIN workflow_stages ws ON po.current_stage_id = ws.id
       WHERE po.company_id = $1 AND po.deleted_at IS NULL
       AND po.status NOT IN ('cancelled')
       ORDER BY po.planned_start_date ASC
       LIMIT 50`,
      [req.companyId]
    );
    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const getLowStockAlerts = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.id, m.code, m.name, m.unit, m.current_stock, m.minimum_stock,
              m.reorder_level, m.reorder_quantity, m.purchase_rate,
              mc.name AS category_name, w.name AS warehouse_name,
              s.name AS supplier_name, s.contact_person AS supplier_contact, s.phone AS supplier_phone
       FROM materials m
       LEFT JOIN material_categories mc ON m.category_id = mc.id
       LEFT JOIN warehouses w ON m.warehouse_id = w.id
       LEFT JOIN suppliers s ON m.supplier_id = s.id
       WHERE m.company_id = $1 AND m.current_stock <= m.minimum_stock
       AND m.is_active = TRUE AND m.deleted_at IS NULL
       ORDER BY (m.current_stock / NULLIF(m.minimum_stock, 0)) ASC
       LIMIT 20`,
      [req.companyId]
    );
    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

module.exports = { getStats, getCharts, getWarehouseStock, getProductionTimeline, getLowStockAlerts };
