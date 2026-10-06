import express from 'express';
import {
    acceptAdvisoryInvitation,
    createAlumni,
    deleteAlumni,
    getAdvisoryInvitationStatus,
    getMyMentorProfile,
    listAlumni,
    updateAlumni,
    updateMyMentorProfile,
} from '../controllers/alumniController';
import { optionalAuth, requireAdmin, requireAuth } from '../middlewares/auth';

const router = express.Router();

router.get('/advisory-invitation-status', requireAuth, getAdvisoryInvitationStatus);
router.post('/accept-advisory', requireAuth, acceptAdvisoryInvitation);

// Alumni self opt-in (linked accounts only). Registered before '/:id'
// so the literal segment is never captured as an alumni id.
router.route('/me/mentor-profile').get(requireAuth, getMyMentorProfile).patch(requireAuth, updateMyMentorProfile);

router.route('/').get(optionalAuth, listAlumni).post(requireAuth, requireAdmin, createAlumni);
router.route('/:id').patch(requireAuth, requireAdmin, updateAlumni).delete(requireAuth, requireAdmin, deleteAlumni);

export default router;
module.exports = router;
