const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta, generateInvoiceNumber } = require('../utils/helpers');
const { writeLedger } = require('../services/ledger.service');

// ─── GET ALL SALES ORDERS ────────────────────────────────────────────────────

const getAll = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, status, customerId, fromDate, toDate, channel } = req.query;

    let where = 'WHERE so.company_id = $1 AND so.deleted_at IS NULL';
    const params = [companyId];
    let idx = 2;

    if (search) {
      where += ` AND (so.order_number ILIKE $${idx} OR c.name ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (status)     { where += ` AND so.status = $${idx++}`;      params.push(status); }
    if (customerId) { where += ` AND so.customer_id = $${idx++}`; params.push(customerId); }
    if (channel)    { where += ` AND so.channel = $${idx++}`;     params.push(channel); }
    if (fromDate)   { where += ` AND so.order_date >= $${idx++}`; params.push(fromDate); }
    if (toDate)     { where += ` AND so.order_date <= $${idx++}`; params.push(toDate); }

    const joins = `
      FROM sales_orders so
      LEFT JOIN customers c ON c.id = so.customer_id
      LEFT JOIN warehouses w ON w.id = so.warehouse_id
      ${where}`;

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT so.*,
                c.name  AS customer_name,
                c.phone AS customer_phone,
                w.name  AS warehouse_name,
                (SELECT COUNT(*)::int FROM sales_order_items WHERE sales_order_id=so.id) AS item_count
         ${joins}
         ORDER BY so.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*)::int AS count ${joins}`, params),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (err) { next(err); }
};

// ─── GET ONE SALES ORDER ─────────────────────────────────────────────────────

const getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const [soRes, itemsRes] = await Promise.all([
      query(
        `SELECT so.*,
                c.name     AS customer_name,
                c.phone    AS customer_phone,
                c.email    AS customer_email,
                c.gst_number AS customer_gst,
                c.credit_limit,
                c.outstanding_amount,
                w.name     AS warehouse_name,
                bo.order_number AS backorder_of_number,
                u.first_name || ' ' || u.last_name AS created_by_name
         FROM sales_orders so
         LEFT JOIN customers c  ON c.id = so.customer_id
         LEFT JOIN warehouses w ON w.id = so.warehouse_id
         LEFT JOIN sales_orders bo ON bo.id = so.backorder_of
         LEFT JOIN users u ON u.id = so.created_by
         WHERE so.id=$1 AND so.company_id=$2 AND so.deleted_at IS NULL`,
        [id, companyId]
      ),
      query(
        `SELECT soi.*,
                m.name AS material_name, m.code AS material_code, m.unit AS material_unit,
                p.name AS product_name,  p.code AS product_code,
                pv.sku AS variant_sku,   pv.name AS variant_name,
                pv.attribute_values AS variant_attributes,
                (soi.quantity - soi.dispatched_quantity - soi.backorder_quantity) AS remaining_quantity
         FROM sales_order_items soi
         LEFT JOIN materials m ON m.id = soi.material_id
         LEFT JOIN products  p ON p.id = soi.product_id
         LEFT JOIN product_variants pv ON pv.id = soi.variant_id
         WHERE soi.sales_order_id = $1
         ORDER BY soi.id`,
        [id]
      ),
    ]);

    if (!soRes.rows[0]) return ApiResponse.notFound(res, 'Sales order not found');

    ApiResponse.success(res, { ...soRes.rows[0], items: itemsRes.rows });
  } catch (err) { next(err); }
};

// ─── CREATE SALES ORDER ──────────────────────────────────────────────────────

