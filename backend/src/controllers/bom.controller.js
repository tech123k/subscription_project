const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');

// Get BOM for a product (with all items)
const getByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const companyId = req.companyId;

    // Verify product belongs to company
    const productRes = await query(
      'SELECT id, name, unit FROM products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [productId, companyId]
    );
    if (!productRes.rows[0]) return ApiResponse.notFound(res, 'Product not found');

    const bomRes = await query(
      `SELECT b.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', bi.id,
                    'material_id', bi.material_id,
                    'material_name', m.name,
                    'material_code', m.code,
                    'material_unit', m.unit::text,
                    'current_stock', m.current_stock,
                    'quantity_per_unit', bi.quantity_per_unit,
                    'unit', bi.unit,
                    'waste_percentage', bi.waste_percentage,
                    'sequence_order', bi.sequence_order,
                    'notes', bi.notes
                  ) ORDER BY bi.sequence_order
                ) FILTER (WHERE bi.id IS NOT NULL),
                '[]'
              ) AS items
       FROM bill_of_materials b
       LEFT JOIN bom_items bi ON bi.bom_id = b.id
       LEFT JOIN materials m ON m.id = bi.material_id
       WHERE b.product_id = $1 AND b.is_active = TRUE
       GROUP BY b.id`,
      [productId]
    );

    ApiResponse.success(res, {
      product: productRes.rows[0],
      bom: bomRes.rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
};

// Create or replace BOM for a product (full save)
const upsert = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const companyId = req.companyId;
    const { items = [], notes } = req.body;

    // Verify product
    const productRes = await query(
      'SELECT id FROM products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [productId, companyId]
    );
    if (!productRes.rows[0]) return ApiResponse.notFound(res, 'Product not found');

    if (items.length === 0) return ApiResponse.badRequest(res, 'BOM must have at least one material');

    // Validate each item
    for (const item of items) {
      if (!item.materialId) return ApiResponse.badRequest(res, 'Each BOM item must reference a material');
      if (!item.quantityPerUnit || Number(item.quantityPerUnit) <= 0) {
        return ApiResponse.badRequest(res, 'Quantity per unit must be greater than 0');
      }
    }

    const bom = await transaction(async (client) => {
      // Deactivate existing BOM
      await client.query(
        'UPDATE bill_of_materials SET is_active = FALSE, updated_at = NOW() WHERE product_id = $1',
        [productId]
      );

      // Get next version
      const verRes = await client.query(
        'SELECT COALESCE(MAX(version), 0) + 1 AS next_ver FROM bill_of_materials WHERE product_id = $1',
        [productId]
      );
      const version = verRes.rows[0].next_ver;

      // Create new BOM
      const bomRes = await client.query(
        `INSERT INTO bill_of_materials (company_id, product_id, version, is_active, notes, created_by)
         VALUES ($1, $2, $3, TRUE, $4, $5) RETURNING *`,
        [companyId, productId, version, notes?.trim() || null, req.user.id]
      );
      const bomId = bomRes.rows[0].id;

      // Insert items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(
          `INSERT INTO bom_items (bom_id, material_id, quantity_per_unit, unit, waste_percentage, sequence_order, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            bomId,
            item.materialId,
            Number(item.quantityPerUnit),
            item.unit?.trim() || null,
            Number(item.wastePercentage || 0),
            i + 1,
            item.notes?.trim() || null,
          ]
        );
      }

      return bomRes.rows[0];
    });

    ApiResponse.success(res, bom, 'BOM saved successfully');
  } catch (error) {
    next(error);
  }
};

// Add a single item to existing BOM
const addItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const companyId = req.companyId;
    const { materialId, quantityPerUnit, unit, wastePercentage, notes } = req.body;

    if (!materialId || !quantityPerUnit || Number(quantityPerUnit) <= 0) {
      return ApiResponse.badRequest(res, 'materialId and quantityPerUnit > 0 are required');
    }

    const bomRes = await query(
      `SELECT b.id FROM bill_of_materials b
       JOIN products p ON p.id = b.product_id
       WHERE b.product_id = $1 AND p.company_id = $2 AND b.is_active = TRUE`,
      [productId, companyId]
    );
    if (!bomRes.rows[0]) return ApiResponse.notFound(res, 'No active BOM found for this product');

    const bomId = bomRes.rows[0].id;
    const seqRes = await query('SELECT COALESCE(MAX(sequence_order),0)+1 AS next FROM bom_items WHERE bom_id=$1', [bomId]);

    const item = await query(
      `INSERT INTO bom_items (bom_id, material_id, quantity_per_unit, unit, waste_percentage, sequence_order, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [bomId, materialId, Number(quantityPerUnit), unit?.trim() || null,
       Number(wastePercentage || 0), seqRes.rows[0].next, notes?.trim() || null]
    );

    await query('UPDATE bill_of_materials SET updated_at=NOW() WHERE id=$1', [bomId]);

    ApiResponse.created(res, item.rows[0], 'Item added to BOM');
  } catch (error) {
    next(error);
  }
};

// Update a single BOM item
const updateItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const companyId = req.companyId;
    const { quantityPerUnit, unit, wastePercentage, notes } = req.body;

    // Verify ownership via join
    const result = await query(
      `UPDATE bom_items bi SET
         quantity_per_unit = COALESCE($1, bi.quantity_per_unit),
         unit = COALESCE($2, bi.unit),
         waste_percentage = COALESCE($3, bi.waste_percentage),
         notes = COALESCE($4, bi.notes)
       FROM bill_of_materials b
       JOIN products p ON p.id = b.product_id
       WHERE bi.id = $5 AND bi.bom_id = b.id AND p.company_id = $6
       RETURNING bi.*`,
      [
        quantityPerUnit ? Number(quantityPerUnit) : null,
        unit?.trim() || null, wastePercentage !== undefined ? Number(wastePercentage) : null,
        notes?.trim() || null, itemId, companyId,
      ]
    );

    if (!result.rows[0]) return ApiResponse.notFound(res, 'BOM item not found');
    ApiResponse.success(res, result.rows[0], 'BOM item updated');
  } catch (error) {
    next(error);
  }
};

// Remove a single BOM item
const removeItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const companyId = req.companyId;

    const result = await query(
      `DELETE FROM bom_items bi
       USING bill_of_materials b, products p
       WHERE bi.id = $1 AND bi.bom_id = b.id AND b.product_id = p.id AND p.company_id = $2
       RETURNING bi.id`,
      [itemId, companyId]
    );

    if (!result.rows[0]) return ApiResponse.notFound(res, 'BOM item not found');
    ApiResponse.success(res, null, 'BOM item removed');
  } catch (error) {
    next(error);
  }
};

module.exports = { getByProduct, upsert, addItem, updateItem, removeItem };
