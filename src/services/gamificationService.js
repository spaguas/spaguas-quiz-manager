import prisma from '../config/prisma.js';
import HttpError from '../utils/httpError.js';

const LEVEL_BASE = 100;

export const BADGE_CONDITION_METRICS = [
  'points',
  'level',
  'experience',
  'totalQuizzes',
  'totalCorrect',
  'totalIncorrect',
  'bestStreak',
  'currentStreak',
  'accuracyPercentage',
];

export const BADGE_CONDITION_OPERATORS = ['gte', 'gt', 'eq', 'lte', 'lt'];

const DEFAULT_BADGES = [
  {
    code: 'FIRST_QUIZ',
    name: 'Primeiro Quiz',
    description: 'Complete um quiz pela primeira vez.',
    icon: '🥉',
    conditionMetric: 'totalQuizzes',
    conditionOperator: 'gte',
    conditionValue: 1,
  },
  {
    code: 'FIVE_QUIZZES',
    name: 'Maratonista',
    description: 'Complete 5 quizzes.',
    icon: '🥈',
    conditionMetric: 'totalQuizzes',
    conditionOperator: 'gte',
    conditionValue: 5,
  },
  {
    code: 'TEN_CORRECT',
    name: 'Sábio',
    description: 'Acumule 10 respostas corretas.',
    icon: '🥇',
    conditionMetric: 'totalCorrect',
    conditionOperator: 'gte',
    conditionValue: 10,
  },
  {
    code: 'STREAK_MASTER',
    name: 'Embalado',
    description: 'Faça uma sequência de 3 quizzes com 100% de acerto.',
    icon: '🏆',
    conditionMetric: 'bestStreak',
    conditionOperator: 'gte',
    conditionValue: 3,
  },
];

export async function ensureBadgesExist() {
  const existingBadges = await prisma.badge.findMany({
    where: {
      code: {
        in: DEFAULT_BADGES.map((badge) => badge.code),
      },
    },
    select: { code: true },
  });
  const existingCodes = new Set(existingBadges.map((badge) => badge.code));
  const missingBadges = DEFAULT_BADGES.filter((badge) => !existingCodes.has(badge.code));

  if (!missingBadges.length) {
    return;
  }

  await prisma.badge.createMany({
    data: missingBadges,
    skipDuplicates: true,
  });
}

const normalizeParticipantEmail = (email) => (email || '').trim().toLowerCase();

const buildGamificationIdentity = ({ userId = null, participantEmail = null, participantName = null }) => {
  const normalizedUserId = userId ? Number(userId) : null;
  if (normalizedUserId) {
    return {
      userId: normalizedUserId,
      participantEmail: null,
      participantName: participantName || null,
      statsWhere: { userId: normalizedUserId },
      badgeWhere: { userId: normalizedUserId },
      createData: { userId: normalizedUserId },
    };
  }

  const normalizedEmail = normalizeParticipantEmail(participantEmail);
  if (!normalizedEmail) {
    throw new Error('Informe um usuário ou e-mail para registrar gamificação');
  }

  return {
    userId: null,
    participantEmail: normalizedEmail,
    participantName: participantName || null,
    statsWhere: { participantEmail: normalizedEmail },
    badgeWhere: { participantEmail: normalizedEmail },
    createData: {
      participantEmail: normalizedEmail,
      participantName: participantName || null,
    },
  };
};

export async function getOrCreateStats(identityInput) {
  const identity = typeof identityInput === 'number'
    ? buildGamificationIdentity({ userId: identityInput })
    : buildGamificationIdentity(identityInput);

  const stats = await prisma.userGamification.findUnique({ where: identity.statsWhere });
  if (stats) {
    if (!identity.userId && identity.participantName && stats.participantName !== identity.participantName) {
      return prisma.userGamification.update({
        where: identity.statsWhere,
        data: { participantName: identity.participantName },
      });
    }
    return stats;
  }

  return prisma.userGamification.create({
    data: identity.createData,
  });
}

function calculateLevel(experience) {
  let level = 1;
  let threshold = LEVEL_BASE;
  let remaining = experience;

  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = Math.round(threshold * 1.5);
  }

  return {
    level,
    nextLevelAt: threshold,
    experienceIntoLevel: remaining,
  };
}

