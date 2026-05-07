const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/user.controller');
const { requireCompanyAdmin } = require('../middleware/auth');
const { imageUpload } = require('../config/cloudinary');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', requireCompanyAdmin, imageUpload.single('avatar'), ctrl.create);
router.put('/:id', requireCompanyAdmin, imageUpload.single('avatar'), ctrl.update);
router.delete('/:id', requireCompanyAdmin, ctrl.remove);
router.patch('/:id/reset-password', requireCompanyAdmin, ctrl.resetUserPassword);

module.exports = router;
