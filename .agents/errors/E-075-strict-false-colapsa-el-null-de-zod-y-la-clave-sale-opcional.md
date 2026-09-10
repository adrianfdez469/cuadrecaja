# E-075: `strict: false` colapsa el `| null` de zod y la clave sale **opcional**

**Área:** build
**Apariciones:** 1 — F-035 (paso 5, `IVentaCreditoEstadoInput.settledAt`)

## Síntoma

Un tipo derivado con `z.infer` de un schema que declara `z.coerce.date().nullable()` no satisface
la firma que el contrato declaraba como **requerida**, y **ninguno de los cinco llamadores
compila**:

```
TS2345: Argument of type '{ ...; settledAt?: Date; }' is not assignable to parameter of type
'IVentaCreditoEstadoInput'.
  Property 'settledAt' is optional in type '{ ...; settledAt?: Date; }' but required in type
  'IVentaCreditoEstadoInput'.
```

El mensaje señala **«optional in type … but required in type …»**, que se lee como «pon la clave» o
«hazla requerida en el schema». Ninguna de las dos es la causa, y las dos llevan a pelearse con el
schema durante un rato.

## Causa raíz

`strict: false` en `tsconfig.json`. Con el interruptor apagado, `z.coerce.date().nullable()`
**dentro de un objeto** se infiere como **`settledAt?: Date`**: la clave se vuelve opcional **y el
`| null` desaparece**, colapsado. Con `strict: true` la misma expresión da `settledAt: Date | null`
y las dos formas —requerida y opcional— compilan.

O sea: el schema está bien escrito, el contrato está bien escrito, y la firma que el contrato pide
**no es expresable** en este repo mientras `strict` esté en `false`.

Comprobado **compilando una sonda** con el `tsc` del propio repo, no razonado desde la
documentación de zod. Es la única forma de verlo: los dos tipos se imprimen distintos según el
interruptor.

Comparte interruptor con [[E-036]] —`strict: false` rompe el estrechamiento por booleano— y es la
segunda forma en que ese mismo `false` produce un error de tipos cuyo mensaje no lo menciona. Si
aparece una tercera, las tres se resumen juntas.

## Solución

Declarar la clave **opcional** en el tipo de entrada, y comparar con **`!= null`**:

```ts
settledAt?: Date | string | null;
// …
const isOpen = settledAt != null;
```

`!= null` cubre **las tres** formas alcanzables —`null`, `undefined` y la clave ausente— porque la
desigualdad débil iguala `null` y `undefined`. Un `=== null` cubre solo la primera y pasa los tests
que solo siembran `null`.

En F-035 esto quedó como **consecuencia vinculante para todo el epic** (§ 0.6 (d) del contrato) y
con enmienda en el ADR 0127, precisamente para que el siguiente feature no vuelva a tropezar.

## Cómo evitarlo

**Con `strict: false`, no declares requerida en un contrato una clave que un `.nullable()` de zod
vaya a alimentar.** Y no deduzcas la forma inferida leyendo el schema: **compílala**. Una sonda de
tres líneas con el `tsc` del repo resuelve en un minuto lo que el `TS2345` no dice.

Corolario para los tests: si el contrato admite `null`, `undefined` y la clave ausente, hay que
sembrar **las tres por separado**. Un solo caso con `null` deja pasar un `=== null` (es [[E-008]]:
pregúntate con qué datos habría fallado).
