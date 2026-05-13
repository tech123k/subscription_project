const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');

// ─── ATTRIBUTE MASTER ────────────────────────────────────────────────────────

const getAttributes = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', av.id, 'value', av.value,
                    'display_name', av.display_name,
                    'color_hex', av.color_hex,
                    'sort_order', av.sort_order,
                    'is_active', av.is_active
                  ) ORDER BY av.sort_order, av.value
                ) FILTER (WHERE av.id IS NOT NULL), '[]'
              ) AS values
       FROM product_attributes a
       LEFT JOIN product_attribute_values av ON av.attribute_id = a.id AND av.is_active = TRUE
       WHERE a.company_id = $1 AND a.is_active = TRUE
       GROUP BY a.id
       ORDER BY a.sort_order, a.name`,
      [req.companyId]
    );
    ApiResponse.success(res, result.rows);
  } catch (err) { next(err); }
};

const createAttribute = async (req, res, next) => {
  try {
    const { name, code, dataType = 'text', isRequired = false, sortOrder = 0, values = [] } = req.body;
    if (!name?.trim() || !code?.trim()) return ApiResponse.badRequest(res, 'name and code are required');

    const dup = await query(
      'SELECT id FROM product_attributes WHERE company_id=$1 AND code=$2',
      [req.companyId, code.trim().toUpperCase()]
    );
    if (dup.rows[0]) return ApiResponse.conflict(res, 'Attribute code already exists for this company');

    const result = await transaction(async (client) => {
      const attrRes = await client.query(
        `INSERT INTO product_attributes (company_id, name, code, data_type, is_required, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.companyId, name.trim(), code.trim().toUpperCase(), dataType, isRequired, sortOrder]
      );
      const attr = attrRes.rows[0];

      const valRows = [];
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (!v.value?.trim()) continue;
        const vRes = await client.query(
          `INSERT INTO product_attribute_values (attribute_id, value, display_name, color_hex, sort_order)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [attr.id, v.value.trim(), v.displayName?.trim() || v.value.trim(), v.colorHex || null, i]
        );
        valRows.push(vRes.rows[0]);
      }
      return { ...attr, values: valRows };
    });

    ApiResponse.created(res, result, 'Attribute created');
  } catch (err) {
    if (err.code === '23505') return ApiResponse.conflict(res, 'Attribute code already exists for this company');
    next(err);
  }
};

const updateAttribute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, dataType, isRequired, sortOrder, isActive } = req.body;
    const result = await query(
      `UPDATE product_attributes SET
         name        = COALESCE($1, name),
         data_type   = COALESCE($2, data_type),
         is_required = COALESCE($3, is_required),
         sort_order  = COALESCE($4, sort_order),
         is_active   = COALESCE($5, is_active),
         updated_at  = NOW()
       WHERE id = $6 AND company_id = $7 RETURNING *`,
      [name?.trim()||null, dataType||null, isRequired??null, sortOrder??null, isActive??null, id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Attribute not found');
    ApiResponse.success(res, result.rows[0], 'Attribute updated');
  } catch (err) { next(err); }
};

const addAttributeValue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { value, displayName, colorHex, sortOrder = 0 } = req.body;
    if (!value?.trim()) return ApiResponse.badRequest(res, 'value is required');

    const attrCheck = await query(
      'SELECT id FROM product_attributes WHERE id = $1 AND company_id = $2', [id, req.companyId]
    );
    if (!attrCheck.rows[0]) return ApiResponse.notFound(res, 'Attribute not found');

    const result = await query(
      `INSERT INTO product_attribute_values (attribute_id, value, display_name, color_hex, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, value.trim(), displayName?.trim() || value.trim(), colorHex||null, sortOrder]
    );
    ApiResponse.created(res, result.rows[0], 'Value added');
  } catch (err) {
    if (err.code === '23505') return ApiResponse.conflict(res, 'Value already exists for this attribute');
    next(err);
  }
};

