# Dashboard — qué debe estar preparado

## Resumen del negocio (recuperaciones → Dashboard)

| Requisito | Motivo |
|-----------|--------|
| **Tienda actual** (o acceso a la tienda consultada) | Las métricas son por sucursal. |
| **Permiso `recuperaciones.dashboard.acceder`** | Sin él el servidor rechaza la consulta. |
| **Ventas en el rango elegido** | Si no hubo movimiento, los gráficos y tablas salen vacíos. |

## Dashboard ejecutivo (`/dashboard`)

| Requisito | Motivo |
|-----------|--------|
| **Usuario con al menos un local** y tienda seleccionada | Igual que arriba. |
| **Período de caja abierto** en la tienda consultada | El backend devuelve error si no existe período activo para armar “período actual”. |
| **Datos de ventas e inventario** | Sin actividad, algunas tarjetas pueden mostrar ceros. |

**Nota de producto:** el **Dashboard ejecutivo** no exige el mismo permiso de “recuperaciones” en la API de métricas que **Resumen del negocio**; igual conviene que solo lo usen perfiles autorizados por el negocio (acceso por URL).

## Diferencia útil para capacitación

- **Ejecutivo:** “¿Cómo va **hoy** y el **período de caja** con el **stock**?”
- **Resumen del negocio:** “¿Qué se vendió **este mes / esta semana** y qué productos **más o menos** convienen?”
