-- F-014: the online order landing.
--
-- Two movement types for the reservation and its release (ADR 0071), the
-- unique link between a sale and the order it landed from, and the claim flag
-- of a live reservation (ADR 0072).
--
-- NO other index is created on purpose: the `@unique` below builds its own, and
-- measuring the need for a `(tiendaId, referenciaId)` on "MovimientoStock" over
-- a table without the rows of the case gives a false conclusion in both
-- directions (E-023). It stays written down in ADR 0072 and is not created now.

-- AlterEnum
ALTER TYPE "MovimientoTipo" ADD VALUE 'PEDIDO_ONLINE_RESERVA';
ALTER TYPE "MovimientoTipo" ADD VALUE 'PEDIDO_ONLINE_LIBERACION';

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN "pedidoEntranteId" TEXT;

-- AlterTable
ALTER TABLE "PedidoEntrante" ADD COLUMN "stockReservedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Venta_pedidoEntranteId_key" ON "Venta"("pedidoEntranteId");

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_pedidoEntranteId_fkey" FOREIGN KEY ("pedidoEntranteId") REFERENCES "PedidoEntrante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
