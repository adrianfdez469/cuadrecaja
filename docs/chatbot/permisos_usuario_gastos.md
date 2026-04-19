# Gastos — permisos (lenguaje sencillo)

## Resumen rápido

| Permiso (etiqueta en roles) | Lo que permite en la práctica |
|------------------------------|-------------------------------|
| **Ver gastos** | Menú **Gastos**, lista de la tienda y, en **Cierre**, bloque **gastos del período**. |
| **Gestionar gastos** | Todo lo anterior **más**: crear/editar/activar/desactivar/eliminar gastos de tienda, **asignar plantilla**, **gastos ad-hoc** en el cierre. |
| **Plantillas de gastos** (en configuración) | **Plantillas de gastos** a nivel **todo el negocio** y asignación a tiendas según el diseño del sistema. |

## Cómo se nota cada falta

- Sin **ver:** mensaje de no permisos o no aparece el menú **Gastos**; en cierre, no ves el resumen de gastos.
- Sin **gestionar:** ves la lista pero **sin** “Nuevo gasto” ni “Asignar plantilla”; en cierre, no podés cargar **ad-hoc**.
- Sin **plantillas:** no ves o no entrás a **Plantillas de gastos** en configuración.

## Superadministrador

Acceso completo.

## Resumen para el bot

- “No veo gastos” → **ver gastos**.  
- “No puedo crear” → **gestionar gastos**.  
- “No puedo armar plantillas del negocio” → **plantillas de gastos** en configuración.
