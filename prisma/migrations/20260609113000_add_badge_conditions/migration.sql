ALTER TABLE "Badge" ADD COLUMN "conditionMetric" TEXT NOT NULL DEFAULT 'totalQuizzes';
ALTER TABLE "Badge" ADD COLUMN "conditionOperator" TEXT NOT NULL DEFAULT 'gte';
ALTER TABLE "Badge" ADD COLUMN "conditionValue" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "Badge" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Badge"
SET "conditionMetric" = 'totalQuizzes',
    "conditionOperator" = 'gte',
    "conditionValue" = 1
WHERE "code" = 'FIRST_QUIZ';

UPDATE "Badge"
SET "conditionMetric" = 'totalQuizzes',
    "conditionOperator" = 'gte',
    "conditionValue" = 5
WHERE "code" = 'FIVE_QUIZZES';

UPDATE "Badge"
SET "conditionMetric" = 'totalCorrect',
    "conditionOperator" = 'gte',
    "conditionValue" = 10
WHERE "code" = 'TEN_CORRECT';

UPDATE "Badge"
SET "conditionMetric" = 'bestStreak',
    "conditionOperator" = 'gte',
    "conditionValue" = 3
WHERE "code" = 'STREAK_MASTER';