const updateAttributeValue = async (req, res, next) => {
  try {
    const { valueId } = req.params;
    const { displayName, colorHex, sortOrder, isActive } = req.body;
    const result = await query(
      `UPDATE product_attribute_values av SET
         display_name = COALESCE($1, av.display_name),
         color_hex    = COALESCE($2, av.color_hex),
         sort_order   = COALESCE($3, av.sort_order),
         is_active    = COALESCE($4, av.is_active)
       FROM product_attributes a
       WHERE av.id = $5 AND av.attribute_id = a.id AND a.company_id = $6
       RETURNING av.*`,
      [displayName?.trim()||null, colorHex||null, sortOrder??null, isActive??null, valueId, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Value not found');
    ApiResponse.success(res, result.rows[0]);
  } catch (err) { next(err); }
};

const deleteAttributeValue = async (req, res, next) => {
  try {
    const { valueId } = req.params;
    const result = await query(
      `DELETE FROM product_attribute_values av
       USING product_attributes a
       WHERE av.id = $1 AND av.attribute_id = a.id AND a.company_id = $2 RETURNING av.id`,
      [valueId, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Value not found');
    ApiResponse.success(res, null, 'Value deleted');
  } catch (err) { next(err); }
};

// ─── PRODUCT VARIANTS ───────────────────────────────────────────────────────

const getVariants = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);

    const [dataRes, countRes, stockRes] = await Promise.all([
      query(
        `SELECT pv.*
         FROM product_variants pv
         WHERE pv.product_id = $1 AND pv.company_id = $2
         ORDER BY pv.created_at
         LIMIT $3 OFFSET $4`,
        [productId, req.companyId, limit, offset]
      ),
      query(
        'SELECT COUNT(*)::int AS count FROM product_variants WHERE product_id=$1 AND company_id=$2',
        [productId, req.companyId]
      ),
      query(
        `SELECT pvs.variant_id,
                json_agg(json_build_object(
                  'warehouse_id', pvs.warehouse_id,
                  'warehouse_name', w.name,
                  'current_stock', pvs.current_stock,
                  'reserved_stock', pvs.reserved_stock,
                  'available_stock', GREATEST(0, pvs.current_stock - pvs.reserved_stock)
                )) AS stock_by_warehouse
         FROM product_variant_stock pvs
         JOIN warehouses w ON w.id = pvs.warehouse_id
         WHERE pvs.variant_id IN (
           SELECT id FROM product_variants WHERE product_id = $1 AND company_id = $2
         )
         GROUP BY pvs.variant_id`,
        [productId, req.companyId]
      ),
    ]);

    const stockMap = {};
    for (const row of stockRes.rows) {
      stockMap[row.variant_id] = row.stock_by_warehouse;
    }

    const variants = dataRes.rows.map((v) => ({
      ...v,
      stock_by_warehouse: stockMap[v.id] || [],
      total_stock: (stockMap[v.id] || []).reduce((s, w) => s + Number(w.current_stock), 0),
    }));

    ApiResponse.paginated(res, variants, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (err) { next(err); }
};

const createVariants = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const companyId = req.companyId;
    const { variants = [], skuPrefix } = req.body;

    if (!variants.length) return ApiResponse.badRequest(res, 'At least one variant is required');

    const prodCheck = await query(
      'SELECT id, sku_prefix FROM products WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL',
      [productId, companyId]
    );
    if (!prodCheck.rows[0]) return ApiResponse.notFound(res, 'Product not found');

    const created = await transaction(async (client) => {
      // Enable variants on product
      await client.query(
        'UPDATE products SET has_variants=TRUE, sku_prefix=COALESCE($1, sku_prefix), updated_at=NOW() WHERE id=$2',
        [skuPrefix?.trim() || null, productId]
      );

      const results = [];
      for (const v of variants) {
        if (!v.sku?.trim()) return ApiResponse.badRequest(res, 'Each variant must have a SKU');
        const vRes = await client.query(
          `INSERT INTO product_variants
             (product_id, company_id, sku, name, attribute_values, barcode, image_url, sale_rate, additional_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (company_id, sku) DO UPDATE SET
             name = EXCLUDED.name,
             attribute_values = EXCLUDED.attribute_values,
             updated_at = NOW()
           RETURNING *`,
          [
            productId, companyId,
            v.sku.trim(),
            v.name?.trim() || null,
            JSON.stringify(v.attributeValues || []),
            v.barcode?.trim() || null,
            v.imageUrl || null,
            v.saleRate || 0,
            v.additionalCost || 0,
          ]
        );
        results.push(vRes.rows[0]);
      }
      return results;
    });

    ApiResponse.created(res, created, `${created.length} variant(s) saved`);
  } catch (err) { next(err); }
};

const updateVariant = async (req, res, next) => {
  try {
    const { variantId } = req.params;
    const { sku, name, barcode, imageUrl, saleRate, isActive } = req.body;

    const result = await query(
      `UPDATE product_variants SET
         sku       = COALESCE($1, sku),
         name      = COALESCE($2, name),
         barcode   = COALESCE($3, barcode),
         image_url = COALESCE($4, image_url),
         sale_rate = COALESCE($5, sale_rate),
         is_active = COALESCE($6, is_active),
         updated_at = NOW()
       WHERE id = $7 AND company_id = $8 RETURNING *`,
      [sku?.trim()||null, name?.trim()||null, barcode?.trim()||null, imageUrl||null,
       saleRate??null, isActive??null, variantId, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Variant not found');
    ApiResponse.success(res, result.rows[0], 'Variant updated');
  } catch (err) {
    if (err.code === '23505') return ApiResponse.conflict(res, 'SKU already exists');
    next(err);
  }
};

const deleteVariant = async (req, res, next) => {
  try {
    const { variantId } = req.params;
    const result = await query(
      `UPDATE product_variants SET is_active=FALSE, updated_at=NOW()
       WHERE id=$1 AND company_id=$2 RETURNING id`,
      [variantId, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Variant not found');
    ApiResponse.success(res, null, 'Variant deactivated');
  } catch (err) { next(err); }
};

// ─── VARIANT STOCK ───────────────────────────────────────────────────────────

const adjustVariantStock = async (req, res, next) => {
  try {
    const { variantId } = req.params;
    const { warehouseId, type, quantity, notes } = req.body;

    if (!warehouseId) return ApiResponse.badRequest(res, 'warehouseId required');
    if (!['add', 'deduct', 'set'].includes(type)) return ApiResponse.badRequest(res, 'type must be add|deduct|set');
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) return ApiResponse.badRequest(res, 'quantity must be >= 0');

    const variantCheck = await query(
      'SELECT id FROM product_variants WHERE id=$1 AND company_id=$2', [variantId, req.companyId]
    );
    if (!variantCheck.rows[0]) return ApiResponse.notFound(res, 'Variant not found');

    // Upsert variant stock row
    await query(
      `INSERT INTO product_variant_stock (variant_id, warehouse_id) VALUES ($1,$2)
       ON CONFLICT (variant_id, warehouse_id) DO NOTHING`,
      [variantId, warehouseId]
    );

    let setClause;
    if (type === 'add')    setClause = `current_stock = current_stock + $1`;
    if (type === 'deduct') setClause = `current_stock = GREATEST(0, current_stock - $1)`;
    if (type === 'set')    setClause = `current_stock = $1`;

    const result = await query(
      `UPDATE product_variant_stock SET ${setClause}
       WHERE variant_id = $2 AND warehouse_id = $3
       RETURNING *, GREATEST(0, current_stock - reserved_stock) AS available_stock`,
      [qty, variantId, warehouseId]
    );

    ApiResponse.success(res, result.rows[0], 'Variant stock adjusted');
  } catch (err) { next(err); }
};

// ─── BOM VARIANT OVERRIDES ───────────────────────────────────────────────────

const getBomOverrides = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const result = await query(
      `SELECT bvo.*, m.name AS material_name, m.code AS material_code, m.unit AS material_unit
       FROM bom_variant_overrides bvo
       JOIN bill_of_materials b ON b.id = bvo.bom_id AND b.product_id = $1 AND b.is_active = TRUE
       JOIN materials m ON m.id = bvo.material_id
       WHERE bvo.variant_id = $2`,
      [productId, variantId]
    );
    ApiResponse.success(res, result.rows);
  } catch (err) { next(err); }
};

const upsertBomOverride = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const { materialId, quantityPerUnit, wastePercentage = 0, notes } = req.body;

    if (!materialId || !quantityPerUnit) return ApiResponse.badRequest(res, 'materialId and quantityPerUnit required');

    const bomRes = await query(
      'SELECT id FROM bill_of_materials WHERE product_id=$1 AND is_active=TRUE',
      [productId]
    );
    if (!bomRes.rows[0]) return ApiResponse.notFound(res, 'No active BOM for this product');

    const result = await query(
      `INSERT INTO bom_variant_overrides (bom_id, variant_id, material_id, quantity_per_unit, waste_percentage, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (bom_id, variant_id, material_id) DO UPDATE SET
         quantity_per_unit = EXCLUDED.quantity_per_unit,
         waste_percentage  = EXCLUDED.waste_percentage,
         notes             = EXCLUDED.notes
       RETURNING *`,
      [bomRes.rows[0].id, variantId, materialId, quantityPerUnit, wastePercentage, notes||null]
    );
    ApiResponse.success(res, result.rows[0], 'BOM override saved');
  } catch (err) { next(err); }
};

