# Inventario — guía paso a paso

## Qué es esta pantalla

- **Título:** Inventario.  
- **Subtítulo (en escritorio):** gestión y control de productos en stock.  
- Muestra **totales** arriba: cantidad de productos, cuántos con stock, sin stock y un **valor total** aproximado (existencia × costo).

**Importante:** aquí se ve el **resultado** del stock; para **sumar o restar** mercancía se usan **Movimientos** y las **ventas en el POS**.

---

## Antes de empezar

1. Elige la **tienda** correcta en la barra (todo lo que ves es de esa sucursal).
2. Abre el menú **Inventario** (suele estar en la sección de resúmenes o recuperaciones).

---

## Buscar y filtrar

1. Escribe en **Buscar producto** para acotar la lista.
2. El **icono de alarma** alterna el modo **“solo próximos a vencer”** (productos con fecha de vencimiento en los próximos 30 días, según la lógica de la pantalla).
3. **Actualizar** (icono circular) recarga la lista desde el servidor.

---

## Leer la tabla o las tarjetas (móvil)

- **Producto:** nombre; si hay proveedor en esa línea, puede mostrarse como “Producto - Proveedor”.
- **Estado:** etiquetas tipo **Sin stock**, **Bajo stock** (poca cantidad) o **En stock**.
- **Existencia:** unidades disponibles.
- **Precio** y **Costo** (en pantallas anchas se ve costo; en estrechas puede ocultarse parte de la información).
- **Valor stock:** existencia multiplicada por costo (orientativo).
- **Vencimiento:** aviso con días o “vencido”; botón o icono de **calendario** para editar.

---

## Ver el historial de un producto

1. Haz **clic en la fila** o en la tarjeta del producto (no en el botón de fecha si quieres abrir el historial).
2. Se abre un cuadro con **movimientos** de ese artículo: fechas, tipos (compra, venta, ajuste, etc.), cantidades con signo + o -.
3. Usa los **filtros** del cuadro (fechas, tipo) y **limpiar filtros** si hace falta.
4. Cierra con la **X**.

---

## Poner o cambiar la fecha de vencimiento

1. Pulsa **Agregar vencimiento** / icono de calendario / “Editar fecha” según tu vista.
2. Elige la fecha en el selector.
3. **Guardar**. Para borrar la fecha, usa **Quitar fecha** si está disponible.

**Requisito:** tu rol debe permitir guardar; si el sistema lo exige, también el permiso de **Conformar precios** (ver problemas frecuentes).

---

## Exportar inventario

1. **Exportar Word** o **Exportar Excel** (en móvil pueden mostrarse abreviados).
2. Solo se incluyen productos con **precio mayor que cero**. Si no hay ninguno, verás un aviso de que no hay nada que exportar.
3. Al terminar bien, aparece un mensaje de éxito con la cantidad de productos exportados.

---

## Coherencia con otras pantallas

| Necesidad | Dónde ir |
|-----------|----------|
| Cambiar cantidades en almacén | **Movimientos** |
| Cambiar precios de venta o masivamente | **Conformar precios** (según permisos) |
| Dar de alta productos nuevos | **Configuración → Productos** |
