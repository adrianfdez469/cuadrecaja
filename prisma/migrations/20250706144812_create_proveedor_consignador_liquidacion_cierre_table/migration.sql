-- CreateTable
CREATE TABLE "ProveedorConsignadorLiquidaciónCierre" (
    "id" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liquidatedAt" TIMESTAMP(3),
    "cierreId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,

    CONSTRAINT "ProveedorConsignadorLiquidaciónCierre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProveedorConsignadorLiquidaciónCierre_cierreId_proveedorId_key" ON "ProveedorConsignadorLiquidaciónCierre"("cierreId", "proveedorId");

-- AddForeignKey
ALTER TABLE "ProveedorConsignadorLiquidaciónCierre" ADD CONSTRAINT "ProveedorConsignadorLiquidaciónCierre_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "CierrePeriodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorConsignadorLiquidaciónCierre" ADD CONSTRAINT "ProveedorConsignadorLiquidaciónCierre_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
