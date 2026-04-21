<!-- Consolidado para embeddings. Fuentes: seis archivos `movimientos` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Movimientos de stock

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

Para que el módulo de movimientos sea útil y sin sorpresas:

| Necesidad | Para qué sirve |
|-----------|----------------|
| **Tiendas (locales) creadas** | Elegir en qué sucursal trabajas y enviar traspasos entre ellas. |
| **Productos dados de alta** | Que aparezcan en el selector al comprar o ajustar. |
| **Proveedores en configuración** | Obligatorio para movimientos de **consignación** (entrada o devolución). |
| **Permisos por tipo** | Quién puede comprar, ajustar, transferir o recibir no es lo mismo; el administrador debe repartirlos según el puesto. |
| **Destinos de transferencia** (si vuestra empresa los usa) | Pueden formar parte del procedimiento de envíos entre tiendas; ver guía de configuración. |

## Si algo está “mal configurado”

- **Sin productos:** no podrás completar compras ni ajustes con sentido.
- **Sin proveedor en consignación:** no podrás registrar entrada o devolución en consignación hasta dar de alta al proveedor.
- **Sin tienda destino en la lista:** no podrás enviar traspasos a un local que no exista o no esté disponible para tu usuario.

## Qué no se “configura” aquí

Los **precios de venta** y la venta en sí se gestionan en **POS** y en **productos**; los movimientos solo reflejan el **stock** y, cuando aplica, **costos** para valoración.

## Guía paso a paso

*Flujo principal en la aplicación.*

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

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

## Ver la pantalla

- Hace falta permiso de **acceder a movimientos de stock**. Sin eso, no verás la opción en el menú de operaciones.

## Crear cada tipo de movimiento

El administrador puede darte solo algunas acciones:

| Lo que hace el usuario | Permiso que lo habilita (nombre interno del producto) |
|------------------------|---------------------------------------------------------|
| Entrar a la pantalla | Acceder a movimientos de stock |
| Registrar **compras** | Crear movimientos de compra |
| **Ajustes** que suman stock | Crear ajustes de inventario (entradas) |
| **Ajustes** que restan stock | Crear ajustes de inventario (salidas) |
| **Enviar** mercancía a otra tienda | Crear transferencias entre tiendas |
| **Recibir** mercancía (recepciones) | Crear recepciones de productos |
| **Consignación** que entra mercancía | Crear entradas de productos en consignación |
| **Consignación** que devuelve mercancía | Crear devoluciones de productos en consignación |

**Liquidar dinero** a proveedores por consignación no es lo mismo que estos movimientos de stock: eso está en la pantalla de **proveedores / liquidaciones** (otro bloque de guía).

## Cómo detectar un problema de permisos

- Ves la lista de movimientos pero **no** el botón Crear, o Crear abre pero **solo ves un tipo** de movimiento en la lista.
- Te deja armar todo pero al guardar sale **no autorizado** (mensaje genérico o de acceso).

**Solución:** Pedir al administrador el permiso concreto de la tabla y **cerrar sesión y volver a entrar**.

## Superadministrador

Tiene acceso completo a todas las funciones del sistema.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## Pantalla: “No hay tienda seleccionada”

**Qué significa:** No hay sucursal actual elegida, así que no se puede cargar el inventario de movimientos.

**Qué hacer:** Seleccionar tienda arriba o crear una en Configuración → Locales.

---

## “Cargando movimientos…” que no termina o lista vacía sin aviso

**Qué hacer:** Comprobar internet; actualizar. Si hay filtros activos, limpiarlos con la opción de **limpiar filtros** (icono de “limpiar” si aparece).

---

## “No se pudo guardar el movimiento”

**Causas típicas:** Datos incompletos, cantidades o costos inválidos, o fallo de conexión/servidor.

**Qué hacer:** Revisar productos, costos obligatorios y límites de stock; repetir. Si sigue igual, soporte.

---

## “No se pudo cargar los productos”

**Qué hacer:** Cerrar el cuadro y abrirlo de nuevo; cambiar tipo de movimiento y volver; si persiste, soporte.

---

## “El costo de un producto no puede ser 0”

**Cuándo:** Al confirmar la selección de productos en operaciones donde el costo es obligatorio (por ejemplo recepción de traspaso).

