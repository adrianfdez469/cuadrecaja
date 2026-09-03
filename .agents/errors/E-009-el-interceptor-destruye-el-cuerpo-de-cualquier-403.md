# E-009: El interceptor destruye el cuerpo de cualquier 403, y el frontend no puede distinguir el suyo

**Área:** auth
**Apariciones:** 1 — F-003

## Síntoma

Una ruta responde un 403 con un código propio en el cuerpo, y en el frontend ese cuerpo **no
existe**. El servicio recibe un `Error` genérico que no es siquiera un `AxiosError`, así que
`error.response.data` es `undefined` y no hay forma de saber qué 403 era:

```
Acceso denegado a /api/negocio/<id>/qab/credential. Por favor asigne los permisos necesarios.
```

Lo desconcertante es que el servidor está bien. `curl` devuelve el cuerpo correcto:

```
curl -b cookie.jar -X POST .../qab/credential
403 {"error":"FORBIDDEN"}
```

El mensaje que ve el usuario le manda además a **arreglar lo que no está roto**: habla de
permisos cuando el 403 puede significar cualquier otra cosa —en F-003, que el negocio está
dado de baja en QAB—.

## Causa raíz

`src/lib/axiosClient.ts` traduce **cualquier** 403, venga de donde venga, a un `Error` fabricado:

```ts
if (status === 403) {
  const url = error.config?.url ?? "recurso desconocido";
  return Promise.reject(
    new Error(`Acceso denegado a ${url}. Por favor asigne los permisos necesarios.`),
  );
}
```

El cuerpo original se pierde ahí, y con él el código que la ruta se molestó en enviar. Un
`.catch()` en el componente no ayuda: el interceptor actúa antes.

Es **el hermano de [E-007](E-007-pagina-publica-que-llama-a-una-api-cerrada.md)**. Aquel
documenta que el mismo interceptor convierte cualquier 401 en `signOut()` y expulsa al usuario;
este es el mismo patrón un escalón más abajo: el 403 no expulsa, pero miente sobre la causa. Los
dos vienen de tratar un estado HTTP como si tuviera un único significado en toda la aplicación.

La consecuencia de diseño es más amplia que el bug: **un desenlace que el contrato pida
distinguir por el cuerpo de un 403 es inalcanzable desde el frontend**, y eso no se ve leyendo
la ruta —que es correcta— ni leyendo el componente. Solo aparece al ejecutarlo.

## Solución

En F-003 **no se tocó el interceptor**: cambiarlo afecta a toda la aplicación y no era el
alcance del feature. Se resolvió en dos capas:

1. **No espejar ningún estado HTTP del sistema externo** (ADR 0022): todo fallo de
   queandabuscando sale como `502` con su código en el cuerpo, precisamente para que ni el 401
   ni el 403 ajenos pasen por el interceptor.
2. **Normalizar el 403 propio en el servicio.** Como este grupo de rutas nunca devuelve otro 403
   que `FORBIDDEN`, un rechazo que **no** es un `AxiosError` solo puede venir de la sustitución
   del interceptor, y se reconstruye como `FORBIDDEN`. Queda documentado en el propio archivo,
   porque es un razonamiento que no se sostiene solo.

Arreglar el interceptor de raíz —preservar el cuerpo y dejar que cada consumidor decida— es
deuda pendiente y no de un feature de integración.

## Cómo evitarlo

**Antes de diseñar un desenlace que el frontend deba distinguir por el cuerpo de un 401 o un
403, comprobar si `axiosClient` lo deja llegar.** Hoy no lo deja en ninguno de los dos casos: el
401 se lleva la sesión por delante y el 403 se lleva el cuerpo.

Dos reglas prácticas que salen de aquí:

- **Un error de un sistema externo no se espeja con su estado HTTP.** Se traduce a un estado
  propio con el código en el cuerpo. Si no, hereda el significado que la aplicación ya le dio a
  ese número.
- **Verificarlo ejecutándolo en el navegador, no con `curl`.** El interceptor es de cliente: por
  `curl` el cuerpo llega perfecto y el fallo es invisible. Es la misma lección que E-007, donde
  el servidor respondía 200 y la redirección ocurría tres pasos después.
