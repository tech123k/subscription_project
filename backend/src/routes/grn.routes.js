const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { writeLedger } = require('../services/ledger.service');

// ─── Helper ──────────────────────────────────────────────────────────────────
const recalculatePOStatus = async (client, poId) => {
  if (!poId) return;

  await client.query(
    `UPDATE po_items pi
     SET received_quantity = (
       SELECT COALESCE(SUM(gi.received_quantity), 0)
       FROM grn g
       JOIN grn_items gi ON gi.grn_id = g.id
       WHERE g.po_id = $1
         AND gi.material_id = pi.material_id
         AND g.status != 'cancelled'
         AND g.qc_status != 'rejected'
     )
     WHERE pi.po_id = $1`,
    [poId]
  );

  const { rows: items } = await client.query(
    'SELECT quantity, received_quantity FROM po_items WHERE po_id = $1',
    [poId]
  );

  if (!items.length) return;

  const totalOrdered  = items.reduce((s, i) => s + Number(i.quantity), 0);
  const totalReceived = items.reduce((s, i) => s + Number(i.received_quantity), 0);

  let newStatus;
  if (totalReceived <= 0)             newStatus = 'confirmed';
  else if (totalReceived < totalOrdered) newStatus = 'partial';
  else                                newStatus = 'completed';

  await client.query(
    `UPDATE purchase_orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND status NOT IN ('draft', 'sent', 'cancelled')`,
    [newStatus, poId]
  );
};

// ─── GET /grn ────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { companyId } = req;
  const { page = 1, limit = 20, search = '', qcStatus = '' } = req.query;
  const offset = (page - 1) * limit;

  let where = "g.company_id = $1 AND g.status != 'cancelled'";
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
              g.supplier_invoice_number, g.notes, g.po_id,
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

// ─── GET /grn/:id ────────────────────────────────────────────────────────────
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

