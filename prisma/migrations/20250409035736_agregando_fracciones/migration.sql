-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovimientoTipo" ADD VALUE 'DESAGREGACION_BAJA';
ALTER TYPE "MovimientoTipo" ADD VALUE 'DESAGREGACION_ALTA';

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "fraccionDeId" TEXT,
ADD COLUMN     "unidadesPorFraccion" INTEGER;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_fraccionDeId_fkey" FOREIGN KEY ("fraccionDeId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
