const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');
const notificationService = require('../services/notification.service');
const excelService = require('../services/excel.service');
const { writeLedger } = require('../services/ledger.service');

const getAll = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, status, startDate, endDate, customerId } = req.query;

    let where = 'WHERE d.company_id = $1 AND d.deleted_at IS NULL';
    const params = [companyId];
    let idx = 2;

    if (search) { where += ` AND (d.dispatch_number ILIKE $${idx} OR d.vehicle_number ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (status) { where += ` AND d.status = $${idx}`; params.push(status); idx++; }
    if (customerId) { where += ` AND d.customer_id = $${idx}`; params.push(customerId); idx++; }
    if (startDate) { where += ` AND d.dispatch_date >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { where += ` AND d.dispatch_date <= $${idx}`; params.push(endDate); idx++; }

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT d.*, c.name AS customer_name, i.invoice_number,
                w.name AS warehouse_name,
                CASE WHEN d.expected_delivery_date < CURRENT_DATE AND d.status NOT IN ('delivered','returned') THEN TRUE ELSE FALSE END AS is_delayed
         FROM dispatches d
         LEFT JOIN customers c ON d.customer_id = c.id
         LEFT JOIN invoices i ON d.invoice_id = i.id
         LEFT JOIN warehouses w ON d.warehouse_id = w.id
         ${where}
         ORDER BY d.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM dispatches d ${where}`, params),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const [dispatchRes, items, tracking] = await Promise.all([
      query(
        `SELECT d.*, c.name AS customer_name, c.gst_number AS customer_gst,
                c.address_line1 AS customer_address, i.invoice_number,
                w.name AS warehouse_name
         FROM dispatches d
         LEFT JOIN customers c ON d.customer_id = c.id
         LEFT JOIN invoices i ON d.invoice_id = i.id
         LEFT JOIN warehouses w ON d.warehouse_id = w.id
         WHERE d.id = $1 AND d.company_id = $2 AND d.deleted_at IS NULL`,
        [id, companyId]
      ),
      query(
        `SELECT di.*, m.name AS material_name, m.code AS material_code
         FROM dispatch_items di
         LEFT JOIN materials m ON di.material_id = m.id
         WHERE di.dispatch_id = $1`,
        [id]
      ),
      query(
        `SELECT dt.*, u.first_name || ' ' || u.last_name AS updated_by_name
         FROM dispatch_tracking dt
         LEFT JOIN users u ON dt.updated_by = u.id
         WHERE dt.dispatch_id = $1
         ORDER BY dt.created_at DESC`,
        [id]
      ),
    ]);

    if (!dispatchRes.rows[0]) return ApiResponse.notFound(res, 'Dispatch not found');
    ApiResponse.success(res, { ...dispatchRes.rows[0], items: items.rows, tracking: tracking.rows });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const {
      invoiceId, salesOrderId, customerId, warehouseId,
      dispatchDate, expectedDeliveryDate, transportName, transportContact,
      vehicleNumber, driverName, driverContact, lrNumber, ewayBillNumber,
      destinationAddress, destinationCity, destinationState, destinationPincode,
      totalPackages, totalWeight, weightUnit, freightAmount, notes, items,
    } = req.body;

    if (!invoiceId && !salesOrderId) {
      return ApiResponse.error(res, 'Dispatch must be linked to an Invoice or Sales Order', 400);
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countRes = await query(
      'SELECT COUNT(*) FROM dispatches WHERE company_id = $1 AND DATE(created_at) = CURRENT_DATE',
      [companyId]
    );
    const dispatchNumber = `DSP-${dateStr}-${String(parseInt(countRes.rows[0].count) + 1).padStart(4, '0')}`;

    const result = await transaction(async (client) => {
      const dispatch = await client.query(
        `INSERT INTO dispatches (
          company_id, dispatch_number, invoice_id, sales_order_id, customer_id, warehouse_id,
          dispatch_date, expected_delivery_date, transport_name, transport_contact, vehicle_number,
          driver_name, driver_contact, lr_number, eway_bill_number,
          destination_address, destination_city, destination_state, destination_pincode,
          total_packages, total_weight, weight_unit, freight_amount, notes, created_by, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,'ready')
        RETURNING *`,
        [
          companyId, dispatchNumber, invoiceId || null, salesOrderId || null,
          customerId || null, warehouseId || null,
          dispatchDate || new Date(), expectedDeliveryDate || null,
          transportName || null, transportContact || null, vehicleNumber || null,
          driverName || null, driverContact || null, lrNumber || null, ewayBillNumber || null,
          destinationAddress || null, destinationCity || null, destinationState || null, destinationPincode || null,
          totalPackages || 0, totalWeight || null, weightUnit || 'kg', freightAmount || 0,
          notes || null, req.user.id,
        ]
      );

      const dispatchId = dispatch.rows[0].id;

      if (items && items.length > 0) {
        for (const item of items) {
          await client.query(
            `INSERT INTO dispatch_items (dispatch_id, material_id, product_id, description, quantity, unit, packages, weight, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [dispatchId, item.materialId || null, item.productId || null, item.description, item.quantity, item.unit, item.packages || 1, item.weight || null, item.notes || null]
          );

          if (item.materialId) {
            const { rows: [matStock] } = await client.query(
              'SELECT current_stock, name FROM materials WHERE id = $1 AND company_id = $2',
              [item.materialId, companyId]
            );
            if (!matStock) throw new Error(`Material not found`);
            if (Number(matStock.current_stock) < Number(item.quantity)) {
              throw new Error(`Insufficient stock for "${matStock.name}". Available: ${matStock.current_stock}, Requested: ${item.quantity}`);
            }

            const { rows: [matUpdated] } = await client.query(
              `UPDATE materials SET in_transit_stock = in_transit_stock + $1,
               current_stock = current_stock - $1
               WHERE id = $2 AND company_id = $3 RETURNING current_stock`,
              [item.quantity, item.materialId, companyId]
            );

            await client.query(
              `INSERT INTO stock_transactions (company_id, material_id, warehouse_id, transaction_type, stock_type, quantity, reference_type, reference_id, reference_number, performed_by)
               VALUES ($1,$2,$3,'outward','in_transit',$4,'dispatch',$5,$6,$7)`,
              [companyId, item.materialId, warehouseId || null, item.quantity, dispatchId, dispatchNumber, req.user.id]
            );

            await writeLedger({
              companyId,
              materialId: item.materialId,
              warehouseId: warehouseId || null,
              movementType: 'dispatch_outward',
              quantity: -Number(item.quantity),
              balanceAfter: matUpdated?.current_stock ?? null,
              unit: item.unit || null,
              referenceType: 'dispatches',
              referenceId: dispatchId,
              referenceNumber: dispatchNumber,
              notes: item.notes || null,
              performedBy: req.user.id,
            }, client);
          }

          if (item.productId) {
            const stockCheck = await client.query(
              `SELECT current_stock FROM products WHERE id = $1 AND company_id = $2`,
              [item.productId, companyId]
            );
            if (!stockCheck.rows[0]) throw new Error(`Product not found: ${item.productId}`);
            if (Number(stockCheck.rows[0].current_stock) < Number(item.quantity)) {
              throw new Error(`Insufficient stock for product. Available: ${stockCheck.rows[0].current_stock}, Requested: ${item.quantity}`);
            }

            const { rows: [prodUpdated] } = await client.query(
              `UPDATE products
               SET current_stock  = GREATEST(0, current_stock - $1),
                   dispatched_qty = dispatched_qty + $1
               WHERE id = $2 AND company_id = $3 RETURNING current_stock`,
              [item.quantity, item.productId, companyId]
            );

            await writeLedger({
              companyId,
              productId: item.productId,
              warehouseId: warehouseId || null,
              movementType: 'dispatch_outward',
              quantity: -Number(item.quantity),
              balanceAfter: prodUpdated?.current_stock ?? null,
              unit: item.unit || null,
              referenceType: 'dispatches',
              referenceId: dispatchId,
              referenceNumber: dispatchNumber,
              notes: item.notes || null,
              performedBy: req.user.id,
            }, client);
          }
        }
      }

      // Initial tracking entry
      await client.query(
        `INSERT INTO dispatch_tracking (dispatch_id, status, notes, updated_by)
         VALUES ($1,'ready','Dispatch created',$2)`,
        [dispatchId, req.user.id]
      );

      return dispatch.rows[0];
    });

    await notificationService.broadcastToCompany(companyId, {
      type: 'dispatch_ready',
      title: 'New Dispatch Created',
      message: `Dispatch ${dispatchNumber} has been created for shipment`,
      referenceType: 'dispatches',
      referenceId: result.id,
      excludeUserId: req.user.id,
    });

    ApiResponse.created(res, result, 'Dispatch created successfully');
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, location, gpsLat, gpsLng, notes, actualDeliveryDate, receiverName } = req.body;
    const companyId = req.companyId;

    const dispatchRes = await query('SELECT * FROM dispatches WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [id, companyId]);
    if (!dispatchRes.rows[0]) return ApiResponse.notFound(res, 'Dispatch not found');

    await transaction(async (client) => {
      const updateFields = ['status = $1'];
      const updateParams = [status];
      let pidx = 2;

      if (status === 'delivered') {
        updateFields.push(`actual_delivery_date = $${pidx}`); updateParams.push(actualDeliveryDate || new Date()); pidx++;
        if (receiverName) { updateFields.push(`receiver_name = $${pidx}`); updateParams.push(receiverName); pidx++; }
      }

      await client.query(
        `UPDATE dispatches SET ${updateFields.join(', ')} WHERE id = $${pidx} AND company_id = $${pidx + 1}`,
        [...updateParams, id, companyId]
      );

      await client.query(
        `INSERT INTO dispatch_tracking (dispatch_id, status, location, gps_lat, gps_lng, notes, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, status, location || null, gpsLat || null, gpsLng || null, notes || null, req.user.id]
      );

      // On delivery, update stock transit → remove from in_transit
      if (status === 'delivered') {
        const items = await client.query('SELECT * FROM dispatch_items WHERE dispatch_id = $1', [id]);
        for (const item of items.rows) {
          if (item.material_id) {
            await client.query(
              'UPDATE materials SET in_transit_stock = in_transit_stock - $1 WHERE id = $2 AND company_id = $3',
              [item.quantity, item.material_id, companyId]
            );
          }
        }
      }
    });

    if (['dispatched', 'delivered'].includes(status)) {
      await notificationService.broadcastToCompany(companyId, {
        type: 'dispatch_ready',
        title: `Dispatch ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Dispatch ${dispatchRes.rows[0].dispatch_number} is now ${status}`,
        referenceType: 'dispatches',
        referenceId: id,
        priority: status === 'delivered' ? 'high' : 'normal',
      });
    }

    ApiResponse.success(res, null, `Dispatch status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

const exportDispatches = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.*, c.name AS customer_name, i.invoice_number,
              CASE WHEN d.expected_delivery_date < CURRENT_DATE AND d.status NOT IN ('delivered','returned') THEN TRUE ELSE FALSE END AS is_delayed
       FROM dispatches d
       LEFT JOIN customers c ON d.customer_id = c.id
       LEFT JOIN invoices i ON d.invoice_id = i.id
       WHERE d.company_id = $1 AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`,
      [req.companyId]
    );

    const wb = excelService.exportDispatches(result.rows);
    const buffer = excelService.toBuffer(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="dispatches.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getOne, create, updateStatus, exportDispatches };