// Generate all possible SKU combinations from selected attributes
const generateSkuCombinations = async (req, res, next) => {
  try {
    const { skuPrefix = '', attributes = [] } = req.body;
    // attributes: [{attributeId, valueIds: [...]}]

    if (!attributes.length) return ApiResponse.badRequest(res, 'attributes required');

    // Fetch attribute names and selected values
    const attrValuePairs = [];
    for (const attr of attributes) {
      const res2 = await query(
        `SELECT a.name AS attr_name, a.code AS attr_code,
                av.id AS value_id, av.value, av.display_name
         FROM product_attributes a
         JOIN product_attribute_values av ON av.attribute_id = a.id
         WHERE a.id = $1 AND a.company_id = $2 AND av.id = ANY($3::uuid[]) AND av.is_active = TRUE
         ORDER BY av.sort_order`,
        [attr.attributeId, req.companyId, attr.valueIds]
      );
      if (res2.rows.length) attrValuePairs.push(res2.rows);
    }

    // Cartesian product
    const cartesian = (arrays) => arrays.reduce(
      (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
      [[]]
    );

    const combinations = cartesian(attrValuePairs);
    const variants = combinations.map((combo) => {
      const suffix = combo.map((c) => c.value.toUpperCase().replace(/\s+/g, '')).join('-');
      const sku = skuPrefix ? `${skuPrefix}-${suffix}` : suffix;
      const name = combo.map((c) => c.display_name || c.value).join(' / ');
      const attributeValues = combo.map((c) => ({
        attribute_id:   c.value_id ? combo.find((x) => x.value_id === c.value_id)?.attr_code : null,
        attribute_name: c.attr_name,
        value_id:       c.value_id,
        value:          c.value,
        display_name:   c.display_name,
      }));
      return { sku, name, attributeValues };
    });

    ApiResponse.success(res, variants);
  } catch (err) { next(err); }
};

module.exports = {
  getAttributes, createAttribute, updateAttribute,
  addAttributeValue, updateAttributeValue, deleteAttributeValue,
  getVariants, createVariants, updateVariant, deleteVariant,
  adjustVariantStock,
  getBomOverrides, upsertBomOverride,
  generateSkuCombinations,
};
