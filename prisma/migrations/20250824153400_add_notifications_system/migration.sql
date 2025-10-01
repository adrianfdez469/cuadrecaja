-- CreateEnum
CREATE TYPE "NivelImportancia" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('ALERTA', 'NOTIFICACION', 'PROMOCION', 'MENSAJE');

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "nivelImportancia" "NivelImportancia" NOT NULL DEFAULT 'MEDIA',
    "tipo" "TipoNotificacion" NOT NULL,
    "leidoPor" TEXT NOT NULL DEFAULT '',
    "negociosDestino" TEXT NOT NULL DEFAULT '',
    "usuariosDestino" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacion_fechaInicio_idx" ON "Notificacion"("fechaInicio");

-- CreateIndex
CREATE INDEX "Notificacion_fechaFin_idx" ON "Notificacion"("fechaFin");

-- CreateIndex
CREATE INDEX "Notificacion_tipo_idx" ON "Notificacion"("tipo");

-- CreateIndex
CREATE INDEX "Notificacion_nivelImportancia_idx" ON "Notificacion"("nivelImportancia");
