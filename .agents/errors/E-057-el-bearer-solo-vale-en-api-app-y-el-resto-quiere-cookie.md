# E-057: El Bearer solo vale en `/api/app`; el resto de las rutas gateadas quieren la cookie de NextAuth

**Área:** auth
**Apariciones:** 1 — F-028 (parte A)

## Síntoma

Para verificar el criterio 1 de F-028 había que registrar una tasa **por el camino real de
producción** —`POST /api/negocio/[id]/tasas-cambio`— y no con un insert directo, porque el criterio
lo exige así. El intento natural fue autenticar la petición con un JWT en la cabecera:

```
Authorization: Bearer <token firmado>
```

La ruta respondía como no autenticada. El token estaba bien firmado y con el secreto correcto, así
que el síntoma parecía un problema del token o del secreto, y ahí es donde se pierde el tiempo.

## Causa raíz

En este proyecto conviven **dos** formas de autenticar una petición, y no son intercambiables:

- Las rutas de `/api/app/**` —las 15 que consume la APK Flutter— aceptan el **Bearer**. Está
  verificado en `.agents/features.json` (`references.external_docs.apk`): la APK manda solo
  `Authorization` y `Content-Type`, y nada más.
- **Cualquier otra ruta gateada** la valida el middleware con `getToken`, que lee la **cookie de
  sesión de NextAuth**, no la cabecera `Authorization`. Un Bearer perfecto es, para esa puerta,
  ninguna credencial.

El mensaje no lo dice: la respuesta es la misma «no autenticado» que daría un token inválido, así
que el diagnóstico apunta al token —lo que se acaba de escribir— y no a la puerta, que es lo que
en realidad no lo mira.

## Solución

Firmar el token con el `encode()` de `next-auth/jwt` (mismo secreto, `NEXTAUTH_SECRET`) y mandarlo
como **cookie** `next-auth.session-token`, en vez de como cabecera. Con eso el middleware lo
reconoce y la ruta se ejercita de verdad, sin montar un flujo de login por credenciales completo.

## Cómo evitarlo

Antes de autenticar una petición de verificación, **mira qué puerta cubre esa ruta**, no cuál te
resulta más cómoda de construir. La regla de este repo, en una línea: **Bearer solo en `/api/app`;
en todo lo demás, cookie de NextAuth.**

Y el patrón de diagnóstico que generaliza: cuando una credencial recién escrita es rechazada, antes
de revisar cómo la firmaste comprueba **que el verificador la lee**. Un mecanismo que ni siquiera
inspecciona la cabecera produce el mismo error que una firma mal hecha, y solo uno de los dos se
arregla mirando el token. Emparenta con [[E-021]], donde el dato que se creía leído en vivo viajaba
en realidad en el JWT de la sesión.
