<!-- Consolidado para embeddings. Fuentes: seis archivos `gastos` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Gastos

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

| Necesidad | Para qué sirve |
|-----------|----------------|
| **Tienda actual** elegida | Los gastos de la pantalla principal son **por sucursal**. |
| **Lista de conceptos** (alquiler, luz, delivery, etc.) | Que en cada cierre se descuenten de forma **ordenada y repetible**. |
| **Decidir tipo de cálculo** | Monto fijo vs porcentaje sobre ventas o ganancias según cómo pague el negocio cada servicio. |
| **Decidir recurrencia** | Cuándo debe “tocar” cada gasto: todos los cierres, solo un mes, una vez, etc. |
| **Plantillas** (opcional) | Ahorrar tiempo si varias tiendas comparten el mismo paquete de gastos. |
| **Quién puede gestionar** | Evitar que cualquier cajero cambie conceptos sin autorización. |

## Coherencia con el cierre

- Los gastos recurrentes **no “cobran solos”** fuera del flujo de cierre: el sistema los considera al **cerrar período** (con paso de **revisión** donde se pueden desmarcar algunos recurrentes del día).
- Los **ad-hoc** son **puntuales** del período y suelen cargarlos quien lleva el cierre con permiso de gestión.

## Lo que el usuario no configura aquí

- **Precios de venta** de productos → **Conformar precios**.
- **Compras de mercadería** → **Movimientos**.

## Guía paso a paso

*Flujo principal en la aplicación.*

## Parte A: Gastos de la tienda (`/gastos`)

### Qué es

- Título: **Gastos**.
- Bloque principal: **Gastos de la tienda**, con texto de ayuda sobre gastos **recurrentes** y su relación con los **cierres de período**.

### Antes de empezar

1. Elegí la **tienda** correcta (barra superior).
2. Con permiso de **solo ver**, podés leer la lista. Con permiso de **gestionar**, ves botones **Asignar plantilla** y **Nuevo gasto**.

### Crear un gasto recurrente

1. Pulsá **Nuevo gasto**.
2. Completá **nombre** y **categoría** (podés elegir sugerencias o escribir una nueva).
3. Elegí **tipo de cálculo**:
   - **Monto fijo:** se descuenta un importe fijo cada vez que aplica.
   - **% sobre ventas:** un porcentaje del total de ventas del período.
   - **% sobre ganancias:** un porcentaje de las ganancias brutas del período.
4. Elegí **recurrencia** (según la pantalla: único, diario, mensual, anual; cada opción trae texto de ayuda):
   - **Único:** una sola vez (no se repite sola).
   - **Diario:** en cada cierre de período.
   - **Mensual / anual:** cuando el cierre cae en el día o fecha configurados.
5. Rellená montos o porcentajes y, si aplica, día del mes / mes / día del año que pide el formulario.
6. Activá o desactivá el interruptor **activo** si existe.
7. **Guardar**.

**Qué debería pasar:** Mensaje de **Gasto creado** y la fila nueva en la lista.

### Asignar una plantilla del negocio

1. Pulsá **Asignar plantilla**.
2. Elegí la plantilla en el paso 1.
3. En el paso 2, ajustá valores o fechas si la pantalla lo pide y confirmá.

**Qué debería pasar:** Mensaje **Plantilla asignada** y nuevas filas o gastos según la plantilla.

### Editar, activar/desactivar o eliminar

- **Editar:** abre el mismo formulario con datos cargados; al guardar: **Gasto actualizado**.
- **Activar/desactivar:** cambia si el gasto sigue vigente para futuros cierres.
- **Eliminar:** pide confirmación; si hay historial en cierres, el aviso indica que puede **desactivarse** en lugar de borrarse.

---

## Parte B: Plantillas de gastos (`/gastos/plantillas`)

- Menú **Configuración → Plantillas de Gastos** (misma ruta que `/gastos/plantillas` según el diseño del menú).
- Sirve para definir **modelos** reutilizables del negocio.
- Botón **Nueva plantilla**, tabla con plantillas existentes, editar y eliminar con confirmación.

**Permiso:** gestionar plantillas a nivel negocio (no es el mismo que “ver gastos” de una tienda).

---

## Parte C: Gastos en el cierre de caja

1. Si podés **ver gastos**, en la pantalla de **Cierre** puede mostrarse el bloque **Gastos del período** con el detalle y totales (incluye **ad-hoc** si los hubo).
2. Si podés **gestionar gastos**, podés abrir el registro de **gasto ad-hoc** (gasto puntual del período) desde el flujo que muestre tu versión del cierre.
3. Al **cerrar** la caja, el sistema puede abrir **Revisión de gastos antes del cierre**: lista de **recurrentes que aplican hoy** (podés desmarcar los que no correspondan), más **ad-hoc** ya cargados, y una **ganancia estimada** después de gastos. Confirmá cuando esté todo revisado.

