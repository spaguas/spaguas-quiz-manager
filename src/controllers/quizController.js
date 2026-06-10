import * as quizService from '../services/quizService.js';
import {
  quizCreateSchema,
  quizUpdateSchema,
  quizPrizeUpdateSchema,
  prizeClaimSchema,
  questionCreateSchema,
  submissionSchema,
  answerValidationSchema,
  competitiveJoinSchema,
  competitiveTokenSchema,
  competitiveAnswerSchema,
  participationCheckSchema,
  questionCopySchema,
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

export async function copyQuestionsToQuiz(req, res, next) {
  try {
    const payload = questionCopySchema.parse({
      sourceQuizId: Number(req.body.sourceQuizId),
      targetQuizId: Number(req.params.quizId),
    });

    const result = await quizService.copyQuestionsBetweenQuizzes(payload);
    return res.status(201).json(result);
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

export async function updateQuizPrizes(req, res, next) {
  try {
    const payload = quizPrizeUpdateSchema.parse({
      ...req.body,
      quizId: Number(req.params.quizId),
    });

    const quiz = await quizService.updateQuizPrizes(payload.quizId, payload.prizes);
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

export async function joinCompetitiveLobby(req, res, next) {
  try {
    const payload = competitiveJoinSchema.parse({
      ...req.body,
      quizId: Number(req.params.quizId),
    });

    const result = await quizService.joinCompetitiveLobby(payload);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getCompetitiveLobbyStatus(req, res, next) {
  try {
    const payload = competitiveTokenSchema.parse({
      quizId: Number(req.params.quizId),
      token: req.params.token,
    });

    const result = await quizService.getCompetitiveLobbyStatus(payload);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function submitCompetitiveAnswer(req, res, next) {
  try {
    const payload = competitiveAnswerSchema.parse({
      quizId: Number(req.params.quizId),
      token: req.params.token,
      optionId: Number(req.body?.optionId),
      responseMs: req.body?.responseMs === undefined ? undefined : Number(req.body.responseMs),
    });

    const result = await quizService.submitCompetitiveAnswer(payload);
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

    const result = await quizService.createSubmission(payload, req.user, {
      ip: req.ip,
      ips: req.ips,
      headers: req.headers,
      socketRemoteAddress: req.socket?.remoteAddress,
    });
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function confirmPrizeClaim(req, res, next) {
  try {
    const payload = prizeClaimSchema.parse({
      ...req.body,
      quizId: Number(req.params.quizId),
      submissionId: Number(req.params.submissionId),
      prizeId: Number(req.params.prizeId),
    });

    const result = await quizService.confirmPrizeClaim(payload);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getRanking(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const { full, limit } = req.query;

    let normalizedLimit = null;
    if (typeof limit === 'string') {
      const parsed = Number(limit);
      if (Number.isFinite(parsed) && parsed > 0) {
        normalizedLimit = parsed;
      }
    }

    if (full === 'true') {
      normalizedLimit = null;
    }

    const ranking = await quizService.getRanking(quizId, normalizedLimit);
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

export async function getQuizDashboardSummary(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const summary = await quizService.getQuizDashboardSummary(quizId);
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

export async function resetQuizData(req, res, next) {
  try {
    const quizId = Number(req.params.quizId);
    const result = await quizService.resetQuizData(quizId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
