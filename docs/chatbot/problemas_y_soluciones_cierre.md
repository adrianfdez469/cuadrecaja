# Cierre de caja — problemas y soluciones

**Cierre** (`/cierre`) resume las **ventas del período** de la **tienda actual**, separa lo **propio** de lo de **consignación**, permite revisar **gastos** antes de cortar y, con permiso, **cierra** el período y **abre uno nuevo** automáticamente. No sustituye al **historial de cierres pasados** (eso suele estar en **Resumen de cierres**).

---

## No veo el menú Cierre

**Qué suele pasar:** Falta permiso de **acceder al cierre de caja**.

**Qué hacer:** Pedir al administrador ese permiso.

---

## “No hay tienda seleccionada”

**Qué hacer:** Elegir **tienda actual**. Para crear o editar locales: **Configuración → Locales** (si un botón dice “tiendas” y no abre, usá **Locales** manualmente).

---

## Mensaje de bienvenida: no hay períodos

**Qué es:** Aún no existe ningún **período de caja** en esa tienda.

**Qué hacer:** Pulsar **Crear primer período** (igual que en otras pantallas que dependen del período). Después ya podés usar **POS** y volver a **Cierre** cuando toque cortar.

---

## “Debe sincronizar las ventas en la interfaz del pos de ventas”

**Qué es:** En **este navegador o dispositivo** quedaron ventas del POS **sin marcar como sincronizadas** en la memoria local (aunque en el servidor ya estén).

**Qué hacer:** Ir al **POS**, usar la **sincronización de ventas pendientes** y esperar a que no queden avisos; volver a **Cierre** e intentar **Cerrar caja** de nuevo.

---

## No aparece el botón “Cerrar caja”

**Qué suele pasar:** Falta permiso de **cerrar caja** (crear el corte / cerrar el período).

**Qué hacer:** Pedir permiso; mientras tanto podés **ver** totales y exportar si la pantalla lo permite.

---

## No veo montos de ganancia o columnas de costo en la tabla

**Qué suele pasar:** Falta permiso de **ver ganancias y costos en el resumen de cierre**.

**Qué hacer:** Pedir permiso; sin él la interfaz puede mostrar solo **cantidades** y totales de venta según diseño.

---

## Al cerrar: “No se pudo cargar el resumen de gastos”

**Qué hacer:** Revisar **conexión**, pulsar **Cancelar** y reintentar **Cerrar caja**. Si persiste, soporte (puede ser permiso de **cerrar** en el servidor al generar la vista previa de gastos).

---

## “Error al aplicar los gastos” / no termina el cierre

**Qué hacer:** Reintentar; no cerrar el navegador a medias. Si el período quedó a medias en el servidor, **soporte** o administrador con acceso técnico.

---

## “Ha ocurrido un error al realizar el cierre” / error del servidor al cerrar

**Causas posibles:** Período ya cerrado, desincronización de **ID de período**, fallo de red o datos inconsistentes.

**Qué hacer:** **Actualizar** la página de Cierre; si el mensaje del servidor dice que el **último período ya está cerrado**, puede hacer falta **abrir período** desde quien tenga permisos o revisar en **Resumen de cierres** qué pasó.

---

## No veo la lista de gastos del período

**Qué suele pasar:** Falta permiso de **ver gastos** (`operaciones.gastos.ver`).

**Qué hacer:** Pedir permiso; los gastos igual pueden intervenir en el paso de **revisión previa** si quien cierra tiene permiso de **cerrar** (flujo interno).

---

## No puedo registrar un gasto “puntual” desde el ícono del ticket

**Qué suele pasar:** Falta permiso de **gestionar gastos** (el botón de gasto ad-hoc solo se muestra con ese permiso).

**Qué hacer:** Pedir **gestionar gastos** o que otro usuario cargue el gasto antes del cierre.

---

## Exporté a Excel y falló

**Qué hacer:** Reintentar; comprobar que el navegador permita **descargas**. El mensaje puede ser **“Error al exportar el archivo Excel”**.
