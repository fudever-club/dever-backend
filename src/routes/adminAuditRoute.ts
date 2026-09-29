import express from 'express';
import { getAdminAuditLog } from '../controllers/adminAuditController';
import { requireAuth, requireAdmin } from '../middlewares/auth';

const router = express.Router();

router.get('/audit-log', requireAuth, requireAdmin, getAdminAuditLog);

export default router;
module.exports = router;
