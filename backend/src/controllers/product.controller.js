const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');

// Products with current_stock ≤ this threshold are flagged "low stock".
const LOW_STOCK_THRESHOLD = 100;

// ─── GET /products ─────────────────────────────────────────────────────────────
// Returns all product fields now stored on the products table itself:
//   current_stock, reserved_stock, produced_qty, dispatched_qty, last_production_date.
// available_stock is computed as: current_stock - reserved_stock.
const getAll = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, category, isActive, stockStatus } = req.query;

    let where = 'WHERE p.company_id = $1 AND p.deleted_at IS NULL';
    const params = [companyId];
    let idx = 2;

    if (search) {
      where += ` AND (p.name ILIKE $${idx} OR p.code ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (category) {
      where += ` AND p.category = $${idx}`;
      params.push(category);
      idx++;
    }
    if (isActive !== undefined && isActive !== '') {
      where += ` AND p.is_active = $${idx}`;
      params.push(isActive === 'true');
      idx++;
    }

    // Stock-status filter uses products.current_stock directly.
    // "out" only flags products that have actually been produced (avoids tagging
    // brand-new products that have never gone through production as "out of stock").
    let stockFilter = '';
    if (stockStatus === 'out') {
      stockFilter = `AND p.produced_qty > 0 AND p.current_stock <= 0`;
    } else if (stockStatus === 'low') {
      stockFilter = `AND p.current_stock > 0 AND p.current_stock <= ${LOW_STOCK_THRESHOLD}`;
    } else if (stockStatus === 'healthy') {
      stockFilter = `AND p.current_stock > ${LOW_STOCK_THRESHOLD}`;
    }

    const joins = `
      FROM products p
      LEFT JOIN bill_of_materials b ON b.product_id = p.id AND b.is_active = TRUE
      ${where} ${stockFilter}
    `;

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT
           p.*,
           GREATEST(0, p.current_stock - p.reserved_stock)::numeric AS available_stock,
           b.id AS bom_id,
           (SELECT COUNT(*)::int FROM bom_items bi WHERE bi.bom_id = b.id) AS bom_item_count
         ${joins}
         ORDER BY p.name ASC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*)::int AS count ${joins}`, params),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (error) {
    next(error);
  }
};

