-- AlterTable
ALTER TABLE "MovimientoStock" ADD COLUMN     "monedaOriginal" TEXT,
ADD COLUMN     "montoOriginal" DOUBLE PRECISION,
ADD COLUMN     "tasaUsada" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "monedaBase" TEXT NOT NULL DEFAULT 'CUP',
ADD COLUMN     "monedaFuerte" TEXT NOT NULL DEFAULT 'CUP';

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "monedaCobro" TEXT NOT NULL DEFAULT 'CUP',
ADD COLUMN     "pagosDetalle" JSONB,
ADD COLUMN     "tasaSnapshot" JSONB,
ADD COLUMN     "vueltoDetalle" JSONB;

-- CreateTable
CREATE TABLE "Moneda" (
    "code" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "simbolo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Moneda_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "DenominacionBillete" (
    "id" TEXT NOT NULL,
    "monedaCode" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DenominacionBillete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegocioMoneda" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "monedaCode" TEXT NOT NULL,
    "admiteEfectivo" BOOLEAN NOT NULL DEFAULT true,
    "admiteTransferencia" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NegocioMoneda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TasaCambio" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "monedaCode" TEXT NOT NULL,
    "tasa" DOUBLE PRECISION NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TasaCambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialMonedaBase" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "monedaAnterior" TEXT NOT NULL,
    "monedaNueva" TEXT NOT NULL,
    "tasaUsada" DOUBLE PRECISION NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialMonedaBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumenMonedaCierre" (
    "id" TEXT NOT NULL,
    "cierrePeriodoId" TEXT NOT NULL,
    "monedaCode" TEXT NOT NULL,
    "totalEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTransfer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "equivalenteBase" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ResumenMonedaCierre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DenominacionBillete_monedaCode_idx" ON "DenominacionBillete"("monedaCode");

-- CreateIndex
CREATE INDEX "NegocioMoneda_negocioId_idx" ON "NegocioMoneda"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "NegocioMoneda_negocioId_monedaCode_key" ON "NegocioMoneda"("negocioId", "monedaCode");

-- CreateIndex
CREATE INDEX "TasaCambio_negocioId_monedaCode_createdAt_idx" ON "TasaCambio"("negocioId", "monedaCode", "createdAt");

-- CreateIndex
CREATE INDEX "HistorialMonedaBase_negocioId_createdAt_idx" ON "HistorialMonedaBase"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "ResumenMonedaCierre_cierrePeriodoId_idx" ON "ResumenMonedaCierre"("cierrePeriodoId");

-- CreateIndex
CREATE UNIQUE INDEX "ResumenMonedaCierre_cierrePeriodoId_monedaCode_key" ON "ResumenMonedaCierre"("cierrePeriodoId", "monedaCode");

-- AddForeignKey
ALTER TABLE "DenominacionBillete" ADD CONSTRAINT "DenominacionBillete_monedaCode_fkey" FOREIGN KEY ("monedaCode") REFERENCES "Moneda"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegocioMoneda" ADD CONSTRAINT "NegocioMoneda_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegocioMoneda" ADD CONSTRAINT "NegocioMoneda_monedaCode_fkey" FOREIGN KEY ("monedaCode") REFERENCES "Moneda"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TasaCambio" ADD CONSTRAINT "TasaCambio_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TasaCambio" ADD CONSTRAINT "TasaCambio_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialMonedaBase" ADD CONSTRAINT "HistorialMonedaBase_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialMonedaBase" ADD CONSTRAINT "HistorialMonedaBase_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumenMonedaCierre" ADD CONSTRAINT "ResumenMonedaCierre_cierrePeriodoId_fkey" FOREIGN KEY ("cierrePeriodoId") REFERENCES "CierrePeriodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
