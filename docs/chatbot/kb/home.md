<!-- Consolidado para embeddings. Fuentes: seis archivos `home` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Inicio (home)

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

| Requisito | Motivo |
|-----------|--------|
| **Usuario con sesión válida** | El panel solo tiene sentido tras el login. |
| **Al menos un local** asignado al usuario | Sin locales, el inicio muestra el flujo de bienvenida con enlace a configuración. |
| **Local actual seleccionado** | Sin eso, no se cargan widgets que dependen de la tienda (vencimientos, etc.). |
| **Permisos por módulo** | Define qué tarjetas de **acceso rápido** y qué ítems de **configuración** se muestran. |
| **Plan de suscripción activo o en gracia** | Si está vencido o suspendido, verás avisos y posibles limitaciones de uso (coherente con login y middleware). |

## Tipo de local

- En **almacén**, algunos accesos rápidos **no se listan** (POS, ventas, cierre, etc.) para alinear el uso del sistema con un depósito.

## Guía paso a paso

*Flujo principal en la aplicación.*

## Al entrar

1. Verificá que arriba figure el **local correcto** (tienda o almacén) y el **nombre del negocio**.
2. Leé la franja de **chips**: productos, usuarios, tiendas y **fecha de vencimiento** del plan (con días restantes).
3. Si hay **alertas** (suscripción, productos, notificaciones), abrilas o seguí el enlace que ofrezcan.

---

## Acceso rápido

1. En **Acceso rápido**, cada tarjeta lleva a un módulo (POS, inventario, ventas, movimientos, cierre, resumen de cierres, etc.).
2. Solo verás las tarjetas para las que tengas **permiso**.
3. Tocá la tarjeta y luego **Acceder** (o la tarjeta entera) para ir a esa sección.

---

## Configuración del sistema

1. Más abajo, si tu rol lo permite, aparece **Configuración del sistema** con iconos (productos, categorías, locales, usuarios, roles, **planes** solo superadmin).
2. Tocá el icono para ir a cada pantalla.

---

## Cambiar de local

1. Usá el **selector de local** del menú superior (no desde esta página).
2. Volvé al **Inicio** si querés ver de nuevo los accesos en contexto del nuevo local.

---

## Superadministrador

- Puede ver **resumen de suspensiones** y el botón de **backup** en el encabezado, además del acceso a **Planes** de administración si está en el menú de configuración.

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

| Situación | Causa habitual |
|-----------|----------------|
| No ves tarjeta **POS**, **Ventas**, etc. | Falta el permiso de ese módulo, o el local es **almacén** y la tarjeta está oculta. |
| No ves sección **Configuración del sistema** | Ninguna de las opciones de configuración te aplica por permisos (o no tenés ninguna). |
| Ves **Planes** (administración de planes) | Solo **superadministrador** del producto. |
| Ves **Generar backup** | Solo **superadministrador**. |

**Nota:** Los **chips** de límites del negocio suelen verse para quien tiene sesión y negocio cargado; no sustituyen a la pantalla **Planes** para contratar.

## Resumen para el bot

- “No tengo POS en el inicio” → permiso **POS** y tipo de local **tienda**.  
- “Soy encargado y no veo configuración” → permisos de **configuración** por ítem.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Cargando panel de control…”

**Qué hacer:** Esperar; si no termina, recargar la página.

---

## “Usuario sin locales asociadas”

**Qué hacer:** Contactar administración o ir a **Configuración** si podés crear/asignar locales.

---

## “Selecciona un local desde el menú de usuario…”

**Qué hacer:** Elegir local en la barra superior.

---

## Chips en rojo (límites al 100 % o más)

**Qué hacer:** Renovar plan o liberar espacio (productos/usuarios/tiendas) según política del negocio.

---

## “Error al generar backup” (superadmin)

**Qué hacer:** Reintentar; si persiste, soporte técnico (puede ser permiso de servidor o fallo de API).

