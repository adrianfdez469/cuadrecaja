# Punto de venta (POS) — problemas y soluciones

El **POS** es donde se **venden** productos: buscás o escaneás, cargás cantidades, armás el **carrito** (puede haber **varias cuentas** a la vez) y cobrás. Las ventas **bajan el inventario** y, si hay internet, suelen **sincronizarse** al servidor enseguida; si no, quedan **guardadas en el dispositivo** para enviar después.

---

## No veo el menú POS

**Qué suele pasar:** Falta permiso de **acceder al punto de venta**.

**Qué hacer:** Pedir al administrador el permiso de **ventas (POS)**.

---

## “No hay tienda seleccionada”

**Qué hacer:** Elegir la **tienda** arriba. Si no hay tiendas, crearlas en **Configuración → Locales** (si un botón dice “configuración de tiendas” y no abre, usá **Locales** manualmente).

---

## No aparecen productos o faltan muchos

**Causas frecuentes en el sistema:**

1. **Precio en cero:** el POS **no muestra** productos sin precio de venta mayor que cero. Solución: **Conformar precios** o el flujo que use el negocio.
2. **Sin stock y sin “padre” con stock:** si el producto no tiene existencia, no sale; **excepción:** algunos artículos en **porciones** (fracción) pueden mostrarse si el **producto padre** (caja, pack) todavía tiene stock.
3. **Tienda equivocada:** el listado es de la **tienda actual**.
4. **Usuario vinculado a proveedor:** igual que en inventario, la lista puede **reducirse** solo a mercancía de ese proveedor (comportamiento del sistema para ciertos usuarios).

**Qué hacer:** Revisar precio, stock en **Inventario** o **Movimientos**, tienda y usuario; no asumir fallo sin esas comprobaciones.

---

## Pregunta de “período abierto” o no deja vender

**Qué es:** El POS necesita un **período de caja abierto** (ligado al **cierre**). Si no hay, la pantalla pregunta si querés **abrir uno** o te avisa que no podés vender sin período.

**Qué hacer:** Confirmar abrir período si corresponde, o hablar con quien hace los **cierres** si el período anterior quedó mal cerrado.

---

## Escaneo o código no encuentra el producto

**Dos caminos:**

- Si tenés permiso de **asociar código**, puede abrirse un asistente para **enlazar** ese código de barras a un producto ya existente.
- Si no, verás un mensaje tipo **“producto no encontrado para el código escaneado”**: revisá que el código esté cargado en **Configuración → Productos** o que no sea de otro artículo.

---

## “Error al obtener productos” o categorías

**Qué hacer:** Actualizar (botón de refrescar en la barra del POS si existe), comprobar internet y tienda. Si el mensaje tiene errores de tipeo del sistema (“erro”, “le período”), igual significa **fallo al cargar**: reintentar o soporte.

---

## Venta guardada “en el celular” o no sincroniza

**Qué es normal:** Sin conexión, la venta puede **guardarse localmente** y el mensaje indica que se enviará **cuando haya red**. Al volver la conexión, el sistema intenta **sincronizar sola**.

**Qué hacer si no termina de sincronizar:** Usar la opción de **sincronizar ventas pendientes** (icono o menú que muestre tu versión). Si dice **stock insuficiente** o **período anterior**, hace falta **administrador** (puede haber inconsistencia de inventario o de fechas de cierre).

---

## No puedo anular o borrar una venta

**Qué suele pasar:** Falta permiso de **cancelar ventas del POS**.

**Qué hacer:** Pedirlo al administrador.

---

## No veo montos de ganancia o costo en el detalle de ventas

**Qué suele pasar:** Falta permiso de **ver ganancias y costos en el resumen de ventas del POS**.

**Qué hacer:** Pedir permiso; mientras tanto solo verás cantidades según diseño de la pantalla.

---

## Código de descuento no aplica

**Qué hacer:** Revisar que el código exista y esté vigente según las reglas del negocio; el mensaje puede decir que **no se pudo aplicar** el descuento.
