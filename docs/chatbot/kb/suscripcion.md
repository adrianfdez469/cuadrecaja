<!-- Consolidado para embeddings. Fuentes: seis archivos `suscripcion` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Suscripción y planes

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

| Requisito | Motivo |
|-----------|--------|
| **Negocio creado** y usuario con acceso a **Configuración → Planes** | Para ver oferta y estado. |
| **Medio de pago o canal acordado** con el proveedor | Muchas renovaciones se coordinan fuera de la app. |
| **Datos de contacto actualizados** en la pantalla de planes | Teléfonos/WhatsApp pueden cambiar; el chatbot no debe inventar números si la UI muestra otros. |

## Roles

- **Cliente / admin del negocio:** usa **Planes** para ver límites y renovar.  
- **Superadministrador del producto:** puede tener **planes-admin** y vistas de suspensión.

## Período de prueba (alta de negocio nuevo)

- El flujo de **activación de negocio** (`/activar`) informa una **prueba** de varios días y condiciones; alinear la respuesta del bot con ese texto si el usuario viene de recién crear cuenta.

## Guía paso a paso

*Flujo principal en la aplicación.*

## Renovar o contratar (dueño / admin del negocio)

1. Desde el **aviso** en el inicio o desde **Configuración**, entrá a **Planes** (ruta interna `/configuracion/planes`).
2. Revisá tu **uso actual** (tiendas, usuarios, productos) y la **fecha de vencimiento**.
3. Compará **planes** (mensual / anual si la pantalla lo ofrece) y beneficios listados.
4. Usá los botones de **contacto** o **WhatsApp** que muestre la propia página para coordinar el pago o la migración de plan (el proceso exacto puede ser manual según comercial).
5. Tras renovar, **recargá** el inicio para ver chips y alertas al día.

---

## Si te llevaron a “suscripción vencida”

1. Leé el texto de **acceso restringido** y el estado (días vencidos, gracia).
2. Pulsá **Renovar** o equivalente que lleve a **Planes**.
3. Si no podés avanzar, **Contactar soporte** con el asunto que sugiera el botón.

---

## Superadministrador

1. En el **inicio**, revisá si hay bloque de **suspensiones** (resumen para soporte).
2. La gestión avanzada de **planes del sistema** puede estar en **planes-admin** según despliegue.

---

## Coherencia con el resto del sistema

- Sin suscripción válida, el **login** o la **navegación** pueden bloquearse para perfiles que no sean superadmin; la pantalla **subscription-expired** queda entre rutas **permitidas** para poder leer el aviso y renovar.

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

| Quién | Qué puede ver |
|-------|----------------|
| Usuario con acceso a **configuración** | Pantalla **Planes** del negocio (`/configuracion/planes`). |
| **Superadministrador** | Además: **planes-admin**, resumen de suspensiones en inicio, backup. |
| Usuario **sin** acceso a configuración | Depende del negocio: puede seguir viendo **avisos** de suscripción en el **inicio** pero quizá no pueda abrir **Planes**; debe pedir a un administrador que renueve o le dé acceso. |

**Resumen para el bot:** “No puedo renovar” → permiso de **configuración** o que otro rol pague / **soporte**.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## Títulos del aviso en inicio

- **Cuenta suspendida:** vencimiento/suspensión automática.  
- **Suscripción expirada:** ya pasó la fecha; puede mencionar **gracia**.  
- **Suscripción por vencer / próxima a vencer:** pocos días restantes.

**Qué hacer:** **Renovar ahora** o **Contactar soporte**.

---

## “Error al cargar estadísticas del negocio”

**Qué hacer:** Recargar; reintentar; si persiste, soporte.

---

## “Error al cargar planes de suscripción”

**Qué hacer:** Igual que arriba.

---

## Pantalla subscription-expired: “Cargando…” eterno

**Qué hacer:** Revisar red y sesión; cerrar sesión y entrar de nuevo.

---

## Botón de correo abre el gestor de mail vacío

**Qué hacer:** Completar el mensaje manualmente o usar **WhatsApp/teléfono** si la pantalla de **Planes** los muestra.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

Incluye: **avisos en el inicio** (`SubscriptionWarning`), la pantalla **`/subscription-expired`**, la contratación/renovación en **`/configuracion/planes`**, y la administración de planes **`/configuracion/planes-admin`** (solo superadministrador).

---

## Aviso en inicio: “Suscripción por vencer” / “Próxima a vencer”

**Qué es:** Quedan **pocos días** (el aviso se muestra cuando el sistema considera que estás en ventana de riesgo, típicamente **7 días o menos** según estado).

**Qué hacer:** **Renovar ahora** (abre **Planes**) o **Contactar soporte** desde los botones del aviso.

---

## “Suscripción expirada” y período de gracia

**Qué es:** La fecha de fin ya pasó pero el mensaje puede indicar **días de gracia** antes de suspensiones más duras.

**Qué hacer:** Renovar en **Planes**; si no podés entrar a esa ruta, usá el **correo de soporte** que muestra la pantalla (en la app aparece **soporte@cuadre-caja.com** en varios flujos).

---

## “Cuenta suspendida” / acceso restringido

**Qué es:** El negocio quedó **suspendido** por suscripción (mensajes en inicio o pantalla dedicada).

**Qué hacer:** Renovar o hablar con **soporte**; los **superadministradores** del producto pueden ver información extra de suspensiones en el inicio.

---

## Me redirigen a `/subscription-expired`

**Qué es:** El flujo de navegación te llevó a la **pantalla de suscripción vencida/suspendida** con explicación y botones.

**Qué hacer:** Seguir **Renovar** o **Contactar soporte** desde esa misma página.

---

## No cargan los planes o las estadísticas del negocio

**Qué hacer:** Revisar sesión, recargar; si hay mensaje **“Error al cargar planes”** o estadísticas, reintentar más tarde o soporte.

---

## No veo “Planes” de administración global

**Qué es:** La ruta **`planes-admin`** es para **superadministrador** del sistema, no para el dueño típico de un solo negocio.

**Qué hacer:** Para contratar o renovar tu negocio usá **Configuración → Planes** (`/configuracion/planes`) con un usuario que tenga acceso a **configuración**.

---

## Chips del inicio al 100 % en productos o tiendas

**Qué es:** Llegaste al **límite del plan**; puede frenar altas nuevas.

**Qué hacer:** Subir de plan o liberar recursos; ver **Planes** para opciones.

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “Me dice que la suscripción venció”

**Respuesta sugerida:**  
“Entrá a **Planes** desde el botón **Renovar** del aviso o desde **Configuración**. Si no tenés acceso a configuración, pedí a quien administra el negocio o escribí a **soporte** con el correo que muestra la pantalla.”

---

## “¿Cuántos días de gracia tengo?”

**Respuesta sugerida:**  
“El mismo aviso o la pantalla de **suscripción** suelen decir los **días de gracia** que calcula el sistema para tu negocio. Si no figura, solo **soporte** puede confirmarlo en tu cuenta.”

---

## “¿Dónde contrato más tiendas o usuarios?”

**Respuesta sugerida:**  
“En **Configuración → Planes** comparás límites y hablás con el contacto comercial que aparece ahí (WhatsApp/teléfono) para subir de plan o ajustar cupos.”

---

## Frases a evitar

- Prometer precios o días exactos si la UI del usuario muestra otra cosa.