function calculateSubmissionPoints({ score, percentage }) {
  const basePoints = Math.max(score * 10, 5);
  const bonus = percentage === 100 ? 20 : percentage >= 70 ? 10 : 0;
  return basePoints + bonus;
}

function getConditionMetricValue(stats, metric) {
  if (metric === 'accuracyPercentage') {
    const answered = stats.totalCorrect + stats.totalIncorrect;
    return answered > 0 ? (stats.totalCorrect / answered) * 100 : 0;
  }

  return Number(stats[metric] ?? 0);
}

function evaluateBadgeCondition(badge, stats) {
  if (!BADGE_CONDITION_METRICS.includes(badge.conditionMetric)) {
    return false;
  }

  const currentValue = getConditionMetricValue(stats, badge.conditionMetric);
  const targetValue = Number(badge.conditionValue);

  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue)) {
    return false;
  }

  switch (badge.conditionOperator) {
    case 'gte':
      return currentValue >= targetValue;
    case 'gt':
      return currentValue > targetValue;
    case 'eq':
      return currentValue === targetValue;
    case 'lte':
      return currentValue <= targetValue;
    case 'lt':
      return currentValue < targetValue;
    default:
      return false;
  }
}

async function awardBadges(identity, stats) {
  await ensureBadgesExist();

  const existing = await prisma.userBadge.findMany({
    where: identity.badgeWhere,
    include: { badge: true },
  });

  const ownedCodes = new Set(existing.map((item) => item.badge.code));

  const badgesToAward = await prisma.badge.findMany({
    where: {
      isActive: true,
      code: {
        notIn: Array.from(ownedCodes),
      },
    },
  });

  const foundBadges = badgesToAward.filter((badge) => evaluateBadgeCondition(badge, stats));

  if (!foundBadges.length) {
    return [];
  }

  await prisma.userBadge.createMany({
    data: foundBadges.map((badge) => ({
      userId: identity.userId,
      participantEmail: identity.participantEmail,
      badgeId: badge.id,
    })),
    skipDuplicates: true,
  });

  return foundBadges;
}

const normalizeBadgeCode = (code) =>
  (code || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeBadgePayload = (data) => {
  const payload = { ...data };
  if (payload.code !== undefined) {
    payload.code = normalizeBadgeCode(payload.code);
  }
  return payload;
};

export async function listBadges() {
  await ensureBadgesExist();
  return prisma.badge.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  });
}

const getGamificationIdentityKey = ({ userId = null, participantEmail = null }) => {
  if (userId) {
    return `user:${Number(userId)}`;
  }
  const email = normalizeParticipantEmail(participantEmail);
  return email ? `email:${email}` : null;
};

