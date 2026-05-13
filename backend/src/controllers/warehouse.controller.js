const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');

const getAll = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT w.*, u.first_name || ' ' || u.last_name AS manager_name,
              (SELECT COUNT(*) FROM materials m WHERE m.warehouse_id = w.id AND m.deleted_at IS NULL) AS material_count,
              (SELECT COALESCE(SUM(m.current_stock * m.purchase_rate), 0) FROM materials m WHERE m.warehouse_id = w.id AND m.deleted_at IS NULL) AS stock_value
       FROM warehouses w
       LEFT JOIN users u ON w.manager_id = u.id
       WHERE w.company_id = $1 AND w.deleted_at IS NULL
       ORDER BY w.is_primary DESC, w.name`,
      [req.companyId]
    );
    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [whRes, racksRes, stockRes] = await Promise.all([
      query('SELECT w.*, u.first_name || \' \' || u.last_name AS manager_name FROM warehouses w LEFT JOIN users u ON w.manager_id = u.id WHERE w.id = $1 AND w.company_id = $2 AND w.deleted_at IS NULL', [id, req.companyId]),
      query('SELECT * FROM warehouse_racks WHERE warehouse_id = $1 AND is_active = TRUE ORDER BY rack_code', [id]),
      query(`SELECT m.id, m.name, m.code, m.unit, m.current_stock, m.minimum_stock, m.purchase_rate,
              m.current_stock * COALESCE(m.purchase_rate, 0) AS stock_value,
              mc.name AS category_name
              FROM materials m LEFT JOIN material_categories mc ON m.category_id = mc.id
              WHERE m.warehouse_id = $1 AND m.deleted_at IS NULL AND m.is_active = TRUE
              ORDER BY m.name`, [id]),
    ]);
    if (!whRes.rows[0]) return ApiResponse.notFound(res, 'Warehouse not found');
    ApiResponse.success(res, { ...whRes.rows[0], racks: racksRes.rows, stocks: stockRes.rows });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, code, address, city, state, pincode, contactPerson, phone, notes } = req.body;
    const result = await query(
      `INSERT INTO warehouses (company_id, name, code, address, city, state, pincode, contact_person, phone, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.companyId, name, code || null, address || null, city || null, state || null, pincode || null, contactPerson || null, phone || null, notes || null]
    );
    ApiResponse.created(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, address, city, state, pincode, contactPerson, phone, notes } = req.body;
    const result = await query(
      `UPDATE warehouses
       SET name            = COALESCE($1, name),
           code            = COALESCE($2, code),
           address         = COALESCE($3, address),
           city            = COALESCE($4, city),
           state           = COALESCE($5, state),
           pincode         = COALESCE($6, pincode),
           contact_person  = $7,
           phone           = COALESCE($8, phone),
           notes           = COALESCE($9, notes),
           updated_at      = NOW()
       WHERE id = $10 AND company_id = $11 AND deleted_at IS NULL
       RETURNING *`,
      [name, code, address, city, state, pincode, contactPerson || null, phone, notes, id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Warehouse not found');
    ApiResponse.success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const createTransfer = async (req, res, next) => {
  try {
    const { fromWarehouseId, toWarehouseId, items, notes } = req.body;
    const companyId = req.companyId;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countRes = await query('SELECT COUNT(*) FROM warehouse_transfers WHERE company_id = $1 AND DATE(created_at) = CURRENT_DATE', [companyId]);
    const transferNumber = `TRF-${dateStr}-${String(parseInt(countRes.rows[0].count) + 1).padStart(4, '0')}`;

    const result = await transaction(async (client) => {
      const transfer = await client.query(
        `INSERT INTO warehouse_transfers (company_id, transfer_number, from_warehouse_id, to_warehouse_id, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [companyId, transferNumber, fromWarehouseId, toWarehouseId, notes || null, req.user.id]
      );

      const transferId = transfer.rows[0].id;

      for (const item of items) {
        await client.query(
          `INSERT INTO warehouse_transfer_items (transfer_id, material_id, quantity, unit, from_rack_id, to_rack_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [transferId, item.materialId, item.quantity, item.unit, item.fromRackId || null, item.toRackId || null]
        );

        // Update stock
        await client.query(
          'UPDATE materials SET warehouse_id = $1, rack_id = COALESCE($2, rack_id) WHERE id = $3 AND company_id = $4',
          [toWarehouseId, item.toRackId || null, item.materialId, companyId]
        );

        await client.query(
          `INSERT INTO stock_transactions (company_id, material_id, warehouse_id, transaction_type, stock_type, quantity, reference_type, reference_id, reference_number, performed_by)
           VALUES ($1,$2,$3,'transfer','available',$4,'warehouse_transfer',$5,$6,$7)`,
          [companyId, item.materialId, toWarehouseId, item.quantity, transferId, transferNumber, req.user.id]
        );
      }

      await client.query('UPDATE warehouse_transfers SET status = $1 WHERE id = $2', ['completed', transferId]);

      return transfer.rows[0];
    });

    ApiResponse.created(res, result, 'Transfer completed successfully');
  } catch (error) {
    next(error);
  }
};

const getTransfers = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT wt.*, fw.name AS from_warehouse, tw.name AS to_warehouse,
                u.first_name || ' ' || u.last_name AS created_by_name,
                (SELECT COUNT(*) FROM warehouse_transfer_items wti WHERE wti.transfer_id = wt.id) AS item_count
         FROM warehouse_transfers wt
         JOIN warehouses fw ON wt.from_warehouse_id = fw.id
         JOIN warehouses tw ON wt.to_warehouse_id = tw.id
         LEFT JOIN users u ON wt.created_by = u.id
         WHERE wt.company_id = $1
         ORDER BY wt.created_at DESC LIMIT $2 OFFSET $3`,
        [req.companyId, limit, offset]
      ),
      query('SELECT COUNT(*) FROM warehouse_transfers WHERE company_id = $1', [req.companyId]),
    ]);
    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (error) {
    next(error);
  }
};

const addRack = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rackCode, binCode, description } = req.body;
    const result = await query(
      'INSERT INTO warehouse_racks (warehouse_id, rack_code, bin_code, description) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, rackCode, binCode || null, description || null]
    );
    ApiResponse.created(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE warehouses SET deleted_at = NOW()
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL AND is_primary = FALSE
       RETURNING id`,
      [id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Warehouse not found or cannot delete primary warehouse');
    ApiResponse.success(res, null, 'Warehouse deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getOne, create, update, remove, createTransfer, getTransfers, addRack };
