const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');
const pdfService = require('../services/pdf.service');
const excelService = require('../services/excel.service');
const QRCode = require('qrcode');

const getAll = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, status, paymentStatus, startDate, endDate, customerId } = req.query;

    let where = 'WHERE i.company_id = $1 AND i.deleted_at IS NULL';
    const params = [companyId];
    let idx = 2;

    if (search) { where += ` AND i.invoice_number ILIKE $${idx}`; params.push(`%${search}%`); idx++; }
    if (status) { where += ` AND i.status = $${idx}`; params.push(status); idx++; }
    if (paymentStatus) { where += ` AND i.payment_status = $${idx}`; params.push(paymentStatus); idx++; }
    if (customerId) { where += ` AND i.customer_id = $${idx}`; params.push(customerId); idx++; }
    if (startDate) { where += ` AND i.invoice_date >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { where += ` AND i.invoice_date <= $${idx}`; params.push(endDate); idx++; }

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT i.*, c.name AS customer_name, c.gst_number AS customer_gst
         FROM invoices i
         LEFT JOIN customers c ON i.customer_id = c.id
         ${where}
         ORDER BY i.invoice_date DESC, i.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM invoices i ${where}`, params),
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

    const [invoiceRes, items, payments] = await Promise.all([
      query(
        `SELECT i.*, c.name AS customer_name, c.gst_number AS customer_gst,
                c.address_line1 AS customer_address, c.city AS customer_city,
                c.state AS customer_state, c.pincode AS customer_pincode
         FROM invoices i
         LEFT JOIN customers c ON i.customer_id = c.id
         WHERE i.id = $1 AND i.company_id = $2 AND i.deleted_at IS NULL`,
        [id, companyId]
      ),
      query(
        `SELECT ii.*, m.name AS material_name, m.code AS material_code
         FROM invoice_items ii
         LEFT JOIN materials m ON ii.material_id = m.id
         WHERE ii.invoice_id = $1
         ORDER BY ii.sequence_order`,
        [id]
      ),
      query(
        `SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date DESC`,
        [id]
      ),
    ]);

    if (!invoiceRes.rows[0]) return ApiResponse.notFound(res, 'Invoice not found');
    ApiResponse.success(res, { ...invoiceRes.rows[0], items: items.rows, payments: payments.rows });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const {
      customerId, salesOrderId, dispatchId, invoiceDate, dueDate, paymentTerms,
      billingAddress, shippingAddress, discountAmount, termsConditions,
      notes, items, isInterState,
    } = req.body;

    const companyRes = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
    const company = companyRes.rows[0];
    const invoiceNumber = `${company.invoice_prefix}-${String(company.invoice_counter).padStart(6, '0')}`;
    await query('UPDATE companies SET invoice_counter = invoice_counter + 1 WHERE id = $1', [companyId]);

    // Calculate totals
    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const processedItems = items.map((item, idx) => {
      const taxableAmt = parseFloat(item.rate) * parseFloat(item.quantity) - parseFloat(item.discountAmount || 0);
      const gstAmt = (taxableAmt * parseFloat(item.gstPercent || 0)) / 100;
      const cgst = isInterState ? 0 : gstAmt / 2;
      const sgst = isInterState ? 0 : gstAmt / 2;
      const igst = isInterState ? gstAmt : 0;
      const amount = taxableAmt + gstAmt;

      subtotal += parseFloat(item.rate) * parseFloat(item.quantity);
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;

      return { ...item, taxableAmt, cgst, sgst, igst, gstAmt, amount, seqOrder: idx + 1 };
    });

    const taxableAmount = subtotal - parseFloat(discountAmount || 0);
    const totalTax = cgstTotal + sgstTotal + igstTotal;
    const netAmount = taxableAmount + totalTax;
    const roundOff = Math.round(netAmount) - netAmount;
    const finalAmount = Math.round(netAmount);

    const qrData = `INV:${invoiceNumber}|AMT:${finalAmount}|DATE:${invoiceDate}|GSTIN:${company.gst_number || ''}`;
    const qrCode = await QRCode.toDataURL(qrData);

    const result = await transaction(async (client) => {
      const inv = await client.query(
        `INSERT INTO invoices (
          company_id, invoice_number, customer_id, sales_order_id, dispatch_id,
          invoice_date, due_date, payment_terms, billing_address, shipping_address,
          subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount,
          total_tax_amount, round_off, net_amount, balance_amount, payment_status,
          status, terms_conditions, notes, qr_code, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,'unpaid','draft',$20,$21,$22,$23)
        RETURNING *`,
        [
          companyId, invoiceNumber, customerId || null, salesOrderId || null, dispatchId || null,
          invoiceDate || new Date(), dueDate || null, paymentTerms || null,
          billingAddress || null, shippingAddress || null,
          subtotal, parseFloat(discountAmount || 0), taxableAmount,
          cgstTotal, sgstTotal, igstTotal, totalTax, roundOff, finalAmount,
          termsConditions || null, notes || null, qrCode, req.user.id,
        ]
      );

      const invId = inv.rows[0].id;

      for (const item of processedItems) {
        await client.query(
          `INSERT INTO invoice_items (
            invoice_id, material_id, description, hsn_code, quantity, unit,
            rate, discount_amount, taxable_amount, gst_percent,
            cgst_percent, sgst_percent, igst_percent, tax_amount, amount, sequence_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            invId, item.materialId || null, item.description, item.hsnCode || null,
            item.quantity, item.unit || 'piece', item.rate, item.discountAmount || 0,
            item.taxableAmt, item.gstPercent || 0,
            isInterState ? 0 : (item.gstPercent || 0) / 2,
            isInterState ? 0 : (item.gstPercent || 0) / 2,
            isInterState ? (item.gstPercent || 0) : 0,
            item.gstAmt, item.amount, item.seqOrder,
          ]
        );
      }

      return inv.rows[0];
    });

    ApiResponse.created(res, result, 'Invoice created successfully');
  } catch (error) {
    next(error);
  }
};

const generatePDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const [invoiceRes, itemsRes, companyRes] = await Promise.all([
      query(`SELECT i.*, c.name AS customer_name, c.gst_number AS customer_gst,
              c.address_line1 AS customer_address FROM invoices i
              LEFT JOIN customers c ON i.customer_id = c.id
              WHERE i.id = $1 AND i.company_id = $2 AND i.deleted_at IS NULL`, [id, companyId]),
      query(`SELECT ii.*, m.name AS material_name FROM invoice_items ii
              LEFT JOIN materials m ON ii.material_id = m.id
              WHERE ii.invoice_id = $1 ORDER BY ii.sequence_order`, [id]),
      query('SELECT * FROM companies WHERE id = $1', [companyId]),
    ]);

    if (!invoiceRes.rows[0]) return ApiResponse.notFound(res, 'Invoice not found');

    const invoice = invoiceRes.rows[0];
    const customer = { name: invoice.customer_name, gst_number: invoice.customer_gst, address_line1: invoice.customer_address };

    const pdfBuffer = await pdfService.generateInvoicePDF(invoice, companyRes.rows[0], itemsRes.rows, customer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${invoice.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

const updatePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paidAmount } = req.body;

    const invRes = await query('SELECT net_amount, paid_amount FROM invoices WHERE id = $1 AND company_id = $2', [id, req.companyId]);
    if (!invRes.rows[0]) return ApiResponse.notFound(res, 'Invoice not found');

    const inv = invRes.rows[0];
    const newPaid = parseFloat(inv.paid_amount) + parseFloat(paidAmount);
    const balance = parseFloat(inv.net_amount) - newPaid;
    const paymentStatus = balance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    await query(
      `UPDATE invoices SET paid_amount = $1, balance_amount = $2, payment_status = $3 WHERE id = $4`,
      [newPaid, Math.max(0, balance), paymentStatus, id]
    );

    ApiResponse.success(res, { paidAmount: newPaid, balance: Math.max(0, balance), paymentStatus }, 'Payment updated');
  } catch (error) {
    next(error);
  }
};

const exportInvoices = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT i.*, c.name AS customer_name FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.company_id = $1 AND i.deleted_at IS NULL
       ORDER BY i.invoice_date DESC`,
      [req.companyId]
    );
    const wb = excelService.exportInvoices(result.rows);
    const buffer = excelService.toBuffer(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const addPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paymentDate, paymentMode = 'bank_transfer', reference = '', notes = '' } = req.body;
    const { v4: uuidv4 } = require('uuid');

    const invRes = await query('SELECT net_amount, paid_amount FROM invoices WHERE id = $1 AND company_id = $2', [id, req.companyId]);
    if (!invRes.rows[0]) return ApiResponse.notFound(res, 'Invoice not found');

    const inv = invRes.rows[0];
    const newPaid = parseFloat(inv.paid_amount) + parseFloat(amount);
    const balance = parseFloat(inv.net_amount) - newPaid;
    const paymentStatus = balance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    await query(
      `INSERT INTO invoice_payments (id, invoice_id, amount, payment_date, payment_mode, reference_number, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuidv4(), id, amount, paymentDate, paymentMode, reference, notes]
    );

    await query(
      `UPDATE invoices SET paid_amount = $1, balance_amount = $2, payment_status = $3 WHERE id = $4`,
      [newPaid, Math.max(0, balance), paymentStatus, id]
    );

    ApiResponse.success(res, { paidAmount: newPaid, balance: Math.max(0, balance), paymentStatus }, 'Payment recorded');
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getOne, create, generatePDF, updatePayment, addPayment, exportInvoices };
