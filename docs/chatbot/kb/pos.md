<!-- Consolidado para embeddings. Fuentes: seis archivos `pos` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# POS

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

| Requisito | Motivo |
|-----------|--------|
| **Tienda y usuario** válidos | Todo el flujo es por sucursal y por vendedor. |
| **Período de caja abierto** | Sin período no se inicia la venta en condiciones normales. |
| **Productos con precio de venta mayor que cero** en esa tienda | El POS **oculta** lo que no tiene precio de venta. |
| **Stock disponible** (o reglas de fracción/padre) | No deja vender más de lo permitido al sincronizar. |
| **Destinos de transferencia** (si cobrás con transferencia) | Puede pedirse elegir a dónde va el dinero según configuración del negocio. |
| **Códigos de barra** en productos | Para escaneo rápido sin asociar cada vez. |
| **Red estable** (deseable) | Reduce ventas “solo locales” y errores de sincronización. |

## Productos en porciones o “hijos” de un pack

- Algunos artículos se venden **sueltos** pero el stock viene de un **producto padre** (caja, pack). El POS usa reglas internas para permitir la venta mientras el padre tenga saldo.

## Lo que el cajero no “configura” desde el POS

- Altas masivas de productos, precios globales o políticas de descuento: eso es **Configuración** / **Conformar precios** / roles.

## Guía paso a paso

*Flujo principal en la aplicación.*

## Antes de vender

1. **Tienda actual** correcta (barra superior).
2. **Período de caja abierto:** si el sistema pregunta, confirmá abrir uno nuevo o pedí ayuda si no debías tocar eso.
3. Mirá el indicador de **conexión** (en línea / sin conexión): sin internet igual podés vender en muchos casos, pero la venta puede quedar **pendiente de envío**.

---

## Encontrar productos

- **Categorías:** tocá una categoría para ver los productos dentro.
- **Buscador:** escribí parte del nombre; elegí de la lista corta que aparece.
- **Cámara o lector:** escaneá el código; si lo reconoce, se abre el selector de **cantidad** (o se agrega según configuración de pistola).
- **Nombre con proveedor:** a veces verás “Producto - Proveedor” para distinguir la misma referencia en consignación.

---

## Agregar al carrito y cobrar

1. Elegí el producto y la **cantidad** (respetando máximos de stock; en **porciones** el sistema calcula distinto que en unidades sueltas).
2. Abrí el **carrito** (icono de carrito).
3. Revisá líneas y total.
4. **Cobrar:** elegí forma de pago (efectivo, transferencia o combinación según pantalla). Si hay **transferencia**, puede pedirte **destino** de transferencia si el negocio lo usa.
5. **Códigos de descuento:** si hay campo o paso para cupón, ingresalo antes de confirmar.
6. Confirmá el pago.

**Qué debería pasar:** Mensaje de venta **procesada** o **guardada para sincronizar**; el carrito se vacía en el flujo normal.

---

## Varias cuentas (varios carritos)

- El POS puede tener **más de un carrito** con nombre (cuentas separadas). Cambiá de carrito según el botón o píldoras que muestre tu pantalla.

---

## Sincronizar ventas pendientes

- Si quedaron ventas **sin enviar**, usá el botón o área de **sincronización** que indique ventas pendientes.
- Esperá al mensaje de **completado** o leé si hubo **avisos** por fallos parciales.

---

## Refrescar catálogo

- El botón de **actualizar / refrescar** vuelve a bajar productos y categorías del servidor (útil tras un cambio de precio o stock en otra pantalla).

---

## Ventas del día o listados

- Según tu versión, puede haber accesos a **ventas del usuario**, **ventas generales** o **resumen del día** desde iconos o menú flotante.

---

## Asociar código de barras nuevo

- Si escaneás un código desconocido y tenés permiso, seguí el asistente para **unirlo** a un producto existente. Al terminar, el sistema confirma y podés seguir vendiendo.

---

## Coherencia con otras pantallas

| Objetivo | Dónde |
|----------|--------|
| Cambiar precio | **Conformar precios** |
| Entrar mercadería | **Movimientos** |
| Ver existencias | **Inventario** |
| Cerrar período | **Cierre** |

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

| Permiso (cómo pedirlo al administrador) | Efecto |
|----------------------------------------|--------|
| **Acceder al POS** | Ver el menú **POS** y usar la pantalla de venta. |
| **Cancelar ventas del POS** | Poder **anular o borrar** ventas desde los listados que lo permitan. |
| **Ver ganancias y costos en resumen de ventas del POS** | Ver **importes sensibles** (margen, costo) en ciertos detalles de ventas; sin esto, a veces solo **cantidades**. |
| **Asociar código de barras desde el POS** | Cuando un código es **desconocido**, abrir el asistente para **vincularlo** a un producto existente. |

**Nota:** “Conformar precios” e “Inventario” son **otros** permisos; el vendedor puede vender sin ellos si ya hay precios y stock cargados.

## Superadministrador

Acceso completo.

## Resumen para el bot

