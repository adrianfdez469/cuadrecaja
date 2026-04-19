# Gastos — problemas y soluciones

En la aplicación hay **dos niveles** habituales:

1. **Gastos de la tienda** (`/gastos`): conceptos de gasto **recurrentes** (alquiler, servicios, etc.) con reglas de **monto fijo** o **porcentaje sobre ventas o ganancias**, y **cada cuánto** se aplican al **cierre de período**. También podés **asignar plantillas** del negocio a tu sucursal.
2. **Plantillas de gastos** (`/gastos/plantillas`, también en menú **Configuración**): modelos **globales del negocio** para crear varias tiendas parecidas sin repetir todo a mano.

Además, en **Cierre de caja** pueden aparecer **gastos del período**, **gastos extra puntuales (ad-hoc)** y un **paso de revisión** antes de cerrar.

---

## No veo el menú “Gastos”

**Qué suele pasar:** Falta el permiso de **solo ver gastos** de la tienda.

**Qué hacer:** Pedir al administrador acceso a **ver gastos**.

---

## Veo la lista pero no puedo crear, editar ni asignar plantilla

**Qué suele pasar:** Solo tenés **ver**; falta **gestionar gastos**.

**Qué hacer:** Pedir permiso de **gestionar gastos** (crear, editar, desactivar, eliminar y registrar gastos ad-hoc en períodos abiertos).

---

## “No tienes permisos para ver esta sección” en Gastos

**Qué hacer:** Igual que arriba: permiso **ver gastos**.

---

## No veo “Plantillas de gastos” en Configuración

**Qué suele pasar:** Falta permiso de **gestionar plantillas de gastos** a nivel negocio.

**Qué hacer:** Lo define el administrador del negocio; es distinto del permiso de ver gastos en la tienda.

---

## La lista dice “No hay gastos configurados”

**Qué hacer:** Si tenés permiso de gestión, usá **Nuevo gasto** o **Asignar plantilla**. Si no tenés gestión, pedí a un encargado que cargue los gastos recurrentes de la tienda.

---

## “Error al cargar gastos” / lista vacía sin mensaje

**Qué hacer:** Comprobar que haya **tienda seleccionada** arriba (los gastos son por sucursal). Actualizar la página. Si sigue, soporte.

---

## Al eliminar un gasto me dice que se desactivará

**Qué es:** El sistema advierte que si el gasto ya tuvo **historial en cierres**, puede **desactivarse** en lugar de borrarse por completo.

**Qué hacer:** Confirmar solo si es lo que buscás; si necesitás borrar del todo algo con historial, puede hacer falta ayuda de administración.

---

## No puedo borrar una plantilla

**Qué dice la pantalla:** si la plantilla sigue **asignada a tiendas** con gastos activos, primero hay que **desactivar esas asignaciones** (o el mensaje te lo indica).

**Qué hacer:** Revisar qué tiendas la usan y quitar la asignación desde **Gastos** en cada tienda o según el procedimiento interno.

---

## En cierre no aparece el botón de gasto extra

**Qué suele pasar:** Falta permiso de **gestionar gastos** (el registro **ad-hoc** solo lo muestra quien puede gestionar).

---

## Al cerrar caja, mensaje sobre sincronizar ventas en el POS

**Qué es:** Regla del **cierre**, no de la pantalla de gastos: hay ventas sin sincronizar.

**Qué hacer:** Ir al **POS**, sincronizar, y volver al cierre (cuando documentemos Cierre en detalle, enlazamos).

---

## Revisión de gastos: “No se pudo cargar el resumen” o error al aplicar

**Qué hacer:** Reintentar; si el período está mal o la red falló, soporte. No cerrar dos veces seguidas si quedó a medias.
