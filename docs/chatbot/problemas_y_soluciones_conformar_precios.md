# Conformar precios — problemas y soluciones

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
