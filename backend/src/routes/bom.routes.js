const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/bom.controller');

// Product-scoped BOM
router.get('/products/:productId', ctrl.getByProduct);
router.post('/products/:productId', ctrl.upsert);      // full save/replace
router.post('/products/:productId/items', ctrl.addItem);

// Item-level
router.put('/items/:itemId', ctrl.updateItem);
router.delete('/items/:itemId', ctrl.removeItem);

module.exports = router;
