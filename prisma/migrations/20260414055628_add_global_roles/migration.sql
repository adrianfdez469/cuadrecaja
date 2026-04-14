-- DropForeignKey
ALTER TABLE "Rol" DROP CONSTRAINT "Rol_negocioId_fkey";

-- AlterTable
ALTER TABLE "Rol" ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "negocioId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Rol_isGlobal_idx" ON "Rol"("isGlobal");

-- Partial unique index: garantiza que no haya dos roles globales con el mismo nombre
CREATE UNIQUE INDEX "Rol_nombre_global_key" ON "Rol"(nombre) WHERE "negocioId" IS NULL;

-- AddForeignKey
ALTER TABLE "Rol" ADD CONSTRAINT "Rol_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Insertar los 3 roles globales del sistema
-- ============================================================
INSERT INTO "Rol" (id, nombre, descripcion, permisos, "isGlobal", "negocioId", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'Administrador',
    'Rol administrador con acceso completo al negocio',
    'configuracion.usuarios.acceder|configuracion.usuarios.cambiarpassword|configuracion.locales.acceder|configuracion.categorias.acceder|configuracion.productos.acceder|configuracion.proveedores.acceder|configuracion.descuentos.acceder|configuracion.descuentos.preview|configuracion.destinostransferencia.acceder|configuracion.roles.acceder|configuracion.roles.escribir|recuperaciones.dashboard.acceder|recuperaciones.inventario.acceder|recuperaciones.resumencierres.acceder|recuperaciones.analisiscpp.acceder|recuperaciones.proveedoresconsignación.acceder|operaciones.pos-venta.acceder|operaciones.pos-venta.cancelarventa|operaciones.pos-venta.gananciascostos|operaciones.pos-venta.asociar_codigo|operaciones.ventas.acceder|operaciones.ventas.eliminar|operaciones.conformarprecios.acceder|operaciones.cierre.acceder|operaciones.cierre.cerrar|operaciones.cierre.gananciascostos|operaciones.movimientos.acceder|operaciones.movimientos.crear.compra|operaciones.movimientos.crear.ajuste_entradas|operaciones.movimientos.crear.ajuste_salidas|operaciones.movimientos.crear.transferencia|operaciones.movimientos.crear.recepcion|operaciones.movimientos.crear.consignacion_entrada|operaciones.movimientos.crear.consignacion_devolucion',
    true,
    NULL,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Vendedor',
    'Rol vendedor con acceso a POS y ventas',
    'operaciones.pos-venta.acceder|operaciones.pos-venta.cancelarventa|operaciones.cierre.acceder|operaciones.cierre.cerrar|operaciones.movimientos.acceder|operaciones.movimientos.crear.recepcion|configuracion.descuentos.preview',
    true,
    NULL,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Almacenero',
    'Rol almacenero con acceso a inventario y movimientos',
    'configuracion.categorias.acceder|configuracion.productos.acceder|configuracion.proveedores.acceder|recuperaciones.inventario.acceder|recuperaciones.analisiscpp.acceder|operaciones.movimientos.acceder|operaciones.movimientos.crear.compra|operaciones.movimientos.crear.ajuste_entradas|operaciones.movimientos.crear.ajuste_salidas|operaciones.movimientos.crear.transferencia|operaciones.movimientos.crear.recepcion|operaciones.movimientos.crear.consignacion_entrada|operaciones.movimientos.crear.consignacion_devolucion',
    true,
    NULL,
    NOW(),
    NOW()
  );

-- ============================================================
-- Migración de datos existentes:
-- Reasignar UsuarioTienda de roles negocio-específicos a sus equivalentes globales
-- ============================================================
UPDATE "UsuarioTienda" ut
SET "rolId" = global_rol.id
FROM "Rol" old_rol
JOIN "Rol" global_rol ON global_rol.nombre = old_rol.nombre AND global_rol."isGlobal" = true
WHERE ut."rolId" = old_rol.id
  AND old_rol."isGlobal" = false;

-- Eliminar roles negocio-específicos que ahora tienen un equivalente global
DELETE FROM "Rol"
WHERE "isGlobal" = false
  AND nombre IN ('Administrador', 'Vendedor', 'Almacenero');
