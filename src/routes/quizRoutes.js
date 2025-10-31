import { Router } from 'express';
import {
  createQuiz,
  updateQuiz,
  updateQuizMedia,
  addQuestionToQuiz,
  deleteQuestion,
  deleteQuiz,
  listQuizzes,
  getQuizByIdForAdmin,
  listActiveQuizzes,
  getQuizForPlay,
  validateQuestionAnswer,
  createSubmission,
  getRanking,
  getDashboardSummary,
  clearRanking,
} from '../controllers/quizController.js';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware.js';
import uploadQuizImages from '../middlewares/uploadQuizImages.js';

const router = Router();

// Rotas administrativas
router.post('/admin/quizzes', authenticate, requireAdmin, createQuiz);
router.patch('/admin/quizzes/:quizId', authenticate, requireAdmin, updateQuiz);
router.patch(
  '/admin/quizzes/:quizId/media',
  authenticate,
  requireAdmin,
  uploadQuizImages.fields([
    { name: 'backgroundImage', maxCount: 1 },
    { name: 'headerImage', maxCount: 1 },
  ]),
  updateQuizMedia,
);
router.delete('/admin/quizzes/:quizId', authenticate, requireAdmin, deleteQuiz);
router.post('/admin/quizzes/:quizId/questions', authenticate, requireAdmin, addQuestionToQuiz);
router.delete('/admin/quizzes/:quizId/questions/:questionId', authenticate, requireAdmin, deleteQuestion);
router.get('/admin/quizzes', authenticate, requireAdmin, listQuizzes);
router.get('/admin/quizzes/:quizId', authenticate, requireAdmin, getQuizByIdForAdmin);
router.get('/admin/dashboard', authenticate, requireAdmin, getDashboardSummary);
router.delete('/admin/quizzes/:quizId/ranking', authenticate, requireAdmin, clearRanking);

// Rotas públicas
router.get('/quizzes', listActiveQuizzes);
router.get('/quizzes/:quizId', getQuizForPlay);
router.post('/quizzes/:quizId/questions/:questionId/validate', validateQuestionAnswer);
router.post('/quizzes/:quizId/submissions', createSubmission);
router.get('/quizzes/:quizId/ranking', getRanking);

export default router;
