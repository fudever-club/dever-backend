import express from 'express';
import {
    createAdminCampaign,
    getActiveCampaign,
    getAdminCampaigns,
    getAdminPayments,
    getFundAnalytics,
    getMyFundPayments,
    reviewAdminPayment,
    submitFundPayment,
    updateAdminCampaign,
} from '../controllers/fundController';
import { optionalAuth, requireAdmin, requireAuth } from '../middlewares/auth';

const router = express.Router();

// Public & Member Routes
router.get('/active-campaign', optionalAuth, getActiveCampaign);
router.get('/my-payments', requireAuth, getMyFundPayments);
router.post('/submit-payment', requireAuth, submitFundPayment);

// Admin Routes
router.get('/admin/campaigns', requireAuth, requireAdmin, getAdminCampaigns);
router.post('/admin/campaigns', requireAuth, requireAdmin, createAdminCampaign);
router.patch('/admin/campaigns/:id', requireAuth, requireAdmin, updateAdminCampaign);
router.get('/admin/payments', requireAuth, requireAdmin, getAdminPayments);
router.patch('/admin/payments/:id/review', requireAuth, requireAdmin, reviewAdminPayment);
router.get('/admin/analytics', requireAuth, requireAdmin, getFundAnalytics);

export default router;
module.exports = router;
