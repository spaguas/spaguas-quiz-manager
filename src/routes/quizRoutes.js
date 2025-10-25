import { Router } from 'express';
import {
  createQuiz,
  updateQuiz,
  addQuestionToQuiz,
  deleteQuestion,
  listQuizzes,
  getQuizByIdForAdmin,
  listActiveQuizzes,
  getQuizForPlay,
  createSubmission,
  getRanking,
  getDashboardSummary,
  clearRanking,
} from '../controllers/quizController.js';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

// Rotas administrativas
router.post('/admin/quizzes', authenticate, requireAdmin, createQuiz);
router.patch('/admin/quizzes/:quizId', authenticate, requireAdmin, updateQuiz);
router.post('/admin/quizzes/:quizId/questions', authenticate, requireAdmin, addQuestionToQuiz);
router.delete('/admin/quizzes/:quizId/questions/:questionId', authenticate, requireAdmin, deleteQuestion);
router.get('/admin/quizzes', authenticate, requireAdmin, listQuizzes);
router.get('/admin/quizzes/:quizId', authenticate, requireAdmin, getQuizByIdForAdmin);
router.get('/admin/dashboard', authenticate, requireAdmin, getDashboardSummary);
router.delete('/admin/quizzes/:quizId/ranking', authenticate, requireAdmin, clearRanking);

// Rotas públicas
router.get('/quizzes', listActiveQuizzes);
router.get('/quizzes/:quizId', getQuizForPlay);
router.post('/quizzes/:quizId/submissions', createSubmission);
router.get('/quizzes/:quizId/ranking', getRanking);

export default router;
