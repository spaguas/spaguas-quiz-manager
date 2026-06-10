ALTER TYPE "QuizMode" ADD VALUE IF NOT EXISTS 'COMPETITIVE';

CREATE TYPE "CompetitiveMatchStatus" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED', 'EXPIRED');

ALTER TABLE "Question"
ADD COLUMN "timeLimitSeconds" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "CompetitiveMatch" (
  "id" TEXT NOT NULL,
  "quizId" INTEGER NOT NULL,
  "questionId" INTEGER NOT NULL,
  "status" "CompetitiveMatchStatus" NOT NULL DEFAULT 'WAITING',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitiveMatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitiveMatch_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitiveMatch_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CompetitiveParticipant" (
  "id" SERIAL NOT NULL,
  "matchId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "slot" INTEGER NOT NULL,
  "userName" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitiveParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitiveParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "CompetitiveMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CompetitiveAnswer" (
  "id" SERIAL NOT NULL,
  "matchId" TEXT NOT NULL,
  "participantId" INTEGER NOT NULL,
  "questionId" INTEGER NOT NULL,
  "optionId" INTEGER NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "responseMs" INTEGER NOT NULL,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitiveAnswer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitiveAnswer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "CompetitiveMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitiveAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CompetitiveParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitiveAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitiveAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CompetitiveMatch_quizId_status_createdAt_idx" ON "CompetitiveMatch"("quizId", "status", "createdAt");
CREATE UNIQUE INDEX "CompetitiveParticipant_token_key" ON "CompetitiveParticipant"("token");
CREATE UNIQUE INDEX "CompetitiveParticipant_matchId_slot_key" ON "CompetitiveParticipant"("matchId", "slot");
CREATE UNIQUE INDEX "CompetitiveParticipant_matchId_userEmail_key" ON "CompetitiveParticipant"("matchId", "userEmail");
CREATE INDEX "CompetitiveParticipant_userEmail_idx" ON "CompetitiveParticipant"("userEmail");
CREATE UNIQUE INDEX "CompetitiveAnswer_matchId_participantId_key" ON "CompetitiveAnswer"("matchId", "participantId");
CREATE INDEX "CompetitiveAnswer_matchId_isCorrect_responseMs_idx" ON "CompetitiveAnswer"("matchId", "isCorrect", "responseMs");
