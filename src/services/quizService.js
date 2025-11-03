import path from 'node:path';
import fs from 'node:fs';
import prisma from '../config/prisma.js';
import HttpError from '../utils/httpError.js';
import appConfig from '../config/appConfig.js';
import { registerSubmission } from './gamificationService.js';

const uploadsRoot = path.resolve(process.cwd(), 'uploads');

const toRelativePath = (filePath) => path.relative(uploadsRoot, filePath).replace(/\\/g, '/');

const buildPublicUrl = (relativePath) => {
  if (!relativePath) {
    return null;
  }

  const pathWithBase = `${appConfig.basePath || ''}/uploads/${relativePath.replace(/\\/g, '/')}`.replace(/\/{2,}/g, '/');

  if (appConfig.publicUrl) {
    return `${appConfig.publicUrl}${pathWithBase.startsWith('/') ? pathWithBase : `/${pathWithBase}`}`;
  }

  return pathWithBase.startsWith('/') ? pathWithBase : `/${pathWithBase}`;
};

const deleteFileIfExists = (relativePath) => {
  if (!relativePath) {
    return;
  }
  const absolutePath = path.join(uploadsRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

export async function createQuiz({
  title,
  description,
  isActive = true,
  mode = 'SEQUENTIAL',
  questionLimit = null,
  backgroundVideoUrl = null,
  backgroundVideoStart = null,
  backgroundVideoEnd = null,
  backgroundVideoLoop = true,
  backgroundVideoMuted = true,
  backgroundImageIntensity = 0.65,
  backgroundVideoIntensity = 0.65,
}) {
  const normalizedLimit = questionLimit ?? null;
  const normalizedVideoUrl = backgroundVideoUrl ? backgroundVideoUrl.trim() : null;
  const hasVideo = Boolean(normalizedVideoUrl);

  return prisma.quiz.create({
    data: {
      title,
      description,
      isActive,
      mode,
      questionLimit: normalizedLimit,
      backgroundImage: null,
      headerImage: null,
      backgroundVideoUrl: normalizedVideoUrl,
      backgroundVideoStart: hasVideo ? backgroundVideoStart ?? 0 : null,
      backgroundVideoEnd: hasVideo ? backgroundVideoEnd ?? null : null,
      backgroundVideoLoop: backgroundVideoLoop ?? true,
      backgroundVideoMuted: backgroundVideoMuted ?? true,
      backgroundImageIntensity: backgroundImageIntensity ?? 0.65,
      backgroundVideoIntensity: backgroundVideoIntensity ?? 0.65,
    },
  });
}

export async function updateQuiz(quizId, {
  title,
  description,
  isActive,
  mode,
  questionLimit,
  backgroundVideoUrl,
  backgroundVideoStart,
  backgroundVideoEnd,
  backgroundVideoLoop,
  backgroundVideoMuted,
  backgroundImageIntensity,
  backgroundVideoIntensity,
}) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  const data = {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(mode !== undefined ? { mode } : {}),
    ...(questionLimit !== undefined ? { questionLimit: questionLimit ?? null } : {}),
  };

  if (backgroundVideoUrl !== undefined) {
    const normalizedVideoUrl = backgroundVideoUrl ? backgroundVideoUrl.trim() : null;
    data.backgroundVideoUrl = normalizedVideoUrl;
    if (normalizedVideoUrl === null) {
      data.backgroundVideoStart = null;
      data.backgroundVideoEnd = null;
    }
  }

  if (backgroundVideoStart !== undefined) {
    data.backgroundVideoStart = backgroundVideoStart === null ? null : backgroundVideoStart;
  }

  if (backgroundVideoEnd !== undefined) {
    data.backgroundVideoEnd = backgroundVideoEnd ?? null;
  }

  if (backgroundVideoLoop !== undefined) {
    data.backgroundVideoLoop = backgroundVideoLoop;
  }

  if (backgroundVideoMuted !== undefined) {
    data.backgroundVideoMuted = backgroundVideoMuted;
  }

  if (backgroundImageIntensity !== undefined) {
    data.backgroundImageIntensity = backgroundImageIntensity;
  }

  if (backgroundVideoIntensity !== undefined) {
    data.backgroundVideoIntensity = backgroundVideoIntensity;
  }

  await prisma.quiz.update({
    where: { id: quizId },
    data,
  });

  return getQuizByIdForAdmin(quizId);
}

export async function updateQuizMedia(quizId, { backgroundImage, headerImage }) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      backgroundImage: true,
      headerImage: true,
    },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  const data = {};

  if (backgroundImage) {
    const relativePath = toRelativePath(backgroundImage.path);
    deleteFileIfExists(quiz.backgroundImage);
    data.backgroundImage = relativePath;
  }

  if (headerImage) {
    const relativePath = toRelativePath(headerImage.path);
    deleteFileIfExists(quiz.headerImage);
    data.headerImage = relativePath;
  }

  if (Object.keys(data).length === 0) {
    return getQuizByIdForAdmin(quizId);
  }

  await prisma.quiz.update({
    where: { id: quizId },
    data,
  });

  return getQuizByIdForAdmin(quizId);
}

