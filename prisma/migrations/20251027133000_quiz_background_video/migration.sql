-- AlterTable
ALTER TABLE "Quiz"
  ADD COLUMN "backgroundVideoUrl" TEXT,
  ADD COLUMN "backgroundVideoStart" INTEGER DEFAULT 0,
  ADD COLUMN "backgroundVideoEnd" INTEGER,
  ADD COLUMN "backgroundVideoLoop" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "backgroundVideoMuted" BOOLEAN NOT NULL DEFAULT true;
