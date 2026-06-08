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

const mapPrize = (prize, claim = null) => ({
  id: prize.id,
  position: prize.position,
  name: prize.name,
  description: prize.description,
  quantity: prize.quantity,
  availableQuantity: prize.availableQuantity,
  isAvailable: prize.availableQuantity > 0,
  claimStatus: claim?.status ?? null,
  claimedAt: claim?.claimedAt ?? null,
  declinedAt: claim?.declinedAt ?? null,
});

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

export async function createSubmission({ quizId, userName, userEmail, durationSeconds, answers }, actor = null) {
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

  const submission = await prisma.submission.create({
    data: {
      quizId,
      userId: submissionUserId,
      userName: userName || actor?.name || 'Participante',
      userEmail: normalizedEmail,
      score: correctAnswers,
      total: expectedQuestions,
      percentage,
      durationSeconds: durationSeconds ?? null,
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

  if (submissionUserId) {
    await registerSubmission({
      userId: submissionUserId,
      score: submission.score,
      total: submission.total,
      percentage: submission.percentage,
    });
  }

  const position = betterResults + 1;
  const positionPrizes = quiz.prizes
    .filter((prize) => prize.position === position)
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
      .map((prize) => mapPrizeForSubmission(prize, item.submissionId, claimLookup)),
  }));
  const recentRanking = buildRecentRanking(fullRanking, 10);
  const latestParticipant = recentRanking[0]
    ? {
        ...recentRanking[0],
        prizes: (prizesByPosition.get(recentRanking[0].position) ?? [])
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