export async function getGamificationDashboard() {
  await ensureBadgesExist();

  const [badges, statsRows, userBadges, recentEvents] = await Promise.all([
    prisma.badge.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.userGamification.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { points: 'desc' },
        { totalQuizzes: 'desc' },
        { lastSubmissionAt: 'desc' },
      ],
    }),
    prisma.userBadge.findMany({
      include: {
        badge: true,
      },
      orderBy: {
        awardedAt: 'desc',
      },
    }),
    prisma.gamificationEvent.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const badgesByParticipant = new Map();
  userBadges.forEach((entry) => {
    const key = getGamificationIdentityKey({
      userId: entry.userId,
      participantEmail: entry.participantEmail,
    });
    if (!key) {
      return;
    }

    if (!badgesByParticipant.has(key)) {
      badgesByParticipant.set(key, new Map());
    }

    badgesByParticipant.get(key).set(entry.badgeId, {
      id: entry.id,
      badgeId: entry.badgeId,
      awardedAt: entry.awardedAt,
      code: entry.badge.code,
      name: entry.badge.name,
      icon: entry.badge.icon,
    });
  });

  const participants = statsRows.map((stats, index) => {
    const key = getGamificationIdentityKey({
      userId: stats.userId,
      participantEmail: stats.participantEmail,
    }) ?? `stats:${stats.id}`;
    const earnedBadges = badgesByParticipant.get(key) ?? new Map();
    const answered = stats.totalCorrect + stats.totalIncorrect;

    return {
      position: index + 1,
      identityKey: key,
      userId: stats.userId,
      name: stats.user?.name ?? stats.participantName ?? stats.participantEmail ?? 'Participante',
      email: stats.user?.email ?? stats.participantEmail,
      isRegistered: Boolean(stats.userId),
      points: stats.points,
      level: stats.level,
      experience: stats.experience,
      nextLevelAt: stats.nextLevelAt,
      totalQuizzes: stats.totalQuizzes,
      totalCorrect: stats.totalCorrect,
      totalIncorrect: stats.totalIncorrect,
      accuracyPercentage: answered ? Number(((stats.totalCorrect / answered) * 100).toFixed(2)) : 0,
      bestStreak: stats.bestStreak,
      currentStreak: stats.currentStreak,
      lastSubmissionAt: stats.lastSubmissionAt,
      badges: badges.map((badge) => {
        const earned = earnedBadges.get(badge.id);
        return {
          badgeId: badge.id,
          code: badge.code,
          name: badge.name,
          icon: badge.icon,
          description: badge.description,
          isActive: badge.isActive,
          earned: Boolean(earned),
          awardedAt: earned?.awardedAt ?? null,
        };
      }),
      earnedBadgeCount: earnedBadges.size,
    };
  });

  const totalBadgesAwarded = userBadges.length;
  const totalPoints = statsRows.reduce((total, stats) => total + stats.points, 0);
  const totalQuizzes = statsRows.reduce((total, stats) => total + stats.totalQuizzes, 0);
  const totalCorrect = statsRows.reduce((total, stats) => total + stats.totalCorrect, 0);
  const totalIncorrect = statsRows.reduce((total, stats) => total + stats.totalIncorrect, 0);
  const answered = totalCorrect + totalIncorrect;
  const levelDistribution = statsRows.reduce((acc, stats) => {
    const key = `Nível ${stats.level}`;
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());

  const badgeStats = badges.map((badge) => ({
    id: badge.id,
    code: badge.code,
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    isActive: badge.isActive,
    conditionMetric: badge.conditionMetric,
    conditionOperator: badge.conditionOperator,
    conditionValue: badge.conditionValue,
    earnedCount: userBadges.filter((entry) => entry.badgeId === badge.id).length,
  }));

  return {
    metrics: {
      totalParticipants: statsRows.length,
      registeredParticipants: statsRows.filter((stats) => stats.userId).length,
      temporaryParticipants: statsRows.filter((stats) => !stats.userId).length,
      totalBadges: badges.length,
      activeBadges: badges.filter((badge) => badge.isActive).length,
      totalBadgesAwarded,
      totalPoints,
      totalQuizzes,
      averageAccuracy: answered ? Number(((totalCorrect / answered) * 100).toFixed(2)) : 0,
      averageLevel: statsRows.length
        ? Number((statsRows.reduce((total, stats) => total + stats.level, 0) / statsRows.length).toFixed(2))
        : 0,
    },
    badges: badgeStats,
    participants,
    levelDistribution: Array.from(levelDistribution.entries()).map(([level, count]) => ({ level, count })),
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      userId: event.userId,
      participantEmail: event.participantEmail,
      participantName: event.user?.name ?? event.participantEmail ?? 'Participante',
      type: event.type,
      points: event.points,
      description: event.description,
      createdAt: event.createdAt,
    })),
  };
}

export async function createBadge(data) {
  const payload = normalizeBadgePayload(data);
  const existing = await prisma.badge.findUnique({
    where: { code: payload.code },
  });
  if (existing) {
    throw new HttpError(409, 'Código de conquista já cadastrado');
  }

  return prisma.badge.create({
    data: payload,
  });
}

export async function updateBadge(badgeId, data) {
  const id = Number(badgeId);
  const payload = normalizeBadgePayload(data);
  if (payload.code) {
    const existing = await prisma.badge.findUnique({
      where: { code: payload.code },
    });
    if (existing && existing.id !== id) {
      throw new HttpError(409, 'Código de conquista já cadastrado');
    }
  }

  return prisma.badge.update({
    where: { id },
    data: payload,
  });
}

export async function deleteBadge(badgeId) {
  const id = Number(badgeId);
  await prisma.badge.delete({
    where: { id },
  });
}

