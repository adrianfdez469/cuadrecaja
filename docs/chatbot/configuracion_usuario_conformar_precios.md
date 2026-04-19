# Conformar precios — qué debe estar preparado

| Requisito | Motivo |
|-----------|--------|
| **Tienda actual** | Los precios son por sucursal. |
| **Productos con ficha en el negocio** | Sin producto maestro no hay fila. |
| **Entrada de mercancía a la tienda** | Hace falta al menos un vínculo producto–tienda con existencias/precio según el flujo del negocio; la pantalla avisa si aún no hubo entradas desde movimientos. |
| **Precios mayores que cero** (para etiquetas) | La ventana de etiquetas filtra por precio > 0. |
| **Códigos de barra** (si vas a imprimir) | Sin código, usá la generación en el asistente o cargá códigos desde **Configuración → Productos** si tu rol lo permite. |

## Coherencia de negocio

- **Precio de venta:** se define o ajusta aquí (y en otros flujos que use el negocio).
- **Costo:** refleja compras y entradas; mantenerlo razonable mejora **rentabilidad** en pantalla y los informes de **CPP**.

## Lo que esta pantalla no reemplaza

- **No** registra compras ni cantidades (eso es **Movimientos**).
- **No** es el catálogo completo de altas/bajas de productos (**Configuración → Productos**).
