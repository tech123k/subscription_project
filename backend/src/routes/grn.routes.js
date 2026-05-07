const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// GET /grn — list with filters
router.get('/', async (req, res) => {
  const { companyId } = req;
  const { page = 1, limit = 20, search = '', qcStatus = '' } = req.query;
  const offset = (page - 1) * limit;

  let where = 'g.company_id = $1';
  const params = [companyId];
  let idx = 2;

  if (search) {
    where += ` AND (g.grn_number ILIKE $${idx} OR s.name ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }
  if (qcStatus) {
    where += ` AND g.qc_status = $${idx}`;
    params.push(qcStatus);
    idx++;
  }

  const baseQuery = `
    FROM grn g
    LEFT JOIN suppliers s ON g.supplier_id = s.id
    LEFT JOIN warehouses w ON g.warehouse_id = w.id
    LEFT JOIN grn_items gi ON gi.grn_id = g.id
    LEFT JOIN materials m ON gi.material_id = m.id
    WHERE ${where}
  `;

  const [{ rows: data }, { rows: [{ count }] }] = await Promise.all([
    pool.query(
      `SELECT g.id, g.grn_number, g.qc_status, g.status, g.created_at,
              g.supplier_invoice_number, g.notes,
              s.name AS supplier_name, w.name AS warehouse_name,
              m.name AS material_name, m.code AS material_code, m.unit,
              gi.received_quantity, gi.accepted_quantity, gi.rejected_quantity,
              gi.rate AS unit_cost, gi.batch_number
       ${baseQuery}
       ORDER BY g.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    ),
    pool.query(`SELECT COUNT(DISTINCT g.id) ${baseQuery}`, params),
  ]);

  res.json({
    success: true,
    data,
    meta: { page: +page, limit: +limit, total: +count, totalPages: Math.ceil(count / limit) },
  });
});

// GET /grn/:id
router.get('/:id', async (req, res) => {
  const { companyId } = req;
  const { rows } = await pool.query(
    `SELECT g.*, s.name AS supplier_name, w.name AS warehouse_name
     FROM grn g
     LEFT JOIN suppliers s ON g.supplier_id = s.id
     LEFT JOIN warehouses w ON g.warehouse_id = w.id
     WHERE g.id = $1 AND g.company_id = $2`,
    [req.params.id, companyId]
  );
  if (!rows[0]) return res.status(404).json({ success: false, message: 'GRN not found' });

  const { rows: items } = await pool.query(
    `SELECT gi.*, m.name AS material_name, m.code AS material_code, m.unit AS material_unit
     FROM grn_items gi
     JOIN materials m ON gi.material_id = m.id
     WHERE gi.grn_id = $1`,
    [req.params.id]
  );

  res.json({ success: true, data: { ...rows[0], items } });
});

// POST /grn
router.post('/', async (req, res) => {
  const { companyId, user } = req;
  const {
    materialId, supplierId, warehouseId,
    receivedQuantity, acceptedQuantity, rejectedQuantity = 0,
    unitCost, qcStatus = 'pending',
    batchNumber, invoiceNumber, invoiceDate, notes,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate GRN number
    const { rows: [{ grn_counter }] } = await client.query(
      'UPDATE companies SET grn_counter = grn_counter + 1 WHERE id = $1 RETURNING grn_counter',
      [companyId]
    );
    const { rows: [{ grn_prefix }] } = await client.query(
      'SELECT grn_prefix FROM companies WHERE id = $1', [companyId]
    );
    const grnNumber = `${grn_prefix || 'GRN'}-${new Date().getFullYear()}-${String(grn_counter).padStart(5, '0')}`;

    const accepted = acceptedQuantity || receivedQuantity;

    // Insert GRN header
    const { rows: [grn] } = await client.query(
      `INSERT INTO grn
       (id, company_id, grn_number, supplier_id, warehouse_id,
        supplier_invoice_number, supplier_invoice_date,
        qc_status, notes, received_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
       RETURNING *`,
      [
        uuidv4(), companyId, grnNumber,
        supplierId || null, warehouseId || null,
        invoiceNumber || null,
        invoiceDate || null,
        qcStatus, notes || null, user.id,
      ]
    );

    // Get material unit for the item
    const { rows: [mat] } = await client.query(
      'SELECT unit FROM materials WHERE id = $1', [materialId]
    );

    // Insert GRN item
    await client.query(
      `INSERT INTO grn_items
       (id, grn_id, material_id, received_quantity, accepted_quantity, rejected_quantity,
        unit, rate, batch_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        uuidv4(), grn.id, materialId,
        receivedQuantity, accepted, rejectedQuantity,
        mat?.unit || 'piece',
        unitCost || null, batchNumber || null,
      ]
    );

    // Update stock and log transaction if accepted > 0 and not rejected
    if (Number(accepted) > 0 && qcStatus !== 'rejected') {
      await client.query(
        `UPDATE materials SET current_stock = current_stock + $1, updated_at = NOW()
         WHERE id = $2 AND company_id = $3`,
        [accepted, materialId, companyId]
      );

      await client.query(
        `INSERT INTO stock_transactions
         (id, company_id, material_id, warehouse_id, transaction_type, quantity,
          reference_type, reference_id, rate, notes, performed_by)
         VALUES ($1,$2,$3,$4,'inward',$5,'grn',$6,$7,$8,$9)`,
        [
          uuidv4(), companyId, materialId, warehouseId || null,
          accepted, grn.id, unitCost || null, notes || null, user.id,
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: grn, message: 'GRN created successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
