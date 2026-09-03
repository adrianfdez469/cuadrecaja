# ADR 0025: `negocioQabSettingsSchema` pasa a `.strict()`, pero lo que cumple el criterio 16 es una aserción de claves

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-003
**Se apoya en:** [ADR 0019](0019-select-explicito-y-403-en-las-rutas-de-negocio.md) ·
[ADR 0024](0024-derivar-qabtokenconfigurado-sin-leer-el-token.md)

## Contexto

El criterio 16 dice: *"Un test cubre que `negocioQabSettingsSchema` no admite ningún campo derivado
del token más allá del booleano y la fecha: **añadir uno hace fallar el test**."*

El spec dejó abierto si eso se resuelve poniendo el schema en `.strict()` o de otra forma. La
respuesta corta es que **`.strict()` no cumple ese criterio**, y conviene ver por qué antes de
decidir, porque es el error natural.

`.strict()` controla las claves de **la entrada** que se parsea: con él, `parse({...base,
qabToken: "x"})` lanza en vez de descartar la clave en silencio. Pero el criterio habla de otra
cosa: de que **el schema crezca**. Si alguien mañana escribe

```ts
export const negocioQabSettingsSchema = z.object({
  tiendaOnlineHabilitada: z.boolean(),
  qabTokenConfigurado: z.boolean(),
  qabTokenActualizadoAt: z.date().nullable(),
  qabTokenUltimos4: z.string(),          // ← el campo derogado, de vuelta
}).strict();
```

el `.strict()` lo acepta encantado, y **los cinco tests que hoy existen siguen en verde**. El
mecanismo que hace fallar un test cuando el schema gana un campo es otro: una aserción sobre el
**conjunto de claves** del propio schema.

Hay además una razón independiente para plantearse `.strict()`, que viene del repositorio y no del
criterio: `negocioAdminViewSchema` ya es `.strict()` desde el ADR 0019, precisamente por ser el
schema de una respuesta que no puede publicar columnas de más.

Y un coste concreto: los tests de F-001 en `src/__tests__/qabNegocio.test.ts` pasan hoy un objeto
**con** `qabToken` y esperan que `parse` funcione y lo descarte. Con `.strict()` esos dos casos
fallan.

## Decisión

**Las dos cosas, y cada una por su motivo.**

1. **`negocioQabSettingsSchema` pasa a `.strict()`**, y también sus derivados
   (`negocioQabSettingsItemSchema`, los cuerpos de petición, las respuestas de las cuatro rutas).
   Motivo: alinear con el precedente del ADR 0019 y convertir un `...negocio` accidental en un
   fallo ruidoso en desarrollo y en los tests, en vez de un descarte silencioso que nadie ve. En
   este feature el descarte silencioso es *seguro* —el token no sale— pero también es la clase de
   cosa que enmascara un error de programación durante meses.

2. **Lo que cumple el criterio 16 es una aserción de conjunto de claves, con la lista escrita a
   mano en el archivo de test:**

   ```ts
   // src/__tests__/qabNegocio.test.ts
   it("no admite ningún campo más allá del booleano y la fecha", () => {
     expect(Object.keys(negocioQabSettingsSchema.shape).sort()).toEqual(
       ["qabTokenActualizadoAt", "qabTokenConfigurado", "tiendaOnlineHabilitada"].sort(),
     );
   });
   ```

   **La lista literal no se importa de ninguna constante compartida.** Es la parte deliberada de la
   decisión: si el test comparara contra un `NEGOCIO_QAB_SETTINGS_KEYS` exportado, quien añadiera un
   campo al schema lo añadiría también a la constante en el mismo commit y el test seguiría verde.
   Una lista duplicada a mano es, aquí, la característica: obliga a **editar el test** —un acto
   deliberado, visible en el diff y en la revisión— para poder ampliar la superficie de lectura del
   token.

   La misma aserción se repite sobre `negocioQabSettingsItemSchema`, cuyas claves deben ser esas
   tres más `negocioId`.

3. **`dev-tester` actualiza los dos casos de F-001** que hoy esperan que `parse` descarte
   `qabToken`: pasan a esperar que lance (`safeParse(...).success === false`). Está dentro de su
   frontera de escritura y queda dicho aquí para que no lo interprete como una regresión de la
   implementación.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Solo `.strict()` | No cumple el criterio: añadir un campo **al schema** deja todos los tests en verde. Es la respuesta que parece correcta y no lo es |
| Solo la aserción de claves, sin `.strict()` | Cumple el criterio, pero deja el schema desalineado con `negocioAdminViewSchema` (ADR 0019) y mantiene el descarte silencioso de un spread accidental |
| Aserción contra una constante exportada (`NEGOCIO_QAB_SETTINGS_KEYS`) | Añadir el campo al schema y a la constante deja el test verde: se protege la coherencia entre dos archivos, no la invariante que importa |
| Una prueba de tipos (`Expect<Equal<keyof INegocioQabSettings, ...>>`) | Falla en compilación, no en la suite, y `npx tsc --noEmit` no es lo que ejecuta `qa` para este criterio. Cabe como refuerzo, no como el mecanismo |
| Un test que haga `grep` de `qabToken` sobre `src/schemas/` | Cubre la invariante escrita en el comentario del archivo, pero no el criterio: `qabTokenUltimos4` contiene la subcadena y pasaría, o —según cómo se escriba— cualquier mención en un comentario lo rompería |
| `z.strictObject()` en vez de `.strict()` | Equivalente en Zod 4, pero el repositorio ya usa `.strict()` en `negocioAdminViewSchema`. Una sola forma en el repositorio vale más que la más moderna |

## Consecuencias

**A favor:**
- El criterio 16 tiene un mecanismo que de verdad falla cuando debe, y se puede comprobar
  invirtiéndolo: añadir un cuarto campo al schema y ver la suite en rojo.
- Una respuesta con un campo de más deja de colarse en silencio, en las cuatro rutas.
- El schema del bloque QAB queda escrito igual que el del bloque de administración (ADR 0019): una
  sola convención para los schemas de respuesta.

**En contra / coste asumido:**
- Dos tests existentes de F-001 cambian de expectativa. Es ruido en el diff que hay que saber leer:
  no es que la protección se debilite, es que pasa de descartar a rechazar.
- La lista de claves está duplicada (schema y test). Duplicación **deliberada**, contraria a la
  regla general de `AGENTS.md`, y este ADR es su justificación: sin la duplicación el test no
  protege nada.
- `.strict()` convierte en error un caso que antes era seguro. Si alguna ruta le pasara la fila de
  Prisma entera al schema, ahora responde 500. Es el fallo ruidoso que se busca, pero hay que
  saberlo: por eso la forma del cable se construye con `toNegocioQabSettings` (ADR 0024) y nunca
  con un spread.

**Impacto en seguridad y escalabilidad:**
- La superficie de lectura del token queda congelada en tres campos, y ampliarla exige tocar un
  archivo de test cuyo nombre lo delata. Es una barrera de proceso, no técnica — y es exactamente
  lo que el criterio pide.
- Sin impacto en consultas ni en coste: es validación en memoria de objetos de tres claves.
- Reversión: quitar `.strict()` y una aserción. Nada persistido.
