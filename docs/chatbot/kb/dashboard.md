<!-- Consolidado para embeddings. Fuentes: seis archivos `dashboard` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Dashboard

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

## Resumen del negocio (recuperaciones → Dashboard)

| Requisito | Motivo |
|-----------|--------|
| **Tienda actual** (o acceso a la tienda consultada) | Las métricas son por sucursal. |
| **Permiso `recuperaciones.dashboard.acceder`** | Sin él el servidor rechaza la consulta. |
| **Ventas en el rango elegido** | Si no hubo movimiento, los gráficos y tablas salen vacíos. |

## Dashboard ejecutivo (`/dashboard`)

| Requisito | Motivo |
|-----------|--------|
| **Usuario con al menos un local** y tienda seleccionada | Igual que arriba. |
| **Período de caja abierto** en la tienda consultada | El backend devuelve error si no existe período activo para armar “período actual”. |
| **Datos de ventas e inventario** | Sin actividad, algunas tarjetas pueden mostrar ceros. |

**Nota de producto:** el **Dashboard ejecutivo** no exige el mismo permiso de “recuperaciones” en la API de métricas que **Resumen del negocio**; igual conviene que solo lo usen perfiles autorizados por el negocio (acceso por URL).

## Diferencia útil para capacitación

- **Ejecutivo:** “¿Cómo va **hoy** y el **período de caja** con el **stock**?”
- **Resumen del negocio:** “¿Qué se vendió **este mes / esta semana** y qué productos **más o menos** convienen?”

## Guía paso a paso

*Flujo principal en la aplicación.*

## A) Resumen del negocio (menú Recuperaciones → “Dashboard”)

1. Elegí **tienda actual**.
2. Abrí **Recuperaciones** y tocá **Dashboard** (en la app esto abre la pantalla titulada **“Resumen del Negocio”**).
3. Arriba elegí el **intervalo**: **Día**, **Semana**, **Mes**, **Año** o **Personalizado** (con fechas **Desde** / **Hasta**).
4. Pulsá **Aplicar** para que se carguen las métricas (sin este paso, al cambiar solo el botón, puede seguir viéndose lo anterior).
5. Revisá las **tarjetas**: ventas del período, unidades, **ganancia estimada**, productos con stock.
6. Bajá a los **gráficos**: top más vendidos, top por ganancia, tablas de menos vendidos y menos rentables.
7. **Refresco:** el mismo botón **Aplicar** vuelve a pedir datos con los filtros actuales.

---

## B) Dashboard ejecutivo (acceso directo)

1. **Tienda actual** (o elegí otra en el filtro **Tienda** cuando abras filtros).
2. Entrá a la pantalla **Dashboard Ejecutivo** (en muchos despliegues será por **favorito** o enlace; no es el mismo ítem que “Dashboard” de recuperaciones).
3. Pulsá el **icono de filtro** para desplegar **Filtros de Dashboard** si hace falta.
4. Ajustá **Período** (Hoy, Esta semana, Este mes, **Período actual** del cierre de caja, o **Personalizado** con fechas).
5. Opcional: cambiá **Tienda** a otra sucursal tuya (lista de locales del usuario).
6. Los datos se **actualizan al cambiar** esos filtros (no hace falta un botón “Aplicar” aparte).
7. Revisá bloques de **ventas** (período, hoy, promedio, crecimiento), **inventario** (totales, stock, valor), barras de **cobertura** y pie de **última actualización**.
8. **Refresco manual:** icono de **actualizar** en la cabecera.

---

## Qué usa cada uno como referencia de tiempo

- **Ejecutivo:** mezcla filtros de calendario con el concepto de **período de caja actual** cuando elegís “Período actual” (depende del cierre abierto en esa tienda).
- **Resumen del negocio:** calendario **natural** (día = hoy, mes = mes calendario, etc.) salvo **Personalizado**.

---

## Coherencia rápida

- **Cierre / Resumen de cierres:** cortes de caja por **período cerrado**.
- **Resumen del negocio:** análisis por **días/semana/mes** calendario.
- **Dashboard ejecutivo:** vista **gerencial** ligada al **período de caja** y a inventario en la tienda filtrada.

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

