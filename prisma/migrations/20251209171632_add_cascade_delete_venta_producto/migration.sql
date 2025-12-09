-- DropForeignKey
ALTER TABLE "VentaProducto" DROP CONSTRAINT "VentaProducto_ventaId_fkey";

-- AddForeignKey
ALTER TABLE "VentaProducto" ADD CONSTRAINT "VentaProducto_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
