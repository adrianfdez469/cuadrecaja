# Acceso: olvidé contraseña, restablecer y activar cuenta — problemas y soluciones

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
