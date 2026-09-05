# E-031: El mensaje de un error de runtime cita el cuerpo, y el cuerpo lleva la credencial

**Área:** auth
**Apariciones:** 1 — F-010

## Síntoma

Ninguno visible. El código compilaba, la suite pasaba y ningún test evidente lo cazaba. La fuga solo
aparece cuando el tercero responde con un cuerpo mal formado:

```
SyntaxError: Unexpected token 'x', ..."code":"ABC12"... is not valid JSON
```

Ese texto acaba en el mensaje del error, y de ahí en un log o en un informe.

## Causa raíz

El contrato prescribía `INVALID_RESPONSE_BODY:<primer issue>` para un cuerpo inválido, copiando el
patrón del cliente hermano. Pero un fallo de `JSON.parse` **no tiene «primer issue»**: no es un error
de Zod, es un `SyntaxError` de V8 — y **V8 cita un fragmento del cuerpo** dentro de su mensaje para
que el humano localice el carácter ofensor.

En esta ruta el cuerpo lleva los `Order.code`, que son la **única credencial de una página pública**
con nombre, teléfono y dirección del comprador. La regla «`Order.code` nunca en un log» estaba
escrita, se respetaba en todos los sitios donde alguien la escribe a mano, y se incumplía por una vía
que nadie escribe: el mensaje que fabrica el runtime.

El cliente hermano (`qabAvailabilityClient`) sí propaga el mensaje de V8, y ahí es inofensivo porque
su cuerpo no lleva credenciales. Copiar el patrón fue lo que trajo el problema.

## Solución

No propagar nunca el mensaje del runtime en esta ruta. Una constante fija del módulo:

```ts
const MALFORMED_BODY_REASON = "MALFORMED_JSON";
// → INVALID_RESPONSE_BODY:MALFORMED_JSON
```

Resuelto **estructuralmente**: no hay ninguna rama que pueda devolver texto que provenga del cuerpo.
El mismo criterio se aplicó al `catch` del bucle del cron, cuyo código de error sale de una función
pura que no tiene ninguna rama que devuelva texto libre — un `P2002` de Prisma nombra campos y a
veces valores en su `meta`.

## Cómo evitarlo

Un mensaje de error fabricado por el runtime —`JSON.parse`, un driver de base de datos, una
librería de red— **puede contener el dato que lo causó**. Antes de propagarlo, preguntarse qué había
en ese dato: si por ese camino pasa una credencial, un identificador de sesión o un dato personal, el
mensaje no se propaga, se sustituye por una constante.

Y al copiar un patrón de un cliente hermano, comprobar que **el contenido que atraviesa el nuevo
cliente es igual de inofensivo**. Aquí lo idéntico era la forma; lo distinto, lo que viajaba dentro.
