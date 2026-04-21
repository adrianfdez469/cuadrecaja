<!-- Consolidado para embeddings. Fuentes: seis archivos `conformar_precios` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Conformar precios

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

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

## Guía paso a paso

*Flujo principal en la aplicación.*

## Dónde está

- Menú de **operaciones** → **Conformar precios**.
- Título: **Conformar precios**. Subtítulo: gestión de **precios de venta** de tus productos.

## Antes de empezar

1. Seleccioná la **tienda** correcta (barra superior).
2. Entrá al menú solo si tu usuario tiene permiso.

---

## Qué verás

- Una tabla con **producto** (si hay proveedor en esa línea, el nombre puede verse como “Producto - Proveedor”).
- Columna **Precio** (editable).
- Columna **Costo** (referencia; en la interfaz actual **no está pensada para editarse** como el precio: el costo suele venir de **movimientos**).
- Columna **Rentabilidad** (porcentaje aproximado según precio y costo).

---

## Cambiar precios (escritorio)

1. Hacé **doble clic** en la celda de **precio** del producto (o seguí el comportamiento de tu navegador para “editar celda”).
2. Escribí el nuevo valor (debe ser **positivo**).
3. Confirmá con **Enter** o el ícono de **tilde** según aparezca.
4. La fila puede **resaltarse** en color suave mientras haya cambios sin guardar.
5. Pulsá **Guardar** arriba (puede indicar cuántos productos cambiaron).
6. Esperá el mensaje de éxito y que la tabla se **actualice**.

---

## Cambiar precios (móvil)

1. Tocá la celda de **precio** para entrar en modo edición.
2. Ingresá el valor y confirmá.
3. En muchos casos el sistema intenta **guardar solo** esa fila automáticamente; igual conviene revisar si quedó el aviso de cambios pendientes y usar **Guardar** si hace falta.

---

## Buscar productos

- Usá el cuadro **Buscar producto** para acortar la lista (ignora mayúsculas según el comportamiento habitual).

---

## Actualizar la lista

- Botón **Actualizar** (o icono de refrescar en móvil) vuelve a leer del servidor **sin** perder necesariamente lo que no guardaste; si hay dudas, **guardá antes** de refrescar.

---

## Etiquetas (botón “Etiquetas” / icono de impresión)

1. Abrí **Etiquetas**.
2. Buscá y **marcá** los productos a imprimir y la **cantidad** de etiquetas por uno.
3. Elegí tipo **código de barras** o **QR** si la ventana lo ofrece.
4. Si un producto **no tiene código**, usá la opción de **generar códigos** cuando aparezca y esperá el mensaje de resultado.
5. Generá el **PDF** y descargalo o imprimilo desde el visor del navegador.

**Nota:** la lista de etiquetas suele incluir solo productos con **precio mayor que cero**.

---

## Relación con otras pantallas

| Objetivo | Pantalla |
|----------|----------|
| Cambiar **cantidades** en depósito | **Movimientos** |
| Ver existencias | **Inventario** |
| Analizar **costo promedio** y confiabilidad | **Análisis CPP** |
| Poner **fecha de vencimiento** | **Inventario** (guardado con el mismo permiso que conformar precios) |

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

## Entrar al menú

- Permiso **operaciones.conformar precios** (“Permite conformar precios de productos” en la descripción interna).

Sin él, no verás **Conformar precios** en operaciones.

---

## Guardar precios y otros datos de producto en tienda

- El **guardado** desde esta pantalla usa la misma regla del servidor: hace falta **conformar precios**.

Por eso, si alguien puede ver **Inventario** pero **no** puede guardar **fecha de vencimiento**, casi siempre le falta este permiso (ver guía de Inventario).

---

## Generar códigos de barra desde etiquetas

- La acción llama a servicios de producto; en muchos negocios también se exige el permiso de **generar código** en configuración de productos. **No está garantizado** solo con conformar precios: si falla, revisar rol con el administrador.