export async function addQuestionToQuiz({ quizId, text, order, options }) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  return prisma.question.create({
    data: {
      text,
      order,
      quizId,
      options: {
        create: options.map((option) => ({
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      },
    },
    include: {
      options: true,
    },
  });
}

export async function listQuizzes() {
  return prisma.quiz.findMany({
    include: {
      questions: {
        include: {
          options: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function listActiveQuizzes() {
  const quizzes = await prisma.quiz.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      mode: true,
      questionLimit: true,
      backgroundImage: true,
      headerImage: true,
      backgroundVideoUrl: true,
      backgroundVideoStart: true,
      backgroundVideoEnd: true,
      backgroundVideoLoop: true,
      backgroundVideoMuted: true,
      backgroundImageIntensity: true,
      backgroundVideoIntensity: true,
      _count: {
        select: {
          questions: true,
          submissions: true,
        },
      },
    },
  });

  return quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    createdAt: quiz.createdAt,
    mode: quiz.mode,
    questionLimit: quiz.questionLimit,
    questionCount: Math.min(
      quiz._count.questions,
      quiz.questionLimit ?? quiz._count.questions,
    ),
    submissionCount: quiz._count.submissions,
    backgroundImageUrl: buildPublicUrl(quiz.backgroundImage),
    headerImageUrl: buildPublicUrl(quiz.headerImage),
    backgroundVideoUrl: quiz.backgroundVideoUrl || null,
    backgroundVideoStart: quiz.backgroundVideoStart ?? 0,
    backgroundVideoEnd: quiz.backgroundVideoEnd ?? null,
    backgroundVideoLoop: quiz.backgroundVideoLoop ?? true,
    backgroundVideoMuted: quiz.backgroundVideoMuted ?? true,
    backgroundImageIntensity: quiz.backgroundImageIntensity ?? 0.65,
    backgroundVideoIntensity: quiz.backgroundVideoIntensity ?? 0.65,
  }));
}

export async function deleteQuestion(quizId, questionId) {
  const question = await prisma.question.findFirst({
    where: { id: questionId, quizId },
    select: {
      id: true,
    },
  });

  if (!question) {
    throw new HttpError(404, 'Pergunta não encontrada para este quiz');
  }

  await prisma.$transaction(async (tx) => {
    await tx.question.delete({
      where: { id: questionId },
    });

    const remaining = await tx.question.findMany({
      where: { quizId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
      },
    });

    await Promise.all(
      remaining.map((item, index) =>
        tx.question.update({
          where: { id: item.id },
          data: { order: index + 1 },
        }),
      ),
    );
  });

  return { message: 'Pergunta removida com sucesso' };
}

export async function deleteQuiz(quizId) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  await prisma.quiz.delete({
    where: { id: quizId },
  });

  const quizDirectory = path.join(uploadsRoot, 'quizzes', String(quizId));
  if (fs.existsSync(quizDirectory)) {
    fs.rmSync(quizDirectory, { recursive: true, force: true });
  }

  return { message: 'Quiz removido com sucesso' };
}

export async function getQuizByIdForAdmin(quizId) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        include: {
          options: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  if (!quiz) {
    return null;
  }

  return {
    ...quiz,
    backgroundImageUrl: buildPublicUrl(quiz.backgroundImage),
    headerImageUrl: buildPublicUrl(quiz.headerImage),
    backgroundVideoUrl: quiz.backgroundVideoUrl || null,
    backgroundVideoStart: quiz.backgroundVideoStart ?? 0,
    backgroundVideoEnd: quiz.backgroundVideoEnd ?? null,
    backgroundVideoLoop: quiz.backgroundVideoLoop ?? true,
    backgroundVideoMuted: quiz.backgroundVideoMuted ?? true,
    backgroundImageIntensity: quiz.backgroundImageIntensity ?? 0.65,
    backgroundVideoIntensity: quiz.backgroundVideoIntensity ?? 0.65,
  };
}

export async function getQuizForPlay(quizId) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        include: {
          options: {
            select: {
              id: true,
              text: true,
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  if (!quiz || !quiz.isActive) {
    return null;
  }

  if (quiz.questions.length === 0) {
    throw new HttpError(409, 'Quiz não possui perguntas disponíveis no momento');
  }

  const shuffleQuestions = (items) => {
    const array = [...items];
    for (let index = array.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
    }
    return array;
  };

  let selectedQuestions = quiz.questions;

  if (quiz.mode === 'RANDOM') {
    selectedQuestions = shuffleQuestions(selectedQuestions);
  }

  const limit = quiz.questionLimit ?? selectedQuestions.length;
  const effectiveLimit = Math.min(limit, selectedQuestions.length);
  const limitedQuestions = selectedQuestions.slice(0, effectiveLimit);

  if (quiz.mode === 'SEQUENTIAL') {
    limitedQuestions.sort((a, b) => a.order - b.order);
  }

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    mode: quiz.mode,
    questionLimit: quiz.questionLimit,
    backgroundImageUrl: buildPublicUrl(quiz.backgroundImage),
    headerImageUrl: buildPublicUrl(quiz.headerImage),
    backgroundVideoUrl: quiz.backgroundVideoUrl || null,
    backgroundVideoStart: quiz.backgroundVideoStart ?? 0,
    backgroundVideoEnd: quiz.backgroundVideoEnd ?? null,
    backgroundVideoLoop: quiz.backgroundVideoLoop ?? true,
    backgroundVideoMuted: quiz.backgroundVideoMuted ?? true,
    backgroundImageIntensity: quiz.backgroundImageIntensity ?? 0.65,
    backgroundVideoIntensity: quiz.backgroundVideoIntensity ?? 0.65,
    questions: limitedQuestions.map((question) => ({
      id: question.id,
      text: question.text,
      order: question.order,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
      })),
    })),
  };
}

