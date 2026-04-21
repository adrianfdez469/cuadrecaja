<!-- Consolidado para embeddings. Fuentes: seis archivos `ventas` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Ventas

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

| Requisito | Motivo |
|-----------|--------|
| **Tienda actual** definida | El listado es por sucursal. |
| Al menos un **período de caja** | Sin período, la pantalla ofrece **crear el primero** o queda sin historial útil. |
| **Ventas registradas** (normalmente desde el **POS**) | Si no hubo cobros sincronizados, la lista sale vacía. |
| **Conexión** estable para cargar y borrar | Las acciones hablan con el servidor. |

## Relación con otras áreas

- **POS:** origen habitual de las ventas; offline implica **retraso** hasta sincronizar.
- **Cierre:** al **cerrar** un período, las ventas de ese período suelen quedar **solo lectura** para anulaciones desde esta pantalla.
- **Inventario:** al **eliminar** una venta o una línea, el stock **vuelve** mediante lógica interna (ajustes); no hace falta un movimiento manual del usuario.

## Lo que esta pantalla no sustituye

- No es el **punto de cobro** (eso es el **POS**).
- No muestra por defecto **ganancias o costos** por producto en el detalle (a diferencia de algunos listados del POS con permiso específico).

## Guía paso a paso

*Flujo principal en la aplicación.*

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

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

| Permiso (cómo pedirlo al administrador) | Efecto |
|----------------------------------------|--------|
| **Acceder a ventas** | Ver el menú **Ventas** y el listado del período cargado. |
| **Eliminar ventas** | Poder **borrar una venta completa** en el servidor (con las reglas de período abierto). |

## Permiso compartido con el POS

Para **eliminar venta completa** o **quitar productos de una venta**, el backend también acepta quien tenga **cancelar ventas del POS** (`operaciones.pos-venta.cancelarventa`). Es decir: **“eliminar ventas”** **o** **“cancelar ventas del POS”** — con que exista **uno** de los dos, suele alcanzar para esas acciones.

## Regla extra para quitar una línea (no toda la venta)

Aunque tengas uno de los permisos anteriores, para **borrar un producto suelto** dentro del detalle:

- Tenés que ser el **vendedor de esa venta**, **o**
- Ser **superadministrador**.

Y la venta debe tener **más de un producto** (no se puede vaciar por líneas).

## Superadministrador

Puede actuar sobre ventas de **otros usuarios** en el detalle (líneas), además de las reglas del servidor.

## Resumen para el bot

- “No veo Ventas” → **acceder a ventas**.  
- “No me deja borrar” → **eliminar ventas** o **cancelar ventas del POS** + **período abierto**.  
- “No puedo sacar un producto de la venta de Juan” → solo **dueño de la venta** o **superadmin** (y permiso de eliminar/cancelar).

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Error: los datos de ventas no pudieron ser cargados”

**Qué hacer:** Botón **actualizar**, comprobar **internet** y **tienda** seleccionada.

---

## “La venta no pudo ser eliminada” / “Error al eliminar la venta”

**Causas típicas:** Sin permiso, **período cerrado**, o fallo de servidor.

**Qué hacer:** Si el administrador confirma que el período está abierto y tenés permiso de **eliminar ventas** o **cancelar ventas del POS**, reintentar; si no, pedir ayuda.

---

## “Acceso no autorizado” (al borrar)

**Lectura:** El servidor rechazó la acción por **permisos**.

**Qué hacer:** Pedir **eliminar ventas** o **cancelar ventas del POS** según política del negocio.

---

## “La venta que se trata de elimnar está en un período que ah sido cerrado”

**Nota:** El texto puede venir con errores de tipeo en mensajes técnicos, pero el significado es claro: **período cerrado**.

**Qué hacer:** No se puede anular desde la app de forma normal; **administración** o soporte.

---

## “La venta pertenece a un período cerrado” (al quitar un producto)

**Qué hacer:** Igual que arriba: período cerrado bloquea correcciones.

---

## “Solo puede eliminar productos de sus propias ventas”

**Qué hacer:** Un usuario común solo corrige **sus** ventas; un **superadministrador** puede actuar sobre las de otros si la pantalla se lo permite.

---

## “Producto no encontrado en la venta”

**Qué hacer:** Refrescar la lista; la venta pudo haber cambiado. Si se repite, soporte.

---

## “No se pudo eliminar el producto de la venta”

**Qué hacer:** Revisar permisos, que la venta sea **propia** (si no sos superadmin), que quede **más de un** producto, y que el período esté **abierto**.

---

## “Error al crear el primer período”

**Qué hacer:** Quien tenga permiso de **cierre** debe intentar abrir período desde **Cierre** o repetir desde **Ventas**; si falla, soporte.

---

## Lista vacía con mensaje “No hay ventas registradas en este período”

**Qué es:** No hay ventas en el servidor para ese período y tienda.

**Qué hacer:** Vender desde el **POS** o sincronizar pendientes; confirmar **tienda** correcta.

---

## “No se encontraron ventas” (con búsqueda activa)

**Qué hacer:** Borrar texto del buscador o probar otros términos.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

La pantalla **Ventas** (`/ventas`) muestra el **historial de ventas ya registradas** de la **tienda actual**, tomando como referencia el **período de caja más reciente** que devuelve el sistema (en la práctica suele coincidir con el período abierto; si acaban de cerrar y aún no abrieron otro, podrías ver el último período cerrado hasta que exista uno nuevo).