---

## Superadministrador

Acceso completo.

---

## Resumen para el bot

- “No veo conformar precios” → permiso **conformar precios**.  
- “No guarda vencimiento en inventario” → mismo permiso, explicarlo con calma.  
- “No genera códigos” → revisar permiso de **códigos de producto** además del acceso a etiquetas.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Cargando productos…” / “Error al cargar los productos”

**Qué hacer:** Conexión o sesión; actualizar. Si persiste, soporte.

---

## “Los valores de precio deben ser positivos”

**Qué hacer:** No uses números negativos; corregí el valor en la celda.

---

## “Error al actualizar el producto” / “Error al guardar los cambios”

**Qué hacer:** Reintentar; comprobar permiso de **Conformar precios**; si el mensaje es de acceso denegado, pedir permiso al administrador.

---

## “No hay cambios para guardar”

**Qué hacer:** Editá al menos un precio antes de guardar.

---

## “Tienes X productos con cambios sin guardar”

**Qué es:** Aviso preventivo; pulsá **Guardar**.

---

## “Cambio guardado automáticamente” (móvil)

**Qué esperar:** Esa fila ya quedó en el servidor; igual podés usar **Actualizar** para verificar.

---

## “Error al guardar automáticamente”

**Qué hacer:** Misma línea que error al guardar: conexión o permisos.

---

## “X producto(s) actualizado(s) correctamente”

**Qué esperar:** Lista sin resaltado de cambios pendientes tras recargar.

---

## Etiquetas — mensajes

- **“Generando códigos para N producto(s)…”** → esperar.
- **“Se generaron N códigos exitosamente”** / avisos con **fallaron** → revisar cuáles productos quedaron sin código.
- **“Error generando códigos de barras”** / **“Error generando el PDF de etiquetas”** → reintentar; si falla siempre, soporte.

---

## Lista vacía con texto sobre “movimientos”

**Lectura:** Falta dar de alta el producto en la tienda vía **entradas** (movimientos). El texto puede decir “operaiones”; entendé “operaciones”.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

La pantalla **Conformar precios** (subtítulo: gestión de **precios de venta**) muestra los productos de la **tienda actual** con **precio**, **costo** (referencia) y **rentabilidad**. Lo habitual es **ajustar el precio de venta** en la tabla y **guardar**; el **costo** en la grilla se muestra para orientarte y suele actualizarse con **compras y movimientos**, no desde aquí en el día a día.

---

## No veo el menú “Conformar precios”

**Qué suele pasar:** Falta el permiso de **operaciones / conformar precios**.

**Qué hacer:** Pedir al administrador que active el acceso.

---

## “No hay tienda seleccionada”

**Qué hacer:** Elegir la sucursal arriba; los precios son **por tienda**.

---

## La lista sale vacía: “No hay productos registrados”

**Qué dice la pantalla:** que primero hay que tener **entradas de productos** desde **movimientos** (el texto puede tener un error tipográfico “operaiones”; se entiende “operaciones”).

**Qué hacer:** Dar de alta el producto en **Configuración** y registrar **compra, recepción u otra entrada** en **Movimientos** para que exista **producto en esa tienda**.

---

## Cambié precios y no se aplicaron

**Causas habituales:**

1. No pulsaste **Guardar** (en escritorio el botón puede mostrar cuántos productos tienen cambios).
2. En **móvil**, a veces se intenta guardar automático al salir de la celda; si falló la conexión, revisa el mensaje en rojo.
3. Quedó un aviso amarillo de **“cambios sin guardar”** arriba de la tabla.

**Qué hacer:** Pulsa **Guardar** y espera a que desaparezca el mensaje de “Guardando…”.

---

## “Acceso no autorizado” al guardar o al poner fecha de vencimiento en Inventario

**Qué suele pasar:** El guardado de precios (y otros datos de producto-tienda) exige el mismo permiso de **Conformar precios**.

