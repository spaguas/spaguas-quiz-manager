ALTER TABLE "UserGamification"
ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "participantEmail" TEXT,
ADD COLUMN "participantName" TEXT;

CREATE UNIQUE INDEX "UserGamification_participantEmail_key"
ON "UserGamification"("participantEmail");

ALTER TABLE "UserBadge"
ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "participantEmail" TEXT;

CREATE UNIQUE INDEX "UserBadge_participantEmail_badgeId_key"
ON "UserBadge"("participantEmail", "badgeId");

ALTER TABLE "GamificationEvent"
ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "participantEmail" TEXT;

CREATE INDEX "GamificationEvent_participantEmail_idx"
ON "GamificationEvent"("participantEmail");
