const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Write a single entry to the inventory_ledger table.
 * Non-throwing — errors are logged so callers don't break on ledger failures.
 *
 * @param {object} entry
 * @param {string} entry.companyId
 * @param {string|null} entry.materialId
 * @param {string|null} entry.productId
 * @param {string|null} entry.variantId
 * @param {string|null} entry.warehouseId
 * @param {string}  entry.movementType  — grn_inward | production_consume | production_complete |
 *                                        dispatch_outward | transfer_in | transfer_out |
 *                                        adjustment_add | adjustment_deduct | opening_balance
 * @param {number}  entry.quantity      — positive for in, negative for out
 * @param {number|null} entry.balanceAfter
 * @param {string|null} entry.unit
 * @param {number|null} entry.rate
 * @param {string|null} entry.referenceType
 * @param {string|null} entry.referenceId
 * @param {string|null} entry.referenceNumber
 * @param {string|null} entry.batchNumber
 * @param {string|null} entry.notes
 * @param {string|null} entry.performedBy
 * @param {object|null} client  — pass a pg client to run inside a transaction
 */
const writeLedger = async (entry, client = null) => {
  const runner = client || { query: (sql, params) => query(sql, params) };
  try {
    await runner.query(
      `INSERT INTO inventory_ledger
         (company_id, material_id, product_id, variant_id, warehouse_id,
          movement_type, quantity, balance_after, unit, rate,
          reference_type, reference_id, reference_number,
          batch_number, notes, performed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        entry.companyId,
        entry.materialId   || null,
        entry.productId    || null,
        entry.variantId    || null,
        entry.warehouseId  || null,
        entry.movementType,
        entry.quantity,
        entry.balanceAfter ?? null,
        entry.unit         || null,
        entry.rate         || null,
        entry.referenceType   || null,
        entry.referenceId     || null,
        entry.referenceNumber || null,
        entry.batchNumber  || null,
        entry.notes        || null,
        entry.performedBy  || null,
      ]
    );
  } catch (err) {
    logger.error('ledger.service writeLedger failed:', err.message, entry);
  }
};

/**
 * Bulk-write ledger entries inside a transaction client.
 */
const writeLedgerBulk = async (entries, client) => {
  for (const entry of entries) {
    await writeLedger(entry, client);
  }
};

module.exports = { writeLedger, writeLedgerBulk };
