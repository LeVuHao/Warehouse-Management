const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/exportController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

// ── Stats (trước /:id) ──────────────────────────────────────────
router.get('/stats', ctrl.getStats);

// ── Check sellable stock ──────────────────────────────────────
router.get('/sellable-stock/:productId', ctrl.getSellableStock);

// ── CRUD cơ bản ───────────────────────────────────────────────
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.delete('/:id', requireAdmin, ctrl.remove);

// ── Workflow transitions (cho phiếu RETURN) ─────────────────────
router.patch('/:id/approve', requireAdmin, ctrl.approve);
router.patch('/:id/reject', requireAdmin, ctrl.reject);
router.patch('/:id/complete-delivery', ctrl.completeDelivery);

// ── Huỷ phiếu ──────────────────────────────────────────────────
router.patch('/:id/cancel', requireAdmin, ctrl.cancel);

module.exports = router;
