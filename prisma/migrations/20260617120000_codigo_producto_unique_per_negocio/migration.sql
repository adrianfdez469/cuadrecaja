-- AlterTable: add negocioId to CodigoProducto (backfill from Producto)
ALTER TABLE "CodigoProducto" ADD COLUMN "negocioId" TEXT;

UPDATE "CodigoProducto" cp
SET "negocioId" = p."negocioId"
FROM "Producto" p
WHERE cp."productoId" = p.id;

ALTER TABLE "CodigoProducto" ALTER COLUMN "negocioId" SET NOT NULL;

-- DropIndex
DROP INDEX "CodigoProducto_codigo_key";

-- CreateIndex
CREATE UNIQUE INDEX "CodigoProducto_codigo_negocioId_key" ON "CodigoProducto"("codigo", "negocioId");

-- AddForeignKey
ALTER TABLE "CodigoProducto" ADD CONSTRAINT "CodigoProducto_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
