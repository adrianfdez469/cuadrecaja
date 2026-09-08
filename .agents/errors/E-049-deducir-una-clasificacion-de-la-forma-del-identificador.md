# E-049: Deducir una clasificación de la forma del identificador

**Área:** api
**Apariciones:** 1 — F-026

## Síntoma

Ninguno. **Ese es el problema.** No hay mensaje de error que copiar aquí, no hay excepción, no hay
test en rojo y el código se lee correcto:

```ts
function isMunicipality(zoneCode: string): boolean {
  return zoneCode.length === MUNICIPALITY_CODE_LENGTH; // 4
}
```

El comportamiento observable habría sido: **una zona de entrega cobra la tarifa de una provincia que
el comerciante nunca le asignó**, indefinidamente y sin ninguna traza. El comprador paga un precio
que nadie fijó, la pantalla del encargado enseña ese precio como si fuera suyo, y los dos lados de la
integración coinciden en el importe equivocado.

No lo encontró una revisión ni un test. Lo encontró que **el otro equipo tomó una decisión sobre su
propio artefacto** —que el nivel de cada zona fuera un campo explícito y no una convención— y al
leerla hubo que ir a mirar si aquí se estaba haciendo lo contrario. Se estaba.

## Causa raíz

Los códigos DPA/ONEI de Cuba tienen una estructura regular: la provincia son 2 dígitos y el
municipio 4, de los cuales los 2 primeros son su provincia. Es cierto para 183 filas de 184, así que
la regla implícita «longitud 4 = municipio» parece una propiedad del dominio y no una suposición.

No lo es. **La Isla de la Juventud es un municipio especial situado al nivel de una provincia**, y su
código es la excepción que la regla no contempla. Y la excepción no falla ruidosamente: si a una zona
de primer nivel le corresponde un código de 4 dígitos cuyos 2 primeros coinciden con una provincia
real, la función construye una escalera de herencia hacia una provincia con la que esa zona no tiene
ninguna relación, **encuentra una fila de tarifario ahí, y la aplica**. Todo el camino es válido:
hay fila, hay importe, la resolución devuelve un resultado bien formado.

El fallo de fondo es más general que este caso, y por eso vale la pena la ficha: **se estaba usando
la forma de un identificador como si fuera un dato**. La longitud del código no es la clasificación
de la zona; es una correlación con ella que el emisor del código nunca prometió mantener.

## Solución

La jerarquía deja de deducirse y pasa a leerse del catálogo compartido, que declara el nivel de cada
zona y cuál es su zona padre:

```ts
export interface ZoneCatalogEntry {
  level: 1 | 2;
  /** La zona de encima. Ausente en las de primer nivel, que no heredan de nada. */
  parentCode?: string;
}

function ladderFor(zoneCode: string, catalog?: ZoneCatalog): string[] {
  const entry = catalog?.get(zoneCode);
  const parent = entry ? entry.parentCode : fallbackParentOf(zoneCode);
  return parent ? [zoneCode, parent] : [zoneCode];
}
```

La regla del prefijo **sobrevive, pero degradada a comportamiento de arranque** y documentada como
tal: el artefacto compartido todavía no existe, y hasta que exista hace falta algo. Lo que cambia es
que ya no es la verdad, es el respaldo — y está escrito en el código que muere cuando llegue el
catálogo.

Dos casos en `src/__tests__/zoneTariffPrecedence.test.ts` prueban **las dos direcciones**: con
catálogo la zona de primer nivel no hereda, con la regla de arranque sí. La diferencia queda en el
test y no en un comentario.

Ver [ADR 0091](../../docs/adr/0091-la-lista-de-monedas-es-una-entidad-de-negocio-y-el-tarifario-de-zonas-una-fila-con-un-discriminante.md) § 4.

## Cómo evitarlo

**Si el sistema que emite un identificador no promete que su forma codifique una clasificación, no la
deduzcas de su forma: pídela como dato.** Longitud, prefijo, número de segmentos, si empieza por
letra — todo eso es una correlación observada en los datos que hay hoy, no un contrato.

Las tres señales de que estás a punto de hacerlo:

- La regla se cumple en **casi todas** las filas, y la excepción tiene nombre propio (un «caso
  especial», un «municipio especial», un «cliente histórico»).
- La deducción se escribe en una función de una línea que parece tan obvia que nadie la revisa.
- Cuando la excepción entra, **no da error**: encuentra otro camino válido y devuelve un resultado
  bien formado.

**Dónde NO aplica, para que la ficha no se use para lo contrario** (aportación del equipo de
queandabuscando): **validar que un identificador está bien formado no es clasificarlo.** Comprobar
que un GTIN tiene 13 dígitos, que un UUID tiene su forma o que un código de moneda tiene 3
caracteres es una guarda de validez perfectamente legítima, y este repositorio la usa a propósito —el
criterio 4 de F-027 filtra `displayCurrencies` por la forma del código—. La diferencia es qué se
concluye: «esto tiene forma de X» es válido; «esto **es** un X **de tipo** Y, porque mide N» es la
deducción que esta ficha prohíbe.

Y la lección de cómo apareció, que es la parte reutilizable: **este fallo no lo encuentra leer el
propio código.** Los dos lados de la integración habían escrito la misma regla implícita —uno en
código, otro a punto de dejarla como convención del formato— y ninguno la habría visto revisando lo
suyo. Lo que la destapó fue **una implementación independiente del mismo acuerdo**. Cuando algo se
implementa en dos sitios por contrato, el cruce no es burocracia: es el único lector que no comparte
tus suposiciones. Hermano de [E-013](E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md)
y de [E-014](E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md): los tres son la misma
familia —un dato que se cree leído y en realidad está siendo inferido.
