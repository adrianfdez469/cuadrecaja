# E-065: Un criterio verificado en el nivel equivocado de la pila

**Área:** ui
**Apariciones:** 1 — F-032

## Síntoma

Un criterio de diseño exigía que, al escribir un nombre con bytes de control en
`/configuracion/clientes`, la pantalla mostrara el mensaje del validador:

```
esperado: "El nombre contiene caracteres no permitidos"   (CONTROL_CHARACTERS_MESSAGE)
real:     "Datos del cliente inválidos"                   (CLIENTES_API_ERRORS.cuerpoInvalido)
```

El `qa` rechazó el feature por esto, en su segundo ciclo de tres. **Y el código estaba bien**: la
respuesta era `400`, el cliente no se creaba, y los dos mensajes no se mezclaban. Lo único
equivocado era el criterio.

## Causa raíz

El criterio citaba el `message` de un `.refine()` de Zod **como si fuera el mensaje HTTP**. Entre
uno y otro hay una ruta, y esa ruta lo colapsa a propósito:

```ts
const parsed = createClienteSchema.safeParse(body);
if (!parsed.success) {
  // The Zod issues are NOT echoed: they quote the value that failed (E-031).
  return NextResponse.json({ error: CLIENTES_API_ERRORS.cuerpoInvalido }, { status: 400 });
}
```

No es un descuido de la ruta: es una defensa deliberada y **correcta** contra
[E-031](E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) —los `issues` de Zod **citan el
valor que falló**, así que devolverlos pondría la propia secuencia de control en la respuesta y en
los logs—. La ruta es de un feature anterior y el feature que escribió el criterio no la tocaba.

El contrato de **arquitectura** sí era preciso: pedía verificar `issue.message` sobre el resultado
de `safeParse` **directamente**, a nivel de esquema, y esa prueba existía y pasaba. El contrato de
**diseño** dio el salto de suponer que ese mismo texto llega hasta el navegador.

## Solución

Corregir el criterio al texto que la ruta devuelve de verdad, y desglosarlo en las tres
afirmaciones que de verdad importan: **400**, **el cliente no se crea**, y **el texto no es el copy
del otro camino** —el aislamiento entre los dos mensajes, que es lo que el criterio protegía—.

Con una advertencia escrita dentro del propio criterio: **nadie debe hacer coincidir el texto
devolviendo los `issues` de Zod desde la ruta.** Eso reintroduce E-031 por la puerta grande, y sería
«arreglar» el código para satisfacer un criterio mal escrito.

## Cómo evitarlo

Es pariente de
[E-016](E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md), pero el mecanismo es
distinto y por eso va aparte: **allí el texto estaba mal; aquí el texto está bien y el nivel de la
pila está mal.**

Regla accionable, antes de citar un mensaje de validación en un criterio de navegador:

1. **Abre el handler HTTP y mira qué devuelve de verdad.** Un `.refine()`, un `superRefine`, un
   `z.enum` — todos traen `message`, y ninguno garantiza que ese `message` cruce la frontera HTTP.
2. Si lo que quieres verificar **es** el mensaje del esquema, el criterio pertenece al nivel del
   esquema: un test sobre `safeParse`, no una aserción en el DOM.
3. Si lo que quieres verificar es lo que ve el usuario, cita el copy de la **capa que lo pinta**.

Y una razón de fondo para desconfiar por defecto: colapsar los errores de validación a un mensaje
genérico **es lo correcto** en cualquier ruta que valide texto libre. Cuanto mejor escrita esté la
ruta, menos probable es que el mensaje del esquema llegue a la pantalla.
