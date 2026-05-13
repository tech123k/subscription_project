const { query } = require('../config/database');
const emailService = require('./email.service');
const logger = require('../utils/logger');

// Simple in-memory cache: key = `${userId}:${companyId}`, value = { count, expiresAt }
const countCache = new Map();
const CACHE_TTL = 45 * 1000; // 45 seconds

class NotificationService {
  constructor() {
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  async create({ companyId, userId, type, title, message, referenceType, referenceId, priority = 'normal', metadata = {} }) {
    const result = await query(
      `INSERT INTO notifications (company_id, user_id, type, title, message, reference_type, reference_id, priority, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [companyId, userId, type, title, message, referenceType, referenceId, priority, metadata]
    );

    const notification = result.rows[0];

    if (this.io && userId) {
      this.io.to(`user:${userId}`).emit('notification', notification);
    }

    if (this.io && companyId && !userId) {
      this.io.to(`company:${companyId}`).emit('notification', notification);
    }

    return notification;
  }

  async broadcastToCompany(companyId, { type, title, message, referenceType, referenceId, priority = 'normal', metadata = {}, excludeUserId = null }) {
    const usersResult = await query(
      `SELECT id, email, first_name, notification_preferences FROM users
       WHERE company_id = $1 AND is_active = TRUE AND deleted_at IS NULL
       ${excludeUserId ? 'AND id != $2' : ''}`,
      excludeUserId ? [companyId, excludeUserId] : [companyId]
    );

    const notifications = [];
    for (const user of usersResult.rows) {
      const n = await this.create({
        companyId,
        userId: user.id,
        type,
        title,
        message,
        referenceType,
        referenceId,
        priority,
        metadata,
      });
      notifications.push(n);

      const prefs = user.notification_preferences || {};
      if (prefs.email && priority === 'high') {
        setImmediate(() => {
          emailService.sendNotification(user.email, user.first_name, title, message, null).catch(() => {});
        });
      }
    }

    return notifications;
  }

  async notifyDepartment(companyId, department, notificationData) {
    const usersResult = await query(
      `SELECT id FROM users WHERE company_id = $1 AND department = $2 AND is_active = TRUE AND deleted_at IS NULL`,
      [companyId, department]
    );

    for (const user of usersResult.rows) {
      await this.create({ ...notificationData, companyId, userId: user.id });
    }
  }

  async markAsRead(notificationId, userId, companyId) {
    const result = await query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING id, user_id`,
      [notificationId, userId]
    );
    if (result.rows[0] && companyId) this.invalidateCountCache(userId, companyId);
    return result.rows[0];
  }

  async markAllAsRead(userId, companyId) {
    await query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND company_id = $2 AND is_read = FALSE`,
      [userId, companyId]
    );
    this.invalidateCountCache(userId, companyId);
  }

  async getUserNotifications(userId, companyId, { page = 1, limit = 20, unreadOnly = false }) {
    const offset = (page - 1) * limit;
    const whereUnread = unreadOnly ? 'AND is_read = FALSE' : '';

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT * FROM notifications WHERE user_id = $1 AND company_id = $2 ${whereUnread}
         ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [userId, companyId, limit, offset]
      ),
      query(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND company_id = $2 ${whereUnread}`,
        [userId, companyId]
      ),
    ]);

    return { data: dataResult.rows, total: parseInt(countResult.rows[0].count) };
  }

  async getUnreadCount(userId, companyId) {
    const key = `${userId}:${companyId}`;
    const cached = countCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.count;

    const result = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND company_id = $2 AND is_read = FALSE',
      [userId, companyId]
    );
    const count = parseInt(result.rows[0].count);
    countCache.set(key, { count, expiresAt: Date.now() + CACHE_TTL });
    return count;
  }

  invalidateCountCache(userId, companyId) {
    countCache.delete(`${userId}:${companyId}`);
  }

  async checkLowStock(companyId) {
    const result = await query(
      `SELECT id, name, code, current_stock, minimum_stock, unit FROM materials
       WHERE company_id = $1 AND current_stock <= minimum_stock AND is_active = TRUE AND deleted_at IS NULL`,
      [companyId]
    );

    if (result.rows.length > 0) {
      await this.broadcastToCompany(companyId, {
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${result.rows.length} material(s) are at or below minimum stock level`,
        priority: 'high',
        metadata: { materials: result.rows },
      });
    }
  }

  async notifyWorkflowStage(companyId, stageId, productionOrderId, orderNumber) {
    const stageResult = await query(
      'SELECT name, department, notify_on_complete FROM workflow_stages WHERE id = $1',
      [stageId]
    );
    const stage = stageResult.rows[0];
    if (!stage || !stage.department) return;

    await this.notifyDepartment(companyId, stage.department, {
      type: 'workflow_stage',
      title: `Production Stage: ${stage.name}`,
      message: `Order ${orderNumber} has reached the ${stage.name} stage`,
      referenceType: 'production_orders',
      referenceId: productionOrderId,
      priority: 'normal',
    });
  }
}

module.exports = new NotificationService();
