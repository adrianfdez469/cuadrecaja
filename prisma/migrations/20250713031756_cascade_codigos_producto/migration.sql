-- DropForeignKey
ALTER TABLE "CodigoProducto" DROP CONSTRAINT "CodigoProducto_productoId_fkey";

-- AddForeignKey
ALTER TABLE "CodigoProducto" ADD CONSTRAINT "CodigoProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
