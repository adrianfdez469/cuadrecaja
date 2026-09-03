-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "qabToken" TEXT,
ADD COLUMN     "qabTokenActualizadoAt" TIMESTAMP(3),
ADD COLUMN     "qabUltimoPedidoVisto" TEXT,
ADD COLUMN     "tiendaOnlineHabilitada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "productoCanonicoId" TEXT,
ADD COLUMN     "publicarEnTienda" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductoTienda" ADD COLUMN     "dispPublicada" TEXT,
ADD COLUMN     "umbralBajo" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Tienda" ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "horarios" JSONB,
ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION,
ADD COLUMN     "motivoDespublicacion" VARCHAR(160),
ADD COLUMN     "provincia" TEXT,
ADD COLUMN     "publicarEnTienda" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "slugQab" TEXT,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "OutboxEvento" (
    "id" BIGSERIAL NOT NULL,
    "negocioId" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "ocurridoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "procesadoAt" TIMESTAMP(3),
    "ultimoError" TEXT,

    CONSTRAINT "OutboxEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoEntrante" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "qabOrderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "storeExternalId" TEXT NOT NULL,
    "tiendaId" TEXT,
    "status" TEXT NOT NULL,
    "cancelledBy" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "contactAddress" TEXT,
    "currencyCode" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discountTotal" DECIMAL(14,2) NOT NULL,
    "deliveryFee" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "deliveryFeePending" BOOLEAN NOT NULL DEFAULT false,
    "rateSnapshot" JSONB,
    "notes" TEXT,
    "customerWhatsappUrl" TEXT,
    "proposalProposedAt" TIMESTAMP(3),
    "proposalExpiresAt" TIMESTAMP(3),
    "proposalPreviousTotal" DECIMAL(14,2),
    "proposalSubtotal" DECIMAL(14,2),
    "proposalDiscountTotal" DECIMAL(14,2),
    "proposalDeliveryFee" DECIMAL(14,2),
    "proposalTotal" DECIMAL(14,2),
    "proposalMessage" TEXT,
    "qabCreatedAt" TIMESTAMP(3),
    "pulledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoEntrante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoEntranteLinea" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "storeProductExternalId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "originalCurrencyCode" TEXT,
    "originalUnitPrice" DECIMAL(14,2),
    "originalLineTotal" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoEntranteLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboxEvento_negocioId_procesadoAt_id_idx" ON "OutboxEvento"("negocioId", "procesadoAt", "id");

-- CreateIndex
CREATE INDEX "OutboxEvento_entidad_entidadId_idx" ON "OutboxEvento"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "PedidoEntrante_negocioId_status_idx" ON "PedidoEntrante"("negocioId", "status");

-- CreateIndex
CREATE INDEX "PedidoEntrante_negocioId_code_idx" ON "PedidoEntrante"("negocioId", "code");

-- CreateIndex
CREATE INDEX "PedidoEntrante_tiendaId_qabCreatedAt_idx" ON "PedidoEntrante"("tiendaId", "qabCreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoEntrante_negocioId_qabOrderId_key" ON "PedidoEntrante"("negocioId", "qabOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoEntrante_id_negocioId_key" ON "PedidoEntrante"("id", "negocioId");

-- CreateIndex
CREATE INDEX "PedidoEntranteLinea_pedidoId_idx" ON "PedidoEntranteLinea"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoEntranteLinea_negocioId_idx" ON "PedidoEntranteLinea"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Tienda_negocioId_slug_key" ON "Tienda"("negocioId", "slug");

-- AddForeignKey
ALTER TABLE "OutboxEvento" ADD CONSTRAINT "OutboxEvento_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoEntrante" ADD CONSTRAINT "PedidoEntrante_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoEntrante" ADD CONSTRAINT "PedidoEntrante_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoEntranteLinea" ADD CONSTRAINT "PedidoEntranteLinea_pedidoId_negocioId_fkey" FOREIGN KEY ("pedidoId", "negocioId") REFERENCES "PedidoEntrante"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

