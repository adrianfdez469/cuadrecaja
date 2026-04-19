# Ventas — qué debe estar preparado

| Requisito | Motivo |
|-----------|--------|
| **Tienda actual** definida | El listado es por sucursal. |
| Al menos un **período de caja** | Sin período, la pantalla ofrece **crear el primero** o queda sin historial útil. |
| **Ventas registradas** (normalmente desde el **POS**) | Si no hubo cobros sincronizados, la lista sale vacía. |
| **Conexión** estable para cargar y borrar | Las acciones hablan con el servidor. |

## Relación con otras áreas

- **POS:** origen habitual de las ventas; offline implica **retraso** hasta sincronizar.
- **Cierre:** al **cerrar** un período, las ventas de ese período suelen quedar **solo lectura** para anulaciones desde esta pantalla.
- **Inventario:** al **eliminar** una venta o una línea, el stock **vuelve** mediante lógica interna (ajustes); no hace falta un movimiento manual del usuario.

## Lo que esta pantalla no sustituye

- No es el **punto de cobro** (eso es el **POS**).
- No muestra por defecto **ganancias o costos** por producto en el detalle (a diferencia de algunos listados del POS con permiso específico).
