-- CreateEnum
CREATE TYPE "QuizMode" AS ENUM ('SEQUENTIAL', 'RANDOM');

-- AlterTable
ALTER TABLE "Quiz"
  ADD COLUMN "mode" "QuizMode" NOT NULL DEFAULT 'SEQUENTIAL',
  ADD COLUMN "questionLimit" INTEGER;
