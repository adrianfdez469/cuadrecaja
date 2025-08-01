export const permisosTemplates = {
    "vendedor": [
        "operaciones.pos-venta.acceder",
        "operaciones.pos-venta.cancelarventa",
        "operaciones.cierre.acceder",
        "operaciones.cierre.cerrar",
        "operaciones.movimientos.acceder",
        "operaciones.movimientos.crear.recepcion",
    ],
    "almacenero": [
        "configuracion.categorias.acceder",
        "configuracion.productos.acceder",
        "configuracion.proveedores.acceder",
        "recuperaciones.inventario.acceder",
        "recuperaciones.analisiscpp.acceder",
        "operaciones.movimientos.acceder",
        "operaciones.movimientos.crear.compra",
        "operaciones.movimientos.crear.ajuste_entradas",
        "operaciones.movimientos.crear.ajuste_salidas",
        "operaciones.movimientos.crear.transferencia",
        "operaciones.movimientos.crear.recepcion",
        "operaciones.movimientos.crear.consignacion_entrada",
        "operaciones.movimientos.crear.consignacion_devolucion",        
    ],
    "administrador": [
        "configuracion.usuarios.acceder",
        "configuracion.usuarios.cambiarpassword",
        "configuracion.locales.acceder",
        "configuracion.categorias.acceder",
        "configuracion.productos.acceder",
        "configuracion.proveedores.acceder",
        "configuracion.destinostransferencia.acceder",
        "configuracion.roles.acceder",
        "configuracion.roles.escribir",
        "recuperaciones.dashboard.acceder",
        "recuperaciones.inventario.acceder",
        "recuperaciones.resumencierres.acceder",
        "recuperaciones.analisiscpp.acceder",
        "recuperaciones.proveedoresconsignación.acceder",
        "operaciones.pos-venta.acceder",
        "operaciones.pos-venta.cancelarventa",
        "operaciones.pos-venta.gananciascostos",
        "operaciones.ventas.acceder",
        "operaciones.ventas.eliminar",
        "operaciones.conformarprecios.acceder",
        "operaciones.cierre.acceder",
        "operaciones.cierre.cerrar",
        "operaciones.cierre.gananciascostos",
        "operaciones.movimientos.acceder",
        "operaciones.movimientos.crear.compra",
        "operaciones.movimientos.crear.ajuste_entradas",
        "operaciones.movimientos.crear.ajuste_salidas",
        "operaciones.movimientos.crear.transferencia",
        "operaciones.movimientos.crear.recepcion",
        "operaciones.movimientos.crear.consignacion_entrada",
        "operaciones.movimientos.crear.consignacion_devolucion"
    ],
}