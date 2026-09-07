-- CreateTable
CREATE TABLE "QabReconciliacionTienda" (
    "id" TEXT NOT NULL,
    "tiendaId" TEXT NOT NULL,
    "ultimaComparacionAt" TIMESTAMP(3),
    "ultimoContactoOkAt" TIMESTAMP(3),
    "hashDivergenteAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QabReconciliacionTienda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QabReconciliacionTienda_tiendaId_key" ON "QabReconciliacionTienda"("tiendaId");

-- CreateIndex
CREATE INDEX "QabReconciliacionTienda_ultimaComparacionAt_idx" ON "QabReconciliacionTienda"("ultimaComparacionAt");

-- AddForeignKey
ALTER TABLE "QabReconciliacionTienda" ADD CONSTRAINT "QabReconciliacionTienda_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