export async function validateQuestionAnswer({ quizId, questionId, optionId }) {
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      quizId,
      quiz: {
        isActive: true,
      },
    },
    select: {
      id: true,
      options: {
        select: {
          id: true,
          isCorrect: true,
        },
      },
    },
  });

  if (!question) {
    throw new HttpError(404, 'Pergunta não encontrada para este quiz');
  }

  const option = question.options.find((item) => item.id === optionId);

  if (!option) {
    throw new HttpError(400, 'Alternativa inválida para esta pergunta');
  }

  return {
    questionId,
    optionId,
    isCorrect: option.isCorrect,
  };
}

export async function validateParticipation({ quizId, userEmail }) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, isActive: true },
  });

  if (!quiz || !quiz.isActive) {
    throw new HttpError(404, 'Quiz não encontrado ou inativo');
  }

  const normalizedEmail = (userEmail || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new HttpError(400, 'Informe um e-mail válido');
  }

  const existingSubmission = await prisma.submission.findFirst({
    where: {
      quizId,
      userEmail: normalizedEmail,
    },
    select: { id: true },
  });

  if (existingSubmission) {
    throw new HttpError(409, 'Este e-mail já participou deste quiz');
  }

  return { allowed: true };
}

export async function createSubmission({ quizId, userName, userEmail, answers }, actor = null) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        include: {
          options: true,
        },
      },
    },
  });

  if (!quiz || !quiz.isActive) {
    throw new HttpError(404, 'Quiz não encontrado ou inativo');
  }

  const normalizedEmail = (userEmail ?? actor?.email ?? '').trim().toLowerCase();

  if (!normalizedEmail) {
    throw new HttpError(400, 'Informe um e-mail válido');
  }

  const hasEmail = await prisma.submission.findFirst({
    where: {
      quizId,
      userEmail: normalizedEmail,
    },
    select: {
      id: true,
    },
  });

  if (hasEmail) {
    throw new HttpError(409, 'Este e-mail já participou deste quiz');
  }

  const questionMap = new Map();
  quiz.questions.forEach((question) => {
    questionMap.set(question.id, question);
  });

  const uniqueQuestions = new Set();

  const evaluation = answers.map((answer) => {
    if (uniqueQuestions.has(answer.questionId)) {
      throw new HttpError(400, 'Cada pergunta deve ter apenas uma resposta');
    }

    uniqueQuestions.add(answer.questionId);

    const question = questionMap.get(answer.questionId);
    if (!question) {
      throw new HttpError(400, 'Pergunta inválida para este quiz');
    }

    const option = question.options.find((item) => item.id === answer.optionId);
    if (!option) {
      throw new HttpError(400, 'Alternativa inválida para esta pergunta');
    }

    return {
      questionId: question.id,
      optionId: option.id,
      isCorrect: option.isCorrect,
    };
  });

  const totalAvailableQuestions = quiz.questions.length;
  const expectedQuestions = Math.min(
    quiz.questionLimit ?? totalAvailableQuestions,
    totalAvailableQuestions,
  );

  if (expectedQuestions > 0 && evaluation.length !== expectedQuestions) {
    throw new HttpError(400, 'Responda todas as perguntas do quiz');
  }

  const correctAnswers = evaluation.filter((item) => item.isCorrect).length;
  const percentage =
    expectedQuestions === 0 ? 0 : Number(((correctAnswers / expectedQuestions) * 100).toFixed(2));

  let submissionUserId = actor?.id ? Number(actor.id) : null;

  if (!submissionUserId) {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      submissionUserId = existingUser.id;
    }
  }

  const submission = await prisma.submission.create({
    data: {
      quizId,
      userId: submissionUserId,
      userName: userName || actor?.name || 'Participante',
      userEmail: normalizedEmail,
      score: correctAnswers,
      total: expectedQuestions,
      percentage,
      answers: {
        create: evaluation,
      },
    },
  });

  const betterResults = await prisma.submission.count({
    where: {
      quizId,
      OR: [
        { score: { gt: submission.score } },
        {
          score: submission.score,
          createdAt: { lt: submission.createdAt },
        },
      ],
    },
  });

  if (submissionUserId) {
    await registerSubmission({
      userId: submissionUserId,
      score: submission.score,
      total: submission.total,
      percentage: submission.percentage,
    });
  }

  return {
    submissionId: submission.id,
    quizId: submission.quizId,
    userId: submission.userId,
    userName: submission.userName,
    userEmail: submission.userEmail,
    score: submission.score,
    total: submission.total,
    percentage: submission.percentage,
    position: betterResults + 1,
  };
}

