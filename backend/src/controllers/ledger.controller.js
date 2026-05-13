const { query } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');
const { writeLedger } = require('../services/ledger.service');

// ─── GET LEDGER ENTRIES ─────────────────────────────────────────────────────

const getEntries = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const {
      materialId, productId, variantId, warehouseId,
      movementType, fromDate, toDate, search,
    } = req.query;

    let where = 'WHERE il.company_id = $1';
    const params = [companyId];
    let idx = 2;

    if (materialId)    { where += ` AND il.material_id = $${idx++}`;   params.push(materialId); }
    if (productId)     { where += ` AND il.product_id = $${idx++}`;    params.push(productId); }
    if (variantId)     { where += ` AND il.variant_id = $${idx++}`;    params.push(variantId); }
    if (warehouseId)   { where += ` AND il.warehouse_id = $${idx++}`;  params.push(warehouseId); }
    if (movementType)  { where += ` AND il.movement_type = $${idx++}`; params.push(movementType); }
    if (fromDate)      { where += ` AND il.created_at >= $${idx++}`;   params.push(fromDate); }
    if (toDate)        { where += ` AND il.created_at <= $${idx++}`;   params.push(toDate + ' 23:59:59'); }
    if (search) {
      where += ` AND (il.reference_number ILIKE $${idx} OR il.notes ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT
           il.*,
           m.name  AS material_name,  m.code AS material_code,
           p.name  AS product_name,   p.code AS product_code,
           pv.sku  AS variant_sku,    pv.name AS variant_name,
           w.name  AS warehouse_name,
           u.first_name || ' ' || u.last_name AS performed_by_name
         FROM inventory_ledger il
         LEFT JOIN materials         m  ON m.id  = il.material_id
         LEFT JOIN products          p  ON p.id  = il.product_id
         LEFT JOIN product_variants  pv ON pv.id = il.variant_id
         LEFT JOIN warehouses        w  ON w.id  = il.warehouse_id
         LEFT JOIN users             u  ON u.id  = il.performed_by
         ${where}
         ORDER BY il.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*)::int AS count FROM inventory_ledger il ${where}`, params),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (err) { next(err); }
};

// ─── GET MATERIAL STOCK CARD ─────────────────────────────────────────────────

const getMaterialStockCard = async (req, res, next) => {
  try {
    const { materialId } = req.params;
    const companyId = req.companyId;
    const { warehouseId, fromDate, toDate } = req.query;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);

    // Verify ownership
    const matCheck = await query(
      'SELECT id, name, code, unit, current_stock, reserved_stock, minimum_stock FROM materials WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL',
      [materialId, companyId]
    );
    if (!matCheck.rows[0]) return ApiResponse.notFound(res, 'Material not found');

    let where = 'WHERE il.material_id = $1';
    const params = [materialId];
    let idx = 2;
    if (warehouseId) { where += ` AND il.warehouse_id = $${idx++}`; params.push(warehouseId); }
    if (fromDate)    { where += ` AND il.created_at >= $${idx++}`; params.push(fromDate); }
    if (toDate)      { where += ` AND il.created_at <= $${idx++}`; params.push(toDate + ' 23:59:59'); }

    const [dataRes, countRes, summaryRes] = await Promise.all([
      query(
        `SELECT il.*,
                w.name AS warehouse_name,
                u.first_name || ' ' || u.last_name AS performed_by_name
         FROM inventory_ledger il
         LEFT JOIN warehouses w ON w.id = il.warehouse_id
         LEFT JOIN users u ON u.id = il.performed_by
         ${where}
         ORDER BY il.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*)::int AS count FROM inventory_ledger il ${where}`, params),
      query(
        `SELECT
           COALESCE(SUM(quantity) FILTER (WHERE quantity > 0), 0) AS total_in,
           COALESCE(ABS(SUM(quantity) FILTER (WHERE quantity < 0)), 0) AS total_out
         FROM inventory_ledger il ${where}`,
        params
      ),
    ]);

    ApiResponse.success(res, {
      material:   matCheck.rows[0],
      summary:    summaryRes.rows[0],
      entries:    dataRes.rows,
      pagination: paginationMeta(countRes.rows[0].count, page, limit),
    });
  } catch (err) { next(err); }
};

// ─── GET PRODUCT STOCK CARD ──────────────────────────────────────────────────