## Resumen del negocio (menú “Dashboard” en Recuperaciones)

| Permiso | Efecto |
|---------|--------|
| **`recuperaciones.dashboard.acceder`** | Ver el ítem **Dashboard** en **Recuperaciones** y que la página **Resumen del Negocio** cargue datos desde el servidor. |

Sin este permiso: el menú no aparece (según configuración del rol) o la API responde **no autorizado**.

## Dashboard ejecutivo (`/dashboard`)

- En el código actual de la API de métricas **no** se comprueba explícitamente `recuperaciones.dashboard.acceder`; basta con estar **logueado** y tener **acceso a la tienda** pedida.
- **Recomendación para el administrador:** dar el ejecutivo solo a quienes deban ver **métricas agregadas** de varias sucursales o del período (encargados, dueños), aunque técnicamente la ruta pueda ser más permisiva.

## Superadministrador

Puede consultar cualquier tienda del negocio donde aplique la lógica del servidor.

## Resumen para el bot

- “No tengo el Dashboard de recuperaciones” → **`recuperaciones.dashboard.acceder`**.  
- “Tengo el menú pero no carga” → tienda, **Aplicar** en filtros, red, sesión.  
- “Quiero el otro dashboard” → aclarar si es **ejecutivo** (período + inventario) o **resumen del negocio** (rankings por tiempo).

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Cargando dashboard…” / “Cargando métricas…”

**Qué hacer:** Esperar; si tarda demasiado, recargar la página.

---

## “Selecciona una tienda para ver las métricas del dashboard”

**Qué hacer:** Elegir **local** en el selector de usuario.

---

## “Error al cargar las métricas” / “Error al cargar las métricas del dashboard”

**Qué hacer:** Comprobar conexión, sesión y **Aplicar** (en Resumen del negocio) o **refresco** (en ejecutivo).

---

## “No hay datos disponibles para mostrar” (Resumen del negocio)

**Qué hacer:** Cambiar rango (p. ej. **Mes**) y pulsar **Aplicar**; verificar que haya ventas en ese intervalo.

---

## “No hay datos disponibles” dentro de un gráfico (Top 10, etc.)

**Qué hacer:** Normal si no hay ventas en el rango; ampliar fechas o período.

---

## “No autorizado” al usar Resumen del negocio

**Qué hacer:** Falta permiso **`recuperaciones.dashboard.acceder`**; pedirlo.

---

## “Tienda no encontrada o sin acceso” (servidor)

**Qué hacer:** No podés ver esa sucursal; elegí una tienda donde tengas permiso o pedí acceso.

---

## “Fecha de inicio requerida para período personalizado” (servidor)

**Qué hacer:** En **Personalizado**, completá **Desde** (y **Hasta** si aplica) y **Aplicar**.

---

## “No hay período activo” (al cargar Dashboard ejecutivo)

**Qué hacer:** Crear o abrir **período de caja** en **Cierre** para esa tienda.

---

## Botón “Aplicar” gris (Resumen del negocio)

**Causa habitual:** Modo **Personalizado** sin fecha **Desde**.

**Qué hacer:** Elegir fechas o volver a **Mes** / **Día** y **Aplicar**.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

En la aplicación hay **dos** pantallas distintas de métricas; conviene no mezclarlas:

| Pantalla | Ruta aproximada | En el menú lateral |
|----------|-----------------|---------------------|
| **Dashboard ejecutivo** | Acceso directo por enlace (ruta interna `/dashboard`) | **No** figura en el menú de recuperaciones del `Layout` actual; puede abrirse si conocés la dirección o un favorito. |
| **Resumen del negocio** (menú “Dashboard”) | Misma sección que el ítem **Dashboard** bajo **Recuperaciones** | Sí: **Recuperaciones → Dashboard** |

---

## No veo “Dashboard” en Recuperaciones

**Qué suele pasar:** Falta permiso **`recuperaciones.dashboard.acceder`** (descripción interna: “dashboard de recuperaciones”).

**Qué hacer:** Pedir al administrador acceso a **recuperaciones — dashboard**.

---

## “Selecciona una tienda…” / “No hay tienda seleccionada”

