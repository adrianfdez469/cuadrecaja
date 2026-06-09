-- AlterTable
ALTER TABLE "ProductoTienda" ADD COLUMN     "monedaCostoCode" TEXT,
ADD COLUMN     "monedaPrecioCode" TEXT;

-- AlterTable
ALTER TABLE "VentaProducto" ADD COLUMN     "monedaCostoCode" TEXT,
ADD COLUMN     "monedaPrecioCode" TEXT;

-- AddForeignKey
ALTER TABLE "ProductoTienda" ADD CONSTRAINT "ProductoTienda_monedaCostoCode_fkey" FOREIGN KEY ("monedaCostoCode") REFERENCES "Moneda"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoTienda" ADD CONSTRAINT "ProductoTienda_monedaPrecioCode_fkey" FOREIGN KEY ("monedaPrecioCode") REFERENCES "Moneda"("code") ON DELETE SET NULL ON UPDATE CASCADE;
