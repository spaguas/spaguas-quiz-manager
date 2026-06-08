-- CreateTable
CREATE TABLE "QuizPrize" (
    "id" SERIAL NOT NULL,
    "quizId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "availableQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizPrize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizPrize_quizId_position_idx" ON "QuizPrize"("quizId", "position");

-- AddForeignKey
ALTER TABLE "QuizPrize" ADD CONSTRAINT "QuizPrize_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