const create = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const {
      customerId, warehouseId, orderDate, expectedDeliveryDate,
      channel = 'direct', priority = 'normal',
      paymentTerms, deliveryTerms, shippingAddress, notes,
      items = [], reserveStock = false,
    } = req.body;

    if (!customerId) return ApiResponse.badRequest(res, 'customerId is required');
    if (!items.length) return ApiResponse.badRequest(res, 'At least one item is required');

    // Credit limit check
    if (reserveStock) {
      const custRes = await query(
        'SELECT credit_limit, outstanding_amount, order_blocking_enabled FROM customers WHERE id=$1 AND company_id=$2',
        [customerId, companyId]
      );
      const cust = custRes.rows[0];
      if (cust?.order_blocking_enabled && Number(cust.credit_limit) > 0) {
        const totalAmt = items.reduce((s, i) => s + (i.quantity * i.rate), 0);
        if (Number(cust.outstanding_amount) + totalAmt > Number(cust.credit_limit)) {
          return ApiResponse.badRequest(res, 'Order exceeds customer credit limit');
        }
      }
    }

    const so = await transaction(async (client) => {
      // Generate order number
      const compRes = await client.query(
        `UPDATE companies SET so_counter = so_counter + 1
         WHERE id = $1 RETURNING so_prefix, so_counter`,
        [companyId]
      );
      const { so_prefix, so_counter } = compRes.rows[0];
      const orderNumber = generateInvoiceNumber(so_prefix || 'SO', so_counter);

      // Calculate totals
      let subtotal = 0;
      let taxAmount = 0;
      for (const item of items) {
        const line = item.quantity * item.rate * (1 - (item.discountPercent || 0) / 100);
        subtotal += line;
        taxAmount += line * (item.gstPercent || 0) / 100;
      }
      const netAmount = subtotal + taxAmount;

      // Insert order
      const soRes = await client.query(
        `INSERT INTO sales_orders
           (company_id, order_number, customer_id, warehouse_id,
            order_date, expected_delivery_date, channel, priority,
            payment_terms, delivery_terms, shipping_address, notes,
            total_amount, tax_amount, net_amount, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',$16)
         RETURNING *`,
        [
          companyId, orderNumber, customerId, warehouseId || null,
          orderDate || new Date().toISOString().slice(0, 10),
          expectedDeliveryDate || null,
          channel, priority, paymentTerms || null, deliveryTerms || null,
          shippingAddress || null, notes || null,
          subtotal, taxAmount, netAmount,
          req.user.id,
        ]
      );
      const soId = soRes.rows[0].id;

      // Insert items + reserve stock
      for (const item of items) {
        const lineAmt = item.quantity * item.rate * (1 - (item.discountPercent || 0) / 100);
        await client.query(
          `INSERT INTO sales_order_items
             (sales_order_id, material_id, product_id, variant_id,
              quantity, unit, rate, discount_percent, gst_percent, amount)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            soId,
            item.materialId || null, item.productId || null, item.variantId || null,
            item.quantity, item.unit, item.rate,
            item.discountPercent || 0, item.gstPercent || 0,
            lineAmt,
          ]
        );

        // Reserve product stock
        if (reserveStock && (item.productId || item.variantId)) {
          if (item.variantId) {
            // Variant-level reservation
            await client.query(
              `UPDATE product_variant_stock
               SET reserved_stock = reserved_stock + $1
               WHERE variant_id = $2 AND (current_stock - reserved_stock) >= $1`,
              [item.quantity, item.variantId]
            );
          } else if (item.productId) {
            const reserveRes = await client.query(
              `UPDATE products
               SET reserved_stock = reserved_stock + $1
               WHERE id = $2 AND company_id = $3
                 AND (current_stock - reserved_stock) >= $1
               RETURNING id`,
              [item.quantity, item.productId, companyId]
            );
            if (!reserveRes.rows[0]) {
              throw Object.assign(new Error('Insufficient stock to reserve for item'), { statusCode: 400 });
            }
          }

          // Log reservation
          await client.query(
            `INSERT INTO stock_reservations
               (company_id, product_id, variant_id, warehouse_id,
                reference_type, reference_id, reference_number,
                reserved_quantity, status, reserved_by)
             VALUES ($1,$2,$3,$4,'sales_order',$5,$6,$7,'active',$8)`,
            [
              companyId, item.productId || null, item.variantId || null, warehouseId || null,
              soId, orderNumber, item.quantity, req.user.id,
            ]
          );
        }
      }

      return soRes.rows[0];
    });

    ApiResponse.created(res, so, 'Sales order created');
  } catch (err) {
    if (err.statusCode === 400) return ApiResponse.badRequest(res, err.message);
    next(err);
  }
};

// ─── UPDATE STATUS ───────────────────────────────────────────────────────────

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const { status, cancellationReason } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'partial', 'dispatched', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) return ApiResponse.badRequest(res, 'Invalid status');

    const updateFields = ['status = $1', 'updated_at = NOW()'];
    const params = [status, id, companyId];

    if (status === 'cancelled') {
      updateFields.push('cancellation_reason = $4', 'cancelled_at = NOW()');
      params.splice(3, 0, cancellationReason || null);

      // Release reserved stock
      const reservations = await query(
        `SELECT sr.*, p.current_stock FROM stock_reservations sr
         LEFT JOIN products p ON p.id = sr.product_id
         WHERE sr.reference_type='sales_order' AND sr.reference_id=$1 AND sr.status='active'`,
        [id]
      );
      for (const res_ of reservations.rows) {
        if (res_.product_id) {
          await query(
            `UPDATE products SET reserved_stock = GREATEST(0, reserved_stock - $1)
             WHERE id = $2 AND company_id = $3`,
            [res_.reserved_quantity, res_.product_id, companyId]
          );
        }
        await query(
          `UPDATE stock_reservations SET status='cancelled', updated_at=NOW() WHERE id=$1`,
          [res_.id]
        );
      }
    }

    const result = await query(
      `UPDATE sales_orders SET ${updateFields.join(', ')} WHERE id=$2 AND company_id=$3 RETURNING *`,
      params
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Sales order not found');
    ApiResponse.success(res, result.rows[0], 'Status updated');
  } catch (err) { next(err); }
};

// ─── CREATE BACKORDER ────────────────────────────────────────────────────────

const createBackorder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const soRes = await query(
      'SELECT * FROM sales_orders WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL',
      [id, companyId]
    );
    if (!soRes.rows[0]) return ApiResponse.notFound(res, 'Sales order not found');
    const original = soRes.rows[0];

    // Get undispatched items
    const itemsRes = await query(
      `SELECT *, (quantity - dispatched_quantity - backorder_quantity) AS pending
       FROM sales_order_items
       WHERE sales_order_id=$1 AND (quantity - dispatched_quantity - backorder_quantity) > 0`,
      [id]
    );
    if (!itemsRes.rows.length) return ApiResponse.badRequest(res, 'No pending items for backorder');

    const backorder = await transaction(async (client) => {
      const compRes = await client.query(
        `UPDATE companies SET so_counter = so_counter + 1 WHERE id=$1 RETURNING so_prefix, so_counter`,
        [companyId]
      );
      const { so_prefix, so_counter } = compRes.rows[0];
      const orderNumber = generateInvoiceNumber(`${so_prefix || 'SO'}-BO`, so_counter);

      let subtotal = 0;
      for (const item of itemsRes.rows) {
        subtotal += item.pending * Number(item.rate);
      }

      const boRes = await client.query(
        `INSERT INTO sales_orders
           (company_id, order_number, customer_id, warehouse_id,
            order_date, channel, priority, payment_terms,
            shipping_address, notes, total_amount, net_amount,
            status, backorder_of, created_by)
         VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7,$8,$9,$10,$10,'pending',$11,$12)
         RETURNING *`,
        [
          companyId, orderNumber, original.customer_id, original.warehouse_id,
          original.channel, original.priority, original.payment_terms,
          original.shipping_address,
          `Backorder from ${original.order_number}`,
          subtotal, id, req.user.id,
        ]
      );
      const boId = boRes.rows[0].id;

      for (const item of itemsRes.rows) {
        await client.query(
          `INSERT INTO sales_order_items
             (sales_order_id, material_id, product_id, variant_id,
              quantity, unit, rate, discount_percent, gst_percent, amount)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [boId, item.material_id, item.product_id, item.variant_id,
           item.pending, item.unit, item.rate, item.discount_percent,
           item.gst_percent, item.pending * Number(item.rate)]
        );
        // Mark original item backorder qty
        await client.query(
          `UPDATE sales_order_items SET backorder_quantity = backorder_quantity + $1 WHERE id=$2`,
          [item.pending, item.id]
        );
      }

      return boRes.rows[0];
    });

    ApiResponse.created(res, backorder, 'Backorder created');
  } catch (err) { next(err); }
};