export async function registerSubmission({
  userId,
  participantEmail,
  participantName,
  score,
  total,
  percentage,
}) {
  const identity = buildGamificationIdentity({ userId, participantEmail, participantName });
  const pointsEarned = calculateSubmissionPoints({ score, percentage });

  const stats = await getOrCreateStats(identity);

  const newStats = await prisma.userGamification.update({
    where: identity.statsWhere,
    data: {
      points: stats.points + pointsEarned,
      experience: stats.experience + pointsEarned,
      totalQuizzes: stats.totalQuizzes + 1,
      totalCorrect: stats.totalCorrect + score,
      totalIncorrect: stats.totalIncorrect + (total - score),
      currentStreak: percentage === 100 ? stats.currentStreak + 1 : 0,
      bestStreak: percentage === 100
        ? Math.max(stats.bestStreak, stats.currentStreak + 1)
        : stats.bestStreak,
      lastSubmissionAt: new Date(),
    },
  });

  const { level, nextLevelAt } = calculateLevel(newStats.experience);

  const finalStats = await prisma.userGamification.update({
    where: identity.statsWhere,
    data: {
      level,
      nextLevelAt,
    },
  });

  const badges = await awardBadges(identity, finalStats);

  await prisma.gamificationEvent.create({
    data: {
      userId: identity.userId,
      participantEmail: identity.participantEmail,
      type: 'submission',
      points: pointsEarned,
      description: `Quiz concluído com ${score}/${total} acertos (${percentage}%).`,
    },
  });

  if (badges.length) {
    await Promise.all(
      badges.map((badge) =>
        prisma.gamificationEvent.create({
          data: {
            userId: identity.userId,
            participantEmail: identity.participantEmail,
            type: 'badge',
            points: 0,
            description: `Conquista desbloqueada: ${badge.name}`,
          },
        }),
      ),
    );
  }

  return {
    stats: finalStats,
    badges,
    pointsEarned,
  };
}

export async function rebuildGamificationFromSubmissions() {
  await ensureBadgesExist();

  await prisma.gamificationEvent.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.userGamification.deleteMany();

  const submissions = await prisma.submission.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      userId: true,
      userName: true,
      userEmail: true,
      score: true,
      total: true,
      percentage: true,
      createdAt: true,
    },
  });

  for (const submission of submissions) {
    if (!submission.userId && !normalizeParticipantEmail(submission.userEmail)) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const identity = buildGamificationIdentity({
      userId: submission.userId,
      participantEmail: submission.userId ? null : submission.userEmail,
      participantName: submission.userName,
    });
    const pointsEarned = calculateSubmissionPoints({
      score: submission.score,
      percentage: submission.percentage,
    });
    // eslint-disable-next-line no-await-in-loop
    const stats = await getOrCreateStats(identity);
    // eslint-disable-next-line no-await-in-loop
    const newStats = await prisma.userGamification.update({
      where: identity.statsWhere,
      data: {
        points: stats.points + pointsEarned,
        experience: stats.experience + pointsEarned,
        totalQuizzes: stats.totalQuizzes + 1,
        totalCorrect: stats.totalCorrect + submission.score,
        totalIncorrect: stats.totalIncorrect + (submission.total - submission.score),
        currentStreak: submission.percentage === 100 ? stats.currentStreak + 1 : 0,
        bestStreak: submission.percentage === 100
          ? Math.max(stats.bestStreak, stats.currentStreak + 1)
          : stats.bestStreak,
        lastSubmissionAt: submission.createdAt,
      },
    });
    const { level, nextLevelAt } = calculateLevel(newStats.experience);
    // eslint-disable-next-line no-await-in-loop
    const finalStats = await prisma.userGamification.update({
      where: identity.statsWhere,
      data: { level, nextLevelAt },
    });
    // eslint-disable-next-line no-await-in-loop
    const badges = await awardBadges(identity, finalStats);

    // eslint-disable-next-line no-await-in-loop
    await prisma.gamificationEvent.create({
      data: {
        userId: identity.userId,
        participantEmail: identity.participantEmail,
        type: 'submission',
        points: pointsEarned,
        description: `Quiz concluído com ${submission.score}/${submission.total} acertos (${submission.percentage}%).`,
        createdAt: submission.createdAt,
      },
    });

    if (badges.length) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        badges.map((badge) =>
          prisma.gamificationEvent.create({
            data: {
              userId: identity.userId,
              participantEmail: identity.participantEmail,
              type: 'badge',
              points: 0,
              description: `Conquista desbloqueada: ${badge.name}`,
              createdAt: submission.createdAt,
            },
          }),
        ),
      );
    }
  }

  return { rebuiltSubmissions: submissions.length };
}

