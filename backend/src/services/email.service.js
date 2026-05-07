const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async send({ to, subject, html, text }) {
    try {
      await this.transporter.sendMail({
        from: `"${process.env.APP_NAME || 'IndustrialERP'}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text,
      });
      logger.info(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      logger.error('Email send failed:', { to, subject, error: error.message });
    }
  }

  async sendPasswordReset(email, name, resetUrl) {
    await this.send({
      to: email,
      subject: 'Password Reset Request - IndustrialERP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">Password Reset</h2>
          <p>Hello ${name},</p>
          <p>You requested a password reset. Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #1e40af; color: white;
             padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Reset Password
          </a>
          <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
          <p>— IndustrialERP Team</p>
        </div>
      `,
    });
  }

  async sendWelcome(email, name, companyName) {
    await this.send({
      to: email,
      subject: `Welcome to IndustrialERP - ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">Welcome to IndustrialERP!</h2>
          <p>Hello ${name},</p>
          <p>Your company <strong>${companyName}</strong> has been registered successfully.</p>
          <p>You can now log in and start managing your operations.</p>
          <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; background: #1e40af;
             color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Login to ERP
          </a>
          <p>— IndustrialERP Team</p>
        </div>
      `,
    });
  }

  async sendLowStockAlert(email, materials, companyName) {
    const materialList = materials
      .map((m) => `<li>${m.name} (${m.code}) - Current: ${m.current_stock} ${m.unit}, Min: ${m.minimum_stock} ${m.unit}</li>`)
      .join('');

    await this.send({
      to: email,
      subject: `Low Stock Alert - ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Low Stock Alert</h2>
          <p>The following materials are at or below minimum stock levels:</p>
          <ul>${materialList}</ul>
          <a href="${process.env.FRONTEND_URL}/materials" style="display: inline-block; background: #dc2626;
             color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Stock
          </a>
          <p>— IndustrialERP System</p>
        </div>
      `,
    });
  }

  async sendNotification(email, name, title, message, actionUrl) {
    await this.send({
      to: email,
      subject: `${title} - IndustrialERP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">${title}</h2>
          <p>Hello ${name},</p>
          <p>${message}</p>
          ${actionUrl ? `<a href="${actionUrl}" style="display: inline-block; background: #1e40af;
            color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Details</a>` : ''}
          <p>— IndustrialERP System</p>
        </div>
      `,
    });
  }
}

module.exports = new EmailService();
