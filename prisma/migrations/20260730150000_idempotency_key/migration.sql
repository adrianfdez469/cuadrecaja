-- AlterTable
ALTER TABLE "MovimientoStock" ADD COLUMN     "batchId" TEXT;

-- CreateIndex
CREATE INDEX "MovimientoStock_batchId_idx" ON "MovimientoStock"("batchId");

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_scopeId_idx" ON "IdempotencyKey"("scopeId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");
