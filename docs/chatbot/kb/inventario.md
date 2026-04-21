<!-- Consolidado para embeddings. Fuentes: seis archivos `inventario` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Inventario

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

Para que la pantalla sea útil:

| Requisito | Motivo |
|-----------|--------|
| **Tienda actual** definida | El inventario es **por sucursal**; cambiar de tienda cambia la lista. |
| **Productos creados** y asignados a la tienda | Si no existen filas de producto-tienda, la lista sale vacía. |
| **Precios mayores que cero** (si queréis exportar) | Word/Excel solo exportan artículos con precio > 0. |
| **Movimientos y ventas** bien registrados | La **existencia** refleja compras, ajustes, traspasos y ventas; no se “inventa” sola. |
| **Proveedores** (si usáis consignación por proveedor) | Puede influir en cómo se muestra el nombre y, en usuarios vinculados a proveedor, en **qué líneas** ven. |

## Si “lo tenemos todo” y los números no cuadran

1. Confirmar **tienda** y **fecha** de los movimientos en el historial del producto (clic en la fila).
2. Revisar **ventas** del POS del mismo periodo.
3. Escalar a administración si hay sospecha de movimientos duplicados o errores de carga (soporte humano).

## Lo que esta pantalla no sustituye

- **No** es el lugar habitual para registrar compras (usar **Movimientos**).
- **No** es el listado maestro de catálogo global (eso es **Configuración → Productos**).

## Guía paso a paso

*Flujo principal en la aplicación.*

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

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

## Entrar a la pantalla

- Menú **Inventario** visible → permiso de **recuperaciones del inventario** (“acceder a la interfaz de recuperaciones del inventario actual de los productos” en la descripción interna).

Sin ese permiso, no verás la opción en el menú de resúmenes.

---

## Ver lista y exportar

- Con solo el permiso de inventario sueles poder **ver**, **buscar**, **filtrar vencimientos**, **abrir historial** y **exportar** (si hay precios válidos).

---

## Editar fecha de vencimiento desde Inventario

- El guardado pasa por una regla del sistema que exige permiso de **Conformar precios** (menú de operaciones con ese nombre), **aunque solo cambies la fecha**.

Si puedes ver inventario pero **no** guardar fechas, pide ese permiso adicional o que alguien con ambos permisos haga el cambio.

---

## Usuario “ligado” a un proveedor

- Si en la ficha del proveedor (Configuración → Proveedores) pusieron tu usuario como **contacto asociado**, tu lista de inventario puede mostrar **solo** productos de ese proveedor y con reglas distintas de visualización respecto a otros empleados.

No es un fallo de permiso de inventario en sí; es **filtro por rol comercial** del negocio.

---

## Superadministrador

Acceso completo sin restricciones habituales.

---

## Resumen para el bot

- “No veo Inventario” → permiso **recuperaciones inventario**.  
- “Veo todo pero no guarda la fecha” → permiso **Conformar precios**.  
- “Veo pocos productos” → revisar **filtro de vencimiento**, **tienda** y **vinculación a proveedor**.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Error al cargar el inventario”

**Qué hacer:** Conexión o sesión; actualizar y reintentar. Si sigue, soporte.

---

## “Cargando inventario…” prolongado

**Qué hacer:** Esperar un poco; si no avanza, actualizar la página o cambiar de tienda y volver.

---

## “No se encontraron productos” (con búsqueda)

**Qué hacer:** Borrar texto del buscador o probar otra palabra.

---

## “No hay productos en el inventario” (sin búsqueda)

**Qué hacer:** Dar de alta productos para la tienda o revisar que estés en la sucursal correcta.

---

## “No hay productos con precio para exportar”

**Qué hacer:** Asignar **precio** mayor que cero a los artículos (vía **Conformar precios** o el flujo que use el negocio) y exportar de nuevo.

---

## “Error al exportar el inventario” / “…a Excel”

**Qué hacer:** Cerrar otros programas que tengan el archivo abierto, repetir. Si persiste, soporte.

---

## “Fecha de vencimiento actualizada”

**Qué esperar:** El listado refleja el nuevo aviso de vencimiento al recargar o al cerrar el popover.

---

## “Error al actualizar la fecha de vencimiento” / acceso no autorizado

**Qué hacer:** Pedir permiso de **Conformar precios** o que otro usuario autorizado haga el cambio.

---

## “Error al cargar los movimientos del producto”

**Contexto:** Dentro del cuadro de historial al abrir un producto.

**Qué hacer:** Cerrar y abrir de nuevo; comprobar conexión.

---

## Chips de vencimiento: “Vence en Xd”, “Vencido”

**Lectura:** Son avisos orientativos según la fecha guardada; los umbrales de color (por ejemplo 7 o 15 días) ayudan a priorizar.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

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

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Qué es la pantalla de Inventario?”

**Respuesta sugerida:**  
“Es donde ves **qué hay en la tienda**: cantidades, precio, costo, valor aproximado del stock y avisos de **caducidad**. Si hacés clic en un producto, ves el **historial de movimientos** de ese artículo. Para **entrar mercancía** o corregir cantidades se usa **Movimientos**; para **vender**, el **POS** baja el stock solo.”

**Pregunta de diagnóstico:** “¿Querés **consultar** cantidades o **cambiar** cuánto hay?”

---

## “No me deja poner la fecha de vencimiento”

**Respuesta sugerida:**  
“Guardar la fecha desde Inventario en muchos casos requiere también el permiso de **Conformar precios**, aunque solo toques la fecha. Pedile a tu administrador que te habilite esa opción o que actualice las fechas alguien que ya la tenga.”

**Pregunta de diagnóstico:** “¿Te sale algún mensaje de **no autorizado** o solo no hace nada?”

---

## “Exporto y dice que no hay productos con precio”

**Respuesta sugerida:**  
“La exportación solo lleva productos con **precio mayor a cero**. Revisá precios en **Conformar precios** o como lo haga tu negocio, y volvé a exportar.”

---

## “Veo menos productos que mi compañero”

**Respuesta sugerida:**  
“Compará si están en la **misma tienda** y sin el filtro de **alarma** (próximos a vencer). Si tu usuario está **asociado a un proveedor** en configuración, el sistema puede mostrarte solo la mercancía de ese proveedor. Si no es tu caso, pasame si usás filtro o no.”

---

## “Dice sin stock pero acabamos de comprar”

**Respuesta sugerida:**  
“Revisá que estés en la **misma sucursal** donde se registró la compra y mirá en **Movimientos** si la compra quedó cargada. Si no hay movimiento, el inventario no sube.”

---

## Frases a evitar

- “ProductoTienda”, “GET”, “omit precio”.
- Decir “bug” sin descartar **filtro**, **tienda** o **usuario proveedor**.
