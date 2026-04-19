# Ventas — guía paso a paso

## Entrar y entender la pantalla

1. Elegí la **tienda actual** (si vendés en varias sucursales).
2. Abrí **Ventas** desde el menú lateral.
3. Arriba verás el **título con la fecha de inicio del período** que está usando la pantalla y, si tu versión lo muestra, un subtítulo tipo **historial del período actual**.
4. Las tarjetas de **Total vendido** y **Monto hoy** se calculan sobre las ventas **que ves en la lista** (incluye el filtro de búsqueda si escribiste algo).

---

## Ver el detalle de una venta

1. En la tabla (escritorio) o en la tarjeta (celular), **tocá la venta** o el ícono de **ojo**.
2. Se abre el **detalle**: fecha, hora, vendedor, formas de pago (efectivo / transferencia / total), productos, y si hubo **descuentos**, un bloque con el desglose.
3. Cerrá con **Cerrar**.

---

## Buscar una venta

1. En el cuadro **Buscar venta…**, escribí parte de:
   - el **código corto** que muestra la lista (últimos caracteres del identificador),
   - una **fecha** o **hora** como la ves en pantalla,
   - el **nombre de un producto**,
   - o el **nombre del vendedor**.
2. La lista se reduce al instante; en móvil puede indicarse **“Filtro aplicado”** en las tarjetas de totales.

---

## Actualizar la lista

1. Pulsá el ícono de **refresco** junto al título (según diseño de tu pantalla).
2. Esperá a que termine de cargar: deberían aparecer ventas nuevas que ya llegaron desde el **POS** al servidor.

---

## Eliminar una venta completa

1. Localizá la venta en la lista.
2. Pulsá el ícono de **papelera** (o seguí el flujo de confirmación que pida la pantalla).
3. Confirmá el aviso **¿Está seguro que desea eliminar completamente esta venta?**

**Efecto esperado:** Mensaje de **eliminación correcta** y la venta desaparece; el sistema **devuelve stock** mediante movimientos internos de ajuste (no hace falta que el usuario los vea).

**Si no te deja:** Revisá **permisos** y si el **período** ya está **cerrado** (en ese caso no se puede desde aquí).

---

## Quitar solo un producto de una venta (varias líneas)

1. Abrí el **detalle** de la venta.
2. Si tenés permiso y la venta es **tuya** (o sos **superadministrador**), y la venta tiene **más de un producto**, verás la opción de **borrar línea** en cada producto.
3. Confirmá cuando el sistema pregunte.

**Efecto:** Ese producto vuelve al inventario y los **totales** de la venta se **recalculan**.

---

## Si no hay períodos todavía

1. Leé el mensaje informativo.
2. Si corresponde, pulsá **Crear primer período** y esperá la confirmación.
3. Después podés vender en el **POS** y volver a **Ventas** para ver el historial.

---

## Flujo típico del negocio

```text
POS (cobrar) → Ventas (revisar / anular con permiso) → Cierre (cerrar período cuando toque)
```
