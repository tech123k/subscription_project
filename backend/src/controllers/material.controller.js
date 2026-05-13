const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');
const notificationService = require('../services/notification.service');
const excelService = require('../services/excel.service');

const getAll = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, categoryId, warehouseId, lowStock, isActive, supplierId } = req.query;

    let whereClause = 'WHERE m.company_id = $1 AND m.deleted_at IS NULL';
    const params = [companyId];
    let paramIdx = 2;

    if (search) {
      whereClause += ` AND (m.name ILIKE $${paramIdx} OR m.code ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (categoryId) { whereClause += ` AND m.category_id = $${paramIdx}`; params.push(categoryId); paramIdx++; }
    if (warehouseId) { whereClause += ` AND m.warehouse_id = $${paramIdx}`; params.push(warehouseId); paramIdx++; }
    if (supplierId) { whereClause += ` AND m.supplier_id = $${paramIdx}`; params.push(supplierId); paramIdx++; }
    if (lowStock === 'true') whereClause += ' AND m.current_stock <= m.minimum_stock';
    if (isActive !== undefined) { whereClause += ` AND m.is_active = $${paramIdx}`; params.push(isActive === 'true'); paramIdx++; }

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT m.*, mc.name AS category_name, w.name AS warehouse_name,
                s.name AS supplier_name, wr.rack_code, wr.bin_code
         FROM materials m
         LEFT JOIN material_categories mc ON m.category_id = mc.id
         LEFT JOIN warehouses w ON m.warehouse_id = w.id
         LEFT JOIN suppliers s ON m.supplier_id = s.id
         LEFT JOIN warehouse_racks wr ON m.rack_id = wr.id
         ${whereClause}
         ORDER BY m.name ASC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM materials m ${whereClause}`, params),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.*, mc.name AS category_name, w.name AS warehouse_name,
              s.name AS supplier_name, s.contact_person AS supplier_contact
       FROM materials m
       LEFT JOIN material_categories mc ON m.category_id = mc.id
       LEFT JOIN warehouses w ON m.warehouse_id = w.id
       LEFT JOIN suppliers s ON m.supplier_id = s.id
       WHERE m.id = $1 AND m.company_id = $2 AND m.deleted_at IS NULL`,
      [req.params.id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Material not found');
    ApiResponse.success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const {
      name, code, description, categoryId, supplierId, unit, secondaryUnit, conversionFactor,
      hsnCode, gstPercent, purchaseRate, saleRate, mrp, openingStock,
      minimumStock, reorderLevel, reorderQuantity, leadTimeDays,
      warehouseId, rackId, barcode, isRawMaterial, isFinishedGood, isSemiFinished, isConsumable, customFields,
    } = req.body;

    const imageUrl = req.file?.path || null;

    const existing = await query('SELECT id FROM materials WHERE company_id = $1 AND code = $2 AND deleted_at IS NULL', [companyId, code]);
    if (existing.rows[0]) return ApiResponse.conflict(res, 'Material code already exists for this company');

    const result = await query(
      `INSERT INTO materials (
        company_id, name, code, description, category_id, supplier_id, unit, secondary_unit,
        conversion_factor, hsn_code, gst_percent, purchase_rate, sale_rate, mrp,
        opening_stock, current_stock, minimum_stock, reorder_level, reorder_quantity,
        lead_time_days, warehouse_id, rack_id, image_url, barcode,
        is_raw_material, is_finished_good, is_semi_finished, is_consumable, custom_fields
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
      RETURNING *`,
      [
        companyId, name, code, description || null, categoryId || null, supplierId || null,
        unit, secondaryUnit || null, conversionFactor || 1,
        hsnCode || null, gstPercent || 0, purchaseRate || 0, saleRate || 0, mrp || 0,
        openingStock || 0, minimumStock || 0, reorderLevel || 0, reorderQuantity || 0,
        leadTimeDays || 0, warehouseId || null, rackId || null, imageUrl, barcode || null,
        isRawMaterial !== false, isFinishedGood === true, isSemiFinished === true, isConsumable === true,
        customFields ? JSON.stringify(customFields) : '{}',
      ]
    );

    // Create opening stock transaction
    if (openingStock > 0) {
      await query(
        `INSERT INTO stock_transactions (company_id, material_id, warehouse_id, transaction_type, stock_type, quantity, rate, reference_type, performed_by)
         VALUES ($1,$2,$3,'inward','available',$4,$5,'opening_stock',$6)`,
        [companyId, result.rows[0].id, warehouseId || null, openingStock, purchaseRate || 0, req.user.id]
      );
    }

    ApiResponse.created(res, result.rows[0], 'Material created successfully');
  } catch (error) {
    if (error.code === '23505') return ApiResponse.conflict(res, 'Material code already exists for this company');
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const existing = await query('SELECT id FROM materials WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [id, companyId]);
    if (!existing.rows[0]) return ApiResponse.notFound(res, 'Material not found');

    const {
      name, description, categoryId, supplierId, unit, secondaryUnit, conversionFactor,
      hsnCode, gstPercent, purchaseRate, saleRate, mrp, minimumStock, reorderLevel,
      reorderQuantity, leadTimeDays, warehouseId, rackId, barcode, isActive, customFields,
    } = req.body;

    const imageUrl = req.file?.path;

    const result = await query(
      `UPDATE materials SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        category_id = COALESCE($3, category_id), supplier_id = COALESCE($4, supplier_id),
        unit = COALESCE($5, unit), secondary_unit = COALESCE($6, secondary_unit),
        conversion_factor = COALESCE($7, conversion_factor),
        hsn_code = COALESCE($8, hsn_code), gst_percent = COALESCE($9, gst_percent),
        purchase_rate = COALESCE($10, purchase_rate), sale_rate = COALESCE($11, sale_rate),
        mrp = COALESCE($12, mrp), minimum_stock = COALESCE($13, minimum_stock),
        reorder_level = COALESCE($14, reorder_level), reorder_quantity = COALESCE($15, reorder_quantity),
        lead_time_days = COALESCE($16, lead_time_days), warehouse_id = COALESCE($17, warehouse_id),
        rack_id = COALESCE($18, rack_id), barcode = COALESCE($19, barcode),
        image_url = COALESCE($20, image_url), is_active = COALESCE($21, is_active),
        custom_fields = COALESCE($22, custom_fields)
       WHERE id = $23 AND company_id = $24 RETURNING *`,
      [
        name, description, categoryId, supplierId, unit, secondaryUnit, conversionFactor,
        hsnCode, gstPercent, purchaseRate, saleRate, mrp, minimumStock, reorderLevel,
        reorderQuantity, leadTimeDays, warehouseId, rackId, barcode,
        imageUrl, isActive, customFields ? JSON.stringify(customFields) : null,
        id, companyId,
      ]
    );

    ApiResponse.success(res, result.rows[0], 'Material updated successfully');
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE materials SET deleted_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING id',
      [id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Material not found');
    ApiResponse.success(res, null, 'Material deleted successfully');
  } catch (error) {
    next(error);
  }
};

const adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, type, notes, warehouseId, stockType = 'available' } = req.body;
    const companyId = req.companyId;

    const matResult = await query('SELECT * FROM materials WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [id, companyId]);
    const material = matResult.rows[0];
    if (!material) return ApiResponse.notFound(res, 'Material not found');

    const adjustment = type === 'decrease' ? -Math.abs(quantity) : Math.abs(quantity);
    const newStock = parseFloat(material.current_stock) + adjustment;

    if (newStock < 0) return ApiResponse.badRequest(res, 'Insufficient stock');

    await transaction(async (client) => {
      await client.query('UPDATE materials SET current_stock = current_stock + $1 WHERE id = $2', [adjustment, id]);
      await client.query(
        `INSERT INTO stock_transactions (company_id, material_id, warehouse_id, transaction_type, stock_type, quantity, reference_type, notes, performed_by)
         VALUES ($1,$2,$3,'adjustment',$4,$5,'manual_adjustment',$6,$7)`,
        [companyId, id, warehouseId || material.warehouse_id, stockType, Math.abs(quantity), notes, req.user.id]
      );
    });

    const updatedMat = await query('SELECT current_stock, reserved_stock, minimum_stock FROM materials WHERE id = $1', [id]);

    if (updatedMat.rows[0].current_stock <= updatedMat.rows[0].minimum_stock) {
      await notificationService.broadcastToCompany(companyId, {
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${material.name} (${material.code}) is at or below minimum stock level`,
        referenceType: 'materials',
        referenceId: id,
        priority: 'high',
      });
    }

    ApiResponse.success(res, { newStock: updatedMat.rows[0].current_stock }, 'Stock adjusted successfully');
  } catch (error) {
    next(error);
  }
};

const getStockHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT st.*, w.name AS warehouse_name, u.first_name || ' ' || u.last_name AS user_name
         FROM stock_transactions st
         LEFT JOIN warehouses w ON st.warehouse_id = w.id
         LEFT JOIN users u ON st.performed_by = u.id
         WHERE st.material_id = $1 AND st.company_id = $2
         ORDER BY st.created_at DESC LIMIT $3 OFFSET $4`,
        [id, req.companyId, limit, offset]
      ),
      query('SELECT COUNT(*) FROM stock_transactions WHERE material_id = $1 AND company_id = $2', [id, req.companyId]),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (error) {
    next(error);
  }
};

const createGRN = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { supplierId, warehouseId, supplierInvoiceNumber, supplierInvoiceDate,
      vehicleNumber, challanNumber, lrNumber, transportName, poReference, notes, items } = req.body;

    // Generate GRN number
    const companyRes = await query('SELECT grn_prefix, grn_counter FROM companies WHERE id = $1', [companyId]);
    const company = companyRes.rows[0];
    const grnNumber = `${company.grn_prefix}-${String(company.grn_counter).padStart(6, '0')}`;

    await query('UPDATE companies SET grn_counter = grn_counter + 1 WHERE id = $1', [companyId]);

    const grnResult = await transaction(async (client) => {
      const grn = await client.query(
        `INSERT INTO grn (company_id, grn_number, supplier_id, warehouse_id, supplier_invoice_number,
          supplier_invoice_date, vehicle_number, challan_number, lr_number, transport_name,
          po_reference, notes, received_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [companyId, grnNumber, supplierId || null, warehouseId || null, supplierInvoiceNumber || null,
          supplierInvoiceDate || null, vehicleNumber || null, challanNumber || null,
          lrNumber || null, transportName || null, poReference || null, notes || null, req.user.id]
      );

      const grnId = grn.rows[0].id;

      for (const item of items) {
        await client.query(
          `INSERT INTO grn_items (grn_id, material_id, ordered_quantity, received_quantity, accepted_quantity, unit, rate, gst_percent, batch_number, lot_number, expiry_date, rack_id)
           VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [grnId, item.materialId, item.orderedQuantity || item.receivedQuantity,
            item.receivedQuantity, item.unit, item.rate || 0, item.gstPercent || 0,
            item.batchNumber || null, item.lotNumber || null, item.expiryDate || null, item.rackId || null]
        );

        // Update stock
        await client.query(
          `UPDATE materials SET current_stock = current_stock + $1, purchase_rate = COALESCE($2, purchase_rate)
           WHERE id = $3 AND company_id = $4`,
          [item.receivedQuantity, item.rate || null, item.materialId, companyId]
        );

        await client.query(
          `INSERT INTO stock_transactions (company_id, material_id, warehouse_id, transaction_type, stock_type, quantity, rate, reference_type, reference_id, reference_number, batch_number, performed_by)
           VALUES ($1,$2,$3,'inward','available',$4,$5,'grn',$6,$7,$8,$9)`,
          [companyId, item.materialId, warehouseId || null, item.receivedQuantity,
            item.rate || 0, grnId, grnNumber, item.batchNumber || null, req.user.id]
        );
      }

      return grn.rows[0];
    });

    ApiResponse.created(res, grnResult, 'GRN created successfully');
  } catch (error) {
    next(error);
  }
};

const exportMaterials = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.*, mc.name AS category_name, w.name AS warehouse_name, s.name AS supplier_name
       FROM materials m
       LEFT JOIN material_categories mc ON m.category_id = mc.id
       LEFT JOIN warehouses w ON m.warehouse_id = w.id
       LEFT JOIN suppliers s ON m.supplier_id = s.id
       WHERE m.company_id = $1 AND m.deleted_at IS NULL
       ORDER BY m.name`,
      [req.companyId]
    );

    const wb = excelService.exportMaterials(result.rows);
    const buffer = excelService.toBuffer(wb);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="materials.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const importMaterials = async (req, res, next) => {
  try {
    if (!req.file) return ApiResponse.badRequest(res, 'Excel file is required');
    const rows = excelService.parseFile(req.file.buffer);
    const errors = [];
    const created = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors = excelService.validateMaterialRow(row, i + 2);
      if (rowErrors.length > 0) { errors.push(...rowErrors); continue; }

      try {
        const existing = await query('SELECT id FROM materials WHERE company_id = $1 AND code = $2 AND deleted_at IS NULL', [req.companyId, row['Material Code*']]);
        if (existing.rows[0]) { errors.push(`Row ${i + 2}: Material code '${row['Material Code*']}' already exists for this company`); continue; }

        const result = await query(
          `INSERT INTO materials (company_id, name, code, unit, hsn_code, gst_percent, purchase_rate, sale_rate, opening_stock, current_stock, minimum_stock, reorder_level, lead_time_days)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12) RETURNING id, name, code`,
          [
            req.companyId, row['Material Name*'], row['Material Code*'],
            (row['Unit*'] || '').toLowerCase(), row['HSN Code'] || null,
            parseFloat(row['GST %']) || 0, parseFloat(row['Purchase Rate']) || 0,
            parseFloat(row['Sale Rate']) || 0, parseFloat(row['Opening Stock']) || 0,
            parseFloat(row['Minimum Stock']) || 0, parseFloat(row['Reorder Level']) || 0,
            parseInt(row['Lead Time (Days)']) || 0,
          ]
        );
        created.push(result.rows[0]);
      } catch (err) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    ApiResponse.success(res, { created: created.length, errors }, `Imported ${created.length} materials`);
  } catch (error) {
    next(error);
  }
};

const downloadTemplate = async (req, res, next) => {
  try {
    const wb = excelService.generateMaterialTemplate();
    const buffer = excelService.toBuffer(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="material_template.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM material_categories WHERE company_id = $1 AND is_active = TRUE ORDER BY name',
      [req.companyId]
    );
    ApiResponse.success(res, result.rows);
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, description, parentId } = req.body;
    const result = await query(
      'INSERT INTO material_categories (company_id, name, description, parent_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.companyId, name, description || null, parentId || null]
    );
    ApiResponse.created(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll, getOne, create, update, remove, adjustStock, getStockHistory,
  createGRN, exportMaterials, importMaterials, downloadTemplate, getCategories, createCategory,
};