**Relación:** los recurrentes respetan la **recurrencia** (por ejemplo mensual solo el día configurado). El texto de ayuda en pantalla lo explica brevemente.

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

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

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “No tienes permisos para ver esta sección”

**Gastos o Plantillas:** falta el permiso correspondiente (ver gastos o gestionar plantillas).

---

## “Error al cargar gastos” / “Error al cargar plantillas”

**Qué hacer:** Conexión o sesión; actualizar. Si persiste, soporte.

---

## “Gasto creado” / “Gasto actualizado” / “Plantilla creada” / etc.

**Qué esperar:** La lista se actualiza; si no, pulsá refrescar en el navegador.

---

## “Error al guardar gasto” / “Error al guardar plantilla”

**Qué hacer:** Revisar campos obligatorios del formulario (mensajes bajo cada campo si falla la validación). Si el mensaje viene del servidor, leer el texto exacto o pedir ayuda a soporte.

---

## “Error al actualizar estado”

**Contexto:** Al activar o desactivar un gasto de tienda.

**Qué hacer:** Reintentar; soporte si se repite.

---

## “Gasto eliminado” vs error al eliminar

**Qué hacer:** Si hay error con texto del servidor, seguir esa pista. Si el gasto tenía historial, puede haberse **desactivado** en lugar de borrarse.

---

## “Error al asignar plantilla”

**Qué hacer:** Revisar el paso 2 del asistente (montos/fechas). Si la plantilla ya está mal configurada, editarla en **Plantillas**.

---

## Plantilla: mensaje de que hay tiendas asignadas

**Qué hacer:** No se puede eliminar a la fuerza sin antes quitar asignaciones o desactivar gastos en esas tiendas, según el texto de confirmación.

---

## Cierre — “No se pudo cargar el resumen de gastos”

**Qué hacer:** Cerrar el cuadro y reintentar el cierre; comprobar red.

---

## “Error al aplicar los gastos”

**Qué hacer:** No repetir el cierre muchas veces seguidas; soporte si el error continúa.

---

## “Debe sincronizar las ventas en la interfaz del pos de ventas”

**Contexto:** Aparece al intentar iniciar el cierre con ventas pendientes de sincronizar.

**Qué hacer:** Ir al **POS** y sincronizar (detalle en la futura guía de Cierre).

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

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

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Para qué sirve la pantalla Gastos?”

**Respuesta sugerida:**  
“Ahí definís los **gastos recurrentes de la tienda**: por ejemplo alquiler o servicios, con **monto fijo** o **porcentaje** sobre ventas o ganancias, y **cada cuánto** se aplican cuando hacés el **cierre de caja**. También podés **asignar una plantilla** que armó el negocio para no cargar todo a mano. Los **gastos puntuales** de un solo período se cargan desde el **cierre**, si tenés permiso.”

**Pregunta de diagnóstico:** “¿Querés cargar **conceptos fijos** o solo ver lo que ya está?”

---

## “No me deja crear un gasto”

**Respuesta sugerida:**  
“Crear o editar requiere permiso de **gestionar gastos**, distinto del de solo **ver**. Pedilo al administrador. Si ya lo tenés, fijate que haya **tienda** seleccionada arriba.”

---

## “¿Dónde armo plantillas para todas las tiendas?”

**Respuesta sugerida:**  
“En **Configuración → Plantillas de gastos** (o la ruta equivalente en tu menú). Eso pide permiso de **gestionar plantillas** a nivel negocio. Después, en cada tienda, en **Gastos**, podés **asignar** esa plantilla si tenés permiso de gestionar gastos en esa tienda.”

---

## “¿Qué es gasto ad-hoc?”

**Respuesta sugerida:**  
“Es un **gasto puntual** de ese período, que no es parte de la lista recurrente: por ejemplo una reparación imprevista. Se registra desde el **cierre de caja** y lo ves en el resumen de gastos del período con una etiqueta tipo **Ad-hoc**.”

---

## “Al cerrar me pide revisar gastos”

**Respuesta sugerida:**  
“Es normal: antes de cerrar el sistema te muestra **qué gastos recurrentes aplican hoy** y podés **destildar** los que no correspondan. También suma los **ad-hoc** ya cargados y te estima la **ganancia** después de gastos. Cuando esté bien, confirmás y sigue el cierre.”

---

## Frases a evitar

- “Schema”, “endpoint”, “ad-hoc” sin explicar que es **“gasto puntual del período”** la primera vez.

---

## Enlace con otros módulos (para el bot)

- **Cierre:** revisión de gastos y sincronización del POS (guía de Cierre pendiente en el plan).  
- **Configuración:** plantillas de gastos.
