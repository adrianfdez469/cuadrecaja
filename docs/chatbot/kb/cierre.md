<!-- Consolidado para embeddings. Fuentes: seis archivos `cierre` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Cierre de período

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

| Requisito | Motivo |
|-----------|--------|
| **Tienda actual** | Todo el cierre es por sucursal. |
| **Período abierto** | Sin período no hay datos que cerrar (la pantalla ofrece crear el primero). |
| **Ventas registradas** (opcional) | Podés cerrar con poco movimiento; los totales reflejarán lo vendido. |
| **Ventas sincronizadas en el POS** (en cada dispositivo) | El **mismo navegador** que intenta cerrar no debe tener ventas locales **sin sincronizar**. |
| **Gastos configurados** (si el negocio los usa) | Los **recurrentes** aparecen en la **revisión previa** según reglas de día/recurrencia; los **ad-hoc** del período se suman al cierre. |

## Permisos que suelen pedirse en conjunto

- **Ver gastos:** para ver el bloque de gastos en la página de cierre.
- **Gestionar gastos:** para el botón de **gasto puntual** y plantillas (vía módulo Gastos).
- **Cerrar caja:** imprescindible para completar el botón **Cerrar caja** y el flujo en servidor.

## Qué hace el sistema al confirmar (sin tecnicismos)

- **Guarda** los totales del período (ventas, transferencias, ganancias, consignación, etc.).
- **Descuenta** o registra los **gastos** según lo que marcaste en la revisión.
- **Cierra** el período y **abre** el siguiente para no dejar la tienda sin período activo.

## Consignación

- Si vendés productos de **proveedor en consignación**, el cierre suele mostrar apartados de **ventas propias** vs **consignación** y puede generar información para **liquidaciones** internas del sistema.

## Guía paso a paso

*Flujo principal en la aplicación.*

## Antes de empezar

1. **Tienda actual** correcta.
2. **Ventas del POS** subidas al servidor (en **Ventas** deberían verse las ventas ya guardadas).
3. En el mismo equipo donde usaste el POS: si quedaron ventas **pendientes de sincronizar** en ese navegador, el **Cierre** puede bloquearte hasta que sincronicés en el **POS**.

---

## Entender la pantalla

- **Título / subtítulo:** indica el **período** (fecha de inicio) que estás viendo.
- **Tarjetas resumen:** tipos de productos vendidos, unidades, total bruto de ventas, descuentos del período (si hay), **ventas propias** vs **consignación**, y con permiso **ganancia total**.
- **Detalle de productos:** tabla con acordeones (propios / consignación), totales y, si aplica, **resumen por vendedor** y **transferencias por destino**.
- **Exportar:** menús para bajar **Excel** de productos (según opciones que muestre tu pantalla).
- **Lista de gastos del período:** visible si tenés permiso de **ver gastos**; el ícono de **ticket** abre **gasto puntual (ad-hoc)** solo si tenés **gestionar gastos**.
- **Refresco:** vuelve a pedir los datos al servidor.

---

## Cerrar el período (corte de caja)

1. Revisá números y exportaciones si las necesitás para contabilidad.
2. Pulsá **Cerrar caja**.
3. Si el sistema avisa de **ventas sin sincronizar en el POS**, andá al POS, sincronizá y volvé.
4. Se abre **“Revisión de gastos antes del cierre”**:
   - **Gastos recurrentes** que “aplican hoy”: podés **desmarcar** los que no quieras cargar en este cierre.
   - **Gastos ad-hoc** del período: suelen listarse para información; el total cuenta en el resumen.
   - Mirá **ganancia neta** estimada; si sale **negativa**, hay una **advertencia** (gastos mayores que ganancias del período).
5. Pulsá **Confirmar y cerrar** (o **Cancelar** para volver atrás sin cerrar).
6. **Qué debería pasar:** mensaje de **cierre realizado**; el sistema **cierra** el período, **aplica** la lógica de gastos elegida y **abre un período nuevo** para seguir vendiendo.

---

## Crear el primer período

1. Si ves el mensaje de negocio nuevo sin períodos, pulsá **Crear primer período**.
2. Esperá la confirmación y recargá datos si hace falta.

---

## Después del cierre

- Seguí vendiendo en el **POS** en el **nuevo período**.
- Para ver **cierres anteriores** en detalle o listados históricos, usá **Resumen de cierres** (cuando esté documentado en el chatbot, será el siguiente bloque del plan).

---

## Relación con otros módulos

| Necesidad | Módulo |
|-----------|--------|
| Cobrar | **POS** |
| Ver tickets por venta | **Ventas** |
| Cargar plantillas de gastos | **Gastos** (configuración de tienda) |
| Historial de cortes | **Resumen de cierres** |

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

| Permiso (cómo pedirlo al administrador) | Efecto |
|----------------------------------------|--------|
| **Acceder al cierre de caja** | Ver el menú **Cierre** y la pantalla de resumen del período. |
| **Cerrar caja** / **crear cierre** (nombre en tu panel) | Poder usar **Cerrar caja** y completar el cierre en servidor; también hace falta para **aplicar** la parte de gastos del asistente (API protegida). |
| **Ver ganancias y costos en el resumen de cierre** | Ver **ganancia total** en tarjetas y **precios/costos/ganancias** en el detalle agregado de productos. Sin esto, la tabla puede mostrar solo **cantidades** (`showOnlyCants` en la interfaz). |

## Permisos de Gastos que se cruzan con esta pantalla

| Permiso | Efecto en Cierre |
|---------|------------------|
| **Ver gastos** | Ver el listado de **gastos del período** debajo del detalle de productos. |
| **Gestionar gastos** | Ver el botón de **gasto puntual (ad-hoc)** en la barra superior del cierre. |

