# Cierre — qué debe estar preparado

| Requisito | Motivo |
|-----------|--------|
| **Tienda actual** | Todo el cierre es por sucursal. |
| **Período abierto** | Sin período no hay datos que cerrar (la pantalla ofrece crear el primero). |
| **Ventas registradas** (opcional) | Podés cerrar con poco movimiento; los totales reflejarán lo vendido. |
| **Ventas sincronizadas en el POS** (en cada dispositivo) | El **mismo navegador** que intenta cerrar no debe tener ventas locales **sin sincronizar**. |
| **Gastos configurados** (si el negocio los usa) | Los **recurrentes** aparecen en la **revisión previa** según reglas de día/recurrencia; los **ad-hoc** del período se suman al cierre. |

## Permisos que suelen pedirse en conjunto

- **Ver gastos:** para ver el bloque de gastos en la página de cierre.
- **Gestionar gastos:** para el botón de **gasto puntual** y plantillas (vía módulo Gastos).
- **Cerrar caja:** imprescindible para completar el botón **Cerrar caja** y el flujo en servidor.

## Qué hace el sistema al confirmar (sin tecnicismos)

- **Guarda** los totales del período (ventas, transferencias, ganancias, consignación, etc.).
- **Descuenta** o registra los **gastos** según lo que marcaste en la revisión.
- **Cierra** el período y **abre** el siguiente para no dejar la tienda sin período activo.

## Consignación

- Si vendés productos de **proveedor en consignación**, el cierre suele mostrar apartados de **ventas propias** vs **consignación** y puede generar información para **liquidaciones** internas del sistema.
