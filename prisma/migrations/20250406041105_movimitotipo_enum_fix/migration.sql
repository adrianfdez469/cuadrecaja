/*
  Warnings:

  - The values [ENTRADA,SALIDA,AJUSTE] on the enum `MovimientoTipo` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MovimientoTipo_new" AS ENUM ('COMPRA', 'VENTA', 'ENTRADA_TRASPASO', 'SALIDA_TRASPADO');
ALTER TABLE "MovimientoStock" ALTER COLUMN "tipo" TYPE "MovimientoTipo_new" USING ("tipo"::text::"MovimientoTipo_new");
ALTER TYPE "MovimientoTipo" RENAME TO "MovimientoTipo_old";
ALTER TYPE "MovimientoTipo_new" RENAME TO "MovimientoTipo";
DROP TYPE "MovimientoTipo_old";
COMMIT;
