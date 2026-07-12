-- CreateEnum
CREATE TYPE "LeadFuente" AS ENUM ('NEGOCIO_ELIMINADO', 'LANDING', 'CONTACTO', 'MANUAL', 'OTRO');

-- CreateEnum
CREATE TYPE "LeadEstado" AS ENUM ('NUEVO', 'CONTACTADO', 'CONVERTIDO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "fuente" "LeadFuente" NOT NULL,
    "estado" "LeadEstado" NOT NULL DEFAULT 'NUEVO',
    "negocioNombre" TEXT,
    "notas" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_fuente_idx" ON "Lead"("fuente");

-- CreateIndex
CREATE INDEX "Lead_estado_idx" ON "Lead"("estado");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
