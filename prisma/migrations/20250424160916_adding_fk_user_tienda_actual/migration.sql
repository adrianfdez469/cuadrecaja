-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tiendaActualId_fkey" FOREIGN KEY ("tiendaActualId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
