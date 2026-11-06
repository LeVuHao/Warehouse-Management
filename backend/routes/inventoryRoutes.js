const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', inventoryController.getInventory);
router.get('/next-import-code', inventoryController.getNextImportCode);
router.get('/next-export-code', inventoryController.getNextExportCode);
router.get('/dashboard', inventoryController.getDashboard);
router.get('/alerts', inventoryController.getAlerts);
router.post('/alerts/dispose', requireAdmin, inventoryController.disposeLot);
router.post('/alerts/send-email', requireAdmin, inventoryController.sendLowStockEmail);
router.get('/stats', inventoryController.getStats);
router.get('/lots/:productId', inventoryController.getProductLots);
router.get('/returnable-products', inventoryController.getReturnableProducts);
router.get('/bell-notifications', inventoryController.getBellNotifications);
router.get('/replenishments/suggestions', inventoryController.getReplenishmentSuggestions);
router.get('/replenishments/ai-suggest', requireAdmin, inventoryController.getAiReplenishmentSuggestions);

module.exports = router;
