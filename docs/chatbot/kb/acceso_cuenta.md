<!-- Consolidado para embeddings. Fuentes: seis archivos `acceso_cuenta` en docs/chatbot/. Regenerar: python3 docs/chatbot/build_kb.py -->

# Acceso a la cuenta

Documentación funcional en un solo documento (guía, permisos, errores, problemas y respuestas tipo bot).

## Configuración previa

*Qué debe tener listo el negocio o el administrador antes de usar el módulo.*

| Requisito | Motivo |
|-----------|--------|
| **Correo único** y válido | Es el usuario de login y el destino del reset. |
| **Bandeja de entrada accesible** | Para recibir enlaces con **token**. |
| **Navegador actualizado** | Evita problemas con formularios y redirecciones. |
| **Invitación vigente** (activar usuario) | El administrador debe generar el enlace; sin token no hay flujo. |

## Diferencia entre flujos

| Flujo | Cuándo se usa |
|-------|----------------|
| **Olvidé contraseña** | Ya tenías cuenta y perdés la clave. |
| **Activar negocio** | Primera creación del **negocio** (trial). |
| **Activar usuario** | Un **admin** te invitó al equipo. |

## Guía paso a paso

*Flujo principal en la aplicación.*

## Olvidé mi contraseña

1. En la pantalla de **login**, abrí **Recuperar contraseña** (o entrá directo a la página de recuperación si te dieron el enlace).
2. Escribí el **correo** con el que iniciás sesión.
3. Enviá el formulario y revisá el **correo** (y spam).
4. Abrí el **enlace** del mail: te llevará a **Nueva contraseña** con `token` en la barra de direcciones.
5. Definí **contraseña** y **confirmación** según las reglas de la pantalla.
6. Al terminar, el sistema suele **redirigir al login** y puede **prellenar** tu usuario para que entres con la clave nueva.

---

## Activar negocio nuevo (`/activar`)

1. Abrí el enlace con **`token`** que recibiste al registrarte.
2. Esperá a que termine la **activación automática**.
3. En éxito, anotá o copiá **usuario (correo)** y **contraseña temporal**; el sistema recomienda **cambiar la clave** después del primer login.
4. Pulsá **Iniciar sesión ahora** (usa esas credenciales de forma segura).

---

## Activar usuario invitado (`/activar-usuario`)

1. Abrí el enlace del mail con **`?token=`**.
2. Definí **contraseña** y **confirmación** con los requisitos de seguridad.
3. Confirmá; te redirige al **login** con datos listos para entrar.

---

## Buenas prácticas

- No reenvíes tokens por **chat público**.  
- Si un enlace **caducó**, pedí uno nuevo en lugar de insistir con el viejo.

## Permisos del usuario

*Por qué puede faltar una opción o un dato.*

- **Olvidé / restablecer contraseña:** no requiere estar logueado; solo un correo asociado a un negocio **activo** (según política del servidor).
- **Activar negocio / usuario:** depende del **token** del enlace, no de permisos previos.
- **Reenviar invitación:** lo hace un usuario con permiso de **gestión de usuarios** en configuración (fuera de esta página).

**Resumen para el bot:** “No puedo activar” → token válido y enlace completo; “no llega mail” → spam y administrador.

## Errores comunes

*Mensajes o comportamientos y cómo reaccionar.*

## “Ingresa un correo electrónico válido”

**Qué hacer:** Corregir el formato del mail antes de enviar.

---

## “Si el correo está registrado…” (mensaje genérico)

**Qué hacer:** Normal por **privacidad**; revisar spam y datos; si no llega nada, contactar **administrador** o **soporte**.

---

## “Error de conexión. Intenta de nuevo.”

**Qué hacer:** Revisar red y reintentar.

---

## “Falta el token en la URL” / “Falta el token de activación”

**Qué hacer:** Usar el enlace completo del correo o pedir reenvío.

---

## “El enlace de activación ha expirado.”

**Qué hacer:** Solicitar **nuevo** enlace de activación de negocio.

---

## “Esta cuenta ya fue activada” / “Los datos indicados ya están en uso”

**Qué hacer:** Probar **login** u **olvidé contraseña**; soporte si sigue bloqueado.

---

## “Las contraseñas no coinciden”

**Qué hacer:** Reescribir ambos campos igual.

