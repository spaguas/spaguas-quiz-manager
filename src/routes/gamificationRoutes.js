import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  createBadge,
  deleteBadge,
  getLeaderboard,
  getMyGamification,
  listBadges,
  updateBadge,
} from '../controllers/gamificationController.js';

const router = Router();

router.get('/profile', authenticate, getMyGamification);
router.get('/leaderboard', getLeaderboard);
router.get('/admin/badges', authenticate, requireAdmin, listBadges);
router.post('/admin/badges', authenticate, requireAdmin, createBadge);
router.patch('/admin/badges/:badgeId', authenticate, requireAdmin, updateBadge);
router.delete('/admin/badges/:badgeId', authenticate, requireAdmin, deleteBadge);

export default router;
