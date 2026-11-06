const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/importController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

// ── Stats (trước /:id để không bị conflict) ──────────────────
router.get('/stats', ctrl.getStats);

// ── CRUD cơ bản ───────────────────────────────────────────────
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', requireAdmin, ctrl.remove);

// ── Workflow transitions ───────────────────────────────────────
router.patch('/:id/arrive', ctrl.markArrived);      // IN_TRANSIT → ARRIVED
router.patch('/:id/inspect', ctrl.inspect);          // ARRIVED → PENDING_APPROVAL
router.patch('/:id/complete', ctrl.complete);        // PENDING_APPROVAL → COMPLETED
router.patch('/:id/cancel', ctrl.cancel);            // any → CANCELLED

module.exports = router;
