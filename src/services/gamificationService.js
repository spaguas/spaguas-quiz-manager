import prisma from '../config/prisma.js';

const LEVEL_BASE = 100;

const BADGE_DEFINITIONS = [
  {
    code: 'FIRST_QUIZ',
    name: 'Primeiro Quiz',
    description: 'Complete um quiz pela primeira vez.',
    icon: '🥉',
    condition: (stats) => stats.totalQuizzes >= 1,
  },
  {
    code: 'FIVE_QUIZZES',
    name: 'Maratonista',
    description: 'Complete 5 quizzes.',
    icon: '🥈',
    condition: (stats) => stats.totalQuizzes >= 5,
  },
  {
    code: 'TEN_CORRECT',
    name: 'Sábio',
    description: 'Acumule 10 respostas corretas.',
    icon: '🥇',
    condition: (stats) => stats.totalCorrect >= 10,
  },
  {
    code: 'STREAK_MASTER',
    name: 'Embalado',
    description: 'Faça uma sequência de 3 quizzes com 100% de acerto.',
    icon: '🏆',
    condition: (stats) => stats.bestStreak >= 3,
  },
];

export async function ensureBadgesExist() {
  await Promise.all(
    BADGE_DEFINITIONS.map((badge) =>
      prisma.badge.upsert({
        where: { code: badge.code },
        update: {
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
        },
        create: {
          code: badge.code,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
        },
      }),
    ),
  );
}

export async function getOrCreateStats(userId) {
  const stats = await prisma.userGamification.findUnique({ where: { userId } });
  if (stats) {
    return stats;
  }

  return prisma.userGamification.create({
    data: {
      userId,
    },
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

async function awardBadges(userId, stats) {
  await ensureBadgesExist();

  const existing = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
  });

  const ownedCodes = new Set(existing.map((item) => item.badge.code));

  const badgesToAward = BADGE_DEFINITIONS.filter((badge) =>
    !ownedCodes.has(badge.code) && badge.condition(stats),
  );

  if (!badgesToAward.length) {
    return [];
  }

  const foundBadges = await prisma.badge.findMany({
    where: {
      code: {
        in: badgesToAward.map((badge) => badge.code),
      },
    },
  });

  await prisma.userBadge.createMany({
    data: foundBadges.map((badge) => ({
      userId,
      badgeId: badge.id,
    })),
    skipDuplicates: true,
  });

  return foundBadges;
}

export async function registerSubmission({
  userId,
  score,
  total,
  percentage,
}) {
  const basePoints = Math.max(score * 10, 5);
  const bonus = percentage === 100 ? 20 : percentage >= 70 ? 10 : 0;
  const pointsEarned = basePoints + bonus;

  const stats = await getOrCreateStats(userId);

  const newStats = await prisma.userGamification.update({
    where: { userId },
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
    where: { userId },
    data: {
      level,
      nextLevelAt,
    },
  });

  const badges = await awardBadges(userId, finalStats);

  await prisma.gamificationEvent.create({
    data: {
      userId,
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
            userId,
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

export async function getUserGamification(userId) {
  const stats = await getOrCreateStats(userId);
  const badges = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { awardedAt: 'desc' },
  });

  const events = await prisma.gamificationEvent.findMany({
    where: { userId },
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
  const users = await prisma.userGamification.findMany({
    orderBy: [{ points: 'desc' }, { updatedAt: 'asc' }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    take: limit,
  });

  return users.map((entry, index) => ({
    position: index + 1,
    userId: entry.userId,
    name: entry.user.name,
    email: entry.user.email,
    points: entry.points,
    level: entry.level,
    totalQuizzes: entry.totalQuizzes,
    totalCorrect: entry.totalCorrect,
    bestStreak: entry.bestStreak,
  }));
}
