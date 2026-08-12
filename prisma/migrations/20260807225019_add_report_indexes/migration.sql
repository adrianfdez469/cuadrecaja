-- CreateIndex
CREATE INDEX "GastoCierre_cierreId_categoria_idx" ON "GastoCierre"("cierreId", "categoria");

-- CreateIndex
CREATE INDEX "MovimientoStock_tiendaId_tipo_fecha_idx" ON "MovimientoStock"("tiendaId", "tipo", "fecha");

-- CreateIndex
CREATE INDEX "ProductoTienda_tiendaId_deletedAt_idx" ON "ProductoTienda"("tiendaId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProductoTienda_tiendaId_fechaVencimiento_idx" ON "ProductoTienda"("tiendaId", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "Venta_tiendaId_createdAt_idx" ON "Venta"("tiendaId", "createdAt");

-- CreateIndex
CREATE INDEX "Venta_cierrePeriodoId_idx" ON "Venta"("cierrePeriodoId");

-- CreateIndex
CREATE INDEX "Venta_usuarioId_idx" ON "Venta"("usuarioId");

-- CreateIndex
CREATE INDEX "VentaProducto_ventaId_idx" ON "VentaProducto"("ventaId");

-- CreateIndex
CREATE INDEX "VentaProducto_productoTiendaId_idx" ON "VentaProducto"("productoTiendaId");
