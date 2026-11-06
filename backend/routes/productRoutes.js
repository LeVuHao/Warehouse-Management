const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middlewares/auth');

// Apply JWT token validation middleware to all product routes
router.use(authenticateToken);

// Duplicate checking route (needs to be registered before /:id)
router.get('/check-duplicate', productController.checkDuplicate);

// General product CRUD routes
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/suppliers', productController.getProductSuppliers);
router.get('/:id/qrcode', productController.getProductQRCode);

// Admin-only write routes (role verification logic is handled inside controller methods)
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
