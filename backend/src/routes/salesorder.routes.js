const router = require('express').Router();
const {
  getAll, getOne, create, updateStatus, createBackorder, getSummary, remove,
} = require('../controllers/salesorder.controller');

router.get('/',                    getAll);
router.get('/summary',             getSummary);
router.get('/:id',                 getOne);
router.post('/',                   create);
router.patch('/:id/status',        updateStatus);
router.post('/:id/backorder',      createBackorder);
router.delete('/:id',              remove);

module.exports = router;
