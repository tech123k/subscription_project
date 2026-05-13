const router = require('express').Router();
const {
  getAttributes, createAttribute, updateAttribute,
  addAttributeValue, updateAttributeValue, deleteAttributeValue,
  getVariants, createVariants, updateVariant, deleteVariant,
  adjustVariantStock,
  getBomOverrides, upsertBomOverride,
  generateSkuCombinations,
} = require('../controllers/variant.controller');

// Attribute master
router.get('/attributes',                          getAttributes);
router.post('/attributes',                         createAttribute);
router.put('/attributes/:id',                      updateAttribute);
router.post('/attributes/:id/values',              addAttributeValue);
router.put('/attributes/values/:valueId',          updateAttributeValue);
router.delete('/attributes/values/:valueId',       deleteAttributeValue);

// SKU generation helper
router.post('/generate-combinations',              generateSkuCombinations);

// Product variants
router.get('/products/:productId/variants',        getVariants);
router.post('/products/:productId/variants',       createVariants);
router.put('/variants/:variantId',                 updateVariant);
router.delete('/variants/:variantId',              deleteVariant);
router.post('/variants/:variantId/adjust-stock',   adjustVariantStock);

// BOM variant overrides
router.get('/products/:productId/variants/:variantId/bom-overrides',   getBomOverrides);
router.post('/products/:productId/variants/:variantId/bom-overrides',  upsertBomOverride);

module.exports = router;
