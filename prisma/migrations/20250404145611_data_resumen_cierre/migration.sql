-- AlterTable
ALTER TABLE "CierrePeriodo" ADD COLUMN     "totalGanancia" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalInversion" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalVentas" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tienda" ALTER COLUMN "tipo" SET DEFAULT 'tienda';

-- CreateIndex
CREATE INDEX "CierrePeriodo_fechaInicio_idx" ON "CierrePeriodo"("fechaInicio");

-- CreateIndex
CREATE INDEX "CierrePeriodo_fechaFin_idx" ON "CierrePeriodo"("fechaFin");

-- CreateIndex
CREATE INDEX "CierrePeriodo_tiendaId_idx" ON "CierrePeriodo"("tiendaId");
