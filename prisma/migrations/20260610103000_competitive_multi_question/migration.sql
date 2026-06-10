ALTER TABLE "CompetitiveMatch"
ADD COLUMN "questionOrder" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0;

UPDATE "CompetitiveMatch"
SET "questionOrder" = jsonb_build_array("questionId")
WHERE "questionOrder" = '[]'::jsonb;

DROP INDEX IF EXISTS "CompetitiveAnswer_matchId_participantId_key";
CREATE UNIQUE INDEX "CompetitiveAnswer_matchId_participantId_questionId_key"
ON "CompetitiveAnswer"("matchId", "participantId", "questionId");
