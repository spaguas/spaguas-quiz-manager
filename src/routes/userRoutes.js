import { Router } from 'express';
import { createUser, listUsers } from '../controllers/userController.js';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', listUsers);
router.post('/', createUser);

export default router;