---

## “No se pudo restablecer / activar la cuenta”

**Qué hacer:** Leer el detalle del error en rojo; token inválido o vencido → nuevo flujo desde el principio.

---

## “Contraseña actualizada. Redirigiendo al inicio de sesión…”

**Qué esperar:** En segundos deberías estar en **login** con usuario sugerido.

## Problemas y soluciones

*Síntomas habituales y qué hacer.*

Rutas habituales: **`/olvide-contrasena`**, **`/restablecer-contrasena`** (con `?token=...` en el enlace del correo), **`/activar`** (alta de **negocio** nuevo con token), **`/activar-usuario`** (invitación de **usuario** con token).

---

## “Recuperar contraseña” no me llega el correo

**Causas:** Correo mal escrito, bandeja de spam, cuenta inactiva, o el servidor respondió el mensaje genérico de **privacidad** (“si existe una cuenta…”).

**Qué hacer:** Revisar ortografía y spam; esperar unos minutos; reintentar. Si el negocio deshabilitó usuarios, **soporte** o el administrador.

---

## El enlace de restablecer dice que falta el token

**Qué es:** Abrís la página **sin** la URL completa que venía en el correo.

**Qué hacer:** Usar el botón del **mismo correo** de recuperación; no copiar solo parte de la dirección.

---

## “El enlace de activación ha expirado” (negocio nuevo)

**Qué es:** En **`/activar`**, el token de alta puede tener **vigencia corta** (la pantalla menciona **30 minutos** en un mensaje de error).

**Qué hacer:** Pedir un **nuevo enlace** de registro a quien te dio de alta.

---

## “Esta cuenta ya fue activada” / conflicto de datos

**Qué es:** El token ya se usó o hay **correo/negocio duplicado**.

**Qué hacer:** Intentar **iniciar sesión**; si no recordás clave, **Olvidé contraseña**; si el conflicto persiste, **soporte**.

---

## Activar usuario invitado: “Falta el token”

**Qué es:** La URL debe ser del tipo **`/activar-usuario?token=...`** que mandó el administrador.

**Qué hacer:** Pedir que reenvíen la invitación.

---

## Contraseña no cumple requisitos

**Qué es:** El sistema pide **mínimo 8 caracteres** con **mayúsculas, minúsculas y números** (texto en pantallas de **Nueva contraseña** y **Activar tu cuenta**).

**Qué hacer:** Elegir otra contraseña que cumpla las tres reglas.

---

## Tras cambiar la clave me manda al login y no entra

**Qué hacer:** El sistema puede **prellenar** el usuario en el login; verificá que estés usando el **correo correcto** y la **nueva** clave. Probá pegar desde un gestor de contraseñas sin espacios extra.

---

## No encuentro “Olvidé mi contraseña” en el login

**Qué hacer:** Suele ser un **enlace** bajo el formulario de inicio de sesión; si la marca blanca lo oculta, pedí la URL **`/olvide-contrasena`** al administrador.

## Respuestas tipo chatbot

*Frases listas y preguntas de diagnóstico.*

---

## “No me llega el mail para cambiar la clave”

**Respuesta sugerida:**  
“Revisá **spam**, que el correo sea el mismo del **login**, y esperá unos minutos. El sistema a veces muestra un mensaje genérico aunque el correo no exista, por **privacidad**. Si nada llega, pedí ayuda al **administrador** o a **soporte**.”

---

## “El link de activación no abre”

**Respuesta sugerida:**  
“Asegurate de abrir el **enlace completo** del correo, con todo lo que va después del signo **?**. Si dice **expirado**, pedí que te manden **otro** enlace.”

---

## “¿Qué contraseña puedo poner?”

**Respuesta sugerida:**  
“Al menos **8 caracteres**, con **mayúsculas**, **minúsculas** y **números**, y que coincida en los dos campos. Eso dice la pantalla al restablecer o al activar invitación.”

---

## “Activé el negocio, ¿y ahora?”

**Respuesta sugerida:**  
“Guardá **usuario** y **contraseña temporal**, pulsá **Iniciar sesión ahora** y, cuando entres, conviene **cambiar la clave** desde tu perfil o con **olvidé contraseña** si ya la personalizás.”

---

## Frases a evitar

- “Token JWT”, “API solicitar-reset”.