// ─── GET /products/summary ─────────────────────────────────────────────────────
const getSummary = async (req, res, next) => {
  try {
    const companyId = req.companyId;

    const [summaryRes, todayRes] = await Promise.all([
      // Aggregate from products table (instant — no JOIN to production_orders needed)
      query(
        `SELECT
           COUNT(p.id)::int                                                                  AS total_products,
           COUNT(p.id) FILTER (WHERE p.is_active)::int                                      AS active_products,
           COUNT(b.id)::int                                                                  AS products_with_bom,
           COUNT(p.id) FILTER (WHERE p.produced_qty > 0 AND p.current_stock <= 0)::int     AS out_of_stock,
           COUNT(p.id) FILTER (WHERE p.current_stock > 0 AND p.current_stock <= $2)::int   AS low_stock,
           COALESCE(SUM(p.current_stock), 0)::numeric                                       AS total_current_stock,
           COALESCE(SUM(p.produced_qty),  0)::numeric                                       AS total_produced_ever
         FROM products p
         LEFT JOIN bill_of_materials b ON b.product_id = p.id AND b.is_active = TRUE
         WHERE p.company_id = $1 AND p.deleted_at IS NULL`,
        [companyId, LOW_STOCK_THRESHOLD]
      ),
      // Today's production comes from production_orders (products.produced_qty is cumulative)
      query(
        `SELECT COALESCE(SUM(po.produced_quantity), 0)::numeric AS produced_today
         FROM production_orders po
         WHERE po.company_id = $1
           AND po.status = 'completed'
           AND po.actual_end_date::date = CURRENT_DATE`,
        [companyId]
      ),
    ]);

    ApiResponse.success(res, {
      ...summaryRes.rows[0],
      produced_today: todayRes.rows[0].produced_today,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /products/:id ─────────────────────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const [productRes, bomRes] = await Promise.all([
      query(
        `SELECT p.*,
                GREATEST(0, p.current_stock - p.reserved_stock)::numeric AS available_stock
         FROM products p
         WHERE p.id = $1 AND p.company_id = $2 AND p.deleted_at IS NULL`,
        [id, companyId]
      ),
      query(
        `SELECT b.*,
                json_agg(
                  json_build_object(
                    'id', bi.id,
                    'material_id', bi.material_id,
                    'material_name', m.name,
                    'material_code', m.code,
                    'material_unit', m.unit::text,
                    'quantity_per_unit', bi.quantity_per_unit,
                    'unit', bi.unit,
                    'waste_percentage', bi.waste_percentage,
                    'sequence_order', bi.sequence_order,
                    'notes', bi.notes,
                    'current_stock', m.current_stock
                  ) ORDER BY bi.sequence_order
                ) FILTER (WHERE bi.id IS NOT NULL) AS items
         FROM bill_of_materials b
         LEFT JOIN bom_items bi ON bi.bom_id = b.id
         LEFT JOIN materials m  ON m.id = bi.material_id
         WHERE b.product_id = $1 AND b.is_active = TRUE
         GROUP BY b.id`,
        [id]
      ),
    ]);

    if (!productRes.rows[0]) return ApiResponse.notFound(res, 'Product not found');

    ApiResponse.success(res, {
      ...productRes.rows[0],
      bom: bomRes.rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /products/:id/history ─────────────────────────────────────────────────
const getProductHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const result = await query(
      `SELECT
         po.id, po.order_number, po.status,
         po.planned_quantity, po.produced_quantity, po.rejected_quantity,
         po.actual_start_date, po.actual_end_date, po.created_at,
         u.first_name || ' ' || u.last_name AS created_by_name,
         (SELECT json_agg(
           json_build_object(
             'name',    m.name,
             'code',    m.code,
             'planned', pm.planned_quantity,
             'actual',  COALESCE(pm.actual_quantity, pm.planned_quantity),
             'unit',    m.unit::text
           ) ORDER BY m.name
         )
          FROM production_materials pm
          JOIN materials m ON m.id = pm.material_id
          WHERE pm.production_order_id = po.id
         ) AS materials_consumed
       FROM production_orders po
       LEFT JOIN users u ON po.created_by = u.id
       WHERE po.product_id = $1
         AND po.company_id = $2
         AND po.deleted_at IS NULL
       ORDER BY po.created_at DESC
       LIMIT 20`,
      [id, companyId]
    );

    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

// ─── GET /products/analytics ───────────────────────────────────────────────────
const getAnalytics = async (req, res, next) => {
  try {
    const companyId = req.companyId;

    const [dailyRes, monthlyRes, topRes] = await Promise.all([
      query(
        `SELECT
           po.actual_end_date::date           AS date,
           SUM(po.produced_quantity)::numeric AS quantity,
           COUNT(*)::int                      AS orders
         FROM production_orders po
         WHERE po.company_id = $1
           AND po.status = 'completed'
           AND po.actual_end_date::date >= CURRENT_DATE - 29
         GROUP BY po.actual_end_date::date
         ORDER BY date ASC`,
        [companyId]
      ),
      query(
        `SELECT
           DATE_TRUNC('month', po.actual_end_date)::date AS month_start,
           SUM(po.produced_quantity)::numeric             AS quantity,
           COUNT(*)::int                                  AS orders
         FROM production_orders po
         WHERE po.company_id = $1
           AND po.status = 'completed'
           AND po.actual_end_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
         GROUP BY DATE_TRUNC('month', po.actual_end_date)
         ORDER BY month_start ASC`,
        [companyId]
      ),
      query(
        `SELECT
           p.id, p.name, p.code, p.unit,
           p.produced_qty  AS total_produced,
           p.current_stock AS current_stock,
           p.last_production_date,
           (SELECT COUNT(*)::int FROM production_orders po
            WHERE po.product_id = p.id AND po.status = 'completed' AND po.company_id = $1
           ) AS order_count
         FROM products p
         WHERE p.company_id = $1
           AND p.deleted_at IS NULL
           AND p.produced_qty > 0
         ORDER BY p.produced_qty DESC
         LIMIT 5`,
        [companyId]
      ),
    ]);

    ApiResponse.success(res, {
      daily:       dailyRes.rows,
      monthly:     monthlyRes.rows,
      topProducts: topRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /products ────────────────────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { name, code, category, unit, description, isActive, finishedGoodsMaterialId } = req.body;

    if (!name?.trim()) return ApiResponse.badRequest(res, 'Product name is required');
    if (!unit?.trim()) return ApiResponse.badRequest(res, 'Unit is required');

    const result = await query(
      `INSERT INTO products
         (company_id, name, code, category, unit, description, is_active, finished_goods_material_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        companyId, name.trim(), code?.trim() || null, category?.trim() || null,
        unit.trim(), description?.trim() || null,
        isActive !== false, finishedGoodsMaterialId || null, req.user.id,
      ]
    );

    ApiResponse.created(res, result.rows[0], 'Product created');
  } catch (error) {
    if (error.code === '23505') return ApiResponse.conflict(res, 'A product with this code already exists');
    next(error);
  }
};

// ─── PUT /products/:id ─────────────────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const { name, code, category, unit, description, isActive, finishedGoodsMaterialId } = req.body;

    const result = await query(
      `UPDATE products SET
         name                       = COALESCE($1, name),
         code                       = COALESCE($2, code),
         category                   = COALESCE($3, category),
         unit                       = COALESCE($4, unit),
         description                = COALESCE($5, description),
         is_active                  = COALESCE($6, is_active),
         finished_goods_material_id = COALESCE($7, finished_goods_material_id),
         updated_at                 = NOW()
       WHERE id = $8 AND company_id = $9 AND deleted_at IS NULL RETURNING *`,
      [
        name?.trim() || null, code?.trim() || null, category?.trim() || null,
        unit?.trim() || null, description?.trim() || null,
        isActive !== undefined ? isActive : null,
        finishedGoodsMaterialId || null,
        id, companyId,
      ]
    );

    if (!result.rows[0]) return ApiResponse.notFound(res, 'Product not found');
    ApiResponse.success(res, result.rows[0], 'Product updated');
  } catch (error) {
    if (error.code === '23505') return ApiResponse.conflict(res, 'A product with this code already exists');
    next(error);
  }
};

// ─── DELETE /products/:id ──────────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE products SET deleted_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING id',
      [id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Product not found');
    ApiResponse.success(res, null, 'Product deleted');
  } catch (error) {
    next(error);
  }
};

// ─── POST /products/:id/adjust-stock ──────────────────────────────────────────
// Manual stock adjustment (e.g., opening balance, write-off, physical count correction).
const adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const { type, quantity, notes } = req.body;

    if (!['add', 'deduct', 'set'].includes(type)) {
      return ApiResponse.badRequest(res, 'type must be add | deduct | set');
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) {
      return ApiResponse.badRequest(res, 'quantity must be a non-negative number');
    }

    let setClause;
    if (type === 'add')   setClause = `current_stock = GREATEST(0, current_stock + $1)`;
    if (type === 'deduct') setClause = `current_stock = GREATEST(0, current_stock - $1)`;
    if (type === 'set')   setClause = `current_stock = $1`;

    const result = await query(
      `UPDATE products SET ${setClause}, updated_at = NOW()
       WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
       RETURNING id, name, current_stock, reserved_stock,
                 GREATEST(0, current_stock - reserved_stock) AS available_stock`,
      [qty, id, companyId]
    );

    if (!result.rows[0]) return ApiResponse.notFound(res, 'Product not found');
    ApiResponse.success(res, result.rows[0], 'Stock adjusted');
  } catch (error) {
    next(error);
  }
};

// ─── POST /products/:id/reserve ───────────────────────────────────────────────
// Reserve stock for a sales order / future dispatch. Reduces available_stock.
const reserveStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const qty = parseFloat(req.body.quantity);

    if (isNaN(qty) || qty <= 0) {
      return ApiResponse.badRequest(res, 'quantity must be > 0');
    }

    const result = await query(
      `UPDATE products
         SET reserved_stock = reserved_stock + $1
       WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
         AND (current_stock - reserved_stock) >= $1
       RETURNING id, name, current_stock, reserved_stock,
                 GREATEST(0, current_stock - reserved_stock) AS available_stock`,
      [qty, id, companyId]
    );

    if (!result.rows[0]) {
      return ApiResponse.badRequest(res, 'Insufficient available stock to reserve');
    }
    ApiResponse.success(res, result.rows[0], `${qty} units reserved`);
  } catch (error) {
    next(error);
  }
};

// ─── POST /products/:id/release-reserve ───────────────────────────────────────
// Release previously reserved stock (e.g., sales order cancelled).
const releaseReserve = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const qty = parseFloat(req.body.quantity);

    if (isNaN(qty) || qty <= 0) {
      return ApiResponse.badRequest(res, 'quantity must be > 0');
    }

    const result = await query(
      `UPDATE products
         SET reserved_stock = GREATEST(0, reserved_stock - $1)
       WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
       RETURNING id, name, current_stock, reserved_stock,
                 GREATEST(0, current_stock - reserved_stock) AS available_stock`,
      [qty, id, companyId]
    );

    if (!result.rows[0]) return ApiResponse.notFound(res, 'Product not found');
    ApiResponse.success(res, result.rows[0], `${qty} units released`);
  } catch (error) {
    next(error);
  }
};

// ─── GET /products/:id/bom-calculate ──────────────────────────────────────────
const getBOMForQuantity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const qty = parseFloat(req.query.qty) || 1;
    const companyId = req.companyId;

    const bomRes = await query(
      `SELECT bi.id, bi.material_id,
              m.name AS material_name, m.code AS material_code,
              m.unit::text AS material_unit, m.current_stock,
              bi.quantity_per_unit, bi.unit, bi.waste_percentage, bi.sequence_order, bi.notes,
              ROUND(bi.quantity_per_unit * $2 * (1 + bi.waste_percentage / 100.0), 4) AS required_quantity
       FROM bill_of_materials b
       JOIN bom_items bi ON bi.bom_id = b.id
       JOIN materials m  ON m.id = bi.material_id AND m.deleted_at IS NULL
       WHERE b.product_id = $1 AND b.is_active = TRUE
       ORDER BY bi.sequence_order`,
      [id, qty]
    );

    const product = await query(
      `SELECT id, name, code, unit, current_stock, reserved_stock,
              GREATEST(0, current_stock - reserved_stock) AS available_stock
       FROM products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (!product.rows[0]) return ApiResponse.notFound(res, 'Product not found');

    ApiResponse.success(res, {
      product:          product.rows[0],
      planned_quantity: qty,
      bom_items:        bomRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /products/categories ──────────────────────────────────────────────────
const getCategories = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT DISTINCT category FROM products
       WHERE company_id = $1 AND deleted_at IS NULL AND category IS NOT NULL
       ORDER BY category`,
      [req.companyId]
    );
    ApiResponse.success(res, result.rows.map((r) => r.category));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll, getSummary, getOne, getProductHistory, getAnalytics,
  create, update, remove,
  adjustStock, reserveStock, releaseReserve,
  getBOMForQuantity, getCategories,
};
