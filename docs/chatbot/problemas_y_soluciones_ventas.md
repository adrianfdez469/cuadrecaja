# Ventas (listado) — problemas y soluciones

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