const getProductStockCard = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);

    const prodCheck = await query(
      'SELECT id, name, code, unit, current_stock, reserved_stock FROM products WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL',
      [productId, companyId]
    );
    if (!prodCheck.rows[0]) return ApiResponse.notFound(res, 'Product not found');

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT il.*,
                pv.sku AS variant_sku, pv.name AS variant_name,
                w.name AS warehouse_name,
                u.first_name || ' ' || u.last_name AS performed_by_name
         FROM inventory_ledger il
         LEFT JOIN product_variants pv ON pv.id = il.variant_id
         LEFT JOIN warehouses w ON w.id = il.warehouse_id
         LEFT JOIN users u ON u.id = il.performed_by
         WHERE il.product_id = $1
         ORDER BY il.created_at DESC
         LIMIT $2 OFFSET $3`,
        [productId, limit, offset]
      ),
      query('SELECT COUNT(*)::int AS count FROM inventory_ledger WHERE product_id=$1', [productId]),
    ]);

    ApiResponse.success(res, {
      product:    prodCheck.rows[0],
      entries:    dataRes.rows,
      pagination: paginationMeta(countRes.rows[0].count, page, limit),
    });
  } catch (err) { next(err); }
};

// ─── MANUAL STOCK ADJUSTMENT (with ledger) ───────────────────────────────────

const createManualAdjustment = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { materialId, productId, variantId, warehouseId, type, quantity, notes } = req.body;

    if (!materialId && !productId) return ApiResponse.badRequest(res, 'materialId or productId required');
    if (!['add', 'deduct'].includes(type)) return ApiResponse.badRequest(res, 'type must be add or deduct');
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return ApiResponse.badRequest(res, 'quantity must be > 0');

    const actualQty = type === 'add' ? qty : -qty;
    const movementType = type === 'add' ? 'adjustment_add' : 'adjustment_deduct';
    let newBalance = null;

    if (materialId) {
      const updateRes = await query(
        type === 'add'
          ? `UPDATE materials SET current_stock = current_stock + $1, updated_at=NOW()
             WHERE id=$2 AND company_id=$3 AND deleted_at IS NULL
             RETURNING current_stock`
          : `UPDATE materials SET current_stock = GREATEST(0, current_stock - $1), updated_at=NOW()
             WHERE id=$2 AND company_id=$3 AND deleted_at IS NULL
             RETURNING current_stock`,
        [qty, materialId, companyId]
      );
      if (!updateRes.rows[0]) return ApiResponse.notFound(res, 'Material not found');
      newBalance = updateRes.rows[0].current_stock;
    } else if (productId) {
      const updateRes = await query(
        type === 'add'
          ? `UPDATE products SET current_stock = current_stock + $1, updated_at=NOW()
             WHERE id=$2 AND company_id=$3 AND deleted_at IS NULL
             RETURNING current_stock`
          : `UPDATE products SET current_stock = GREATEST(0, current_stock - $1), updated_at=NOW()
             WHERE id=$2 AND company_id=$3 AND deleted_at IS NULL
             RETURNING current_stock`,
        [qty, productId, companyId]
      );
      if (!updateRes.rows[0]) return ApiResponse.notFound(res, 'Product not found');
      newBalance = updateRes.rows[0].current_stock;
    }

    await writeLedger({
      companyId, materialId, productId, variantId, warehouseId,
      movementType, quantity: actualQty, balanceAfter: newBalance,
      notes, performedBy: req.user.id,
    });

    ApiResponse.success(res, { balance_after: newBalance }, 'Adjustment recorded');
  } catch (err) { next(err); }
};

// ─── LOW STOCK SUMMARY ───────────────────────────────────────────────────────

const getLowStockAlerts = async (req, res, next) => {
  try {
    const companyId = req.companyId;

    const [matsRes, prodsRes] = await Promise.all([
      query(
        `SELECT id, name, code, unit, current_stock, minimum_stock, reorder_level,
                (minimum_stock - current_stock) AS shortage
         FROM materials
         WHERE company_id=$1 AND deleted_at IS NULL
           AND current_stock <= minimum_stock AND minimum_stock > 0
         ORDER BY shortage DESC
         LIMIT 50`,
        [companyId]
      ),
      query(
        `SELECT id, name, code, unit, current_stock, reserved_stock,
                GREATEST(0, current_stock - reserved_stock) AS available_stock
         FROM products
         WHERE company_id=$1 AND deleted_at IS NULL
           AND current_stock <= 0 AND produced_qty > 0
         ORDER BY name
         LIMIT 50`,
        [companyId]
      ),
    ]);

    ApiResponse.success(res, {
      low_materials: matsRes.rows,
      out_of_stock_products: prodsRes.rows,
    });
  } catch (err) { next(err); }
};

// ─── STOCK MOVEMENT SUMMARY ──────────────────────────────────────────────────

const getMovementSummary = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const days = parseInt(req.query.days) || 30;

    const result = await query(
      `SELECT
         movement_type,
         COUNT(*)::int AS count,
         SUM(ABS(quantity))::numeric AS total_quantity
       FROM inventory_ledger
       WHERE company_id=$1
         AND created_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY movement_type
       ORDER BY total_quantity DESC`,
      [companyId, days]
    );

    ApiResponse.success(res, result.rows);
  } catch (err) { next(err); }
};

module.exports = {
  getEntries, getMaterialStockCard, getProductStockCard,
  createManualAdjustment, getLowStockAlerts, getMovementSummary,
};
