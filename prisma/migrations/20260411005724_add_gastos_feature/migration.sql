/*
  Warnings:

  - You are about to drop the column `locallimit` on the `Negocio` table. All the data in the column will be lost.
  - You are about to drop the column `productlimit` on the `Negocio` table. All the data in the column will be lost.
  - You are about to drop the column `userlimit` on the `Negocio` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TipoCalculo" AS ENUM ('MONTO_FIJO', 'PORCENTAJE_VENTAS', 'PORCENTAJE_GANANCIAS');

-- CreateEnum
CREATE TYPE "RecurrenciaGasto" AS ENUM ('UNICO', 'DIARIO', 'MENSUAL', 'ANUAL');

-- AlterTable
ALTER TABLE "CierrePeriodo" ADD COLUMN     "totalGananciaFinal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalGastos" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Negocio" DROP COLUMN "locallimit",
DROP COLUMN "productlimit",
DROP COLUMN "userlimit";

-- CreateTable
CREATE TABLE "GastoPlantilla" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "tipoCalculo" "TipoCalculo" NOT NULL,
    "recurrencia" "RecurrenciaGasto" NOT NULL,
    "diaMes" INTEGER,
    "mesAnio" INTEGER,
    "diaAnio" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoPlantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoTienda" (
    "id" TEXT NOT NULL,
    "tiendaId" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "plantillaId" TEXT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "tipoCalculo" "TipoCalculo" NOT NULL,
    "monto" DOUBLE PRECISION,
    "porcentaje" DOUBLE PRECISION,
    "recurrencia" "RecurrenciaGasto" NOT NULL,
    "diaMes" INTEGER,
    "mesAnio" INTEGER,
    "diaAnio" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoTienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoCierre" (
    "id" TEXT NOT NULL,
    "cierreId" TEXT NOT NULL,
    "gastoTiendaId" TEXT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "tipoCalculo" "TipoCalculo" NOT NULL,
    "montoCalculado" DOUBLE PRECISION NOT NULL,
    "monto" DOUBLE PRECISION,
    "porcentaje" DOUBLE PRECISION,
    "esAdHoc" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GastoCierre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GastoPlantilla_negocioId_idx" ON "GastoPlantilla"("negocioId");

-- CreateIndex
CREATE INDEX "GastoTienda_tiendaId_idx" ON "GastoTienda"("tiendaId");

-- CreateIndex
CREATE INDEX "GastoTienda_negocioId_idx" ON "GastoTienda"("negocioId");

-- CreateIndex
CREATE INDEX "GastoCierre_cierreId_idx" ON "GastoCierre"("cierreId");

-- CreateIndex
CREATE INDEX "GastoCierre_gastoTiendaId_idx" ON "GastoCierre"("gastoTiendaId");

-- AddForeignKey
ALTER TABLE "GastoPlantilla" ADD CONSTRAINT "GastoPlantilla_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoTienda" ADD CONSTRAINT "GastoTienda_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoTienda" ADD CONSTRAINT "GastoTienda_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoTienda" ADD CONSTRAINT "GastoTienda_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "GastoPlantilla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCierre" ADD CONSTRAINT "GastoCierre_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "CierrePeriodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCierre" ADD CONSTRAINT "GastoCierre_gastoTiendaId_fkey" FOREIGN KEY ("gastoTiendaId") REFERENCES "GastoTienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