---

## Alerta de suscripción que no desaparece

**Qué hacer:** Renovar en **Planes** o verificar que el pago se haya registrado; contactar soporte si el estado en pantalla no coincide con lo pagado.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

El **Panel de control** es la pantalla principal tras iniciar sesión: muestra el **local actual**, **límites del plan** (productos, usuarios, tiendas, vencimiento), **avisos** de suscripción y productos, **accesos rápidos** a módulos y accesos a **configuración** según permisos.

---

## “Usuario sin locales asociadas”

**Qué es:** Tu usuario aún no tiene ningún **local/tienda** vinculado.

**Qué hacer:** Pulsá **Ir a Configuración** si tenés permiso, o pedí al **administrador del negocio** que te asigne al menos un local.

---

## “Selecciona un local desde el menú de usuario”

**Qué es:** Tenés locales pero **ninguno elegido** como “actual”.

**Qué hacer:** Abrí el **selector de usuario / tienda** (arriba) y elegí el local donde vas a trabajar.

---

## No veo una tarjeta de acceso rápido (POS, Ventas, etc.)

**Qué suele pasar:** No tenés **permiso** para ese módulo, o el local es tipo **almacén** y algunas rutas (POS, ventas, cierre, resumen de cierres, dashboard) se **ocultan** por diseño.

**Qué hacer:** Pedir permiso o cambiar a un local tipo **tienda** si corresponde.

---

## Aparece un aviso amarillo/rojo de suscripción

**Qué es:** El sistema detectó **vencimiento cercano**, **suscripción vencida** (con posible **gracia**) o **cuenta suspendida**.

**Qué hacer:** Usar **Renovar ahora** (lleva a **Planes**), **Contactar soporte** o el correo que indique el aviso. Detalle en `kb/suscripcion.md` o en `problemas_y_soluciones_suscripcion.md`.

---

## Los chips de productos/usuarios/tiendas muestran porcentaje alto en rojo

**Qué es:** Te estás **acercando al tope** del plan contratado.

**Qué hacer:** Renovar o cambiar de plan, o dar de baja datos que no usés; coordinar con quien administra la **suscripción**.

---

## “Generar Backup BD” no me aparece

**Qué es:** Ese botón es solo para **superadministrador** del sistema.

**Qué hacer:** Si no sos ese rol, los backups los coordina quien mantenga la infraestructura.

---

## Notificaciones o productos por vencer

**Qué hacer:** Revisar el **widget de notificaciones** y el aviso de **vencimiento de productos** (si aparece): suelen enlazar o resumir tareas pendientes en la tienda actual.

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “¿Qué es el panel de control?”

**Respuesta sugerida:**  
“Es la **página de inicio** después de entrar: muestra tu **local actual**, cuánto usás del **plan** (productos, usuarios, tiendas, fecha de vencimiento), **avisos** importantes y **accesos rápidos** a POS, inventario, ventas y demás según tus permisos.”

---

## “No me aparece el POS en las tarjetas”

**Respuesta sugerida:**  
“Puede ser por **permisos** o porque el local seleccionado es un **almacén**: en almacén el sistema oculta algunas ventas de cara al depósito. Probá con una **tienda** o pedí permiso de **POS**.”

---

## “Me sale que no tengo locales”

**Respuesta sugerida:**  
“Tu usuario todavía no está asociado a ningún local. Un **administrador** del negocio debe asignarte una tienda en **Configuración → Locales / usuarios**.”

---

## “¿Para qué sirven los números de arriba?”

**Respuesta sugerida:**  
“Son **límites de tu plan**: cuántos productos, usuarios y tiendas llevás respecto al máximo, y cuándo **vence** la suscripción. Si un chip se pone **rojo**, estás cerca o pasado del límite.”

---

## Frases a evitar

- “JWT”, “middleware”, “excludeOnWarehouse”.
