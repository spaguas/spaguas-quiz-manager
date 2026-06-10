import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import prisma from '../config/prisma.js';
import HttpError from '../utils/httpError.js';
import appConfig from '../config/appConfig.js';
import { rebuildGamificationFromSubmissions, registerSubmission } from './gamificationService.js';

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

const mapPrize = (prize, claim = null) => ({
  id: prize.id,
  position: prize.position,
  name: prize.name,
  description: prize.description,
  quantity: prize.quantity,
  availableQuantity: prize.availableQuantity,
  minimumScore: prize.minimumScore ?? 0,
  minimumPercentage: prize.minimumPercentage ?? 0,
  isAvailable: prize.availableQuantity > 0,
  claimStatus: claim?.status ?? null,
  claimedAt: claim?.claimedAt ?? null,
  declinedAt: claim?.declinedAt ?? null,
});

const isPrizeEligibleForSubmission = (prize, submission) => {
  const minimumPercentage = prize.minimumPercentage ?? 0;
  if (minimumPercentage > 0) {
    return (submission.percentage ?? 0) >= minimumPercentage;
  }
  return (submission.score ?? 0) >= (prize.minimumScore ?? 0);
};

const buildPrizeAvailabilityByPosition = (prizes = []) => {
  const groups = new Map();

  prizes.forEach((prize) => {
    if (!groups.has(prize.position)) {
      groups.set(prize.position, []);
    }
    groups.get(prize.position).push(mapPrize(prize));
  });

  return groups;
};

const buildClaimLookup = (claims = []) => {
  const lookup = new Map();
  claims.forEach((claim) => {
    lookup.set(`${claim.submissionId}:${claim.prizeId}`, claim);
  });
  return lookup;
};

const mapPrizeForSubmission = (prize, submissionId, claimLookup) =>
  mapPrize(prize, claimLookup.get(`${submissionId}:${prize.id}`));

const normalizePrizeClaimRow = (row) => (row ? ({
  id: Number(row.id),
  submissionId: Number(row.submissionId),
  prizeId: Number(row.prizeId),
  status: row.status,
  claimedAt: row.claimedAt,
  declinedAt: row.declinedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
}) : null);

const selectPrizeClaimSql = `
  SELECT
    "id",
    "submissionId",
    "prizeId",
    "status",
    "claimedAt",
    "declinedAt",
    "createdAt",
    "updatedAt"
  FROM "SubmissionPrizeClaim"
`;

let prizeClaimTableReady = false;
let prizeClaimTablePromise = null;

async function ensurePrizeClaimTable(client = prisma) {
  if (prizeClaimTableReady) {
    return;
  }

  if (!prizeClaimTablePromise) {
    prizeClaimTablePromise = (async () => {
      const existingTables = await client.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'SubmissionPrizeClaim'
        LIMIT 1
      `;

      if (existingTables.length) {
        prizeClaimTableReady = true;
        return;
      }

      await client.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SubmissionPrizeClaim" (
          "id" SERIAL NOT NULL,
          "submissionId" INTEGER NOT NULL,
          "prizeId" INTEGER NOT NULL,
          "status" TEXT NOT NULL,
          "claimedAt" TIMESTAMP(3),
          "declinedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "SubmissionPrizeClaim_pkey" PRIMARY KEY ("id")
        )
      `);

      await client.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "SubmissionPrizeClaim_submissionId_prizeId_key"
        ON "SubmissionPrizeClaim"("submissionId", "prizeId")
      `);

      await client.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "SubmissionPrizeClaim_prizeId_idx"
        ON "SubmissionPrizeClaim"("prizeId")
      `);

      await client.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'SubmissionPrizeClaim_submissionId_fkey'
          ) THEN
            ALTER TABLE "SubmissionPrizeClaim"
            ADD CONSTRAINT "SubmissionPrizeClaim_submissionId_fkey"
            FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);

      await client.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'SubmissionPrizeClaim_prizeId_fkey'
          ) THEN
            ALTER TABLE "SubmissionPrizeClaim"
            ADD CONSTRAINT "SubmissionPrizeClaim_prizeId_fkey"
            FOREIGN KEY ("prizeId") REFERENCES "QuizPrize"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);

      prizeClaimTableReady = true;
    })().catch((error) => {
      prizeClaimTablePromise = null;
      throw error;
    });
  }

  await prizeClaimTablePromise;
}

async function findPrizeClaim(client, { submissionId, prizeId }) {
  const rows = await client.$queryRaw`
    SELECT
      "id",
      "submissionId",
      "prizeId",
      "status",
      "claimedAt",
      "declinedAt",
      "createdAt",
      "updatedAt"
    FROM "SubmissionPrizeClaim"
    WHERE "submissionId" = ${submissionId}
      AND "prizeId" = ${prizeId}
    LIMIT 1
  `;

  return normalizePrizeClaimRow(rows[0]);
}

async function upsertPrizeClaim(client, {
  submissionId,
  prizeId,
  status,
  claimedAt = null,
  declinedAt = null,
}) {
  const rows = await client.$queryRaw`
    INSERT INTO "SubmissionPrizeClaim" (
      "submissionId",
      "prizeId",
      "status",
      "claimedAt",
      "declinedAt",
      "updatedAt"
    )
    VALUES (
      ${submissionId},
      ${prizeId},
      ${status},
      ${claimedAt},
      ${declinedAt},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("submissionId", "prizeId") DO UPDATE SET
      "status" = EXCLUDED."status",
      "claimedAt" = EXCLUDED."claimedAt",
      "declinedAt" = EXCLUDED."declinedAt",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING
      "id",
      "submissionId",
      "prizeId",
      "status",
      "claimedAt",
      "declinedAt",
      "createdAt",
      "updatedAt"
  `;

  return normalizePrizeClaimRow(rows[0]);
}

async function findPrizeClaimsBySubmissionIds(client, submissionIds) {
  await ensurePrizeClaimTable(client);

  const ids = submissionIds
    .map((id) => Number(id))
    .filter(Number.isFinite);

  if (!ids.length) {
    return [];
  }

  const rows = await client.$queryRawUnsafe(`
    ${selectPrizeClaimSql}
    WHERE "submissionId" IN (${ids.join(',')})
  `);

  return rows.map(normalizePrizeClaimRow);
}

async function deletePrizeClaimsBySubmissionIds(client, submissionIds) {
  await ensurePrizeClaimTable(client);

  const ids = submissionIds
    .map((id) => Number(id))
    .filter(Number.isFinite);

  if (!ids.length) {
    return { count: 0 };
  }

  const rows = await client.$queryRawUnsafe(`
    DELETE FROM "SubmissionPrizeClaim"
    WHERE "submissionId" IN (${ids.join(',')})
    RETURNING "id"
  `);

  return { count: rows.length };
}

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

export async function updateQuizPrizes(quizId, prizes) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  const normalizedPrizes = prizes
    .map((prize) => ({
      quizId,
      position: prize.position,
      name: prize.name.trim(),
      description: prize.description?.trim() || null,
      quantity: prize.quantity,
      availableQuantity: prize.availableQuantity,
      minimumScore: prize.minimumScore ?? 0,
      minimumPercentage: prize.minimumPercentage,
    }))
    .sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return a.name.localeCompare(b.name);
    });

  await prisma.$transaction(async (tx) => {
    await tx.quizPrize.deleteMany({ where: { quizId } });
    if (normalizedPrizes.length) {
      await tx.quizPrize.createMany({ data: normalizedPrizes });
    }
  });

  return getQuizByIdForAdmin(quizId);
}

