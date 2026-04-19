# POS — qué debe estar preparado

| Requisito | Motivo |
|-----------|--------|
| **Tienda y usuario** válidos | Todo el flujo es por sucursal y por vendedor. |
| **Período de caja abierto** | Sin período no se inicia la venta en condiciones normales. |
| **Productos con precio de venta mayor que cero** en esa tienda | El POS **oculta** lo que no tiene precio de venta. |
| **Stock disponible** (o reglas de fracción/padre) | No deja vender más de lo permitido al sincronizar. |
| **Destinos de transferencia** (si cobrás con transferencia) | Puede pedirse elegir a dónde va el dinero según configuración del negocio. |
| **Códigos de barra** en productos | Para escaneo rápido sin asociar cada vez. |
| **Red estable** (deseable) | Reduce ventas “solo locales” y errores de sincronización. |

## Productos en porciones o “hijos” de un pack

- Algunos artículos se venden **sueltos** pero el stock viene de un **producto padre** (caja, pack). El POS usa reglas internas para permitir la venta mientras el padre tenga saldo.

## Lo que el cajero no “configura” desde el POS

- Altas masivas de productos, precios globales o políticas de descuento: eso es **Configuración** / **Conformar precios** / roles.
