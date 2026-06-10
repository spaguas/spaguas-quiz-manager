CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');
CREATE TYPE "QuizMode" AS ENUM ('SEQUENTIAL', 'RANDOM', 'COMPETITIVE');
CREATE TYPE "CompetitiveMatchStatus" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED', 'EXPIRED');

CREATE TABLE "User" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Quiz" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "mode" "QuizMode" NOT NULL DEFAULT 'SEQUENTIAL',
  "questionLimit" INTEGER,
  "backgroundImage" TEXT,
  "headerImage" TEXT,
  "backgroundVideoUrl" TEXT,
  "backgroundVideoStart" INTEGER DEFAULT 0,
  "backgroundVideoEnd" INTEGER,
  "backgroundVideoLoop" BOOLEAN NOT NULL DEFAULT true,
  "backgroundVideoMuted" BOOLEAN NOT NULL DEFAULT true,
  "backgroundImageIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
  "backgroundVideoIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "QuizPrize" (
  "id" SERIAL PRIMARY KEY,
  "quizId" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "quantity" INTEGER NOT NULL,
  "availableQuantity" INTEGER NOT NULL,
  "minimumScore" INTEGER NOT NULL DEFAULT 0,
  "minimumPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizPrize_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE
);

CREATE INDEX "QuizPrize_quizId_position_idx" ON "QuizPrize"("quizId", "position");

CREATE TABLE "Question" (
  "id" SERIAL PRIMARY KEY,
  "quizId" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "timeLimitSeconds" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Question_quizId_order_key" ON "Question"("quizId", "order");

CREATE TABLE "Option" (
  "id" SERIAL PRIMARY KEY,
  "questionId" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE
);

CREATE TABLE "Submission" (
  "id" SERIAL PRIMARY KEY,
  "quizId" INTEGER NOT NULL,
  "userId" INTEGER,
  "userName" TEXT NOT NULL,
  "userEmail" TEXT,
  "score" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "percentage" DOUBLE PRECISION NOT NULL,
  "durationSeconds" INTEGER,
  "ipAddress" TEXT,
  "ipSource" TEXT,
  "userAgent" TEXT,
  "browserName" TEXT,
  "browserVersion" TEXT,
  "osName" TEXT,
  "deviceType" TEXT,
  "locale" TEXT,
  "timezone" TEXT,
  "screenResolution" TEXT,
  "referrer" TEXT,
  "geoLatitude" DOUBLE PRECISION,
  "geoLongitude" DOUBLE PRECISION,
  "geoAccuracy" DOUBLE PRECISION,
  "geoStatus" TEXT,
  "clientMetadata" JSONB,
  "requestMetadata" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Submission_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE,
  CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "Submission_quizId_userEmail_key" ON "Submission"("quizId", "userEmail");

CREATE TABLE "SubmissionAnswer" (
  "id" SERIAL PRIMARY KEY,
  "submissionId" INTEGER NOT NULL,
  "questionId" INTEGER NOT NULL,
  "optionId" INTEGER NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  CONSTRAINT "SubmissionAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE,
  CONSTRAINT "SubmissionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE,
  CONSTRAINT "SubmissionAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "SubmissionAnswer_submissionId_questionId_key" ON "SubmissionAnswer"("submissionId", "questionId");

CREATE TABLE "CompetitiveMatch" (
  "id" TEXT PRIMARY KEY,
  "quizId" INTEGER NOT NULL,
  "questionId" INTEGER NOT NULL,
  "questionOrder" JSONB NOT NULL DEFAULT '[]',
  "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
  "status" "CompetitiveMatchStatus" NOT NULL DEFAULT 'WAITING',
  "startsAt" TIMESTAMP,
  "endsAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitiveMatch_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE,
  CONSTRAINT "CompetitiveMatch_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE
);

CREATE INDEX "CompetitiveMatch_quizId_status_createdAt_idx" ON "CompetitiveMatch"("quizId", "status", "createdAt");

CREATE TABLE "CompetitiveParticipant" (
  "id" SERIAL PRIMARY KEY,
  "matchId" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "slot" INTEGER NOT NULL,
  "userName" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "joinedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitiveParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "CompetitiveMatch"("id") ON DELETE CASCADE,
  CONSTRAINT "CompetitiveParticipant_matchId_slot_key" UNIQUE ("matchId", "slot"),
  CONSTRAINT "CompetitiveParticipant_matchId_userEmail_key" UNIQUE ("matchId", "userEmail")
);

CREATE INDEX "CompetitiveParticipant_userEmail_idx" ON "CompetitiveParticipant"("userEmail");

CREATE TABLE "CompetitiveAnswer" (
  "id" SERIAL PRIMARY KEY,
  "matchId" TEXT NOT NULL,
  "participantId" INTEGER NOT NULL,
  "questionId" INTEGER NOT NULL,
  "optionId" INTEGER NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "responseMs" INTEGER NOT NULL,
  "answeredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitiveAnswer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "CompetitiveMatch"("id") ON DELETE CASCADE,
  CONSTRAINT "CompetitiveAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CompetitiveParticipant"("id") ON DELETE CASCADE,
  CONSTRAINT "CompetitiveAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE,
  CONSTRAINT "CompetitiveAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE,
  CONSTRAINT "CompetitiveAnswer_matchId_participantId_questionId_key" UNIQUE ("matchId", "participantId", "questionId")
);

CREATE INDEX "CompetitiveAnswer_matchId_isCorrect_responseMs_idx" ON "CompetitiveAnswer"("matchId", "isCorrect", "responseMs");

CREATE TABLE "SubmissionPrizeClaim" (
  "id" SERIAL PRIMARY KEY,
  "submissionId" INTEGER NOT NULL,
  "prizeId" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "claimedAt" TIMESTAMP,
  "declinedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionPrizeClaim_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE,
  CONSTRAINT "SubmissionPrizeClaim_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "QuizPrize"("id") ON DELETE CASCADE,
  CONSTRAINT "SubmissionPrizeClaim_submissionId_prizeId_key" UNIQUE ("submissionId", "prizeId")
);

CREATE TABLE "PasswordResetToken" (
  "id" SERIAL PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "userId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "UserGamification" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER UNIQUE,
  "participantEmail" TEXT UNIQUE,
  "participantName" TEXT,
  "points" INTEGER NOT NULL DEFAULT 0,
  "level" INTEGER NOT NULL DEFAULT 1,
  "experience" INTEGER NOT NULL DEFAULT 0,
  "nextLevelAt" INTEGER NOT NULL DEFAULT 100,
  "totalQuizzes" INTEGER NOT NULL DEFAULT 0,
  "totalCorrect" INTEGER NOT NULL DEFAULT 0,
  "totalIncorrect" INTEGER NOT NULL DEFAULT 0,
  "bestStreak" INTEGER NOT NULL DEFAULT 0,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "lastSubmissionAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserGamification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "Badge" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "conditionMetric" TEXT NOT NULL DEFAULT 'totalQuizzes',
  "conditionOperator" TEXT NOT NULL DEFAULT 'gte',
  "conditionValue" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "UserBadge" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "participantEmail" TEXT,
  "badgeId" INTEGER NOT NULL,
  "awardedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE,
  CONSTRAINT "UserBadge_userId_badgeId_key" UNIQUE ("userId", "badgeId"),
  CONSTRAINT "UserBadge_participantEmail_badgeId_key" UNIQUE ("participantEmail", "badgeId")
);

CREATE TABLE "GamificationEvent" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "participantEmail" TEXT,
  "type" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GamificationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
