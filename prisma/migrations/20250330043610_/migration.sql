/*
  Warnings:

  - Added the required column `cerrado` to the `CierrePeriodo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CierrePeriodo" ADD COLUMN     "cerrado" BOOLEAN NOT NULL;