// ─── POST /grn ───────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { companyId, user } = req;
  const {
    materialId, supplierId, warehouseId,
    receivedQuantity, acceptedQuantity, rejectedQuantity = 0,
    unitCost, qcStatus = 'pending',
    batchNumber, invoiceNumber, invoiceDate, notes,
    poId,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── PO quantity cap validation ──────────────────────────────────────────
    if (poId && materialId) {
      const { rows: [poItem] } = await client.query(
        `SELECT pi.quantity,
                COALESCE((
                  SELECT SUM(gi2.received_quantity)
                  FROM grn g2
                  JOIN grn_items gi2 ON gi2.grn_id = g2.id
                  WHERE g2.po_id = $1
                    AND gi2.material_id = $2
                    AND g2.status != 'cancelled'
                    AND g2.qc_status != 'rejected'
                ), 0) AS already_received
         FROM po_items pi
         WHERE pi.po_id = $1 AND pi.material_id = $2`,
        [poId, materialId]
      );
      if (poItem) {
        const remaining = Number(poItem.quantity) - Number(poItem.already_received);
        const toReceive = Number(receivedQuantity);
        if (toReceive > Math.max(0, remaining) + 0.001) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Cannot receive more than ordered quantity. Remaining: ${Math.max(0, remaining).toFixed(2)}`,
          });
        }
      }
    }

    // Generate GRN number
    const { rows: [co] } = await client.query(
      'UPDATE companies SET grn_counter = grn_counter + 1 WHERE id = $1 RETURNING grn_counter, grn_prefix',
      [companyId]
    );
    const grnNumber = `${co.grn_prefix || 'GRN'}-${new Date().getFullYear()}-${String(co.grn_counter).padStart(5, '0')}`;

    const accepted = Number(acceptedQuantity || receivedQuantity);

    const { rows: [grn] } = await client.query(
      `INSERT INTO grn
       (id, company_id, grn_number, supplier_id, warehouse_id,
        supplier_invoice_number, supplier_invoice_date,
        qc_status, notes, received_by, status, po_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11)
       RETURNING *`,
      [
        uuidv4(), companyId, grnNumber,
        supplierId || null, warehouseId || null,
        invoiceNumber || null, invoiceDate || null,
        qcStatus, notes || null, user.id,
        poId || null,
      ]
    );

    const { rows: [mat] } = await client.query(
      'SELECT unit, current_stock FROM materials WHERE id = $1', [materialId]
    );

    await client.query(
      `INSERT INTO grn_items
       (id, grn_id, material_id, received_quantity, accepted_quantity, rejected_quantity,
        unit, rate, batch_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        uuidv4(), grn.id, materialId,
        receivedQuantity, accepted, Number(rejectedQuantity),
        mat?.unit || 'piece',
        unitCost || null, batchNumber || null,
      ]
    );

    // Only add accepted qty to stock when QC is approved
    if (accepted > 0 && qcStatus === 'approved') {
      const { rows: [updated] } = await client.query(
        `UPDATE materials SET current_stock = current_stock + $1, updated_at = NOW()
         WHERE id = $2 AND company_id = $3 RETURNING current_stock`,
        [accepted, materialId, companyId]
      );

      await client.query(
        `INSERT INTO stock_transactions
         (id, company_id, material_id, warehouse_id, transaction_type, quantity,
          reference_type, reference_id, rate, notes, performed_by)
         VALUES ($1,$2,$3,$4,'inward',$5,'grn',$6,$7,$8,$9)`,
        [uuidv4(), companyId, materialId, warehouseId || null,
         accepted, grn.id, unitCost || null, notes || null, user.id]
      );

      // ── Write inventory_ledger entry ──────────────────────────────────────
      await writeLedger({
        companyId,
        materialId,
        warehouseId: warehouseId || null,
        movementType: 'grn_inward',
        quantity: accepted,
        balanceAfter: updated?.current_stock ?? null,
        unit: mat?.unit || null,
        rate: unitCost ? Number(unitCost) : null,
        referenceType: 'grn',
        referenceId: grn.id,
        referenceNumber: grnNumber,
        batchNumber: batchNumber || null,
        notes: notes || null,
        performedBy: user.id,
      }, client);
    }

    await recalculatePOStatus(client, poId);

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: grn, message: 'GRN created successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── PUT /grn/:id ────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { companyId } = req;
  const { id } = req.params;
  const { qcStatus, acceptedQuantity, rejectedQuantity, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT g.qc_status, g.grn_number, g.po_id, g.warehouse_id,
              gi.material_id, gi.accepted_quantity AS old_accepted, gi.received_quantity, gi.rate,
              m.unit AS material_unit
       FROM grn g
       JOIN grn_items gi ON gi.grn_id = g.id
       JOIN materials m ON m.id = gi.material_id
       WHERE g.id = $1 AND g.company_id = $2 AND g.status != 'cancelled'`,
      [id, companyId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'GRN not found' });
    const grn = rows[0];

    const oldQcStatus = grn.qc_status;
    const oldAccepted = Number(grn.old_accepted);
    const newQcStatus = qcStatus || oldQcStatus;
    const newAccepted = acceptedQuantity !== undefined ? Number(acceptedQuantity) : oldAccepted;

    const oldStockAdded = oldQcStatus === 'approved' ? oldAccepted : 0;
    const newStockAdded = newQcStatus === 'approved' ? newAccepted : 0;
    const stockDelta    = newStockAdded - oldStockAdded;

    await client.query(
      `UPDATE grn SET qc_status = $1, notes = COALESCE($2, notes), updated_at = NOW() WHERE id = $3`,
      [newQcStatus, notes ?? null, id]
    );

    const newRejected = rejectedQuantity !== undefined
      ? Number(rejectedQuantity)
      : Math.max(0, Number(grn.received_quantity) - newAccepted);

    await client.query(
      `UPDATE grn_items SET accepted_quantity = $1, rejected_quantity = $2 WHERE grn_id = $3`,
      [newAccepted, newRejected, id]
    );

    if (stockDelta !== 0) {
      const { rows: [updated] } = await client.query(
        `UPDATE materials SET current_stock = GREATEST(0, current_stock + $1)
         WHERE id = $2 AND company_id = $3 RETURNING current_stock`,
        [stockDelta, grn.material_id, companyId]
      );

      const txnType = stockDelta > 0 ? 'inward' : 'outward';
      await client.query(
        `INSERT INTO stock_transactions
         (id, company_id, material_id, warehouse_id, transaction_type, quantity,
          reference_type, reference_id, rate, notes, performed_by)
         VALUES ($1,$2,$3,$4,$5,$6,'grn',$7,$8,$9,$10)`,
        [uuidv4(), companyId, grn.material_id, grn.warehouse_id,
         txnType, Math.abs(stockDelta), id, grn.rate || null,
         notes ?? null, req.user.id]
      );

      // ── Write inventory_ledger entry for QC status change ─────────────────
      // Positive delta = new approval (grn_inward), negative = reversal (adjustment_deduct)
      await writeLedger({
        companyId,
        materialId: grn.material_id,
        warehouseId: grn.warehouse_id || null,
        movementType: stockDelta > 0 ? 'grn_inward' : 'adjustment_deduct',
        quantity: stockDelta,
        balanceAfter: updated?.current_stock ?? null,
        unit: grn.material_unit || null,
        rate: grn.rate ? Number(grn.rate) : null,
        referenceType: 'grn',
        referenceId: id,
        referenceNumber: grn.grn_number,
        notes: `QC status changed to ${newQcStatus}${notes ? ': ' + notes : ''}`,
        performedBy: req.user.id,
      }, client);
    }

    await recalculatePOStatus(client, grn.po_id);

    await client.query('COMMIT');
    res.json({ success: true, message: 'GRN updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─── DELETE /grn/:id ─────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { companyId } = req;
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT g.qc_status, g.grn_number, g.po_id, g.warehouse_id,
              gi.material_id, gi.accepted_quantity, gi.rate,
              m.unit AS material_unit
       FROM grn g
       JOIN grn_items gi ON gi.grn_id = g.id
       JOIN materials m ON m.id = gi.material_id
       WHERE g.id = $1 AND g.company_id = $2 AND g.status != 'cancelled'`,
      [id, companyId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'GRN not found' });
    const grn = rows[0];

    // Reverse stock only if it was approved
    if (grn.qc_status === 'approved' && Number(grn.accepted_quantity) > 0) {
      const { rows: [updated] } = await client.query(
        `UPDATE materials SET current_stock = GREATEST(0, current_stock - $1)
         WHERE id = $2 AND company_id = $3 RETURNING current_stock`,
        [Number(grn.accepted_quantity), grn.material_id, companyId]
      );

      // ── Write reversal ledger entry ────────────────────────────────────────
      await writeLedger({
        companyId,
        materialId: grn.material_id,
        warehouseId: grn.warehouse_id || null,
        movementType: 'adjustment_deduct',
        quantity: -Number(grn.accepted_quantity),
        balanceAfter: updated?.current_stock ?? null,
        unit: grn.material_unit || null,
        referenceType: 'grn',
        referenceId: id,
        referenceNumber: grn.grn_number,
        notes: `GRN cancelled — stock reversed`,
        performedBy: req.user.id,
      }, client);
    }

    await client.query(
      `UPDATE grn SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await recalculatePOStatus(client, grn.po_id);

    await client.query('COMMIT');
    res.json({ success: true, message: 'GRN deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
