import express from 'express';
import {
    acceptAdvisoryInvitation,
    createAlumni,
    deleteAlumni,
    getAdvisoryInvitationStatus,
    listAlumni,
    updateAlumni,
} from '../controllers/alumniController';
import { optionalAuth, requireAdmin, requireAuth } from '../middlewares/auth';

const router = express.Router();

router.get('/advisory-invitation-status', requireAuth, getAdvisoryInvitationStatus);
router.post('/accept-advisory', requireAuth, acceptAdvisoryInvitation);

router.route('/').get(optionalAuth, listAlumni).post(requireAuth, requireAdmin, createAlumni);
router.route('/:id').patch(requireAuth, requireAdmin, updateAlumni).delete(requireAuth, requireAdmin, deleteAlumni);

export default router;
module.exports = router;
