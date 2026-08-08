import express from 'express';
import { createProjectLab, deleteProjectLab, listProjectLabs, updateProjectLab } from '../controllers/projectLabController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

const router = express.Router();
router.route('/').get(listProjectLabs).post(requireAuth, requireAdmin, createProjectLab);
router.route('/:id').patch(requireAuth, requireAdmin, updateProjectLab).delete(requireAuth, requireAdmin, deleteProjectLab);

module.exports = router;
