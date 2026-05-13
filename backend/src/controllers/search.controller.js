const { query } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');

const globalSearch = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 10);

    if (q.length < 2) {
      return ApiResponse.success(res, {
        materials: [], customers: [], suppliers: [],
        invoices: [], dispatches: [], products: [],
        warehouses: [], purchaseOrders: [],
      }, 'Search results');
    }

    const like = `%${q}%`;

    const [
      matsRes, custsRes, suppsRes, invsRes,
      dispsRes, prodsRes, whsRes, posRes,
    ] = await Promise.all([

      query(
        `SELECT id, name, code, current_stock, unit
         FROM materials
         WHERE company_id = $1 AND deleted_at IS NULL
           AND (name ILIKE $2 OR code ILIKE $2)
         ORDER BY name LIMIT $3`,
        [companyId, like, limit]
      ),

      query(
        `SELECT id, name, email, phone
         FROM customers
         WHERE company_id = $1 AND deleted_at IS NULL
           AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)
         ORDER BY name LIMIT $3`,
        [companyId, like, limit]
      ),

      query(
        `SELECT id, name, email, phone
         FROM suppliers
         WHERE company_id = $1 AND deleted_at IS NULL
           AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)
         ORDER BY name LIMIT $3`,
        [companyId, like, limit]
      ),

      query(
        `SELECT i.id, i.invoice_number, i.status, i.total_amount, c.name AS customer_name
         FROM invoices i
         LEFT JOIN customers c ON i.customer_id = c.id
         WHERE i.company_id = $1 AND i.deleted_at IS NULL
           AND (i.invoice_number ILIKE $2 OR c.name ILIKE $2)
         ORDER BY i.created_at DESC LIMIT $3`,
        [companyId, like, limit]
      ),

      query(
        `SELECT d.id, d.dispatch_number, d.status, c.name AS customer_name
         FROM dispatches d
         LEFT JOIN sales_orders so ON d.sales_order_id = so.id
         LEFT JOIN customers c ON so.customer_id = c.id
         WHERE d.company_id = $1 AND d.deleted_at IS NULL
           AND (d.dispatch_number ILIKE $2 OR c.name ILIKE $2)
         ORDER BY d.created_at DESC LIMIT $3`,
        [companyId, like, limit]
      ),

      query(
        `SELECT id, name, code
         FROM products
         WHERE company_id = $1 AND deleted_at IS NULL
           AND (name ILIKE $2 OR code ILIKE $2)
         ORDER BY name LIMIT $3`,
        [companyId, like, limit]
      ),

      query(
        `SELECT id, name, location
         FROM warehouses
         WHERE company_id = $1 AND deleted_at IS NULL
           AND (name ILIKE $2 OR location ILIKE $2)
         ORDER BY name LIMIT $3`,
        [companyId, like, limit]
      ),

      query(
        `SELECT po.id, po.po_number, po.status, s.name AS supplier_name
         FROM purchase_orders po
         LEFT JOIN suppliers s ON po.supplier_id = s.id
         WHERE po.company_id = $1 AND po.deleted_at IS NULL
           AND (po.po_number ILIKE $2 OR s.name ILIKE $2)
         ORDER BY po.created_at DESC LIMIT $3`,
        [companyId, like, limit]
      ),
    ]);

    ApiResponse.success(res, {
      materials: matsRes.rows.map(r => ({
        id: r.id,
        type: 'material',
        label: r.name,
        sublabel: [r.code, r.current_stock != null ? `${r.current_stock} ${r.unit || ''}`.trim() : null].filter(Boolean).join(' · '),
        path: `/materials/${r.id}`,
      })),
      customers: custsRes.rows.map(r => ({
        id: r.id,
        type: 'customer',
        label: r.name,
        sublabel: r.email || r.phone || '',
        path: `/customers/${r.id}`,
      })),
      suppliers: suppsRes.rows.map(r => ({
        id: r.id,
        type: 'supplier',
        label: r.name,
        sublabel: r.email || r.phone || '',
        path: `/suppliers/${r.id}`,
      })),
      invoices: invsRes.rows.map(r => ({
        id: r.id,
        type: 'invoice',
        label: r.invoice_number,
        sublabel: [r.customer_name, r.status].filter(Boolean).join(' · '),
        path: `/invoices/${r.id}`,
      })),
      dispatches: dispsRes.rows.map(r => ({
        id: r.id,
        type: 'dispatch',
        label: r.dispatch_number,
        sublabel: [r.customer_name, r.status].filter(Boolean).join(' · '),
        path: `/dispatches/${r.id}`,
      })),
      products: prodsRes.rows.map(r => ({
        id: r.id,
        type: 'product',
        label: r.name,
        sublabel: r.code || '',
        path: `/production/products/${r.id}`,
      })),
      warehouses: whsRes.rows.map(r => ({
        id: r.id,
        type: 'warehouse',
        label: r.name,
        sublabel: r.location || '',
        path: `/warehouses/${r.id}`,
      })),
      purchaseOrders: posRes.rows.map(r => ({
        id: r.id,
        type: 'purchaseOrder',
        label: r.po_number,
        sublabel: [r.supplier_name, r.status].filter(Boolean).join(' · '),
        path: `/po/${r.id}`,
      })),
    }, 'Search results');
  } catch (error) {
    next(error);
  }
};

module.exports = { globalSearch };
