const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/workflow.controller');
const { requireCompanyAdmin } = require('../middleware/auth');

router.get('/', ctrl.getTemplates);
router.get('/:id', ctrl.getTemplate);
router.post('/', requireCompanyAdmin, ctrl.createTemplate);
router.put('/:id', requireCompanyAdmin, ctrl.updateTemplate);
router.post('/:templateId/stages', requireCompanyAdmin, ctrl.addStage);
router.put('/stages/:stageId', requireCompanyAdmin, ctrl.updateStage);
router.patch('/:templateId/stages/reorder', requireCompanyAdmin, ctrl.reorderStages);
router.delete('/stages/:stageId', requireCompanyAdmin, ctrl.deleteStage);

module.exports = router;