export async function getRanking(quizId, limit = 10) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  const results = await prisma.submission.findMany({
    where: { quizId },
    orderBy: [
      { score: 'desc' },
      { createdAt: 'asc' },
    ],
    take: limit,
    select: {
      id: true,
      userName: true,
      score: true,
      total: true,
      percentage: true,
      createdAt: true,
    },
  });

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
    },
    ranking: results.map((result, index) => ({
      position: index + 1,
      submissionId: result.id,
      userName: result.userName,
      score: result.score,
      total: result.total,
      percentage: result.percentage,
      createdAt: result.createdAt,
    })),
  };
}

export async function clearQuizRanking(quizId) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  const deletedAnswers = await prisma.submissionAnswer.deleteMany({
    where: {
      submission: {
        quizId,
      },
    },
  });

  const deletedSubmissions = await prisma.submission.deleteMany({
    where: { quizId },
  });

  return {
    quizId,
    deletedSubmissions: deletedSubmissions.count,
    deletedAnswers: deletedAnswers.count,
    message: 'Ranking limpo com sucesso',
  };
}

export async function getDashboardSummary() {
  const [
    totalQuizzes,
    activeQuizzes,
    totalQuestions,
    totalSubmissions,
    averageStats,
    recentSubmissions,
    topQuizStats,
    topPerformers,
  ] = await Promise.all([
    prisma.quiz.count(),
    prisma.quiz.count({ where: { isActive: true } }),
    prisma.question.count(),
    prisma.submission.count(),
    prisma.submission.aggregate({
      _avg: {
        percentage: true,
        score: true,
      },
    }),
    prisma.submission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        userName: true,
        score: true,
        total: true,
        percentage: true,
        createdAt: true,
        quiz: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
    prisma.submission.groupBy({
      by: ['quizId'],
      _count: {
        quizId: true,
      },
      _avg: {
        percentage: true,
      },
      orderBy: {
        _count: {
          quizId: 'desc',
        },
      },
      take: 5,
    }),
    prisma.submission.findMany({
      orderBy: [
        { percentage: 'desc' },
        { score: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 5,
      select: {
        id: true,
        userName: true,
        score: true,
        total: true,
        percentage: true,
        createdAt: true,
        quiz: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
  ]);

  const quizIds = topQuizStats.map((item) => item.quizId);
  const quizLookup = quizIds.length
    ? await prisma.quiz.findMany({
        where: { id: { in: quizIds } },
        select: {
          id: true,
          title: true,
        },
      })
    : [];

  const quizNameMap = new Map(quizLookup.map((item) => [item.id, item.title]));

  return {
    metrics: {
      totalQuizzes,
      activeQuizzes,
      totalQuestions,
      totalSubmissions,
      averageScore: Number((averageStats._avg.score ?? 0).toFixed(2)),
      averageAccuracy: Number((averageStats._avg.percentage ?? 0).toFixed(2)),
    },
    topQuizzes: topQuizStats.map((item) => ({
      quizId: item.quizId,
      title: quizNameMap.get(item.quizId) ?? 'Quiz removido',
      submissions: item._count.quizId,
      averageAccuracy: Number((item._avg.percentage ?? 0).toFixed(2)),
    })),
    topPerformers: topPerformers.map((submission) => ({
      submissionId: submission.id,
      userName: submission.userName,
      quizTitle: submission.quiz?.title ?? 'Quiz removido',
      score: submission.score,
      total: submission.total,
      percentage: submission.percentage,
      createdAt: submission.createdAt,
    })),
    recentActivity: recentSubmissions.map((submission) => ({
      submissionId: submission.id,
      userName: submission.userName,
      quizTitle: submission.quiz?.title ?? 'Quiz removido',
      score: submission.score,
      total: submission.total,
      percentage: submission.percentage,
      createdAt: submission.createdAt,
    })),
  };
}
