const https = require('https');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const USE_RESEND  = !!process.env.RESEND_API_KEY;
const USE_MAILJET = !USE_RESEND && (process.env.SMTP_HOST || '').includes('mailjet');

// Resend HTTP API — most reliable for cloud deployments
const resendSend = ({ to, subject, html, text, fromName }) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from:    `${fromName} <onboarding@resend.dev>`,
      to:      [to],
      subject,
      html,
      text:    text || '',
    });
    const req = https.request(
      {
        hostname: 'api.resend.com',
        path:     '/emails',
        method:   'POST',
        headers:  {
          Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(`Resend ${res.statusCode}: ${data}`));
          else resolve(JSON.parse(data));
        });
      }
    );
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Resend API timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

class EmailService {
  constructor() {
    if (!USE_MAILJET) {
      // Local dev: use Gmail SMTP
      this.transporter = nodemailer.createTransport({
        host:       process.env.SMTP_HOST || 'smtp.gmail.com',
        port:       parseInt(process.env.SMTP_PORT) || 587,
        secure:     false,
        requireTLS: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout:   10000,
        socketTimeout:     15000,
      });
    }
  }

  // send() throws on failure — callers decide whether to swallow or propagate
  async send({ to, subject, html, text }) {
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName  = process.env.APP_NAME  || 'IndustrialERP';

    if (USE_RESEND) {
      await resendSend({ to, subject, html, text, fromName });
    } else if (USE_MAILJET) {
      await mailjetSend({ to, subject, html, text, fromEmail, fromName });
    } else {
      const sendMail = this.transporter.sendMail.bind(this.transporter, {
        from: `"${fromName}" <${fromEmail}>`, to, subject, html, text,
      });
      await Promise.race([
        new Promise((resolve, reject) =>
          sendMail((err, info) => (err ? reject(err) : resolve(info)))
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SMTP timeout after 20s')), 20000)
        ),
      ]);
    }
    logger.info(`Email sent to ${to}: ${subject}`);
  }

  // silent wrapper for non-critical emails (low-stock alerts, welcome, etc.)
  async sendSilent(opts) {
    try {
      await this.send(opts);
    } catch (err) {
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
