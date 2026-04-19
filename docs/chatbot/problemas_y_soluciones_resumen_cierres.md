# Resumen de cierres — problemas y soluciones

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
