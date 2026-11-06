const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);
router.get('/', locationController.getAllLocations);

module.exports = router;
