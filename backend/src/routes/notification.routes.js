const express = require('express');
const router = express.Router();
const notificationService = require('../services/notification.service');
const ApiResponse = require('../utils/ApiResponse');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const result = await notificationService.getUserNotifications(req.user.id, req.companyId, { page, limit, unreadOnly: unreadOnly === 'true' });
    ApiResponse.paginated(res, result.data, { total: result.total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) { next(error); }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id, req.companyId);
    ApiResponse.success(res, { count });
  } catch (error) { next(error); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user.id);
    ApiResponse.success(res, null, 'Marked as read');
  } catch (error) { next(error); }
});

router.patch('/mark-all-read', async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id, req.companyId);
    ApiResponse.success(res, null, 'All marked as read');
  } catch (error) { next(error); }
});

module.exports = router;
