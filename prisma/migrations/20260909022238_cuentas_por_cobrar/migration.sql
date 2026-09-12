-- CreateEnum
CREATE TYPE "TipoMovimientoCuentaPorCobrar" AS ENUM ('ABONO', 'AJUSTE_DEVOLUCION', 'CONDONACION', 'REVERSION_ABONO');

-- AlterTable
ALTER TABLE "CierrePeriodo" ADD COLUMN     "totalCobrosCredito" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalCreditoOtorgado" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalPorCobrarAlCierre" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MovimientoStock" ADD COLUMN     "montoAplicadoADeuda" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "clienteId" TEXT,
ADD COLUMN     "creditoBase" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "negocioId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaPorCobrar" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tiendaId" TEXT NOT NULL,
    "fechaVenta" TIMESTAMP(3) NOT NULL,
    "montoOriginal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saldoPendiente" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "monedaDeudaCode" TEXT,
    "montoDeudaMonedaOriginal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaPorCobrar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCuentaPorCobrar" (
    "id" TEXT NOT NULL,
    "cuentaPorCobrarId" TEXT NOT NULL,
    "tipo" "TipoMovimientoCuentaPorCobrar" NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagosDetalle" JSONB,
    "tasaSnapshot" JSONB,
    "motivo" TEXT,
    "usuarioId" TEXT,
    "revierteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCuentaPorCobrar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "Cliente"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_nombre_negocioId_key" ON "Cliente"("nombre", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaPorCobrar_ventaId_key" ON "CuentaPorCobrar"("ventaId");

-- CreateIndex
CREATE INDEX "CuentaPorCobrar_tiendaId_settledAt_idx" ON "CuentaPorCobrar"("tiendaId", "settledAt");

-- CreateIndex
CREATE INDEX "CuentaPorCobrar_tiendaId_fechaVenta_idx" ON "CuentaPorCobrar"("tiendaId", "fechaVenta");

-- CreateIndex
CREATE INDEX "CuentaPorCobrar_clienteId_idx" ON "CuentaPorCobrar"("clienteId");

-- CreateIndex
CREATE INDEX "MovimientoCuentaPorCobrar_cuentaPorCobrarId_fecha_idx" ON "MovimientoCuentaPorCobrar"("cuentaPorCobrarId", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoCuentaPorCobrar_fecha_idx" ON "MovimientoCuentaPorCobrar"("fecha");

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaPorCobrar" ADD CONSTRAINT "CuentaPorCobrar_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaPorCobrar" ADD CONSTRAINT "CuentaPorCobrar_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaPorCobrar" ADD CONSTRAINT "CuentaPorCobrar_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaPorCobrar" ADD CONSTRAINT "MovimientoCuentaPorCobrar_cuentaPorCobrarId_fkey" FOREIGN KEY ("cuentaPorCobrarId") REFERENCES "CuentaPorCobrar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaPorCobrar" ADD CONSTRAINT "MovimientoCuentaPorCobrar_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaPorCobrar" ADD CONSTRAINT "MovimientoCuentaPorCobrar_revierteId_fkey" FOREIGN KEY ("revierteId") REFERENCES "MovimientoCuentaPorCobrar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
