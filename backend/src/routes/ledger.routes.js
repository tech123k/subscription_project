const router = require('express').Router();
const {
  getEntries, getMaterialStockCard, getProductStockCard,
  createManualAdjustment, getLowStockAlerts, getMovementSummary,
} = require('../controllers/ledger.controller');

router.get('/',                           getEntries);
router.get('/low-stock',                  getLowStockAlerts);
router.get('/movement-summary',           getMovementSummary);
router.post('/adjust',                    createManualAdjustment);
router.get('/materials/:materialId',      getMaterialStockCard);
router.get('/products/:productId',        getProductStockCard);

module.exports = router;
