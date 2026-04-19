# Dashboard ejecutivo y Resumen del negocio — problemas y soluciones

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