**Qué hacer:** Corregir el costo de la línea antes de confirmar.

---

## “Entrada rechazada correctamente” / “Error al rechazar el producto”

**Contexto:** Al rechazar una recepción pendiente con motivo.

**Qué hacer:** Si es error, repetir o revisar que el motivo esté escrito si la pantalla lo exige.

---

## “No se pudo crear los movimientos de entrada”

**Contexto:** Al confirmar una recepción masiva de traspaso.

**Qué hacer:** Misma línea que guardar movimiento: revisar datos y permisos de **recepción**.

---

## Errores al importar Excel

- **Encabezados incorrectos:** la primera fila debe coincidir con: Categoría, Producto, Costo, Precio, Cantidad (y Proveedor si la usáis).
- **“Fila X: …”** con texto de producto vacío, categoría vacía, costo/precio/cantidad inválidos o duplicado producto+proveedor en el archivo.
- **“No se pudo leer el archivo”:** archivo dañado o no es Excel.
- **“Error de red o inesperado”:** conexión o servidor.

---

## El botón Guardar está apagado

**Causas:** Formulario incompleto (sin productos, sin proveedor en consignación, sin destino en envío, cantidades en cero, costo faltante donde aplica).

**Qué hacer:** Completar según la guía paso a paso.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

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

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Para qué sirve Movimientos?”

**Respuesta sugerida:**  
“Es la pantalla donde ves el **historial de entradas y salidas** de mercancía de tu tienda, y donde puedes **registrar** cosas como compras, ajustes por roturas o inventario, envíos a otra sucursal y movimientos de consignación. Las **ventas del día** bajan el inventario cuando cobras en el **punto de venta**; aquí solo las ves en el historial, no las cargas como si fueran una compra.”

**Pregunta de diagnóstico:** “¿Querés **ver** qué pasó con el stock o **registrar** una compra o traspaso?”

---

## “No me deja crear el movimiento”

**Respuesta sugerida:**  
“Revisemos cuatro cosas rápidas: ¿tenés **tienda** elegida arriba? ¿Agregaste **productos** con cantidad mayor a cero? Si es **compra, recepción o consignación entrada**, ¿pusiste **costo** en cada línea? Si es **consignación**, ¿elegiste **proveedor**? Si es **envío a otra tienda**, ¿elegiste **destino**? Si todo eso está y sigue fallando, decime qué **tipo** de movimiento elegiste y si sale algún mensaje en rojo.”

---

## “Me llegó mercancía de otra tienda y no sé qué hacer”

**Respuesta sugerida:**  
“Entrá a **Movimientos** y mirá si aparece un **icono con aviso** (como un mensaje con número). Ahí están los productos **pendientes de recepcionar**. Abrí la lista, revisá cantidades y **costo** (no puede ir en cero), y confirmá. Si el envío está mal, podés **rechazar** la línea y escribir el motivo.”

---

## “No veo el tipo traspaso / consignación / ajuste”

**Respuesta sugerida:**  
“Cada tipo de movimiento tiene su **permiso**. Tu administrador puede haberte dejado solo compras, por ejemplo. Decile qué operación necesitás y que revise tu **rol** en movimientos.”

---

## “¿Cómo importo desde Excel?”

**Respuesta sugerida:**  
“Si ves el botón **Importar Excel**, el archivo tiene que traer en la primera fila exactamente estas columnas: **Categoría, Producto, Costo, Precio, Cantidad** y si querés, **Proveedor**. Los números tienen que estar bien en costo, precio y cantidad. Si no te aparece el botón, puede ser porque ya hay movimientos listados o tu tipo de usuario no lo usa; en ese caso cargá la compra con **Crear movimiento**.”

---

## Enlace “Ir a configuración de tiendas” que no abre

**Respuesta sugerida:**  
“En algunas pantallas el botón puede mandar a una dirección antigua. Andá manualmente a **Configuración → Locales** para crear o revisar sucursales.”

*(Interpretación documentada en otros temas de configuración; si el producto corrige el enlace, esta respuesta se puede acortar.)*

---

## Frases a evitar

- “MovimientoStock”, “API”, “batch”, “enum”.
- Decir “error de validación” sin decir **qué campo** revisar.
