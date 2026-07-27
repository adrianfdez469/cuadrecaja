-- CreateTable
CREATE TABLE "TasaReferenciaExterna" (
    "id" TEXT NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'ELTOQUE',
    "tasas" JSONB NOT NULL,
    "fechaDato" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TasaReferenciaExterna_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TasaReferenciaExterna_fuente_fetchedAt_idx" ON "TasaReferenciaExterna"("fuente", "fetchedAt");
