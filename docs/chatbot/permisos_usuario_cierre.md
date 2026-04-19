# Cierre — permisos (lenguaje sencillo)

| Permiso (cómo pedirlo al administrador) | Efecto |
|----------------------------------------|--------|
| **Acceder al cierre de caja** | Ver el menú **Cierre** y la pantalla de resumen del período. |
| **Cerrar caja** / **crear cierre** (nombre en tu panel) | Poder usar **Cerrar caja** y completar el cierre en servidor; también hace falta para **aplicar** la parte de gastos del asistente (API protegida). |
| **Ver ganancias y costos en el resumen de cierre** | Ver **ganancia total** en tarjetas y **precios/costos/ganancias** en el detalle agregado de productos. Sin esto, la tabla puede mostrar solo **cantidades** (`showOnlyCants` en la interfaz). |

## Permisos de Gastos que se cruzan con esta pantalla

| Permiso | Efecto en Cierre |
|---------|------------------|
| **Ver gastos** | Ver el listado de **gastos del período** debajo del detalle de productos. |
| **Gestionar gastos** | Ver el botón de **gasto puntual (ad-hoc)** en la barra superior del cierre. |

**Nota:** La **revisión de gastos** antes de cerrar la ejecuta quien pulse **Confirmar y cerrar**; en la práctica quien **cierra** necesita el permiso de **cerrar caja** en el servidor.

## Superadministrador

Acceso completo salvo las mismas reglas de negocio (período ya cerrado, etc.).

## Resumen para el bot

- “Entro a Cierre y no veo el menú” → **acceder al cierre**.  
- “Veo todo pero no puedo cerrar” → **cerrar caja**.  
- “Solo veo cantidades, no dinero de ganancia” → **ganancias y costos en cierre**.  
- “No veo gastos abajo” → **ver gastos**.  
- “No tengo el botón del ticket” → **gestionar gastos**.