**Qué hacer:** Elegir **local/tienda actual** en la barra superior antes de cargar métricas.

---

## En Resumen del negocio cambié el período y los números no cambian

**Qué es:** En esa pantalla los filtros **no recargan solos** al tocar Día / Semana / Mes: hace falta pulsar **Aplicar** (botón con icono de refresco).

**Qué hacer:** Elegí período o fechas en **Personalizado** y pulsá **Aplicar**. En modo personalizado, sin **fecha desde**, el botón **Aplicar** puede quedar deshabilitado.

---

## En Dashboard ejecutivo sí cambian los datos al cambiar filtros

**Qué es:** Ahí las métricas se vuelven a pedir al servidor cuando cambiás **Período** o **Tienda** en el panel de filtros (primero abrí filtros con el **icono de lista** si está colapsado).

---

## “Error al cargar las métricas” / “Error al cargar las métricas del dashboard”

**Qué hacer:** Revisar **internet** y **sesión**, pulsá **refresco** en la cabecera. Si persiste, probá otra **tienda** en el ejecutivo (si tenés varias).

---

## Dashboard ejecutivo: “no hay período activo” (fallo al cargar)

**Qué es:** El servidor necesita un **período de caja abierto** en esa tienda para armar parte de las métricas del período actual.

**Qué hacer:** Abrir período desde **Cierre** o **Ventas** (flujo de “primer período”) según corresponda.

---

## Resumen del negocio: gráficos vacíos (“No hay datos disponibles”)

**Qué es:** En el rango elegido no hubo ventas suficientes para armar rankings o el filtro es muy angosto.

**Qué hacer:** Ampliar a **mes** o **año**, o revisar fechas en **Personalizado**, y **Aplicar**.

---

## Confundo Resumen del negocio con Resumen de cierres

| Pregunta | Pantalla |
|----------|----------|
| “¿Cuánto vendí por día / top productos / ganancia en un rango?” | **Resumen del negocio** (`dashboard-resumen`) |
| “¿Cuánto dio cada **corte de caja** cerrado?” | **Resumen de cierres** |

---

## Confundo con Inventario (recuperaciones)

**Inventario** en recuperaciones es **existencias actuales**; **Resumen del negocio** es **ventas y rentabilidad** en un intervalo de tiempo.

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Dónde veo el dashboard?”

**Respuesta sugerida:**  
“Hay **dos** cosas distintas: en **Recuperaciones** el menú **Dashboard** abre el **Resumen del Negocio** (ventas por día/semana/mes, tops y tablas). Aparte existe el **Dashboard ejecutivo**, que en muchos equipos se abre solo por **enlace favorito** y muestra ventas del **período de caja** más inventario. ¿Cuál buscás?”

---

## “Cambié a ‘mes’ y sigue igual”

**Respuesta sugerida:**  
“Si estás en **Resumen del Negocio**, después de elegir Día, Semana o Mes tenés que pulsar **Aplicar** para que traiga los datos. En el **Dashboard ejecutivo** no hace falta ese paso: al cambiar el filtro debería actualizar solo.”

---

## “¿Es lo mismo que Resumen de cierres?”

**Respuesta sugerida:**  
“No: **Resumen de cierres** son los **cortes de caja** cerrados, uno por fila. **Resumen del Negocio** son **estadísticas por calendario** (top productos, ganancia estimada en un rango, etc.).”

---

## “No me deja entrar al dashboard de recuperaciones”

**Respuesta sugerida:**  
“Hace falta el permiso de **acceder al dashboard de recuperaciones** en tu perfil. Pedilo al administrador (en la ficha técnica del sistema suele llamarse recuperaciones.dashboard.acceder).”

---

## “¿Qué es ganancia estimada?”

**Respuesta sugerida:**  
“Es un **indicador del sistema** calculado con las ventas del rango que elegiste; sirve para comparar períodos y ver tendencias. Para el detalle contable exacto del negocio, el dueño suele cruzar con **cierres** y su contador.”

---

## Frases a evitar

- Afirmar que ambas pantallas son **la misma** o que usan **idéntica** lógica de fechas.
- “Endpoint”, “axios”, “JWT”.
