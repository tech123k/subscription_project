const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/material.controller');
const { imageUpload, processUploadedFile } = require('../config/cloudinary');
const multer = require('multer');

const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', ctrl.getAll);
router.get('/export', ctrl.exportMaterials);
router.get('/template', ctrl.downloadTemplate);
router.get('/categories', ctrl.getCategories);
router.get('/import', (req, res) => res.status(405).json({ success: false, message: 'Use POST /import to upload a file' }));
router.get('/:id', ctrl.getOne);
router.get('/:id/history', ctrl.getStockHistory);

router.post('/', imageUpload.single('image'), processUploadedFile, ctrl.create);
router.post('/import', excelUpload.single('file'), ctrl.importMaterials);
router.post('/grn', ctrl.createGRN);
router.post('/categories', ctrl.createCategory);

router.put('/:id', imageUpload.single('image'), processUploadedFile, ctrl.update);
router.patch('/:id/stock', ctrl.adjustStock);
router.delete('/:id', ctrl.remove);

module.exports = router;