// ─── SUMMARY / DASHBOARD WIDGET ─────────────────────────────────────────────

const getSummary = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status='pending')::int     AS pending_orders,
         COUNT(*) FILTER (WHERE status='confirmed')::int   AS confirmed_orders,
         COUNT(*) FILTER (WHERE status='partial')::int     AS partial_orders,
         COUNT(*) FILTER (WHERE status='processing')::int  AS processing_orders,
         COUNT(*) FILTER (WHERE status='completed')::int   AS completed_orders,
         COUNT(*) FILTER (WHERE status='cancelled')::int   AS cancelled_orders,
         COALESCE(SUM(net_amount) FILTER (WHERE status NOT IN ('cancelled')), 0) AS total_order_value,
         COALESCE(SUM(net_amount) FILTER (WHERE status='pending'), 0) AS pending_value,
         COUNT(*) FILTER (
           WHERE expected_delivery_date < CURRENT_DATE
             AND status NOT IN ('completed','cancelled','dispatched')
         )::int AS overdue_orders
       FROM sales_orders
       WHERE company_id=$1 AND deleted_at IS NULL`,
      [companyId]
    );
    ApiResponse.success(res, result.rows[0]);
  } catch (err) { next(err); }
};

// ─── DELETE (SOFT) ───────────────────────────────────────────────────────────

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE sales_orders SET deleted_at=NOW()
       WHERE id=$1 AND company_id=$2 AND status='pending' AND deleted_at IS NULL
       RETURNING id`,
      [id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Order not found or cannot be deleted');
    ApiResponse.success(res, null, 'Order deleted');
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, updateStatus, createBackorder, getSummary, remove };
