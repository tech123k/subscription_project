const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// GET /po
router.get('/', async (req, res) => {
  const { companyId } = req;
  const { page = 1, limit = 20, search = '', status = '', supplierId = '' } = req.query;
  const offset = (page - 1) * limit;

  let where = "po.company_id = $1 AND po.deleted_at IS NULL";
  const params = [companyId];
  let idx = 2;

  if (search) {
    where += ` AND (po.po_number ILIKE $${idx} OR s.name ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }
  if (status) {
    where += ` AND po.status = $${idx}`;
    params.push(status);
    idx++;
  }
  if (supplierId) {
    where += ` AND po.supplier_id = $${idx}`;
    params.push(supplierId);
    idx++;
  }

  const baseQuery = `
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN warehouses w ON po.warehouse_id = w.id
    WHERE ${where}
  `;

  const [{ rows: data }, { rows: [{ count }] }] = await Promise.all([
    pool.query(
      `SELECT po.id, po.po_number, po.status, po.order_date, po.expected_delivery,
              po.total_amount, po.created_at,
              s.name AS supplier_name,
              w.name AS warehouse_name,
              (SELECT COUNT(*) FROM po_items WHERE po_id = po.id) AS item_count,
              (SELECT COALESCE(SUM(received_quantity),0) FROM po_items WHERE po_id = po.id) AS total_received
       ${baseQuery}
       ORDER BY po.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    ),
    pool.query(`SELECT COUNT(*) ${baseQuery}`, params),
  ]);

  res.json({
    success: true,
    data,
    meta: { page: +page, limit: +limit, total: +count, totalPages: Math.ceil(count / limit) },
  });
});

// GET /po/:id
router.get('/:id', async (req, res) => {
  const { companyId } = req;

  const { rows: [po] } = await pool.query(
    `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone,
            s.email AS supplier_email, w.name AS warehouse_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     LEFT JOIN warehouses w ON po.warehouse_id = w.id
     WHERE po.id = $1 AND po.company_id = $2 AND po.deleted_at IS NULL`,
    [req.params.id, companyId]
  );
  if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

  const { rows: items } = await pool.query(
    `SELECT pi.*, m.name AS material_name, m.code AS material_code, m.unit AS material_unit
     FROM po_items pi
     JOIN materials m ON pi.material_id = m.id
     WHERE pi.po_id = $1
     ORDER BY pi.id`,
    [req.params.id]
  );

  const { rows: grns } = await pool.query(
    `SELECT g.id, g.grn_number, g.qc_status, g.created_at,
            gi.received_quantity, gi.accepted_quantity, m.name AS material_name
     FROM grn g
     JOIN grn_items gi ON gi.grn_id = g.id
     JOIN materials m ON gi.material_id = m.id
     WHERE g.po_id = $1 AND g.status != 'cancelled'`,
    [req.params.id]
  );

  res.json({ success: true, data: { ...po, items, grns } });
});

// POST /po
router.post('/', async (req, res) => {
  const { companyId, user } = req;
  const { supplierId, warehouseId, orderDate, expectedDelivery, paymentTerms, notes, items } = req.body;

  if (!items?.length) {
    return res.status(400).json({ success: false, message: 'At least one item is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [co] } = await client.query(
      'UPDATE companies SET po_counter = po_counter + 1 WHERE id = $1 RETURNING po_counter, po_prefix',
      [companyId]
    );
    const poNumber = `${co.po_prefix || 'PO'}-${new Date().getFullYear()}-${String(co.po_counter).padStart(5, '0')}`;

    const totalAmount = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate || 0)), 0);

    const { rows: [po] } = await client.query(
      `INSERT INTO purchase_orders
         (id, company_id, po_number, supplier_id, warehouse_id, status,
          order_date, expected_delivery, payment_terms, notes, total_amount, created_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        uuidv4(), companyId, poNumber,
        supplierId || null, warehouseId || null,
        orderDate || new Date().toISOString().split('T')[0],
        expectedDelivery || null, paymentTerms || null,
        notes || null, totalAmount, user.id,
      ]
    );

    for (const it of items) {
      const { rows: [mat] } = await client.query('SELECT unit FROM materials WHERE id = $1', [it.materialId]);
      await client.query(
        `INSERT INTO po_items (id, po_id, material_id, quantity, unit, rate, gst_percent, amount, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          uuidv4(), po.id, it.materialId,
          it.quantity, it.unit || mat?.unit || null,
          it.rate || 0, it.gstPercent || 0,
          Number(it.quantity) * Number(it.rate || 0),
          it.notes || null,
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: po, message: 'Purchase Order created' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PUT /po/:id
router.put('/:id', async (req, res) => {
  const { companyId } = req;
  const { id } = req.params;
  const { supplierId, warehouseId, orderDate, expectedDelivery, paymentTerms, notes, items } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [existing] } = await client.query(
      'SELECT status FROM purchase_orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [id, companyId]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'PO not found' });
    if (!['draft', 'sent'].includes(existing.status)) {
      return res.status(400).json({ success: false, message: 'Cannot edit a confirmed or completed PO' });
    }

    const totalAmount = (items || []).reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate || 0)), 0);

    await client.query(
      `UPDATE purchase_orders SET
         supplier_id = $1, warehouse_id = $2, order_date = $3,
         expected_delivery = $4, payment_terms = $5, notes = $6,
         total_amount = $7, updated_at = NOW()
       WHERE id = $8`,
      [supplierId || null, warehouseId || null, orderDate, expectedDelivery || null,
       paymentTerms || null, notes || null, totalAmount, id]
    );

    if (items?.length) {
      await client.query('DELETE FROM po_items WHERE po_id = $1', [id]);
      for (const it of items) {
        const { rows: [mat] } = await client.query('SELECT unit FROM materials WHERE id = $1', [it.materialId]);
        await client.query(
          `INSERT INTO po_items (id, po_id, material_id, quantity, unit, rate, gst_percent, amount, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            uuidv4(), id, it.materialId,
            it.quantity, it.unit || mat?.unit || null,
            it.rate || 0, it.gstPercent || 0,
            Number(it.quantity) * Number(it.rate || 0),
            it.notes || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'PO updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /po/:id/status
router.patch('/:id/status', async (req, res) => {
  const { companyId } = req;
  const { status } = req.body;
  const valid = ['draft', 'sent', 'confirmed', 'partial', 'completed', 'cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const { rows: [po] } = await pool.query(
    `UPDATE purchase_orders SET status = $1, updated_at = NOW()
     WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
     RETURNING id, po_number, status`,
    [status, req.params.id, companyId]
  );
  if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
  res.json({ success: true, data: po, message: `PO marked as ${status}` });
});

// DELETE /po/:id
router.delete('/:id', async (req, res) => {
  const { companyId } = req;

  const { rows: [po] } = await pool.query(
    'SELECT status FROM purchase_orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
    [req.params.id, companyId]
  );
  if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
  if (['confirmed', 'partial', 'completed'].includes(po.status)) {
    return res.status(400).json({ success: false, message: 'Cannot delete a confirmed or completed PO' });
  }

  await pool.query(
    `UPDATE purchase_orders SET deleted_at = NOW(), status = 'cancelled' WHERE id = $1`,
    [req.params.id]
  );
  res.json({ success: true, message: 'PO cancelled' });
});

module.exports = router;