export async function getUserGamification(userId) {
  const identity = buildGamificationIdentity({ userId });
  const stats = await getOrCreateStats(identity);
  const badges = await prisma.userBadge.findMany({
    where: identity.badgeWhere,
    include: { badge: true },
    orderBy: { awardedAt: 'desc' },
  });

  const events = await prisma.gamificationEvent.findMany({
    where: identity.badgeWhere,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    stats,
    badges: badges.map((item) => ({
      id: item.id,
      code: item.badge.code,
      name: item.badge.name,
      description: item.badge.description,
      icon: item.badge.icon,
      awardedAt: item.awardedAt,
    })),
    events,
  };
}

export async function getGlobalLeaderboard(limit = 20) {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
  const [submissions, gamificationStats] = await Promise.all([
    prisma.submission.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.userGamification.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const statsByKey = new Map();
  gamificationStats.forEach((stats) => {
    const email = normalizeParticipantEmail(stats.user?.email ?? stats.participantEmail);
    const key = stats.userId ? `user:${stats.userId}` : `email:${email}`;
    statsByKey.set(key, stats);
    if (email) {
      statsByKey.set(`email:${email}`, stats);
    }
  });

  const participants = new Map();

  submissions.forEach((submission) => {
    const email = (submission.user?.email ?? submission.userEmail ?? '').trim().toLowerCase();
    const key = submission.userId ? `user:${submission.userId}` : (email ? `email:${email}` : `submission:${submission.id}`);
    const current = participants.get(key) ?? {
      userId: submission.userId,
      name: submission.user?.name ?? submission.userName,
      email: email || submission.userEmail,
      totalQuizzes: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      totalDurationSeconds: 0,
      hasDuration: true,
      firstSubmissionAt: submission.createdAt,
      lastSubmissionAt: submission.createdAt,
    };

    current.userId = current.userId ?? submission.userId;
    current.name = submission.user?.name ?? current.name ?? submission.userName;
    current.email = current.email ?? email ?? submission.userEmail;
    current.totalQuizzes += 1;
    current.totalCorrect += submission.score;
    current.totalIncorrect += submission.total - submission.score;
    current.firstSubmissionAt =
      submission.createdAt < current.firstSubmissionAt ? submission.createdAt : current.firstSubmissionAt;
    current.lastSubmissionAt =
      submission.createdAt > current.lastSubmissionAt ? submission.createdAt : current.lastSubmissionAt;

    if (Number.isFinite(submission.durationSeconds)) {
      current.totalDurationSeconds += submission.durationSeconds;
    } else {
      current.hasDuration = false;
    }

    participants.set(key, current);
  });

  return Array.from(participants.values())
    .sort((a, b) => {
      if (b.totalCorrect !== a.totalCorrect) {
        return b.totalCorrect - a.totalCorrect;
      }

      const aDuration = a.hasDuration ? a.totalDurationSeconds : Number.MAX_SAFE_INTEGER;
      const bDuration = b.hasDuration ? b.totalDurationSeconds : Number.MAX_SAFE_INTEGER;

      if (aDuration !== bDuration) {
        return aDuration - bDuration;
      }

      return a.firstSubmissionAt - b.firstSubmissionAt;
    })
    .slice(0, normalizedLimit)
    .map((entry, index) => ({
      ...entry,
      stats: statsByKey.get(entry.userId ? `user:${entry.userId}` : `email:${normalizeParticipantEmail(entry.email)}`),
      position: index + 1,
    }))
    .map((entry) => ({
      position: entry.position,
      userId: entry.userId,
      name: entry.name,
      email: entry.email,
      points: entry.stats?.points ?? entry.totalCorrect,
      totalDurationSeconds: entry.hasDuration ? entry.totalDurationSeconds : null,
      averageDurationSeconds: entry.hasDuration
        ? Number((entry.totalDurationSeconds / entry.totalQuizzes).toFixed(2))
        : null,
      level: entry.stats?.level ?? null,
      totalQuizzes: entry.totalQuizzes,
      totalCorrect: entry.totalCorrect,
      bestStreak: entry.stats?.bestStreak ?? null,
    }));
}
