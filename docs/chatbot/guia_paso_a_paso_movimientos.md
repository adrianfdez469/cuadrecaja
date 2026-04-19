# Movimientos de stock — guía paso a paso

## Antes de empezar

1. Asegúrate de tener **tienda actual** seleccionada (la sucursal donde entra o sale la mercancía).
2. Abre el menú **Movimientos** (dentro de operaciones).

Verás un **listado** con filtros (búsqueda, tipo de movimiento, fechas), **resumen** de totales y botones para **crear**, **actualizar** y, si aplica, **importar** o ver **pendientes de recepción**.

---

## Consultar el historial

1. Usa la **búsqueda** o el botón de filtrar según tu pantalla.
2. Puedes acotar por **tipo** (compra, ajuste, traspaso, consignación, venta en el historial, etc.) y por **fechas**.
3. Navega por páginas con **Anterior / Siguiente** si hay muchos registros.

**Qué debería pasar:** Cada fila refleja un cambio de inventario con fecha y tipo.

---

## Crear un movimiento nuevo (asistente)

1. Pulsa **Crear movimiento** (o “Crear” en móvil).
2. Elige **tipo de movimiento** en la lista. Cada tipo trae texto de ayuda: despliega **“Descripción y ejemplo”** si lo necesitas.
3. Rellena lo que pida el tipo:
   - **Compra:** productos, cantidades, **costos**; en algunos casos puedes indicar **fecha de vencimiento** por producto.
   - **Ajuste entrada / salida:** productos y cantidades; en salidas o entradas de ajuste conviene escribir un **motivo** claro (rotura, inventario físico, etc.).
   - **Envío de mercancía (traspaso salida):** elige la **tienda destino**, luego productos y cantidades que no superen lo que hay.
   - **Consignación entrada / devolución:** elige **proveedor** (debe existir en Configuración → Proveedores; si no, en algunos casos puedes crear uno rápido desde el mismo flujo), luego productos y cantidades.
4. Añade productos con el **selector** (buscar, marcar cantidad).
5. Pulsa **Guardar**.

**Qué debería pasar:** Mensaje de éxito, el cuadro se cierra y el listado se actualiza.

---

## Recibir mercancía enviada desde otra tienda

1. Si hay envíos pendientes, verás un **icono con aviso** (mensaje con número).
2. Ábrelo: verás los productos en camino.
3. Revisa cantidades y **costo** de cada línea.
4. Confirma la recepción o, si algo no coincide, usa **rechazar** y escribe el **motivo**.

**Qué debería pasar:** El stock de tu tienda sube al confirmar; si rechazas, el envío se trata según las reglas del sistema (la otra tienda recupera el saldo).

---

## Importar compras desde Excel (si tienes el botón)

1. Pulsa **Importar Excel** (o “Importar” en móvil).
2. Elige un archivo con la primera fila de títulos: **Categoría, Producto, Costo, Precio, Cantidad** y opcionalmente **Proveedor**.
3. Revisa la vista previa y los errores por fila si los hay.
4. Confirma la importación.

**Qué debería pasar:** Mensaje de importación correcta y productos/movimientos creados según el resultado que muestre la pantalla.

---

## Relación con otras pantallas

- **Proveedores (ficha):** Configuración → Proveedores. Necesarios para consignación y para el Excel con columna Proveedor.
- **Destinos de transferencia:** si tu negocio los usa para organizar envíos, pueden estar en Configuración; la guía de “destinos” está en el bloque de configuración.
- **Ventas:** se registran en el **POS**, no desde este asistente.
