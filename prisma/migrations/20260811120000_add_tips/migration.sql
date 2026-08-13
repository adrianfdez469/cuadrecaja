-- Propinas.
--
-- La propina no es un flujo de dinero aparte: es una anotación sobre
-- pagosDetalle que marca qué parte de lo recibido no pertenece al negocio.
-- Invariante: Σ pagosDetalle.equivalenteBase − Σ vueltoDetalle(base) = total + tipTotal.
-- Por eso la caja no cambia: el billete ya estaba contado en la gaveta.
--
-- Las ventas existentes con excedente no se reclasifican como propina: son
-- ambiguas (mayormente vuelto no registrado) y quedan en tipTotal = 0.

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "tipDetail" JSONB,
ADD COLUMN     "tipTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CierrePeriodo" ADD COLUMN     "totalTips" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ResumenMonedaCierre" ADD COLUMN     "tipCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tipTransfer" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TicketPlantilla" ADD COLUMN     "mostrarPropina" BOOLEAN NOT NULL DEFAULT true;
