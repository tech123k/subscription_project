const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/search.controller');

router.get('/', globalSearch);

module.exports = router;
