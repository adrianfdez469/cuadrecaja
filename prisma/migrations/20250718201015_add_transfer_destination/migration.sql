-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "transferDestinationId" TEXT;

-- CreateTable
CREATE TABLE "TransferDestinations" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "default" BOOLEAN NOT NULL DEFAULT false,
    "tiendaId" TEXT NOT NULL,

    CONSTRAINT "TransferDestinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferDestinations_tiendaId_idx" ON "TransferDestinations"("tiendaId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferDestinations_nombre_tiendaId_key" ON "TransferDestinations"("nombre", "tiendaId");

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_transferDestinationId_fkey" FOREIGN KEY ("transferDestinationId") REFERENCES "TransferDestinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferDestinations" ADD CONSTRAINT "TransferDestinations_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