**Nota:** La **revisión de gastos** antes de cerrar la ejecuta quien pulse **Confirmar y cerrar**; en la práctica quien **cierra** necesita el permiso de **cerrar caja** en el servidor.

## Superadministrador

Acceso completo salvo las mismas reglas de negocio (período ya cerrado, etc.).

## Resumen para el bot

- “Entro a Cierre y no veo el menú” → **acceder al cierre**.  
- “Veo todo pero no puedo cerrar” → **cerrar caja**.  
- “Solo veo cantidades, no dinero de ganancia” → **ganancias y costos en cierre**.  
- “No veo gastos abajo” → **ver gastos**.  
- “No tengo el botón del ticket” → **gestionar gastos**.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Debe sincronizar las ventas en la interfaz del pos de ventas”

**Qué hacer:** **POS** → sincronizar pendientes → volver a **Cierre**.

---

## “Cierre de caja realizado exitosamente”

**Qué esperar:** Período anterior cerrado y **uno nuevo abierto**; lista de ventas del período “arranca de cero” para el nuevo ciclo.

---

## “Ha ocurrido un error al realizar el cierre”

**Qué hacer:** Actualizar página, revisar red, reintentar. Si el período ya quedó cerrado en servidor, no forzar de nuevo sin revisar **Resumen de cierres**.

---

## “Error al crear el primer período”

**Qué hacer:** Reintentar; verificar **tienda** y permisos. Mismo mensaje que en **Ventas** si falla la creación inicial.

---

## “Error al cargar los datos de cierre. Por favor, intenta recargar la página.”

**Qué hacer:** Recargar (F5 o botón del navegador). Si sigue, comprobar sesión e internet.

---

## Toast / mensaje con texto del servidor (p. ej. “Cierre no encontrado”)

**Qué hacer:** Suele indicar **período inexistente** o fallo al leer datos; recargar y confirmar **tienda**.

---

## “No se pudo cargar el resumen de gastos. Intenta de nuevo.”

**Qué hacer:** Cerrar el cuadro de diálogo y volver a **Cerrar caja**; revisar conexión.

---

## “Error al aplicar los gastos. Intenta de nuevo.”

**Qué hacer:** Misma línea: reintentar; no duplicar cierres si ya hubo éxito parcial (consultar con administración).

---

## “Acceso no autorizado” (al cerrar en servidor)

**Qué hacer:** Falta permiso de **cerrar caja**; pedirlo al administrador.

---

## Respuestas del servidor al cerrar (texto aproximado)

- **“El último período ya está cerrado”:** el sistema considera que no hay un período **abierto** para cerrar o el ID no coincide; revisar con administración o **Resumen de cierres**.
- **“Período no coincide con el cierre solicitado”:** desactualización de pantalla; **actualizar** datos.
- **“No hay períodos para esta tienda”:** crear período inicial.

---

## “Archivo Excel exportado exitosamente” / “Error al exportar el archivo Excel”

**Qué hacer:** En éxito, buscar la descarga en la carpeta del navegador; en error, reintentar o probar otro navegador.

---

## Alerta: “La ganancia neta es negativa…”

**Qué es:** Aviso informativo en la revisión de gastos: los gastos superan la ganancia estimada del período.

**Qué hacer:** Revisar montos y gastos marcados; igual podés confirmar si el negocio acepta cerrar así.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

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

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Qué es el cierre de caja en el sistema?”

**Respuesta sugerida:**  
“Es la pantalla donde **resumís** las ventas del **período** de la tienda, revisás **gastos** si los usan, y con permiso **cerrás** el período. Al cerrar, el sistema **guarda** los totales, **descuenta** gastos según lo que marcaste y **abre un período nuevo** para seguir vendiendo en el POS.”

---

## “Me dice que sincronice el POS y ya vendí todo”

**Respuesta sugerida:**  
“Ese aviso mira las ventas **guardadas en ese mismo navegador o celular**, no solo el servidor. Abrí el **POS** en **ese equipo**, usá **sincronizar ventas pendientes** hasta que no queden pendientes, y volvé a **Cierre**.”

---

## “¿Puedo cerrar sin ver ganancias?”

**Respuesta sugerida:**  
“Sí podés **cerrar** si tenés permiso de **cerrar caja**; lo que puede faltar es el permiso de **ver ganancias y costos en el cierre**, que es solo para mostrar montos sensibles en el resumen.”

---

## “¿Los gastos se cargan solos al cerrar?”

**Respuesta sugerida:**  
“Al pulsar **Cerrar caja** se abre una **revisión**: los **recurrentes** que aplican ese día vienen **marcados** y podés **destildar** los que no correspondan; los **gastos puntuales** del período suelen sumarse al total. Después confirmás con **Confirmar y cerrar**.”

---

## “Cerré y desaparecieron las ventas del listado”

**Respuesta sugerida:**  
“Es normal: al cerrarse el período, el **POS** y **Ventas** empiezan a contar el **período nuevo**. Lo del corte anterior queda en **Resumen de cierres** o reportes históricos.”

---

## “¿Dónde descargo el Excel?”

**Respuesta sugerida:**  
“En la misma pantalla de **Cierre**, en el bloque de **detalle de productos vendidos**, usá los menús de **exportar** (iconos o tres puntos según tu versión). Si falla, probá de nuevo o otro navegador.”

---

## Frases a evitar

- “Transacción Prisma”, “PUT /api/cierre”.
- Decir que el cierre **no** abre período nuevo (en esta app **sí** abre otro al terminar bien).
