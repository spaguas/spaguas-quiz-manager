import * as quizService from '../services/quizService.js';
import {
  quizCreateSchema,
  quizUpdateSchema,
  questionCreateSchema,
  submissionSchema,
} from '../validators/quizValidators.js';

export async function createQuiz(req, res, next) {
  try {
    const data = quizCreateSchema.parse(req.body);
    const quiz = await quizService.createQuiz(data);
    return res.status(201).json(quiz);
  } catch (error) {
    return next(error);
  }
}

export async function addQuestionToQuiz(req, res, next) {
  try {
    const payload = questionCreateSchema.parse({
      ...req.body,
      quizId: Number(req.params.quizId),
    });

    const question = await quizService.addQuestionToQuiz(payload);
    return res.status(201).json(question);
  } catch (error) {
    return next(error);
  }
}

export async function deleteQuestion(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const questionId = Number(req.params.questionId);
    const result = await quizService.deleteQuestion(quizId, questionId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function updateQuiz(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const payload = quizUpdateSchema.parse(req.body);
    const quiz = await quizService.updateQuiz(quizId, payload);
    return res.json(quiz);
  } catch (error) {
    return next(error);
  }
}

export async function listQuizzes(req, res, next) {
  try {
    const quizzes = await quizService.listQuizzes();
    return res.json(quizzes);
  } catch (error) {
    return next(error);
  }
}

export async function listActiveQuizzes(req, res, next) {
  try {
    const quizzes = await quizService.listActiveQuizzes();
    return res.json(quizzes);
  } catch (error) {
    return next(error);
  }
}

export async function getQuizByIdForAdmin(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const quiz = await quizService.getQuizByIdForAdmin(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz não encontrado' });
    }
    return res.json(quiz);
  } catch (error) {
    return next(error);
  }
}

export async function getQuizForPlay(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const quiz = await quizService.getQuizForPlay(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz não encontrado' });
    }
    return res.json(quiz);
  } catch (error) {
    return next(error);
  }
}

export async function createSubmission(req, res, next) {
  try {
    const payload = submissionSchema.parse({
      ...req.body,
      quizId: Number(req.params.quizId),
    });

    const result = await quizService.createSubmission(payload, req.user);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getRanking(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const ranking = await quizService.getRanking(quizId);
    return res.json(ranking);
  } catch (error) {
    return next(error);
  }
}

export async function getDashboardSummary(req, res, next) {
  try {
    const summary = await quizService.getDashboardSummary();
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
}

export async function clearRanking(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const result = await quizService.clearQuizRanking(quizId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
