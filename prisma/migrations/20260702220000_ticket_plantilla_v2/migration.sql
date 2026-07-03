-- AlterTable
ALTER TABLE "TicketPlantilla" ADD COLUMN "mostrarNegocio" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TicketPlantilla" ADD COLUMN "mostrarTienda" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TicketPlantilla" ADD COLUMN "mostrarTasas" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TicketPlantilla" ADD COLUMN "mostrarTotalesSecundarios" BOOLEAN NOT NULL DEFAULT true;
