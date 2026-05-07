const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

class PDFService {
  async generateInvoicePDF(invoice, company, items, customer) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const pageWidth = doc.page.width - 80;

        // Header with company logo
        if (company.logo_url) {
          try {
            doc.image(company.logo_url, 40, 40, { width: 80, height: 60 });
          } catch (_) {}
        }

        // Company details
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#1e40af');
        doc.text(company.name, 140, 45);
        doc.font('Helvetica').fontSize(9).fillColor('#374151');
        if (company.address_line1) doc.text(company.address_line1, 140, 67);
        if (company.city) doc.text(`${company.city}, ${company.state} - ${company.pincode}`, 140, 78);
        if (company.gst_number) doc.text(`GSTIN: ${company.gst_number}`, 140, 89);
        if (company.phone) doc.text(`Phone: ${company.phone}`, 140, 100);

        // Invoice title
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#1e40af');
        doc.text('TAX INVOICE', 0, 45, { align: 'right', width: doc.page.width - 40 });
        doc.font('Helvetica').fontSize(10).fillColor('#374151');
        doc.text(`Invoice No: ${invoice.invoice_number}`, 0, 75, { align: 'right', width: doc.page.width - 40 });
        doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}`, 0, 88, { align: 'right', width: doc.page.width - 40 });
        if (invoice.due_date) {
          doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-IN')}`, 0, 101, { align: 'right', width: doc.page.width - 40 });
        }

        // Divider
        doc.moveTo(40, 130).lineTo(doc.page.width - 40, 130).strokeColor('#e5e7eb').lineWidth(1).stroke();

        // Billing info
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('BILL TO', 40, 145);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(customer.name, 40, 157);
        doc.font('Helvetica').fontSize(9).fillColor('#374151');
        if (invoice.billing_address) doc.text(invoice.billing_address, 40, 170, { width: 220 });
        if (customer.gst_number) doc.text(`GSTIN: ${customer.gst_number}`, 40, 200);

        // QR Code
        const qrData = `INV:${invoice.invoice_number}|AMT:${invoice.net_amount}|DATE:${invoice.invoice_date}`;
        const qrBuffer = await QRCode.toBuffer(qrData, { width: 80, margin: 1 });
        doc.image(qrBuffer, doc.page.width - 120, 140, { width: 80, height: 80 });

        // Items table
        const tableTop = 240;
        this.drawTableHeader(doc, tableTop, pageWidth);

        let yPos = tableTop + 25;
        let slNo = 1;

        for (const item of items) {
          if (yPos > doc.page.height - 200) {
            doc.addPage();
            yPos = 50;
            this.drawTableHeader(doc, yPos, pageWidth);
            yPos += 25;
          }

          const rowHeight = 20;
          const isEven = slNo % 2 === 0;
          if (isEven) {
            doc.rect(40, yPos - 3, pageWidth, rowHeight).fillColor('#f9fafb').fill();
          }

          doc.font('Helvetica').fontSize(8).fillColor('#111827');
          doc.text(String(slNo), 40, yPos, { width: 25 });
          doc.text(item.description, 65, yPos, { width: 180 });
          doc.text(item.hsn_code || '', 245, yPos, { width: 55 });
          doc.text(`${item.quantity} ${item.unit}`, 300, yPos, { width: 60 });
          doc.text(Number(item.rate).toFixed(2), 360, yPos, { width: 55, align: 'right' });
          doc.text(`${item.gst_percent || 0}%`, 415, yPos, { width: 40, align: 'center' });
          doc.text(Number(item.amount).toFixed(2), 455, yPos, { width: 60, align: 'right' });

          yPos += rowHeight;
          slNo++;
        }

        // Table bottom border
        doc.moveTo(40, yPos).lineTo(doc.page.width - 40, yPos).strokeColor('#d1d5db').lineWidth(0.5).stroke();
        yPos += 15;

        // Totals
        this.drawTotals(doc, invoice, yPos, pageWidth);

        // Bank details
        const bankY = doc.page.height - 200;
        if (company.bank_name) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text('Bank Details:', 40, bankY);
          doc.font('Helvetica').fontSize(8).fillColor('#374151');
          doc.text(`Bank: ${company.bank_name}`, 40, bankY + 14);
          doc.text(`A/C No: ${company.bank_account_number}`, 40, bankY + 26);
          doc.text(`IFSC: ${company.bank_ifsc}`, 40, bankY + 38);
          if (company.bank_branch) doc.text(`Branch: ${company.bank_branch}`, 40, bankY + 50);
        }

        // Terms
        if (invoice.terms_conditions) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text('Terms & Conditions:', 200, bankY);
          doc.font('Helvetica').fontSize(8).fillColor('#374151').text(invoice.terms_conditions, 200, bankY + 14, { width: 200 });
        }

        // Signature
        doc.font('Helvetica').fontSize(9).fillColor('#374151');
        doc.text(`For ${company.name}`, doc.page.width - 180, bankY + 20, { align: 'center', width: 140 });
        doc.moveTo(doc.page.width - 180, bankY + 80).lineTo(doc.page.width - 40, bankY + 80).strokeColor('#374151').lineWidth(0.5).stroke();
        doc.text('Authorised Signatory', doc.page.width - 180, bankY + 85, { align: 'center', width: 140 });

        // Footer
        doc.fontSize(8).fillColor('#9ca3af').text(
          'This is a computer-generated invoice.',
          40, doc.page.height - 40, { align: 'center', width: pageWidth }
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  drawTableHeader(doc, yPos, pageWidth) {
    doc.rect(40, yPos - 3, pageWidth, 22).fillColor('#1e40af').fill();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    doc.text('#', 40, yPos, { width: 25 });
    doc.text('Description', 65, yPos, { width: 180 });
    doc.text('HSN', 245, yPos, { width: 55 });
    doc.text('Qty/Unit', 300, yPos, { width: 60 });
    doc.text('Rate', 360, yPos, { width: 55, align: 'right' });
    doc.text('GST%', 415, yPos, { width: 40, align: 'center' });
    doc.text('Amount', 455, yPos, { width: 60, align: 'right' });
  }

  drawTotals(doc, invoice, yPos, pageWidth) {
    const rightCol = doc.page.width - 40;
    const labelX = rightCol - 200;
    const valueX = rightCol - 80;

    const rows = [
      ['Subtotal', Number(invoice.subtotal).toFixed(2)],
      invoice.discount_amount > 0 ? ['Discount', `-${Number(invoice.discount_amount).toFixed(2)}`] : null,
      ['Taxable Amount', Number(invoice.taxable_amount).toFixed(2)],
      invoice.cgst_amount > 0 ? ['CGST', Number(invoice.cgst_amount).toFixed(2)] : null,
      invoice.sgst_amount > 0 ? ['SGST', Number(invoice.sgst_amount).toFixed(2)] : null,
      invoice.igst_amount > 0 ? ['IGST', Number(invoice.igst_amount).toFixed(2)] : null,
      invoice.round_off ? ['Round Off', Number(invoice.round_off).toFixed(2)] : null,
    ].filter(Boolean);

    rows.forEach(([label, value]) => {
      doc.font('Helvetica').fontSize(9).fillColor('#374151');
      doc.text(label, labelX, yPos, { width: 100 });
      doc.text(`₹ ${value}`, valueX, yPos, { width: 80, align: 'right' });
      yPos += 16;
    });

    // Total row
    doc.rect(labelX - 10, yPos - 3, 200, 22).fillColor('#1e40af').fill();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff');
    doc.text('TOTAL', labelX, yPos, { width: 100 });
    doc.text(`₹ ${Number(invoice.net_amount).toFixed(2)}`, valueX, yPos, { width: 80, align: 'right' });
  }
}

module.exports = new PDFService();
