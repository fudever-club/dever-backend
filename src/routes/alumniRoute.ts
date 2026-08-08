import express from 'express';
import { createAlumni, deleteAlumni, listAlumni, updateAlumni } from '../controllers/alumniController';
import { optionalAuth, requireAdmin, requireAuth } from '../middlewares/auth';

const router = express.Router();
router.route('/').get(optionalAuth, listAlumni).post(requireAuth, requireAdmin, createAlumni);
router.route('/:id').patch(requireAuth, requireAdmin, updateAlumni).delete(requireAuth, requireAdmin, deleteAlumni);

module.exports = router;
