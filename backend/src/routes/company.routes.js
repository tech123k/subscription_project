const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/company.controller');
const { requireSuperAdmin, requireCompanyAdmin } = require('../middleware/auth');
const { logoUpload } = require('../config/cloudinary');

router.get('/settings', ctrl.getSettings);
router.put('/settings', requireCompanyAdmin, logoUpload.single('logo'), ctrl.updateSettings);
router.get('/', requireSuperAdmin, ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.put('/:id', requireCompanyAdmin, logoUpload.single('logo'), ctrl.update);
router.patch('/:id/toggle-status', requireSuperAdmin, ctrl.toggleStatus);
router.patch('/:id/subscription', requireSuperAdmin, ctrl.updateSubscription);

module.exports = router;
