-- CreateTable
CREATE TABLE "SubmissionPrizeClaim" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "prizeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionPrizeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionPrizeClaim_submissionId_prizeId_key" ON "SubmissionPrizeClaim"("submissionId", "prizeId");

-- CreateIndex
CREATE INDEX "SubmissionPrizeClaim_prizeId_idx" ON "SubmissionPrizeClaim"("prizeId");

-- AddForeignKey
ALTER TABLE "SubmissionPrizeClaim" ADD CONSTRAINT "SubmissionPrizeClaim_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionPrizeClaim" ADD CONSTRAINT "SubmissionPrizeClaim_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "QuizPrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;
