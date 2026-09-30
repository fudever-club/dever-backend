import express from 'express';
import { getAdminAuditLog, getAdminAuditSummary } from '../controllers/adminAuditController';
import { requireAuth, requireAdmin } from '../middlewares/auth';

const router = express.Router();

router.get('/audit-log', requireAuth, requireAdmin, getAdminAuditLog);
router.get('/audit-log/summary', requireAuth, requireAdmin, getAdminAuditSummary);

export default router;
module.exports = router;
