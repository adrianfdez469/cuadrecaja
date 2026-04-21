<!-- Consolidado para embeddings. Fuentes: seis archivos `resumen_cierres` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Resumen de cierres

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

| Requisito | Motivo |
|-----------|--------|
| **Tienda actual** | Todo el informe es por sucursal. |
| **Al menos un cierre de caja completado** | Sin cierres cerrados no hay filas en el histórico. |
| **Permiso de recuperaciones — resumen de cierres** | Sin él no se muestra el menú ni se accede a la ruta protegida. |
| **Permiso de ganancias/costos en cierre** (opcional) | Para ver **gastos** y montos sensibles en columnas y en el **detalle** del panel. |

## Qué datos alimentan la pantalla

- Los **totales guardados** al momento de cada **cierre** (ventas, inversiones, transferencias, consignación, gastos, etc.).
- **Ventas y descuentos** también se usan para recalcular o enriquecer **brutos** y **descuentos** por período en el listado.

## Lo que esta pantalla no hace

- **No cierra** el período ni abre uno nuevo (eso es **Cierre**).
- **No edita** ventas ni stock.

## Guía paso a paso

*Flujo principal en la aplicación.*

## Entrar

1. Elegí la **tienda actual** si trabajás con varias.
2. En el menú, abrí **Resumen Cierres** (suele estar bajo **Recuperaciones**).
3. Esperá el mensaje **“Cargando resumen de cierres…”** hasta ver datos o el aviso de lista vacía.

---

## Filtros por fecha

1. En **Filtros de búsqueda**, tocá **Fecha inicio** y/o **Fecha fin** en el calendario.
2. Al cambiar las fechas, la página **vuelve a pedir** los datos al servidor (no hace falta un botón “Buscar” aparte en la versión actual).
3. **Limpiar:** botón **Limpiar** o el ícono de lista con filtro, para quitar fechas y volver al listado **general** (solo períodos **cerrados**).

---

## Leer los totales de arriba

Según permisos y datos, podés ver tarjetas como:

- **Total ventas**, **ganancia final**, **inversión**, **transferencias** (con opción de **desplegar** el desglose por destino).
- **Ventas propias** vs **consignación**.
- **Ventas en bruto** y **descuentos** del intervalo (si hay números).
- **Total gastos** del intervalo (visible en agregados cuando corresponde).

Los totales superiores **resumen** ventas, ganancias, transferencias y otros valores del **rango de fechas** y la **tienda** (sin fechas, se consideran los cierres **cerrados** disponibles). La **tabla** de abajo muestra **por página** cada período; usá la **paginación** para ver más filas.

---

## Tabla “Historial de cierres”

1. Cada fila o tarjeta (móvil) es un **período cerrado** con fechas de inicio y fin.
2. Revisá columnas de ventas, bruto, descuentos, ganancia final, inversión, transferencias y bloques de consignación según tu pantalla.
3. **Paginación:** abajo podés cambiar de página o cuántas filas por página.

---

## Ver el detalle de un cierre

1. **Clic** en la fila o tarjeta del período (o en el ícono de **acercar** en móvil).
2. Se abre un **panel lateral** con tarjetas de resumen y la **tabla de productos vendidos** (misma familia de componentes que en **Cierre**).
3. Cerrá el panel con la **X** o deslizando según el dispositivo.

---

## Actualizar

- Usá el ícono de **refresco** en la cabecera para volver a cargar sin cambiar filtros.

---

## Coherencia con Cierre

1. Para **generar** una nueva fila en este histórico, completá un cierre en **Cierre de caja** (**Cierre**).
2. Mientras el período siga **abierto**, seguí mirando números en vivo en **Cierre**; aquí verás el corte **después** de cerrarlo.

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

| Permiso (cómo pedirlo al administrador) | Efecto |
|----------------------------------------|--------|
| **Acceder al resumen de cierres** (`recuperaciones.resumencierres.acceder`) | Ver el menú **Resumen Cierres** y la página de histórico. |
| **Ver ganancias y costos en el resumen de cierre de caja** (`operaciones.cierre.gananciascostos`) | Ver **gastos** en filas/tarjetas cuando aplica, y en el **panel lateral** el detalle de productos con **precios/ganancias** (no solo cantidades). |

**Nota:** El permiso de **ganancias/costos** es el **mismo** que usa la pantalla **Cierre**; si ya lo tenés para cierre, también aplica al detalle agregado aquí.

## Superadministrador

Acceso completo a menús y datos según rol.

## Resumen para el bot

- “No tengo Resumen Cierres en el menú” → **recuperaciones — resumen de cierres**.  
- “Entro pero no veo plata de gastos o ganancia por producto” → **ganancias y costos en cierre**.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Cargando resumen de cierres…” (mucho tiempo)

**Qué hacer:** Esperar; si no termina, recargar la página y comprobar red.

---

## “No hay cierres históricos disponibles”

**Lectura:** No hay registros de períodos **cerrados** que coincidan (o nunca cerraste).

**Qué hacer:** Ir a **Cierre** y completar un cierre; o **limpiar filtros** de fechas.

---

## “No hay tienda seleccionada”

**Qué hacer:** Elegir tienda actual; crear locales en **Configuración → Locales** si hace falta.

---

## Error del servidor: “Error al obtener los datos del cierre”

**Qué hacer:** Reintentar con **refresco**; si persiste, soporte (fallo al leer el resumen en servidor).

---

## Fila con “Actual” en la fecha de fin (caso raro en pantalla)

**Contexto:** El listado está pensado para **cierres terminados**; si ves algo inconsistente, **actualizá** datos o revisá en **Cierre** si el período sigue abierto.