**Qué hacer:** Pedir ese permiso, no solo inventario.

---

## Rentabilidad sale 0 %

**Qué significa:** Si el **costo** o el **precio** es cero, la columna **Rentabilidad** muestra 0 % (así está definido en pantalla).

**Qué hacer:** Revisar costo vía **movimientos** y precio aquí.

---

## Etiquetas: no aparecen productos o falla el PDF

**Causas frecuentes:**

- El listado de etiquetas solo trae artículos con **precio mayor que cero** (regla del sistema para esa ventana).
- Falta **código de barras** en algunos productos: la ventana ofrece **generar códigos** antes de imprimir; si falla, puede ser permiso de **generar códigos** en configuración de productos (depende de cómo esté armado el rol).

**Qué hacer:** Revisar precios y códigos; leer el mensaje exacto (“Error generando el PDF…”, “Error generando códigos…”).

---

## “No hay cambios para guardar”

**Qué es:** Pulsaste Guardar sin haber modificado ninguna fila desde la última carga.

**Qué hacer:** Edita al menos un precio y vuelve a guardar.

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Para qué sirve Conformar precios?”

**Respuesta sugerida:**  
“Es donde el negocio **ajusta el precio de venta** de cada producto en la **tienda** que tenés seleccionada. Ves también el **costo** y una **rentabilidad** aproximada. Los **costos** suelen actualizarse cuando comprás o recibís mercancía en **Movimientos**. Después de cambiar precios, acordate de pulsar **Guardar**.”

**Pregunta de diagnóstico:** “¿Estás en la **tienda** correcta arriba?”

---

## “No me guarda los cambios”

**Respuesta sugerida:**  
“Fijate si aparece el aviso amarillo de **cambios sin guardar** y pulsá **Guardar**. Si igual falla, puede ser **permiso**: hace falta **Conformar precios** para grabar. Si ves mensaje de no autorizado, pedilo al administrador.”

---

## “No tengo productos en la lista”

**Respuesta sugerida:**  
“Esa pantalla muestra lo que ya está **dado de alta en la tienda** con entradas desde **movimientos** (compras, recepciones, etc.). Si recién creaste el producto en configuración, falta registrar la **entrada** a tu sucursal. El mensaje de la pantalla puede tener un typo ‘operaiones’, pero se refiere a **operaciones / movimientos**.”

---

## “¿Cómo imprimo etiquetas?”

**Respuesta sugerida:**  
“Desde **Conformar precios** abrí **Etiquetas**, elegí productos y cantidad, y generá el **PDF**. Si un producto no tiene código, la misma ventana suele ofrecer **generar códigos** antes de imprimir. Los que tienen **precio en cero** pueden no aparecer en esa lista de etiquetas.”

---

## “¿Aquí arreglo el costo?”

**Respuesta sugerida:**  
“Lo principal de esta pantalla es el **precio de venta**. El **costo** lo ves para orientarte; en la práctica lo actualizan las **compras y entradas** en **Movimientos**. Si necesitás corregir un costo mal cargado, normalmente se hace con el procedimiento que use tu administrador (movimiento de ajuste o similar).”

---

## Productos “conformados” por otros (compuestos)

**Respuesta sugerida:**  
“En esta pantalla se listan los **productos en la tienda** como filas de precio y costo. Si vendés artículos compuestos o paquetes, cómo se llaman y se cargan depende de cómo los dio de alta tu negocio en **Productos**. Si me decís el **nombre exacto** que ves en el POS, te guío mejor en el bloque de POS cuando lo tengamos documentado.”

*(Interpretación honesta: el flujo de ‘producto conformado’ no se detalla en el código de esta página; no inventar pasos.)*

---

## Frases a evitar

- “PUT a productos_tienda”, “DataGrid”.
- Afirmar que desde aquí se editan **cantidades** de stock.