- “No veo POS” → **acceder al POS**.  
- “No puedo borrar una venta” → **cancelar ventas**.  
- “No veo costos en el detalle” → **ganancias/costos en POS**.  
- “No me deja enlazar un código nuevo” → **asociar código**.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “No puede comenzar a vender si no tiene un período abierto”

**Contexto:** Rechazaste abrir período o no se pudo abrir.

**Qué hacer:** Coordinar con quien administra **cierres** para dejar un período abierto.

---

## “No existe un período abierto. ¿Desea abrir un nuevo período?”

**Qué es:** Pregunta del sistema al entrar.

**Qué hacer:** **Aceptar** si tenés autoridad para abrir caja; si no, cancelar y pedir ayuda.

---

## “Ocurrió un erro intentando cargar le período” / “…cargar las categorías”

**Qué hacer:** Texto con errores de tipeo pero el sentido es **fallo al cargar**; reintentar, revisar red y tienda.

---

## “Error al obtener productos”

**Qué hacer:** Igual que arriba; también revisar **sesión** (cerrar sesión y entrar).

---

## “Error al procesar el pago”

**Qué hacer:** Revisar que el total de pagos cubra el monto; si el carrito quedó raro, volver a armar la venta. Si se repite, soporte.

---

## Mensajes con 📱 “Venta guardada localmente…”

**Lectura:** La venta quedó en el **aparato** y se enviará **después** (red, servidor, reintento).

**Qué hacer:** Recuperar conexión y usar **sincronizar**; no apagar el equipo de inmediato si hay muchas pendientes.

---

## “No hay suficiente stock…” / “Existencia insuficiente”

**Qué hacer:** Ajustar cantidades con lo que muestra **Inventario**; si el stock “debería” estar, revisar **movimientos** y **desdoblamientos** de packs (productos en porciones).

---

## “…período anterior” / venta no se puede sincronizar

**Qué hacer:** **Administrador** o soporte: suele pasar si el **cierre** cambió mientras la venta estaba pendiente.

---

## “⚠️ X ventas no pudieron sincronizarse” / parcialmente bien

**Qué hacer:** Abrir la vista de **ventas pendientes** (si existe) para ver cuál falló; no borrar datos sin indicación.

---

## “Producto no encontrado para el código escaneado”

**Qué hacer:** Verificar código; si es nuevo, pedir permiso de **asociar código** o que carguen el código en **productos**.

---

## “No se pudo aplicar el código de descuento”

**Qué hacer:** Revisar cupón; intentar otro o vender sin descuento.

---

## “Datos actualizados correctamente” (refrescar)

**Qué esperar:** Lista de productos al día con el servidor.

---

## “Error al sincronizar los datos” (refrescar)

**Qué hacer:** Reintentar; comprobar red.

---

## “Ocurrió un error de red al sincronizar” (desde listados de ventas)

**Qué hacer:** Esperar mejor señal y reintentar.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

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

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Por qué no me aparecen productos para vender?”

**Respuesta sugerida:**  
“El POS solo muestra artículos con **precio de venta mayor a cero** y con **stock disponible** según las reglas del sistema (a veces un producto en **porciones** se muestra si el **pack padre** todavía tiene unidades). Revisá que estés en la **tienda** correcta, que el producto tenga **precio** en **Conformar precios** y que haya **existencia** en **Inventario** o por **movimientos**. Si tu usuario está **ligado a un proveedor**, puede que solo veas parte del catálogo.”

**Preguntas de diagnóstico:** “¿El mismo producto lo ve otro compañero?” · “¿El precio está en cero?”

---

## “¿Cómo vendo lo que viene de un pack o porciones?”

**Respuesta sugerida:**  
“Si el producto está configurado como **porción** de otro (por ejemplo cigarrillos sueltos de una caja), el POS usa el **stock del producto padre** para dejarte vender la porción. Si no aparece, casi siempre falta **stock del padre** o **precio** en la línea que estás vendiendo. Si necesitás el detalle exacto de tu catálogo, lo confirma un administrador en **Productos**.”

---

## “La venta quedó en el celular y no sube”

**Respuesta sugerida:**  
“Conectate a internet y usá la opción de **sincronizar ventas pendientes** en el POS. Si sale **stock** o **período**, anotá el mensaje completo y pasáselo a administración.”

---

## “No me deja cerrar la caja / sincronizar ventas”

**Respuesta sugerida:**  
“En **Cierre** a veces pide que las ventas del POS estén **sincronizadas** con el servidor. Volvé al POS, sincronizá, y reintentá el cierre.”

*(Detalle ampliado en la guía de Cierre cuando esté documentada.)*

---

## “Escaneo y no encuentra”

**Respuesta sugerida:**  
“Comprobá que el código sea del producto y de esta tienda. Si es un código **nuevo**, puede hacer falta el permiso de **asociar código** para enlazarlo a un producto ya existente; si no lo tenés, quien administre productos debe cargar el código.”

---

## Frases a evitar

- “createSell”, “Zustand”, “UUID”.
- Prometer que “siempre” sincroniza en X segundos (depende de la red).
