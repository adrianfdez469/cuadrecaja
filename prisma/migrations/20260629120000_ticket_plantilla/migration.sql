-- CreateTable
CREATE TABLE "TicketPlantilla" (
    "id" TEXT NOT NULL,
    "tiendaId" TEXT NOT NULL,
    "encabezado" TEXT,
    "pie" TEXT,
    "mostrarCajero" BOOLEAN NOT NULL DEFAULT true,
    "mostrarDescuentos" BOOLEAN NOT NULL DEFAULT true,
    "mostrarMultimoneda" BOOLEAN NOT NULL DEFAULT true,
    "anchoPapel" INTEGER NOT NULL DEFAULT 58,
    "logoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketPlantilla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketPlantilla_tiendaId_key" ON "TicketPlantilla"("tiendaId");

-- AddForeignKey
ALTER TABLE "TicketPlantilla" ADD CONSTRAINT "TicketPlantilla_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
