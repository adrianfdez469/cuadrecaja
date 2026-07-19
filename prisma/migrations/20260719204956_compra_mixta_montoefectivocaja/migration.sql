-- AlterEnum
ALTER TYPE "FormaPagoCompra" ADD VALUE 'MIXTO';

-- AlterTable
ALTER TABLE "MovimientoStock" ADD COLUMN     "montoEfectivoCaja" DOUBLE PRECISION;
