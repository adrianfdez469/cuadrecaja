# Inventario — problemas y soluciones

La pantalla **Inventario** muestra los **productos de la tienda actual** con **existencias**, **precio**, **costo**, valor aproximado del stock y avisos de **vencimiento**. Sirve para **consultar** y, en algunos casos, **exportar** o **editar la fecha de vencimiento**. Para **cambiar cantidades** de mercancía se usa **Movimientos** (compras, ajustes, ventas en POS, etc.).

---

## No veo el menú Inventario

**Qué suele pasar:** Falta permiso de **recuperaciones del inventario** (en el menú suele estar junto a otros resúmenes).

**Qué hacer:** Pedir al administrador que active el acceso a inventario en tu rol.

---

## La lista está vacía o tiene muy pocos productos

**Causas posibles:**

1. **En la tienda no hay productos dados de alta** o no están asignados a esa sucursal.
2. **Búsqueda o filtro activo:** limpia el cuadro de búsqueda y el filtro de “próximos a vencer” (icono de alarma) si lo encendiste sin querer.
3. **Usuario vinculado a proveedor:** si tu usuario está asociado en la ficha de un proveedor como “persona de contacto”, el sistema puede mostrarte **solo** los artículos ligados a ese proveedor (lista más corta que la de otros compañeros). Si no estás seguro, comparar con un administrador.

**Qué hacer:** Confirmar tienda arriba; revisar filtros; si aplica, hablar con el administrador sobre la vinculación a proveedor.

---

## “Error al cargar el inventario”

**Qué hacer:** Actualizar, comprobar internet, cerrar sesión y entrar. Si persiste, soporte.

---

## No me deja guardar la fecha de vencimiento (o sale “no autorizado”)

**Qué suele pasar:** Guardar vencimiento usa la misma vía que otros cambios de datos de producto en tienda; el sistema exige permiso de **Conformar precios** (nombre del menú en operaciones), aunque solo estés tocando la fecha.

**Qué hacer:** Pedir al administrador el permiso para **Conformar precios** además del de **Inventario**, o que quien tenga ese permiso actualice las fechas.

---

## Exportar a Word o Excel dice que no hay productos con precio

**Qué significa:** La exportación **solo incluye** artículos cuyo **precio es mayor que cero**. Si todos están en cero o sin precio, no exporta.

**Qué hacer:** Revisar precios en **Conformar precios** o en **Configuración de productos** según el procedimiento del negocio, y volver a exportar.

---

## El nombre del producto lleva “- Nombre de proveedor”

**Qué es:** Forma de distinguir la misma referencia cuando hay **proveedor asociado** a esa fila de inventario (por ejemplo consignación).

**Qué hacer:** Nada incorrecto; si confunde al buscar, probá buscar por parte del nombre del producto.

---

## “Sin stock” o “Bajo stock” y yo acabo de comprar

**Qué suele pasar:** La compra aún no se registró como **movimiento**, o estás en **otra tienda** distinta de donde entró la mercancía.

**Qué hacer:** Revisar tienda actual y el historial en **Movimientos**; registrar la compra si faltaba.

---

## Pulso la fila y no pasa nada o no entiendo el cuadro

**Qué es:** Al hacer clic en un producto se abre el **historial de movimientos de ese artículo** en la tienda (entradas y salidas con filtros).

**Qué hacer:** Usar filtros de fechas y tipo dentro del cuadro; cerrar con la X.
