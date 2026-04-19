# Movimientos de stock — problemas y soluciones

La pantalla **Movimientos** (a veces titulada “Movimientos de stock”) es el **historial de entradas y salidas** de mercancía de la tienda en la que estás trabajando. Desde ahí también puedes **registrar** compras, ajustes, traspasos y consignación, y atender **mercancía enviada desde otra tienda**.

---

## “No hay tienda seleccionada” o no carga nada

**Cómo identificarlo:** Aparece un aviso de que hace falta una tienda actual o no ves movimientos.

**Qué hacer:**

1. Arriba en la barra (o menú de usuario), elige la **tienda** en la que estás operando.
2. Si no tienes tiendas, un administrador debe crearlas en **Configuración → Locales** (en algunos enlaces internos puede decir “tiendas”, pero es lo mismo).
3. Vuelve a abrir **Movimientos**.

---

## No veo el menú Movimientos

**Qué suele pasar:** Tu rol no incluye “operaciones de movimientos”.

**Qué hacer:** Pedir al administrador el permiso para **acceder a movimientos de stock**. Sin eso no aparece la opción en el menú principal de operaciones.

---

## “Crear movimiento” no me deja guardar o el botón no reacciona

**Causas habituales:**

1. **No añadiste productos** o las cantidades son cero o negativas.
2. **Falta el costo** en tipos donde el sistema lo exige para calcular el inventario valorado (compras, recepciones de traspaso, consignación entrada, envíos de traspaso según lo que estés haciendo).
3. **Consignación:** falta elegir **proveedor** en la lista.
4. **Envío a otra tienda:** falta elegir **tienda destino**.
5. **Cantidad mayor que lo que hay en tienda** en salidas o traspasos: el sistema no deja confirmar si pides más de lo disponible.

**Qué hacer:** Revisa cada campo del asistente; abre el acordeón de “Descripción y ejemplo” del tipo de movimiento si no estás seguro de qué pide.

---

## No aparece el tipo de movimiento que necesito (solo veo algunos)

**Qué suele pasar:** Cada tipo (compra, ajuste, traspaso, consignación…) tiene su **permiso aparte**. Tu usuario solo ve los que le autorizaron.

**Qué hacer:** Di al administrador qué operación necesitas (por ejemplo “solo puedo comprar pero no hacer traspasos”) para que ajusten el rol.

---

## Hay un icono con mensajes / número y no sé qué es

**Qué es:** Suele indicar **productos pendientes de recepcionar**: otra tienda te envió mercancía y falta que la confirmes en tu tienda.

**Qué hacer:**

1. Pulsa el icono y revisa la lista.
2. Confirma cantidades y **costos** (no pueden ir en cero al confirmar la recepción).
3. Si algo llegó mal, puedes usar la opción de **rechazar** una línea e indicar el **motivo** por escrito.

---

## Las ventas no las registro aquí

**Aclaración:** Las **ventas** bajan el inventario cuando cobras en el **punto de venta**. En el historial de movimientos puede aparecer el tipo “venta”, pero **no** suele ser un tipo que elijas en “Crear movimiento” manualmente.

---

## Importar Excel no aparece o falla

**Cuándo puede verse el botón:** En situaciones de lista vacía (sin búsqueda activa) o en cuentas de administración global; si no lo ves, puede ser normal según tu usuario.

**Si falla la importación:** El archivo debe ser una hoja con columnas exactas: **Categoría, Producto, Costo, Precio, Cantidad** y opcionalmente **Proveedor**, con números válidos en costo, precio y cantidad. Los mensajes de error suelen indicar la **fila** con problema.

---

## “No se pudo guardar el movimiento” sin más detalle

**Qué hacer:** Revisa conexión, cierra sesión y entra de nuevo. Si persiste, anota hora, tienda y tipo de movimiento y contacta a soporte.
