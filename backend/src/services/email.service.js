const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool:           true,
      maxConnections: 1,
      maxMessages:    5,
      connectionTimeout: 10000,
      greetingTimeout:   10000,
      socketTimeout:     10000,
    });

    this.transporter.verify((err, success) => {
      if (err) {
        console.error('SMTP VERIFY ERROR:', err);
        logger.error('SMTP ERROR:', err.message);
      } else {
        console.log('SMTP VERIFY SUCCESS');
        logger.info('SMTP READY');
      }
    });
  }

  async send({ to, subject, html, text }) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'IndustrialERP'}" <${from}>`,
      to, subject, html, text,
    };

    console.log('SMTP SENDING...');

    const mailPromise = this.transporter.sendMail(mailOptions);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SMTP Timeout after 15 seconds')), 15000)
    );

    await Promise.race([mailPromise, timeoutPromise]);

    console.log('SMTP SUCCESS');
    logger.info(`Email sent to ${to}: ${subject}`);
  }

  async sendSilent(opts) {
    try {
      await this.send(opts);
    } catch (err) {
      console.error('SMTP FULL ERROR:', err);
      console.error('SMTP MESSAGE:', err.message);
      console.error('SMTP STACK:', err.stack);
      logger.error('Email send failed (non-critical):', { to: opts.to, error: err.message });
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
    await this.sendSilent({
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

    await this.sendSilent({
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

  async sendOTP(email, name, otp) {
    console.log('SEND OTP START');
    console.log('EMAIL:', email);
    await this.send({
      to: email,
      subject: `${otp} — Your IndustrialERP Verification Code`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;background:#1e40af;padding:12px 20px;border-radius:8px;">
              <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">IndustrialERP</span>
            </div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:28px 24px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Email Verification</h2>
            <p style="color:#475569;margin:0 0 24px;font-size:14px;">Hello <strong>${name}</strong>, use the OTP below to complete your registration.</p>
            <div style="background:#eff6ff;border:2px dashed #93c5fd;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
              <span style="font-size:38px;font-weight:800;color:#1e40af;letter-spacing:12px;">${otp}</span>
            </div>
            <p style="color:#64748b;font-size:13px;margin:0;">This OTP is valid for <strong>10 minutes</strong>.<br>Do not share it with anyone.</p>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `Your IndustrialERP OTP is: ${otp}. Valid for 10 minutes.`,
    });
  }

  async sendNotification(email, name, title, message, actionUrl) {
    await this.sendSilent({
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
