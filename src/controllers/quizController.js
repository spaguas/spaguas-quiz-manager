import * as quizService from '../services/quizService.js';
import {
  quizCreateSchema,
  quizUpdateSchema,
  questionCreateSchema,
  submissionSchema,
  answerValidationSchema,
  participationCheckSchema,
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

export async function deleteQuiz(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const result = await quizService.deleteQuiz(quizId);
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

export async function updateQuizMedia(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const backgroundImage = req.files?.backgroundImage?.[0] ?? null;
    const headerImage = req.files?.headerImage?.[0] ?? null;

    if (!backgroundImage && !headerImage) {
      return res.status(400).json({ message: 'Envie ao menos uma imagem para atualizar.' });
    }

    const quiz = await quizService.updateQuizMedia(quizId, {
      backgroundImage,
      headerImage,
    });
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


export async function validateParticipation(req, res, next) {
  try {
    const payload = participationCheckSchema.parse({
      ...req.body,
      quizId: Number(req.params.quizId),
    });

    const result = await quizService.validateParticipation(payload);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function validateQuestionAnswer(req, res, next) {
  try {
    const payload = answerValidationSchema.parse({
      quizId: Number(req.params.quizId),
      questionId: Number(req.params.questionId),
      optionId: Number(req.body?.optionId),
    });

    const result = await quizService.validateQuestionAnswer(payload);
    return res.json(result);
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