export async function addQuestionToQuiz({ quizId, text, order, timeLimitSeconds = 30, options }) {
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
      timeLimitSeconds,
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

export async function copyQuestionsBetweenQuizzes({ sourceQuizId, targetQuizId }) {
  const [sourceQuiz, targetQuiz] = await Promise.all([
    prisma.quiz.findUnique({
      where: { id: sourceQuizId },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { id: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.quiz.findUnique({
      where: { id: targetQuizId },
      include: {
        questions: {
          select: { order: true },
        },
      },
    }),
  ]);

  if (!sourceQuiz) {
    throw new HttpError(404, 'Quiz de origem não encontrado');
  }

  if (!targetQuiz) {
    throw new HttpError(404, 'Quiz de destino não encontrado');
  }

  if (sourceQuiz.id === targetQuiz.id) {
    throw new HttpError(400, 'Escolha um quiz de origem diferente do quiz atual');
  }

  if (!sourceQuiz.questions.length) {
    throw new HttpError(400, 'Quiz de origem não possui perguntas para copiar');
  }

  const initialOrder = targetQuiz.questions.length
    ? Math.max(...targetQuiz.questions.map((question) => question.order))
    : 0;

  const createdQuestions = await prisma.$transaction(
    sourceQuiz.questions.map((question, index) =>
      prisma.question.create({
        data: {
          quizId: targetQuiz.id,
          text: question.text,
          order: initialOrder + index + 1,
          timeLimitSeconds: question.timeLimitSeconds ?? 30,
          options: {
            create: question.options.map((option) => ({
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          },
        },
        include: {
          options: true,
        },
      }),
    ),
  );

  return {
    sourceQuizId: sourceQuiz.id,
    sourceQuizTitle: sourceQuiz.title,
    targetQuizId: targetQuiz.id,
    copiedQuestions: createdQuestions.length,
    questions: createdQuestions,
    message: `${createdQuestions.length} pergunta(s) copiada(s) com sucesso`,
  };
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
      prizes: {
        orderBy: [
          { position: 'asc' },
          { name: 'asc' },
        ],
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
      prizes: {
        orderBy: [
          { position: 'asc' },
          { name: 'asc' },
        ],
      },
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
    isCompetitive: quiz.mode === 'COMPETITIVE',
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
    prizes: quiz.prizes.map(mapPrize),
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
      prizes: {
        orderBy: [
          { position: 'asc' },
          { name: 'asc' },
        ],
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
    prizes: quiz.prizes.map(mapPrize),
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

  if (quiz.mode === 'COMPETITIVE') {
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
      questions: [],
    };
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
      timeLimitSeconds: question.timeLimitSeconds ?? 30,
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
          text: true,
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

  const correctOptions = question.options
    .filter((item) => item.isCorrect)
    .map((item) => ({
      id: item.id,
      text: item.text,
    }));

  return {
    questionId,
    optionId,
    isCorrect: option.isCorrect,
    correctOptions,
  };
}

const competitiveMatchInclude = {
  quiz: {
    select: {
      id: true,
      title: true,
      mode: true,
      isActive: true,
    },
  },
  question: {
    include: {
      options: {
        select: {
          id: true,
          text: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  },
  participants: {
    orderBy: { slot: 'asc' },
  },
  answers: {
    include: {
      participant: true,
      option: {
        select: {
          id: true,
          text: true,
        },
      },
    },
    orderBy: [
      { isCorrect: 'desc' },
      { responseMs: 'asc' },
      { answeredAt: 'asc' },
    ],
  },
};

const shuffleItems = (items) => {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
};

const pickRandomItem = (items) => items[Math.floor(Math.random() * items.length)];

const getQuestionOrder = (match) => {
  if (Array.isArray(match.questionOrder) && match.questionOrder.length) {
    return match.questionOrder.map((item) => Number(item)).filter(Number.isInteger);
  }
  return [match.questionId].filter(Number.isInteger);
};

const buildParticipantAvatarUrl = (email) => {
  const hash = crypto
    .createHash('md5')
    .update(String(email || '').trim().toLowerCase())
    .digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=96&d=mp`;
};

const getCompetitiveQuestions = async (quizId, questionLimit = null, client = prisma) => {
  const questions = await client.question.findMany({
    where: { quizId },
    include: {
      options: {
        select: {
          id: true,
          text: true,
          isCorrect: true,
        },
      },
    },
  });

  if (!questions.length) {
    throw new HttpError(409, 'Quiz não possui perguntas disponíveis no momento');
  }

  const shuffled = shuffleItems(questions);
  const limit = Math.min(questionLimit ?? shuffled.length, shuffled.length);
  return shuffled.slice(0, limit);
};

const getParticipantStats = (match) =>
  match.participants.map((participant) => {
    const answers = match.answers.filter((answer) => answer.participantId === participant.id);
    const correctAnswers = answers.filter((answer) => answer.isCorrect);
    const totalResponseMs = correctAnswers.reduce((total, answer) => total + answer.responseMs, 0);

    return {
      participantId: participant.id,
      userName: participant.userName,
      userEmail: participant.userEmail,
      avatarUrl: buildParticipantAvatarUrl(participant.userEmail),
      score: correctAnswers.length,
      answeredQuestions: answers.length,
      totalResponseMs,
    };
  });

const compareParticipantStats = (a, b) => {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  if (a.totalResponseMs !== b.totalResponseMs) {
    return a.totalResponseMs - b.totalResponseMs;
  }

  return a.participantId - b.participantId;
};

const areAllParticipantsAnsweredCurrentQuestion = (match) => {
  if (!match.participants.length) {
    return false;
  }

  const currentQuestionAnswers = match.answers.filter((answer) => answer.questionId === match.questionId);
  return match.participants.every((participant) =>
    currentQuestionAnswers.some((answer) => answer.participantId === participant.id),
  );
};

const advanceCompetitiveMatch = async (match) => {
  const questionOrder = getQuestionOrder(match);
  const nextQuestionIndex = (match.currentQuestionIndex ?? 0) + 1;

  if (nextQuestionIndex >= questionOrder.length) {
    return prisma.competitiveMatch.update({
      where: { id: match.id },
      data: {
        status: 'COMPLETED',
        endsAt: new Date(),
      },
      include: competitiveMatchInclude,
    });
  }

  const nextQuestion = await prisma.question.findFirst({
    where: {
      id: questionOrder[nextQuestionIndex],
      quizId: match.quizId,
    },
    select: {
      id: true,
      timeLimitSeconds: true,
    },
  });

  if (!nextQuestion) {
    return prisma.competitiveMatch.update({
      where: { id: match.id },
      data: { status: 'COMPLETED' },
      include: competitiveMatchInclude,
    });
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + (nextQuestion.timeLimitSeconds ?? 30) * 1000);

  return prisma.competitiveMatch.update({
    where: { id: match.id },
    data: {
      questionId: nextQuestion.id,
      currentQuestionIndex: nextQuestionIndex,
      startsAt,
      endsAt,
    },
    include: competitiveMatchInclude,
  });
};

const synchronizeCompetitiveMatch = async (match) => {
  if (!match || match.status !== 'ACTIVE') {
    return match;
  }

  const timedOut = match.endsAt && new Date(match.endsAt).getTime() <= Date.now();
  if (timedOut || areAllParticipantsAnsweredCurrentQuestion(match)) {
    return advanceCompetitiveMatch(match);
  }

  return match;
};

const buildCompetitiveResult = (match) => {
  if (!['COMPLETED', 'EXPIRED'].includes(match.status)) {
    return null;
  }

  const stats = getParticipantStats(match).sort(compareParticipantStats);
  const [winner, runnerUp] = stats;

  if (!winner || winner.score === 0) {
    return {
      winnerParticipantId: null,
      outcome: 'NO_CORRECT_ANSWER',
      message: 'Ninguém acertou perguntas nesta disputa.',
      standings: stats,
    };
  }

  const isTie =
    runnerUp &&
    runnerUp.score === winner.score &&
    runnerUp.totalResponseMs === winner.totalResponseMs;

  if (isTie) {
    return {
      winnerParticipantId: null,
      outcome: 'TIE',
      message: `Empate com ${winner.score} ponto(s).`,
      standings: stats,
    };
  }

  return {
    winnerParticipantId: winner.participantId,
    outcome: 'WINNER',
    message: `${winner.userName} venceu com ${winner.score} ponto(s).`,
    standings: stats,
  };
};

const mapCompetitiveMatchState = (match, participantToken) => {
  const participant = match.participants.find((item) => item.token === participantToken);
  if (!participant) {
    throw new HttpError(404, 'Participante não encontrado nesta disputa');
  }

  const ownAnswer = match.answers.find((answer) =>
    answer.participantId === participant.id && answer.questionId === match.questionId,
  ) ?? null;
  const isFinished = ['COMPLETED', 'EXPIRED'].includes(match.status);
  const now = Date.now();
  const endsAtMs = match.endsAt ? new Date(match.endsAt).getTime() : null;
  const remainingMs = endsAtMs ? Math.max(0, endsAtMs - now) : null;
  const result = buildCompetitiveResult(match);
  const questionOrder = getQuestionOrder(match);
  const currentQuestionAnswers = match.answers.filter((answer) => answer.questionId === match.questionId);
  const statsByParticipant = new Map(
    getParticipantStats(match).map((stats) => [stats.participantId, stats]),
  );
  const currentQuestionIndex = match.currentQuestionIndex ?? 0;
  const opponent = match.participants.find((item) => item.id !== participant.id) ?? null;

  return {
    matchId: match.id,
    token: participant.token,
    quiz: {
      id: match.quiz.id,
      title: match.quiz.title,
    },
    status: match.status,
    startsAt: match.startsAt,
    endsAt: match.endsAt,
    remainingMs,
    currentQuestionIndex,
    currentQuestionNumber: questionOrder.length ? currentQuestionIndex + 1 : 0,
    totalQuestions: questionOrder.length,
    participant: {
      id: participant.id,
      slot: participant.slot,
      userName: participant.userName,
      avatarUrl: buildParticipantAvatarUrl(participant.userEmail),
    },
    opponent: opponent
      ? {
          id: opponent.id,
          slot: opponent.slot,
          userName: opponent.userName,
          avatarUrl: buildParticipantAvatarUrl(opponent.userEmail),
        }
      : null,
    scoreboard: match.participants.map((item) => {
      const stats = statsByParticipant.get(item.id) ?? {
        score: 0,
        answeredQuestions: 0,
        totalResponseMs: 0,
      };
      return {
        participantId: item.id,
        slot: item.slot,
        userName: match.status === 'WAITING' && item.id !== participant.id ? `Competidor ${item.slot}` : item.userName,
        avatarUrl: buildParticipantAvatarUrl(item.userEmail),
        isSelf: item.id === participant.id,
        score: stats.score,
        answeredQuestions: stats.answeredQuestions,
        totalResponseMs: stats.totalResponseMs,
        hasAnsweredCurrentQuestion: currentQuestionAnswers.some((answer) => answer.participantId === item.id),
      };
    }),
    participants: match.participants.map((item) => ({
      id: item.id,
      slot: item.slot,
      userName: isFinished || match.status === 'ACTIVE' || item.id === participant.id ? item.userName : `Competidor ${item.slot}`,
      avatarUrl: buildParticipantAvatarUrl(item.userEmail),
      isSelf: item.id === participant.id,
      hasAnswered: isFinished
        ? match.answers.some((answer) => answer.participantId === item.id)
        : currentQuestionAnswers.some((answer) => answer.participantId === item.id),
    })),
    question: match.status === 'ACTIVE' || isFinished
      ? {
          id: match.question.id,
          text: match.question.text,
          order: match.question.order,
          timeLimitSeconds: match.question.timeLimitSeconds ?? 30,
          options: match.question.options.map((option) => ({ id: option.id, text: option.text })),
        }
      : null,
    ownAnswer: ownAnswer
      ? {
          questionId: ownAnswer.questionId,
          optionId: ownAnswer.optionId,
          isCorrect: isFinished ? ownAnswer.isCorrect : null,
          responseMs: ownAnswer.responseMs,
          answeredAt: ownAnswer.answeredAt,
        }
      : null,
    result: result
      ? {
          ...result,
          didWin: result.winnerParticipantId === participant.id,
          standings: result.standings.map((standing) => ({
            ...standing,
            isSelf: standing.participantId === participant.id,
          })),
          answers: match.participants.map((item) => {
            const participantAnswers = match.answers.filter((entry) => entry.participantId === item.id);
            const stats = statsByParticipant.get(item.id);
            return {
              participantId: item.id,
              userName: item.userName,
              avatarUrl: buildParticipantAvatarUrl(item.userEmail),
              isSelf: item.id === participant.id,
              answered: participantAnswers.length > 0,
              score: stats?.score ?? 0,
              answeredQuestions: participantAnswers.length,
              totalResponseMs: stats?.totalResponseMs ?? 0,
            };
          }),
        }
      : null,
  };
};

const getCompetitiveMatchByToken = async ({ quizId, token }) => {
  const participant = await prisma.competitiveParticipant.findUnique({
    where: { token },
    select: { matchId: true },
  });

  if (!participant) {
    throw new HttpError(404, 'Sessão competitiva não encontrada');
  }

  const match = await prisma.competitiveMatch.findFirst({
    where: {
      id: participant.matchId,
      quizId,
    },
    include: competitiveMatchInclude,
  });

  if (!match) {
    throw new HttpError(404, 'Disputa não encontrada para este quiz');
  }

  return synchronizeCompetitiveMatch(match);
};

export async function joinCompetitiveLobby({ quizId, userName, userEmail }) {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      mode: true,
      isActive: true,
      questionLimit: true,
    },
  });

  if (!quiz || !quiz.isActive) {
    throw new HttpError(404, 'Quiz não encontrado ou inativo');
  }

  if (quiz.mode !== 'COMPETITIVE') {
    throw new HttpError(400, 'Este quiz não está configurado como competitivo');
  }

  const existingParticipant = await prisma.competitiveParticipant.findFirst({
    where: {
      userEmail: normalizedEmail,
      match: {
        quizId,
        status: { in: ['WAITING', 'ACTIVE'] },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  if (existingParticipant) {
    const match = await getCompetitiveMatchByToken({ quizId, token: existingParticipant.token });
    return mapCompetitiveMatchState(match, existingParticipant.token);
  }

  const match = await prisma.$transaction(async (tx) => {
    const waitingMatches = await tx.competitiveMatch.findMany({
      where: { quizId, status: 'WAITING' },
      include: {
        participants: {
          orderBy: { slot: 'asc' },
        },
        question: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const eligibleMatches = waitingMatches.filter((item) =>
      item.participants.length === 1 &&
      item.participants[0].userEmail !== normalizedEmail,
    );
    const waitingMatch = eligibleMatches.length ? pickRandomItem(eligibleMatches) : null;

    if (waitingMatch) {
      const startsAt = new Date();
      const durationSeconds = waitingMatch.question.timeLimitSeconds ?? 30;
      const endsAt = new Date(startsAt.getTime() + durationSeconds * 1000);
      await tx.competitiveParticipant.create({
        data: {
          matchId: waitingMatch.id,
          slot: 2,
          userName: userName.trim(),
          userEmail: normalizedEmail,
        },
      });
      return tx.competitiveMatch.update({
        where: { id: waitingMatch.id },
        data: {
          status: 'ACTIVE',
          startsAt,
          endsAt,
        },
        include: competitiveMatchInclude,
      });
    }

    const questions = await getCompetitiveQuestions(quizId, quiz.questionLimit, tx);
    const [firstQuestion] = questions;
    return tx.competitiveMatch.create({
      data: {
        quizId,
        questionId: firstQuestion.id,
        questionOrder: questions.map((question) => question.id),
        currentQuestionIndex: 0,
        status: 'WAITING',
        participants: {
          create: {
            slot: 1,
            userName: userName.trim(),
            userEmail: normalizedEmail,
          },
        },
      },
      include: competitiveMatchInclude,
    });
  });

  const participant = match.participants.find((item) => item.userEmail === normalizedEmail);
  return mapCompetitiveMatchState(match, participant.token);
}

export async function getCompetitiveLobbyStatus({ quizId, token }) {
  const match = await getCompetitiveMatchByToken({ quizId, token });
  return mapCompetitiveMatchState(match, token);
}

export async function submitCompetitiveAnswer({ quizId, token, optionId, responseMs }) {
  const match = await getCompetitiveMatchByToken({ quizId, token });
  if (match.status !== 'ACTIVE') {
    throw new HttpError(409, 'Esta disputa ainda não está ativa ou já foi encerrada');
  }

  const participant = match.participants.find((item) => item.token === token);
  if (!participant) {
    throw new HttpError(404, 'Participante não encontrado nesta disputa');
  }

  const now = new Date();
  if (match.endsAt && now.getTime() > new Date(match.endsAt).getTime()) {
    const synchronized = await synchronizeCompetitiveMatch(match);
    return mapCompetitiveMatchState(synchronized, token);
  }

  const option = await prisma.option.findFirst({
    where: {
      id: optionId,
      questionId: match.questionId,
    },
    select: {
      id: true,
      isCorrect: true,
    },
  });

  if (!option) {
    throw new HttpError(400, 'Alternativa inválida para esta pergunta');
  }

  const serverResponseMs = match.startsAt
    ? Math.max(0, now.getTime() - new Date(match.startsAt).getTime())
    : responseMs ?? 0;
  const existingAnswer = await prisma.competitiveAnswer.findUnique({
    where: {
      matchId_participantId_questionId: {
        matchId: match.id,
        participantId: participant.id,
        questionId: match.questionId,
      },
    },
  });

  if (!existingAnswer) {
    await prisma.competitiveAnswer.create({
      data: {
        matchId: match.id,
        participantId: participant.id,
        questionId: match.questionId,
        optionId: option.id,
        isCorrect: option.isCorrect,
        responseMs: serverResponseMs,
        answeredAt: now,
      },
    });
  }

  const refreshed = await prisma.competitiveMatch.findUnique({
    where: { id: match.id },
    include: competitiveMatchInclude,
  });

  const synchronized = await synchronizeCompetitiveMatch(refreshed);
  return mapCompetitiveMatchState(synchronized, token);
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

const compareRankingEntries = (a, b) => {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  const aDuration = Number.isFinite(a.durationSeconds) ? a.durationSeconds : Number.MAX_SAFE_INTEGER;
  const bDuration = Number.isFinite(b.durationSeconds) ? b.durationSeconds : Number.MAX_SAFE_INTEGER;

  if (aDuration !== bDuration) {
    return aDuration - bDuration;
  }

  const createdDiff = a.createdAt - b.createdAt;
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return a.id - b.id;
};

const firstHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const normalizeIpAddress = (value) => {
  if (!value) {
    return null;
  }
  const first = String(value).split(',')[0].trim();
  return first.replace(/^::ffff:/, '') || null;
};

const extractRequestIp = (requestInfo = {}) => {
  const headers = requestInfo.headers ?? {};
  const forwardedFor = firstHeaderValue(headers['x-forwarded-for']);
  const realIp = firstHeaderValue(headers['x-real-ip']);
  const cfIp = firstHeaderValue(headers['cf-connecting-ip']);
  const ips = Array.isArray(requestInfo.ips) && requestInfo.ips.length ? requestInfo.ips[0] : null;

  return {
    ipAddress: normalizeIpAddress(cfIp || realIp || forwardedFor || ips || requestInfo.ip || requestInfo.socketRemoteAddress),
    ipSource: cfIp
      ? 'cf-connecting-ip'
      : realIp
        ? 'x-real-ip'
        : forwardedFor
          ? 'x-forwarded-for'
          : ips
            ? 'req.ips'
            : requestInfo.ip
              ? 'req.ip'
              : 'socket.remoteAddress',
  };
};

const parseUserAgent = (userAgent = '') => {
  const value = String(userAgent || '');
  const browserPatterns = [
    ['Edge', /Edg\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  const osPatterns = [
    ['Windows', /Windows NT/],
    ['macOS', /Mac OS X/],
    ['iOS', /iPhone|iPad|iPod/],
    ['Android', /Android/],
    ['Linux', /Linux/],
  ];
  const browser = browserPatterns.find(([, pattern]) => pattern.test(value));
  const os = osPatterns.find(([, pattern]) => pattern.test(value));
  const browserMatch = browser ? value.match(browser[1]) : null;

  return {
    browserName: browser?.[0] ?? null,
    browserVersion: browserMatch?.[1] ?? null,
    osName: os?.[0] ?? null,
    deviceType: /Mobi|Android|iPhone|iPod/i.test(value)
      ? 'mobile'
      : /iPad|Tablet/i.test(value)
        ? 'tablet'
        : 'desktop',
  };
};

const buildSubmissionMetadata = (clientMetadata = {}, requestInfo = {}) => {
  const headers = requestInfo.headers ?? {};
  const userAgent = clientMetadata.userAgent || firstHeaderValue(headers['user-agent']) || null;
  const parsedUserAgent = parseUserAgent(userAgent);
  const { ipAddress, ipSource } = extractRequestIp(requestInfo);

  return {
    ipAddress,
    ipSource,
    userAgent,
    browserName: clientMetadata.browserName || parsedUserAgent.browserName,
    browserVersion: clientMetadata.browserVersion || parsedUserAgent.browserVersion,
    osName: clientMetadata.osName || parsedUserAgent.osName,
    deviceType: clientMetadata.deviceType || parsedUserAgent.deviceType,
    locale: clientMetadata.locale || firstHeaderValue(headers['accept-language']) || null,
    timezone: clientMetadata.timezone || null,
    screenResolution: clientMetadata.screenResolution || null,
    referrer: clientMetadata.referrer || firstHeaderValue(headers.referer) || null,
    geoLatitude: clientMetadata.geoLatitude ?? null,
    geoLongitude: clientMetadata.geoLongitude ?? null,
    geoAccuracy: clientMetadata.geoAccuracy ?? null,
    geoStatus: clientMetadata.geoStatus || null,
    clientMetadata: clientMetadata ?? null,
    requestMetadata: {
      acceptLanguage: firstHeaderValue(headers['accept-language']) || null,
      origin: firstHeaderValue(headers.origin) || null,
      referer: firstHeaderValue(headers.referer) || null,
      host: firstHeaderValue(headers.host) || null,
      forwardedFor: firstHeaderValue(headers['x-forwarded-for']) || null,
      realIp: firstHeaderValue(headers['x-real-ip']) || null,
      cfConnectingIp: firstHeaderValue(headers['cf-connecting-ip']) || null,
    },
  };
};

const normalizeSubmissionRow = (row) => ({
  id: Number(row.id),
  quizId: Number(row.quizId),
  userId: row.userId === null || row.userId === undefined ? null : Number(row.userId),
  userName: row.userName,
  userEmail: row.userEmail,
  score: Number(row.score),
  total: Number(row.total),
  percentage: Number(row.percentage),
  durationSeconds: row.durationSeconds === null || row.durationSeconds === undefined
    ? null
    : Number(row.durationSeconds),
  createdAt: row.createdAt,
});

async function createSubmissionRecord({
  quizId,
  userId,
  userName,
  userEmail,
  score,
  total,
  percentage,
  durationSeconds,
  evaluation,
}) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      INSERT INTO "Submission" (
        "quizId",
        "userId",
        "userName",
        "userEmail",
        "score",
        "total",
        "percentage",
        "durationSeconds"
      )
      VALUES (
        ${quizId},
        ${userId},
        ${userName},
        ${userEmail},
        ${score},
        ${total},
        ${percentage},
        ${durationSeconds}
      )
      RETURNING
        "id",
        "quizId",
        "userId",
        "userName",
        "userEmail",
        "score",
        "total",
        "percentage",
        "durationSeconds",
        "createdAt"
    `;

    const submission = normalizeSubmissionRow(rows[0]);

    await tx.submissionAnswer.createMany({
      data: evaluation.map((answer) => ({
        submissionId: submission.id,
        questionId: answer.questionId,
        optionId: answer.optionId,
        isCorrect: answer.isCorrect,
      })),
    });

    return submission;
  });
}

async function persistSubmissionMetadata(submissionId, metadata) {
  try {
    await prisma.$executeRaw`
      UPDATE "Submission"
      SET
        "ipAddress" = ${metadata.ipAddress},
        "ipSource" = ${metadata.ipSource},
        "userAgent" = ${metadata.userAgent},
        "browserName" = ${metadata.browserName},
        "browserVersion" = ${metadata.browserVersion},
        "osName" = ${metadata.osName},
        "deviceType" = ${metadata.deviceType},
        "locale" = ${metadata.locale},
        "timezone" = ${metadata.timezone},
        "screenResolution" = ${metadata.screenResolution},
        "referrer" = ${metadata.referrer},
        "geoLatitude" = ${metadata.geoLatitude},
        "geoLongitude" = ${metadata.geoLongitude},
        "geoAccuracy" = ${metadata.geoAccuracy},
        "geoStatus" = ${metadata.geoStatus},
        "clientMetadata" = ${JSON.stringify(metadata.clientMetadata ?? {})}::jsonb,
        "requestMetadata" = ${JSON.stringify(metadata.requestMetadata ?? {})}::jsonb
      WHERE "id" = ${submissionId}
    `;
  } catch (error) {
    console.warn('Não foi possível persistir metadados da submissão.', {
      submissionId,
      error,
    });
  }
}

export async function createSubmission({
  quizId,
  userName,
  userEmail,
  durationSeconds,
  answers,
  clientMetadata = {},
}, actor = null, requestInfo = {}) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        include: {
          options: true,
        },
      },
      prizes: {
        orderBy: [
          { position: 'asc' },
          { name: 'asc' },
        ],
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

  const submissionMetadata = buildSubmissionMetadata(clientMetadata, requestInfo);
  const submission = await createSubmissionRecord({
    quizId,
    userId: submissionUserId,
    userName: userName || actor?.name || 'Participante',
    userEmail: normalizedEmail,
    score: correctAnswers,
    total: expectedQuestions,
    percentage,
    durationSeconds: durationSeconds ?? null,
    evaluation,
  });

  await persistSubmissionMetadata(submission.id, submissionMetadata);

  const betterResults = await prisma.submission.count({
    where: {
      quizId,
      OR: [
        { score: { gt: submission.score } },
        {
          score: submission.score,
          durationSeconds: { lt: submission.durationSeconds ?? Number.MAX_SAFE_INTEGER },
        },
        {
          score: submission.score,
          durationSeconds: submission.durationSeconds,
          createdAt: { lt: submission.createdAt },
        },
      ],
    },
  });

  await registerSubmission({
    userId: submissionUserId,
    participantEmail: submissionUserId ? null : normalizedEmail,
    participantName: submission.userName,
    score: submission.score,
    total: submission.total,
    percentage: submission.percentage,
  });

  const position = betterResults + 1;
  const positionPrizes = quiz.prizes
    .filter((prize) => prize.position === position)
    .filter((prize) => isPrizeEligibleForSubmission(prize, submission))
    .map((prize) => mapPrize(prize));

  return {
    submissionId: submission.id,
    quizId: submission.quizId,
    userId: submission.userId,
    userName: submission.userName,
    userEmail: submission.userEmail,
    score: submission.score,
    total: submission.total,
    percentage: submission.percentage,
    durationSeconds: submission.durationSeconds,
    position,
    prizes: positionPrizes,
    hasUnavailablePrize: positionPrizes.some((prize) => !prize.isAvailable),
  };
}

const buildFullRanking = (submissions, positionMap) =>
  submissions.map((result) => ({
    submissionId: result.id,
    userName: result.userName,
    userEmail: result.userEmail,
    score: result.score,
    total: result.total,
    percentage: result.percentage,
    durationSeconds: result.durationSeconds,
    createdAt: result.createdAt,
    position: positionMap.get(result.id) ?? null,
  }));

const buildRecentRanking = (fullRanking, size = 10) => {
  if (!fullRanking.length) {
    return [];
  }
  return fullRanking.slice(0, size);
};

const buildRankingByDay = (fullRanking) => {
  const groups = new Map();

  fullRanking.forEach((item) => {
    const dateKey = item.createdAt.toISOString().slice(0, 10);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey).push(item);
  });

  return Array.from(groups.entries())
    .map(([date, items]) => ({
      date,
      items: items
        .slice()
        .sort(compareRankingEntries)
        .map((item, index) => ({
          ...item,
          dailyPosition: index + 1,
        })),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
};

async function getSubmissionRankingPosition(submission, client = prisma) {
  const betterResults = await client.submission.count({
    where: {
      quizId: submission.quizId,
      OR: [
        { score: { gt: submission.score } },
        {
          score: submission.score,
          durationSeconds: { lt: submission.durationSeconds ?? Number.MAX_SAFE_INTEGER },
        },
        {
          score: submission.score,
          durationSeconds: submission.durationSeconds,
          createdAt: { lt: submission.createdAt },
        },
      ],
    },
  });

  return betterResults + 1;
}

export async function confirmPrizeClaim({ quizId, submissionId, prizeId, userEmail, received }) {
  const normalizedEmail = userEmail.trim().toLowerCase();
  await ensurePrizeClaimTable();

  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      quizId,
      userEmail: normalizedEmail,
    },
    select: {
      id: true,
      quizId: true,
      userEmail: true,
      score: true,
      percentage: true,
      durationSeconds: true,
      createdAt: true,
    },
  });

  if (!submission) {
    throw new HttpError(404, 'Submissão não encontrada para este participante');
  }

  const prize = await prisma.quizPrize.findFirst({
    where: {
      id: prizeId,
      quizId,
    },
  });

  if (!prize) {
    throw new HttpError(404, 'Prêmio não encontrado para este quiz');
  }

  const position = await getSubmissionRankingPosition(submission);
  if (prize.position !== position) {
    throw new HttpError(400, 'Este prêmio não corresponde à posição atual do participante');
  }

  if (!isPrizeEligibleForSubmission(prize, submission)) {
    throw new HttpError(400, 'Pontuação insuficiente para retirar este prêmio');
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingClaim = await findPrizeClaim(tx, { submissionId, prizeId });

    if (!received) {
      if (existingClaim?.status === 'CLAIMED') {
        throw new HttpError(409, 'Este prêmio já foi marcado como retirado');
      }

      const declinedAt = existingClaim?.declinedAt ?? new Date();
      const claim = await upsertPrizeClaim(tx, {
        submissionId,
        prizeId,
        status: 'DECLINED',
        declinedAt,
      });

      return { prize, claim };
    }

    if (existingClaim?.status === 'CLAIMED') {
      return { prize, claim: existingClaim };
    }

    const updatedPrize = await tx.quizPrize.updateMany({
      where: {
        id: prizeId,
        availableQuantity: { gt: 0 },
      },
      data: {
        availableQuantity: {
          decrement: 1,
        },
      },
    });

    if (updatedPrize.count === 0) {
      throw new HttpError(409, 'Prêmio indisponível em estoque');
    }

    const refreshedPrize = await tx.quizPrize.findUnique({
      where: { id: prizeId },
    });
    const claimedAt = new Date();
    const claim = await upsertPrizeClaim(tx, {
      submissionId,
      prizeId,
      status: 'CLAIMED',
      claimedAt,
    });

    return { prize: refreshedPrize, claim };
  });

  return {
    submissionId,
    prize: mapPrize(result.prize, result.claim),
    message: result.claim.status === 'CLAIMED'
      ? 'Retirada do prêmio confirmada'
      : 'Prêmio marcado como não retirado',
  };
}

export async function getRanking(quizId, limit = null) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      prizes: {
        orderBy: [
          { position: 'asc' },
          { name: 'asc' },
        ],
      },
    },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  const baseOrder = [
    { createdAt: 'desc' },
    { score: 'desc' },
    { id: 'desc' },
  ];

  const baseSelect = {
    id: true,
    userName: true,
    userEmail: true,
    score: true,
    total: true,
    percentage: true,
    durationSeconds: true,
    createdAt: true,
  };

  const baseQuery = {
    where: { quizId },
    orderBy: baseOrder,
    select: baseSelect,
  };

  const submissions = [];
  const batchSize = 500;
  let skip = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await prisma.submission.findMany({
      ...baseQuery,
      skip,
      take: batchSize,
    });

    if (!batch.length) {
      break;
    }

    submissions.push(...batch);
    skip += batch.length;

    if (batch.length < batchSize) {
      break;
    }
  }

  const rankingOrder = submissions
    .slice()
    .sort(compareRankingEntries);
  const submissionIds = submissions.map((submission) => submission.id);
  const prizeClaims = await findPrizeClaimsBySubmissionIds(prisma, submissionIds);
  const claimLookup = buildClaimLookup(prizeClaims);

  const positionMap = new Map();
  rankingOrder.forEach((item, index) => {
    positionMap.set(item.id, index + 1);
  });

  const submissionsByDate = submissions.slice().sort((a, b) => b.createdAt - a.createdAt);

  const fullRanking = buildFullRanking(submissionsByDate, positionMap);
  const rankingByScore = buildFullRanking(rankingOrder, positionMap);
  const prizesByPosition = buildPrizeAvailabilityByPosition(quiz.prizes);
  const attachPrizes = (items) => items.map((item) => ({
    ...item,
    prizes: (prizesByPosition.get(item.position) ?? [])
      .filter((prize) => isPrizeEligibleForSubmission(prize, item))
      .map((prize) => mapPrizeForSubmission(prize, item.submissionId, claimLookup)),
  }));
  const recentRanking = buildRecentRanking(fullRanking, 10);
  const latestParticipant = recentRanking[0]
    ? {
        ...recentRanking[0],
        prizes: (prizesByPosition.get(recentRanking[0].position) ?? [])
          .filter((prize) => isPrizeEligibleForSubmission(prize, recentRanking[0]))
          .map((prize) => mapPrizeForSubmission(prize, recentRanking[0].submissionId, claimLookup)),
      }
    : null;
  const rankingByDay = buildRankingByDay(fullRanking).map((group) => ({
    ...group,
    items: attachPrizes(group.items),
  }));

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      prizes: quiz.prizes.map(mapPrize),
    },
    ranking: attachPrizes(limit ? rankingByScore.slice(0, limit) : rankingByScore),
    views: {
      recent: {
        items: attachPrizes(recentRanking),
        latestParticipant,
      },
      full: {
        total: rankingByScore.length,
        items: attachPrizes(rankingByScore),
      },
      byDay: rankingByDay,
    },
  };
}

export async function resetQuizData(quizId) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, title: true },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  await ensurePrizeClaimTable();

  const result = await prisma.$transaction(async (tx) => {
    const competitiveMatches = await tx.competitiveMatch.findMany({
      where: { quizId },
      select: { id: true },
    });
    const competitiveMatchIds = competitiveMatches.map((match) => match.id);

    const deletedCompetitiveAnswers = competitiveMatchIds.length
      ? await tx.competitiveAnswer.deleteMany({
          where: {
            matchId: { in: competitiveMatchIds },
          },
        })
      : { count: 0 };

    const deletedCompetitiveParticipants = competitiveMatchIds.length
      ? await tx.competitiveParticipant.deleteMany({
          where: {
            matchId: { in: competitiveMatchIds },
          },
        })
      : { count: 0 };

    const deletedCompetitiveMatches = await tx.competitiveMatch.deleteMany({
      where: { quizId },
    });

    const submissionIds = await tx.submission.findMany({
      where: { quizId },
      select: { id: true },
    }).then((items) => items.map((item) => item.id));

    const deletedPrizeClaims = await deletePrizeClaimsBySubmissionIds(tx, submissionIds);

    const deletedAnswers = await tx.submissionAnswer.deleteMany({
      where: {
        submission: {
          quizId,
        },
      },
    });

    const deletedSubmissions = await tx.submission.deleteMany({
      where: { quizId },
    });

    const prizes = await tx.quizPrize.findMany({
      where: { quizId },
      select: { id: true, quantity: true },
    });

    await Promise.all(
      prizes.map((prize) =>
        tx.quizPrize.update({
          where: { id: prize.id },
          data: { availableQuantity: prize.quantity },
        }),
      ),
    );

    return {
      deletedPrizeClaims: deletedPrizeClaims.count,
      deletedAnswers: deletedAnswers.count,
      deletedSubmissions: deletedSubmissions.count,
      deletedCompetitiveMatches: deletedCompetitiveMatches.count,
      deletedCompetitiveParticipants: deletedCompetitiveParticipants.count,
      deletedCompetitiveAnswers: deletedCompetitiveAnswers.count,
      restoredPrizes: prizes.length,
    };
  });

  let gamification = { rebuiltSubmissions: 0 };
  let gamificationWarning = null;

  try {
    gamification = await rebuildGamificationFromSubmissions();
  } catch (error) {
    console.error('Falha ao recalcular gamificação após reset do quiz', {
      quizId,
      error,
    });
    gamificationWarning = 'O quiz foi resetado, mas não foi possível recalcular a gamificação automaticamente.';
  }

  return {
    quizId,
    quizTitle: quiz.title,
    ...result,
    rebuiltGamificationSubmissions: gamification.rebuiltSubmissions,
    gamificationWarning,
    message: gamificationWarning
      ? 'Dados do quiz resetados com sucesso, com aviso na gamificação'
      : 'Dados do quiz resetados com sucesso',
  };
}

