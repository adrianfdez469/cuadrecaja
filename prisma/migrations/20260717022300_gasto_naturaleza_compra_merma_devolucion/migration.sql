-- CreateEnum
CREATE TYPE "NaturalezaGasto" AS ENUM ('OPERATIVO', 'INVERSION');

-- CreateEnum
CREATE TYPE "FormaPagoCompra" AS ENUM ('EFECTIVO_CAJA', 'EXTERNO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovimientoTipo" ADD VALUE 'MERMA';
ALTER TYPE "MovimientoTipo" ADD VALUE 'DEVOLUCION_VENTA';

-- AlterTable
ALTER TABLE "CierrePeriodo" ADD COLUMN     "totalComprasCaja" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalDevoluciones" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalMerma" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GastoCierre" ADD COLUMN     "naturaleza" "NaturalezaGasto" NOT NULL DEFAULT 'OPERATIVO';

-- AlterTable
ALTER TABLE "GastoPlantilla" ADD COLUMN     "naturaleza" "NaturalezaGasto" NOT NULL DEFAULT 'OPERATIVO';

-- AlterTable
ALTER TABLE "GastoTienda" ADD COLUMN     "naturaleza" "NaturalezaGasto" NOT NULL DEFAULT 'OPERATIVO';

-- AlterTable
ALTER TABLE "MovimientoStock" ADD COLUMN     "formaPago" "FormaPagoCompra";
