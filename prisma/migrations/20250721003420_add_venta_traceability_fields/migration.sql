-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "frontendCreatedAt" TIMESTAMP(3),
ADD COLUMN     "syncAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wasOffline" BOOLEAN NOT NULL DEFAULT false;
