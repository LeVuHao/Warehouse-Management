const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.post('/', chatController.sendMessage);
router.get('/overview', chatController.getOverview);

module.exports = router;

