/*
  Warnings:

  - A unique constraint covering the columns `[quizId,userEmail]` on the table `Submission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "userEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Submission_quizId_userEmail_key" ON "Submission"("quizId", "userEmail");
