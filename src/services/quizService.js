import prisma from '../config/prisma.js';
import HttpError from '../utils/httpError.js';

export async function createQuiz({ title, description, isActive = true }) {
  return prisma.quiz.create({
    data: {
      title,
      description,
      isActive,
    },
  });
}

export async function updateQuiz(quizId, { title, description, isActive }) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  return prisma.quiz.update({
    where: { id: quizId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    include: {
      questions: {
        include: { options: true },
        orderBy: { order: 'asc' },
      },
    },
  });
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
    questionCount: quiz._count.questions,
    submissionCount: quiz._count.submissions,
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

export async function getQuizByIdForAdmin(quizId) {
  return prisma.quiz.findUnique({
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

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions.map((question) => ({
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

  const totalQuestions = quiz.questions.length;
  if (totalQuestions > 0 && evaluation.length !== totalQuestions) {
    throw new HttpError(400, 'Responda todas as perguntas do quiz');
  }

  const correctAnswers = evaluation.filter((item) => item.isCorrect).length;
  const percentage = totalQuestions === 0 ? 0 : Number(((correctAnswers / totalQuestions) * 100).toFixed(2));

  const submission = await prisma.submission.create({
    data: {
      quizId,
      userId: actor?.id ? Number(actor.id) : null,
      userName: userName || actor?.name || 'Participante',
      userEmail: normalizedEmail,
      score: correctAnswers,
      total: totalQuestions,
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