Las ventas **nuevas** se cargan desde el **POS**; aquí se **consultan**, se **buscan** y, con permisos, se **corrigen o anulan**.

---

## No veo el menú Ventas

**Qué suele pasar:** Falta permiso de **acceder a ventas**.

**Qué hacer:** Pedir al administrador el permiso correspondiente.

---

## “No hay tienda seleccionada”

**Qué hacer:** Elegir la **tienda actual** en la barra. Para crear locales: **Configuración → Locales** (si un botón antiguo dice “tiendas” y no abre, entrá manualmente a **Locales**).

---

## Mensaje de bienvenida: “No se encontraron períodos…”

**Qué es:** Aún no hay ningún **período de caja** en esa tienda.

**Qué hacer:** Pulsar **Crear primer período** (si tenés permiso para gestionar cierres) o pedir a quien administra la caja que abra un período. Sin período no hay base para listar ventas de ese ciclo.

---

## La lista está vacía pero sí vendemos

**Causas frecuentes:**

1. **Otra tienda** seleccionada: el listado es solo de la tienda actual.
2. **Período distinto:** las ventas quedan guardadas en el período en que se hicieron; si el sistema cargó un período sin movimientos, parecerá vacío.
3. **Ventas solo en el dispositivo (POS offline):** hasta que **sincronicen**, no aparecen en este listado del servidor.

**Qué hacer:** Confirmar tienda, ir al **POS** y **sincronizar ventas pendientes**, esperar y **actualizar** (icono de refresco en Ventas).

---

## “Error: los datos de ventas no pudieron ser cargados”

**Qué hacer:** Reintentar con el botón de **actualizar**, comprobar internet y sesión. Si persiste, soporte.

---

## No puedo borrar una venta o me dice que no está autorizado

**Qué suele pasar:** Hace falta permiso de **eliminar ventas** o, en muchos negocios, el mismo permiso que **cancelar ventas del POS** (el sistema acepta cualquiera de los dos para borrar en servidor).

**Otra causa:** La venta pertenece a un **período ya cerrado**; en ese caso el servidor **no permite** eliminarla (inventario y cierre ya quedaron consolidados).

**Qué hacer:** Pedir permisos o hablar con administración si el error habla de **período cerrado**.

---

## No veo cómo quitar una línea de producto de una venta

**Reglas del sistema:**

- Hace falta permiso (**eliminar ventas** o **cancelar ventas del POS**) **y además** la venta debe ser **tuya** (salvo **superadministrador**, que puede actuar sobre ventas de otros).
- No se puede dejar la venta **sin ningún producto**: si solo hay **un** ítem, no aparece la opción de borrar esa línea (en ese caso la corrección suele ser **eliminar la venta entera**, si está permitido).

**Qué hacer:** Abrí el **detalle** de la venta (clic en la fila o en el ícono de ojo) y buscá el ícono de borrar en la línea, si aplica.

---

## Busco por texto y no encuentra la venta

**Qué hace el buscador:** Filtra por fragmentos del **identificador visible**, **fecha**, **hora**, **nombres de productos** y **nombre del vendedor**.

**Qué hacer:** Probar otra palabra (por ejemplo el nombre del vendedor o un producto de la nota).

---

## Coherencia con el POS

| Situación | Dónde resolverla |
|-----------|------------------|
| Cobrar o nueva venta | **POS** |
| Ver ventas ya guardadas en servidor | **Ventas** |
| Venta pendiente de subir | **POS** → sincronizar |

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Dónde veo lo que vendí?”

**Respuesta sugerida:**  
“En **Ventas** ves el historial de la **tienda que tenés seleccionada**, según el **período** que está cargando el sistema. Las ventas nuevas salen del **POS**; si cobraste sin internet, primero sincronizá en el POS y después actualizá **Ventas**.”

**Preguntas de diagnóstico:** “¿Es la misma sucursal?” · “¿Ya se sincronizó el POS?”

---

## “¿Puedo borrar una venta por error?”

**Respuesta sugerida:**  
“Solo si tu usuario tiene permiso de **eliminar ventas** o de **cancelar ventas del POS**, y casi siempre si el **período de caja sigue abierto**. Si el período ya se **cerró**, el sistema no deja borrarla desde ahí: hay que hablar con administración.”

---

## “Quiero sacar un producto de la nota pero no me deja”

**Respuesta sugerida:**  
“Para quitar **una línea** hace falta permiso (**eliminar ventas** o **cancelar ventas del POS**), que la venta sea **tuya** (salvo **superadministrador**) y que queden **al menos dos productos** en la venta. Si solo hay uno, la corrección suele ser **anular la venta entera**, si está permitido.”

---

## “No aparece la venta que acabo de hacer”

**Respuesta sugerida:**  
“Comprobá **tienda actual**, pulsá **actualizar** en Ventas y, si vendiste sin conexión, andá al **POS** y **sincronizá ventas pendientes**.”

---

## “¿Ventas es lo mismo que el POS?”

**Respuesta sugerida:**  
“No: el **POS** es para **cobrar**. **Ventas** es para **revisar** lo ya guardado en el servidor, buscar tickets y, con permiso, **corregir o anular**.”

---

## Frases a evitar

- “Endpoint”, “DELETE”, “Prisma”.
- Afirmar que siempre se puede borrar cualquier venta sin mencionar el **período cerrado**.