export const clearQuizRanking = resetQuizData;

async function getDashboardClientInteractionData(quizId = null) {
  try {
    const [interactionRows, quizMetadataRows, clientSummaryRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          s."id" AS "submissionId",
          s."quizId",
          q."title" AS "quizTitle",
          s."userName",
          s."userEmail",
          s."score",
          s."total",
          s."percentage",
          s."durationSeconds",
          s."createdAt",
          s."ipAddress",
          s."ipSource",
          s."browserName",
          s."browserVersion",
          s."osName",
          s."deviceType",
          s."locale",
          s."timezone",
          s."screenResolution",
          s."referrer",
          s."geoLatitude",
          s."geoLongitude",
          s."geoAccuracy",
          s."geoStatus"
        FROM "Submission" s
        INNER JOIN "Quiz" q ON q."id" = s."quizId"
        WHERE (${quizId}::int IS NULL OR s."quizId" = ${quizId})
        ORDER BY s."createdAt" DESC
        LIMIT 100
      `,
      prisma.$queryRaw`
        SELECT
          s."quizId",
          COUNT(*)::int AS "total",
          COUNT(s."ipAddress")::int AS "withIp",
          COUNT(s."browserName")::int AS "withBrowser",
          COUNT(s."geoLatitude")::int AS "withCoordinates",
          COUNT(DISTINCT s."ipAddress")::int AS "uniqueIps"
        FROM "Submission" s
        WHERE (${quizId}::int IS NULL OR s."quizId" = ${quizId})
        GROUP BY s."quizId"
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE(s."deviceType", 'Não identificado') AS "deviceType",
          COALESCE(s."browserName", 'Não identificado') AS "browserName",
          COALESCE(s."osName", 'Não identificado') AS "osName",
          COUNT(*)::int AS "count"
        FROM "Submission" s
        WHERE (${quizId}::int IS NULL OR s."quizId" = ${quizId})
        GROUP BY s."deviceType", s."browserName", s."osName"
        ORDER BY COUNT(*) DESC
        LIMIT 20
      `,
    ]);

    return {
      interactions: interactionRows.map((row) => ({
        submissionId: Number(row.submissionId),
        quizId: Number(row.quizId),
        quizTitle: row.quizTitle,
        userName: row.userName,
        userEmail: row.userEmail,
        score: Number(row.score),
        total: Number(row.total),
        percentage: Number(row.percentage),
        durationSeconds: row.durationSeconds === null ? null : Number(row.durationSeconds),
        createdAt: row.createdAt,
        ipAddress: row.ipAddress,
        ipSource: row.ipSource,
        browserName: row.browserName,
        browserVersion: row.browserVersion,
        osName: row.osName,
        deviceType: row.deviceType,
        locale: row.locale,
        timezone: row.timezone,
        screenResolution: row.screenResolution,
        referrer: row.referrer,
        geoLatitude: row.geoLatitude === null ? null : Number(row.geoLatitude),
        geoLongitude: row.geoLongitude === null ? null : Number(row.geoLongitude),
        geoAccuracy: row.geoAccuracy === null ? null : Number(row.geoAccuracy),
        geoStatus: row.geoStatus,
      })),
      quizMetadata: quizMetadataRows.map((row) => ({
        quizId: Number(row.quizId),
        total: Number(row.total),
        withIp: Number(row.withIp),
        withBrowser: Number(row.withBrowser),
        withCoordinates: Number(row.withCoordinates),
        uniqueIps: Number(row.uniqueIps),
      })),
      clientSummary: clientSummaryRows.map((row) => ({
        deviceType: row.deviceType,
        browserName: row.browserName,
        osName: row.osName,
        count: Number(row.count),
      })),
    };
  } catch (error) {
    console.warn('Metadados de cliente indisponíveis no dashboard.', error);
    return {
      interactions: [],
      quizMetadata: [],
      clientSummary: [],
    };
  }
}

export async function getQuizDashboardSummary(quizId) {
  await ensurePrizeClaimTable();

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      description: true,
      isActive: true,
      mode: true,
      questionLimit: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          questions: true,
          submissions: true,
        },
      },
      prizes: {
        select: {
          id: true,
          position: true,
          name: true,
          quantity: true,
          availableQuantity: true,
          minimumScore: true,
          minimumPercentage: true,
        },
        orderBy: [
          { position: 'asc' },
          { id: 'asc' },
        ],
      },
    },
  });

  if (!quiz) {
    throw new HttpError(404, 'Quiz não encontrado');
  }

  const [
    averageStats,
    durationStats,
    distinctParticipants,
    temporaryParticipants,
    topPerformers,
    recentSubmissions,
    prizeClaimRows,
    questionRows,
    scoreDistributionRows,
    clientInteractionData,
  ] = await Promise.all([
    prisma.submission.aggregate({
      where: { quizId },
      _avg: {
        percentage: true,
        score: true,
        durationSeconds: true,
      },
    }),
    prisma.submission.aggregate({
      where: {
        quizId,
        durationSeconds: { not: null },
      },
      _min: {
        durationSeconds: true,
      },
      _max: {
        durationSeconds: true,
      },
    }),
    prisma.submission.findMany({
      distinct: ['userEmail'],
      where: {
        quizId,
        userEmail: { not: null },
      },
      select: { userEmail: true },
    }),
    prisma.submission.findMany({
      distinct: ['userEmail'],
      where: {
        quizId,
        userId: null,
        userEmail: { not: null },
      },
      select: { userEmail: true },
    }),
    prisma.submission.findMany({
      where: { quizId },
      orderBy: [
        { percentage: 'desc' },
        { score: 'desc' },
        { durationSeconds: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 10,
      select: {
        id: true,
        userName: true,
        userEmail: true,
        score: true,
        total: true,
        percentage: true,
        durationSeconds: true,
        createdAt: true,
      },
    }),
    prisma.submission.findMany({
      where: { quizId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        userName: true,
        userEmail: true,
        score: true,
        total: true,
        percentage: true,
        durationSeconds: true,
        createdAt: true,
      },
    }),
    prisma.$queryRaw`
      SELECT
        spc."status",
        COUNT(*)::int AS count
      FROM "SubmissionPrizeClaim" spc
      INNER JOIN "QuizPrize" qp ON qp."id" = spc."prizeId"
      WHERE qp."quizId" = ${quizId}
      GROUP BY spc."status"
    `,
    prisma.$queryRaw`
      SELECT
        q."id" AS "questionId",
        q."text",
        q."order",
        COUNT(sa."id")::int AS "attempts",
        COALESCE(SUM(CASE WHEN sa."isCorrect" THEN 1 ELSE 0 END), 0)::int AS "correct",
        COALESCE(SUM(CASE WHEN sa."isCorrect" THEN 0 ELSE 1 END), 0)::int AS "incorrect"
      FROM "Question" q
      LEFT JOIN "SubmissionAnswer" sa ON sa."questionId" = q."id"
      WHERE q."quizId" = ${quizId}
      GROUP BY q."id", q."text", q."order"
      ORDER BY q."order" ASC
    `,
    prisma.$queryRaw`
      SELECT
        CASE
          WHEN s."percentage" >= 80 THEN '80% ou mais'
          WHEN s."percentage" >= 50 THEN '50% a 79%'
          ELSE 'Abaixo de 50%'
        END AS "range",
        COUNT(*)::int AS "count"
      FROM "Submission" s
      WHERE s."quizId" = ${quizId}
      GROUP BY "range"
      ORDER BY MIN(s."percentage") DESC
    `,
    getDashboardClientInteractionData(quizId),
  ]);

  const prizeClaims = prizeClaimRows.reduce((acc, row) => {
    if (row.status === 'CLAIMED') {
      acc.claimed += Number(row.count ?? 0);
    } else if (row.status === 'DECLINED') {
      acc.declined += Number(row.count ?? 0);
    } else {
      acc.pending += Number(row.count ?? 0);
    }
    return acc;
  }, {
    claimed: 0,
    declined: 0,
    pending: 0,
  });

  const totalPrizeQuantity = quiz.prizes.reduce((total, prize) => total + prize.quantity, 0);
  const availablePrizeQuantity = quiz.prizes.reduce((total, prize) => total + prize.availableQuantity, 0);

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      isActive: quiz.isActive,
      mode: quiz.mode,
      questionLimit: quiz.questionLimit,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
    },
    metrics: {
      totalQuestions: quiz._count.questions,
      totalSubmissions: quiz._count.submissions,
      totalParticipants: distinctParticipants.length,
      temporaryParticipants: temporaryParticipants.length,
      averageScore: Number((averageStats._avg.score ?? 0).toFixed(2)),
      averageAccuracy: Number((averageStats._avg.percentage ?? 0).toFixed(2)),
      averageDurationSeconds: Math.round(averageStats._avg.durationSeconds ?? 0),
      fastestDurationSeconds: durationStats._min.durationSeconds ?? null,
      slowestDurationSeconds: durationStats._max.durationSeconds ?? null,
      prizes: {
        configuredItems: quiz.prizes.length,
        totalQuantity: totalPrizeQuantity,
        availableQuantity: availablePrizeQuantity,
        unavailableQuantity: Math.max(0, totalPrizeQuantity - availablePrizeQuantity),
        claimed: prizeClaims.claimed,
        declined: prizeClaims.declined,
        pending: Math.max(0, totalPrizeQuantity - availablePrizeQuantity - prizeClaims.claimed),
      },
    },
    prizes: quiz.prizes.map((prize) => ({
      id: prize.id,
      position: prize.position,
      name: prize.name,
      quantity: prize.quantity,
      availableQuantity: prize.availableQuantity,
      minimumScore: prize.minimumScore,
      minimumPercentage: prize.minimumPercentage,
    })),
    questionStats: questionRows.map((row) => {
      const attempts = Number(row.attempts);
      const correct = Number(row.correct);
      const incorrect = Number(row.incorrect);
      return {
        questionId: Number(row.questionId),
        text: row.text,
        order: Number(row.order),
        attempts,
        correct,
        incorrect,
        accuracy: attempts ? Number(((correct / attempts) * 100).toFixed(2)) : 0,
      };
    }),
    scoreDistribution: scoreDistributionRows.map((row) => ({
      range: row.range,
      count: Number(row.count),
    })),
    topPerformers: topPerformers.map((submission) => ({
      submissionId: submission.id,
      userName: submission.userName,
      userEmail: submission.userEmail,
      score: submission.score,
      total: submission.total,
      percentage: submission.percentage,
      durationSeconds: submission.durationSeconds,
      createdAt: submission.createdAt,
    })),
    recentActivity: recentSubmissions.map((submission) => ({
      submissionId: submission.id,
      userName: submission.userName,
      userEmail: submission.userEmail,
      score: submission.score,
      total: submission.total,
      percentage: submission.percentage,
      durationSeconds: submission.durationSeconds,
      createdAt: submission.createdAt,
    })),
    clientInteractions: clientInteractionData.interactions,
    clientSummary: clientInteractionData.clientSummary,
    clientMetadata: clientInteractionData.quizMetadata[0] ?? {
      total: 0,
      withIp: 0,
      withBrowser: 0,
      withCoordinates: 0,
      uniqueIps: 0,
    },
    geoInteractions: clientInteractionData.interactions.filter((item) =>
      Number.isFinite(item.geoLatitude) && Number.isFinite(item.geoLongitude)
    ),
  };
}

export async function getDashboardSummary() {
  await ensurePrizeClaimTable();

  const [
    totalQuizzes,
    activeQuizzes,
    totalQuestions,
    totalSubmissions,
    totalRegisteredUsers,
    averageStats,
    durationStats,
    distinctParticipants,
    registeredParticipantRows,
    temporaryParticipantRows,
    recentSubmissions,
    topQuizStats,
    topPerformers,
    quizzes,
    prizeClaimRows,
  ] = await Promise.all([
    prisma.quiz.count(),
    prisma.quiz.count({ where: { isActive: true } }),
    prisma.question.count(),
    prisma.submission.count(),
    prisma.user.count(),
    prisma.submission.aggregate({
      _avg: {
        percentage: true,
        score: true,
        durationSeconds: true,
      },
    }),
    prisma.submission.aggregate({
      where: {
        durationSeconds: { not: null },
      },
      _avg: {
        durationSeconds: true,
      },
      _min: {
        durationSeconds: true,
      },
      _max: {
        durationSeconds: true,
      },
    }),
    prisma.submission.findMany({
      distinct: ['userEmail'],
      where: {
        userEmail: { not: null },
      },
      select: {
        userEmail: true,
      },
    }),
    prisma.submission.findMany({
      distinct: ['userId'],
      where: {
        userId: { not: null },
      },
      select: {
        userId: true,
      },
    }),
    prisma.submission.findMany({
      distinct: ['userEmail'],
      where: {
        userId: null,
        userEmail: { not: null },
      },
      select: {
        userEmail: true,
      },
    }),
    prisma.submission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        userName: true,
        userEmail: true,
        score: true,
        total: true,
        percentage: true,
        durationSeconds: true,
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
        score: true,
        durationSeconds: true,
      },
      _min: {
        durationSeconds: true,
      },
      _max: {
        durationSeconds: true,
      },
      orderBy: {
        _count: {
          quizId: 'desc',
        },
      },
    }),
    prisma.submission.findMany({
      orderBy: [
        { percentage: 'desc' },
        { score: 'desc' },
        { durationSeconds: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 5,
      select: {
        id: true,
        userName: true,
        score: true,
        total: true,
        percentage: true,
        durationSeconds: true,
        createdAt: true,
        quiz: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
    prisma.quiz.findMany({
      orderBy: [
        { isActive: 'desc' },
        { title: 'asc' },
      ],
      select: {
        id: true,
        title: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            questions: true,
            submissions: true,
          },
        },
        prizes: {
          select: {
            id: true,
            quantity: true,
            availableQuantity: true,
          },
        },
      },
    }),
    prisma.$queryRaw`
      SELECT
        qp."quizId",
        spc."status",
        COUNT(*)::int AS count
      FROM "SubmissionPrizeClaim" spc
      INNER JOIN "QuizPrize" qp ON qp."id" = spc."prizeId"
      GROUP BY qp."quizId", spc."status"
    `,
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
  const topQuizStatsMap = new Map(topQuizStats.map((item) => [item.quizId, item]));
  const prizeClaimsByQuiz = new Map();
  const clientInteractionData = await getDashboardClientInteractionData();
  const clientMetadataByQuiz = new Map(
    clientInteractionData.quizMetadata.map((item) => [item.quizId, item]),
  );

  prizeClaimRows.forEach((row) => {
    const quizId = Number(row.quizId);
    const current = prizeClaimsByQuiz.get(quizId) ?? {
      claimed: 0,
      declined: 0,
      pending: 0,
    };

    if (row.status === 'CLAIMED') {
      current.claimed += Number(row.count ?? 0);
    } else if (row.status === 'DECLINED') {
      current.declined += Number(row.count ?? 0);
    } else {
      current.pending += Number(row.count ?? 0);
    }

    prizeClaimsByQuiz.set(quizId, current);
  });

  const quizStats = quizzes.map((quiz) => {
    const submissionStats = topQuizStatsMap.get(quiz.id);
    const prizeClaims = prizeClaimsByQuiz.get(quiz.id) ?? {
      claimed: 0,
      declined: 0,
      pending: 0,
    };
    const prizeTotalQuantity = quiz.prizes.reduce((total, prize) => total + prize.quantity, 0);
    const prizeAvailableQuantity = quiz.prizes.reduce((total, prize) => total + prize.availableQuantity, 0);
    const clientMetadata = clientMetadataByQuiz.get(quiz.id) ?? {
      total: 0,
      withIp: 0,
      withBrowser: 0,
      withCoordinates: 0,
      uniqueIps: 0,
    };

    return {
      quizId: quiz.id,
      title: quiz.title,
      isActive: quiz.isActive,
      questions: quiz._count.questions,
      submissions: quiz._count.submissions,
      averageScore: Number((submissionStats?._avg.score ?? 0).toFixed(2)),
      averageAccuracy: Number((submissionStats?._avg.percentage ?? 0).toFixed(2)),
      averageDurationSeconds: Math.round(submissionStats?._avg.durationSeconds ?? 0),
      fastestDurationSeconds: submissionStats?._min.durationSeconds ?? null,
      slowestDurationSeconds: submissionStats?._max.durationSeconds ?? null,
      prizes: {
        configuredItems: quiz.prizes.length,
        totalQuantity: prizeTotalQuantity,
        availableQuantity: prizeAvailableQuantity,
        unavailableQuantity: Math.max(0, prizeTotalQuantity - prizeAvailableQuantity),
        claimed: prizeClaims.claimed,
        declined: prizeClaims.declined,
        pending: Math.max(0, prizeTotalQuantity - prizeAvailableQuantity - prizeClaims.claimed),
      },
      clientMetadata,
      createdAt: quiz.createdAt,
    };
  });

  const globalPrizeStats = quizStats.reduce((acc, quiz) => ({
    configuredItems: acc.configuredItems + quiz.prizes.configuredItems,
    totalQuantity: acc.totalQuantity + quiz.prizes.totalQuantity,
    availableQuantity: acc.availableQuantity + quiz.prizes.availableQuantity,
    unavailableQuantity: acc.unavailableQuantity + quiz.prizes.unavailableQuantity,
    claimed: acc.claimed + quiz.prizes.claimed,
    declined: acc.declined + quiz.prizes.declined,
    pending: acc.pending + quiz.prizes.pending,
  }), {
    configuredItems: 0,
    totalQuantity: 0,
    availableQuantity: 0,
    unavailableQuantity: 0,
    claimed: 0,
    declined: 0,
    pending: 0,
  });

  return {
    metrics: {
      totalQuizzes,
      activeQuizzes,
      totalQuestions,
      totalSubmissions,
      totalRegisteredUsers,
      totalParticipants: distinctParticipants.length,
      registeredParticipants: registeredParticipantRows.length,
      temporaryParticipants: temporaryParticipantRows.length,
      averageScore: Number((averageStats._avg.score ?? 0).toFixed(2)),
      averageAccuracy: Number((averageStats._avg.percentage ?? 0).toFixed(2)),
      averageDurationSeconds: Math.round(durationStats._avg.durationSeconds ?? 0),
      fastestDurationSeconds: durationStats._min.durationSeconds ?? null,
      slowestDurationSeconds: durationStats._max.durationSeconds ?? null,
      prizes: globalPrizeStats,
    },
    topQuizzes: topQuizStats.slice(0, 5).map((item) => ({
      quizId: item.quizId,
      title: quizNameMap.get(item.quizId) ?? 'Quiz removido',
      submissions: item._count.quizId,
      averageScore: Number((item._avg.score ?? 0).toFixed(2)),
      averageAccuracy: Number((item._avg.percentage ?? 0).toFixed(2)),
      averageDurationSeconds: Math.round(item._avg.durationSeconds ?? 0),
      fastestDurationSeconds: item._min.durationSeconds ?? null,
    })),
    topPerformers: topPerformers.map((submission) => ({
      submissionId: submission.id,
      userName: submission.userName,
      quizTitle: submission.quiz?.title ?? 'Quiz removido',
      score: submission.score,
      total: submission.total,
      percentage: submission.percentage,
      durationSeconds: submission.durationSeconds,
      createdAt: submission.createdAt,
    })),
    quizStats,
    prizeStats: globalPrizeStats,
    clientInteractions: clientInteractionData.interactions,
    clientSummary: clientInteractionData.clientSummary,
    geoInteractions: clientInteractionData.interactions.filter((item) =>
      Number.isFinite(item.geoLatitude) && Number.isFinite(item.geoLongitude)
    ),
    recentActivity: recentSubmissions.map((submission) => ({
      submissionId: submission.id,
      userName: submission.userName,
      userEmail: submission.userEmail,
      quizTitle: submission.quiz?.title ?? 'Quiz removido',
      score: submission.score,
      total: submission.total,
      percentage: submission.percentage,
      durationSeconds: submission.durationSeconds,
      createdAt: submission.createdAt,
    })),
  };
}