---

## Desglose de transferencias: “No hay transferencias registradas en este período”

**Qué es:** No hubo ventas con **transferencia** en el rango que usa ese desglose, o los montos fueron cero.

**Qué hacer:** Normal si solo cobraron en efectivo.

---

## No veo gastos en la fila del resumen

**Qué hacer:** Puede ser permiso de **ganancias y costos en cierre** o que ese período tenga **gastos en cero**.

---

## Limpiar filtros y la página sigue igual

**Qué hacer:** Verificar que se hayan borrado ambas fechas; bajar a la **paginación** por si estabas en una página vacía.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

**Resumen de cierres** (`/resumen_cierre`) está en el menú de **Recuperaciones** y sirve para ver **cortes de caja ya cerrados** (histórico), totales agregados, **filtros por fechas** y el **detalle** de productos de un período. **No** es donde se ejecuta el cierre del día (eso es **Cierre**).

---

## No veo el menú “Resumen Cierres”

**Qué suele pasar:** Falta permiso de **acceder al resumen de cierres** (en recuperaciones).

**Qué hacer:** Pedir al administrador ese permiso; el nombre en el panel puede decir “resumentes” en la descripción interna, pero es el mismo módulo.

---

## “No hay cierres históricos disponibles”

**Qué es:** En esa tienda **aún no se cerró** ningún período de caja, o el filtro de fechas dejó la lista sin resultados.

**Qué hacer:** Si recién empezás, hacé al menos un **Cierre de caja** completo desde **Cierre**. Si usaste filtros, pulsá **Limpiar** (o el ícono de filtro) y revisá de nuevo.

---

## No aparece el día que quiero / “no veo mi período”

**Causas frecuentes:**

1. **Tienda equivocada:** el listado es solo de la **tienda actual**.
2. **Solo períodos cerrados:** por defecto el sistema lista **cierres terminados** (con fecha de fin). El período **abierto** del día se ve en **Cierre**, no aquí como histórico hasta que lo cierres.
3. **Filtro de fechas:** las fechas acotan qué cortes entran en la página; probá **limpiar** y usar **paginación** (más abajo en la tabla) para ver páginas siguientes.

---

## Cambié las fechas y no pasa nada

**Qué hacer:** Al elegir **fecha inicio** o **fecha fin**, la pantalla debería **volver a cargar** sola. Si no, pulsá **actualizar** (icono de refresco arriba). Comprobá que las fechas tengan sentido (rango amplio si no estás seguro).

---

## No veo montos de gastos o detalles de ganancia en la tabla

**Qué suele pasar:** Falta permiso de **ver ganancias y costos en el resumen de cierre de caja** (`operaciones.cierre.gananciascostos`). Ese permiso también controla columnas y tarjetas sensibles en **Resumen de cierres** y el detalle del **panel lateral**.

**Qué hacer:** Pedir permiso al administrador.

---

## El panel lateral no muestra precios / ganancias por producto

**Qué hacer:** Misma regla: permiso **ganancias y costos en cierre**; sin él la tabla de productos puede mostrar solo **cantidades** (`showOnlyCants` en la interfaz).

---

## La lista carga pero queda en blanco o no actualiza

**Qué hacer:** Pulsar **refresco**; revisar **internet** y sesión. El código no siempre muestra un mensaje de error visible si falla la petición (puede quedar el estado anterior).

---

## “Ir a Configuración de Tiendas” no abre

**Qué hacer:** Usar **Configuración → Locales** manualmente (`/configuracion/locales`).

---

## Diferencia con “Cierre” y con “Ventas”

| Pantalla | Para qué sirve |
|----------|----------------|
| **Cierre** | Período **actual**, totales en vivo y **botón cerrar caja**. |
| **Resumen de cierres** | **Histórico** de períodos **ya cerrados**, filtros y detalle. |
| **Ventas** | Listado de **ventas** del período que el sistema tenga cargado (no es el mismo informe agregado de cierre). |

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Dónde veo los cierres viejos?”

**Respuesta sugerida:**  
“En **Resumen de cierres**, dentro del menú de **Recuperaciones**. Ahí aparecen los **períodos ya cerrados** de la **tienda actual**. El **período abierto** del día lo ves en **Cierre** hasta que lo cortes.”

---

## “Hice ventas pero no hay nada en resumen de cierres”

**Respuesta sugerida:**  
“Esa pantalla muestra **cierres terminados**. Si todavía no **cerraste** el período en **Cierre de caja**, el histórico puede estar vacío. También revisá que sea la **misma tienda**.”

---

## “¿Cómo filtro por mes?”

**Respuesta sugerida:**  
“En **Filtros de búsqueda** elegí **fecha inicio** y **fecha fin** del mes; la lista se **recarga sola** al cambiar las fechas. Si te perdés, usá **Limpiar** y volvé a cargar.”

---

## “No veo los gastos de cada cierre”

**Respuesta sugerida:**  
“Los **gastos** en el listado y en el detalle suelen pedir el permiso de **ver ganancias y costos en el resumen de cierre de caja**. Sin ese permiso la pantalla puede ocultar esos montos y mostrar solo **cantidades** en productos.”

---

## “¿Es lo mismo que Dashboard?”

**Respuesta sugerida:**  
“No: **Resumen de cierres** es **histórico de cortes de caja** por período. El **Dashboard** de recuperaciones es otro informe (otro menú y permisos).”

---

## Frases a evitar

- “API summary”, “take/skip”.
- Decir que aquí se **cierra** la caja (el cierre se hace en **Cierre**).
