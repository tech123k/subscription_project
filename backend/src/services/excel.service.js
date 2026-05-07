const XLSX = require('xlsx');
const { AppError } = require('../middleware/errorHandler');

class ExcelService {
  generateWorkbook(sheetData) {
    const wb = XLSX.utils.book_new();
    Object.entries(sheetData).forEach(([name, data]) => {
      const ws = XLSX.utils.json_to_sheet(data);
      this.autoFitColumns(ws, data);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    });
    return wb;
  }

  autoFitColumns(ws, data) {
    if (!data.length) return;
    const colWidths = {};
    const headers = Object.keys(data[0]);
    headers.forEach((h) => {
      colWidths[h] = Math.max(h.length, ...data.map((r) => String(r[h] || '').length));
    });
    ws['!cols'] = headers.map((h) => ({ wch: Math.min(colWidths[h] + 2, 50) }));
  }

  toBuffer(workbook) {
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  parseFile(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  }

  generateMaterialTemplate() {
    const template = [
      {
        'Material Name*': 'Sample Material',
        'Material Code*': 'MAT-001',
        'Category': 'Raw Materials',
        'Unit*': 'kg',
        'HSN Code': '72041000',
        'GST %': '18',
        'Purchase Rate': '100',
        'Sale Rate': '150',
        'Opening Stock': '500',
        'Minimum Stock': '50',
        'Reorder Level': '100',
        'Reorder Quantity': '200',
        'Lead Time (Days)': '7',
        'Supplier Code': 'SUP-001',
        'Warehouse Code': 'WH-01',
        'Description': 'Sample description',
      },
    ];
    return this.generateWorkbook({ 'Materials': template });
  }

  generateGRNTemplate() {
    const template = [
      {
        'Supplier Code*': 'SUP-001',
        'Supplier Invoice No*': 'INV-2024-001',
        'Supplier Invoice Date*': '2024-01-15',
        'Vehicle No': 'MH-01-AB-1234',
        'Material Code*': 'MAT-001',
        'Received Quantity*': '100',
        'Unit*': 'kg',
        'Rate': '100',
        'Batch No': 'BATCH-001',
        'Warehouse Code': 'WH-01',
      },
    ];
    return this.generateWorkbook({ 'GRN Items': template });
  }

  validateMaterialRow(row, index) {
    const errors = [];
    if (!row['Material Name*']) errors.push(`Row ${index}: Material Name is required`);
    if (!row['Material Code*']) errors.push(`Row ${index}: Material Code is required`);
    if (!row['Unit*']) errors.push(`Row ${index}: Unit is required`);

    const validUnits = ['kg', 'gm', 'ton', 'litre', 'ml', 'meter', 'feet', 'inch', 'piece', 'box', 'carton', 'dozen', 'pair', 'set', 'roll', 'sheet'];
    if (row['Unit*'] && !validUnits.includes(row['Unit*'].toLowerCase())) {
      errors.push(`Row ${index}: Invalid unit '${row['Unit*']}'`);
    }

    if (row['GST %'] && (isNaN(row['GST %']) || parseFloat(row['GST %']) < 0 || parseFloat(row['GST %']) > 100)) {
      errors.push(`Row ${index}: GST % must be between 0 and 100`);
    }

    return errors;
  }

  exportMaterials(materials) {
    const data = materials.map((m) => ({
      'Code': m.code,
      'Name': m.name,
      'Category': m.category_name || '',
      'Unit': m.unit,
      'HSN Code': m.hsn_code || '',
      'GST %': m.gst_percent,
      'Purchase Rate': m.purchase_rate,
      'Sale Rate': m.sale_rate,
      'Current Stock': m.current_stock,
      'Reserved Stock': m.reserved_stock,
      'Minimum Stock': m.minimum_stock,
      'Reorder Level': m.reorder_level,
      'Warehouse': m.warehouse_name || '',
      'Supplier': m.supplier_name || '',
      'Is Active': m.is_active ? 'Yes' : 'No',
      'Created At': m.created_at ? new Date(m.created_at).toLocaleDateString() : '',
    }));
    return this.generateWorkbook({ 'Materials': data });
  }

  exportProductionOrders(orders) {
    const data = orders.map((o) => ({
      'Order Number': o.order_number,
      'Product': o.product_name,
      'Customer': o.customer_name || '',
      'Status': o.status,
      'Priority': o.priority,
      'Planned Qty': o.planned_quantity,
      'Produced Qty': o.produced_quantity,
      'Rejected Qty': o.rejected_quantity,
      'Current Stage': o.current_stage_name || '',
      'Planned Start': o.planned_start_date ? new Date(o.planned_start_date).toLocaleDateString() : '',
      'Planned End': o.planned_end_date ? new Date(o.planned_end_date).toLocaleDateString() : '',
      'Is Delayed': o.is_delayed ? 'Yes' : 'No',
    }));
    return this.generateWorkbook({ 'Production Orders': data });
  }

  exportInvoices(invoices) {
    const data = invoices.map((i) => ({
      'Invoice Number': i.invoice_number,
      'Customer': i.customer_name || '',
      'Invoice Date': i.invoice_date ? new Date(i.invoice_date).toLocaleDateString() : '',
      'Due Date': i.due_date ? new Date(i.due_date).toLocaleDateString() : '',
      'Subtotal': i.subtotal,
      'Tax Amount': i.total_tax_amount,
      'Net Amount': i.net_amount,
      'Paid Amount': i.paid_amount,
      'Balance': i.balance_amount,
      'Payment Status': i.payment_status,
      'Status': i.status,
    }));
    return this.generateWorkbook({ 'Invoices': data });
  }

  exportDispatches(dispatches) {
    const data = dispatches.map((d) => ({
      'Dispatch Number': d.dispatch_number,
      'Customer': d.customer_name || '',
      'Invoice Number': d.invoice_number || '',
      'Vehicle Number': d.vehicle_number || '',
      'Transport': d.transport_name || '',
      'Driver': d.driver_name || '',
      'LR Number': d.lr_number || '',
      'Dispatch Date': d.dispatch_date ? new Date(d.dispatch_date).toLocaleDateString() : '',
      'Expected Delivery': d.expected_delivery_date ? new Date(d.expected_delivery_date).toLocaleDateString() : '',
      'Status': d.status,
      'Destination City': d.destination_city || '',
      'Is Delayed': d.is_delayed ? 'Yes' : 'No',
    }));
    return this.generateWorkbook({ 'Dispatches': data });
  }

  exportStockTransactions(transactions) {
    const data = transactions.map((t) => ({
      'Date': t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
      'Material': t.material_name,
      'Material Code': t.material_code,
      'Type': t.transaction_type,
      'Stock Type': t.stock_type,
      'Quantity': t.quantity,
      'Rate': t.rate || '',
      'Amount': t.amount || '',
      'Reference': t.reference_number || '',
      'Reference Type': t.reference_type || '',
      'Warehouse': t.warehouse_name || '',
      'Performed By': t.user_name || '',
      'Notes': t.notes || '',
    }));
    return this.generateWorkbook({ 'Stock Transactions': data });
  }
}

module.exports = new ExcelService();
