import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { getLeaderboard, getMyGamification } from '../controllers/gamificationController.js';

const router = Router();

router.get('/profile', authenticate, getMyGamification);
router.get('/leaderboard', getLeaderboard);

export default router;
