# ADR 0045: F-006 no necesita migración: el `updatedAt` de las cuatro entidades se inyecta y la cadena vacía es la forma de borrar el color

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-006
**Se apoya en:** [ADR 0032](0032-el-payload-de-store-se-construye-entero-desde-la-fila-persistida.md) ·
contrato QAB v10.1, § ① «`payload` de `CATEGORY`» y «`payload` de `PRODUCT`»

## Contexto

El contrato exige dos datos que el schema de cuadrecaja **no tiene**, y ninguno de los dos es
opcional del lado receptor.

**1. `updatedAt`, la guarda anti-rancio.** Es obligatorio en las cuatro entidades de F-006. En
`CATEGORY` y `PRODUCT` además **se compara**: *«un evento con `updatedAt` menor o igual al guardado
no escribe nada y responde `stale`»*. Verificado en `prisma/schema.prisma`:

- `Categoria` no tiene `updatedAt` **ni `createdAt`**.
- `Producto` no tiene `updatedAt`.
- `ProductoTienda` no tiene `updatedAt`.

Es decir: las tres tablas de las que sale el `payload` de `CATEGORY` y de `PRODUCT` carecen del
instante que el contrato pide. `Tienda` sí lo tenía cuando F-005 resolvió lo mismo para `STORE`…
salvo que **tampoco**: F-005 no leyó ninguna columna, inyectó un parámetro `occurredAt: z.date()`
en el momento de la mutación (`qabStorePayloadInputSchema`, `saveTiendaOnlineLocal`).

**2. Un `color` que se pueda borrar.** El contrato de `CATEGORY`:

> `color` — Sin validar como color: se guarda tal cual. **Omitirlo borra la columna**, igual que
> enviar `null`.

Y el criterio 9 exige demostrarlo: *«editarla quitando el color … genera un segundo evento
`CATEGORY` cuyo `payload.color` es `null`»*. Pero `Categoria.color` es `String` **NOT NULL** en
Postgres, y `categoriaSchema` lo declara `z.string().min(1)`. Leyendo la fila **nunca** se puede
producir un `null`, así que el criterio 9, tal como está escrito, no es ejecutable sin decidir algo.

La restricción de alcance que enmarca las dos: el spec dice cuatro veces que este feature **no
necesita migración** («columna existente `Producto.publicarEnTienda`, ya en el schema desde F-001 —
no hace falta migración», «Ninguna migración nueva», «sin migración, la respuesta ya vive en
`OutboxEvento`»). Una migración cambia el plan de despliegue: hay que coordinarla, y arrastra el
E-002 (un `npm run dev` levantado antes de migrar sirve un cliente de Prisma viejo y da un falso
aprobado).

## Decisión

**F-006 no añade ninguna columna, ningún índice y ninguna migración. Los dos datos se derivan.**

### 1. El `updatedAt` de las cuatro entidades sale de un `occurredAt` inyectado

Se extiende a `CATEGORY`, `PRODUCT`, `CURRENCY` y `EXCHANGE_RATE` el patrón que F-005 ya fijó para
`STORE`: los cuatro `*PayloadInputSchema` declaran `occurredAt: z.date()`, el constructor escribe
`updatedAt: input.occurredAt.toISOString()`, y **ese mismo instante** se pasa como
`OutboxEvento.ocurridoAt`. Un solo `new Date()` por transacción, compartido por toda la emisión.

Por qué es correcto y no un apaño:

- **El instante que la guarda anti-rancio necesita es el de la emisión, no el de la última
  edición.** El `payload` se construye entero desde la fila **ya persistida** (ADR 0032), así que
  siempre lleva el estado actual. Un evento emitido más tarde lleva datos más nuevos, por
  definición.
- **Es monótono por construcción:** cada emisión de una misma entidad tiene un `occurredAt`
  estrictamente posterior al de la anterior, salvo dentro del mismo milisegundo.
- **No hay una segunda fuente de verdad que pueda desincronizarse**, que es exactamente el defecto
  que una columna `updatedAt` mantenida a mano introduciría.

### 2. El color se borra con la cadena vacía, y la columna sigue siendo `NOT NULL`

Un único puente, `toQabCategoryColor` (`src/schemas/qabCategory.ts`), y en ningún otro sitio:

```
"#1E88E5" -> "#1E88E5"      ""  -> null      "   " -> null      null/undefined -> null
```

La clave `color` **siempre viaja** en el `payload`, con `null` explícito cuando corresponde: como
omitirla borra igual, escribirla dice lo que se quiso decir.

Y la lectura ejecutable del criterio 9, fijada aquí para que el `qa` no invente otra (E-016,
E-018): **se ejecuta enviando `color: ""` en el `PUT` de la categoría.** Un `color` **ausente**
deja la columna como estaba —comportamiento de hoy, que este feature no cambia— así que la cadena
vacía es la forma de borrarlo. El `null` aparece en el `payload`, nunca en la columna.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Añadir `updatedAt DateTime @updatedAt` a `Categoria`, `Producto` y `ProductoTienda` | Tres columnas en tres tablas grandes, migración coordinada, y `@updatedAt` se mueve con **cualquier** escritura —incluida una venta que toca `ProductoTienda.existencia`—, así que emitiría eventos «nuevos» con datos idénticos. Resuelve peor lo que el `occurredAt` ya resuelve |
| Añadir solo `updatedAt` a `Categoria` (la única sin ninguna marca de tiempo) | Deja `Producto`/`ProductoTienda` con el patrón inyectado igual, así que habría **dos** mecanismos para lo mismo. Peor que uno |
| Usar `OutboxEvento.ocurridoAt` como `updatedAt` leyéndolo tras insertar | Obliga a insertar antes de construir el `payload`, o a un segundo `update` de la fila del outbox. Rompe «el payload se construye entero y luego se encola» |
| Hacer `Categoria.color` nullable | Es la opción «limpia» y es la que se descarta a conciencia: exige migración —el spec dice que no la hay— y obliga a repasar **todos** los lectores de `Categoria.color` (la UI de categorías, el POS, los informes) para que aguanten un `null`. Cambia el plan de despliegue por un campo cosmético |
| Tratar un `color` **ausente** en el `PUT` como «borrar» | Cambia el comportamiento actual de una ruta existente: hoy un `PUT` sin `color` conserva el color. Un cliente que mande solo `nombre` perdería el color sin pedirlo |
| Enviar `"transparente"`, `"none"` o `"#00000000"` como «sin color» | El criterio 9 lo prohíbe literalmente («no `"transparente"`»), y el contrato dice que el color «se guarda tal cual»: cualquier centinela acabaría pintado en la tienda pública |
| Omitir la clave `color` cuando está en blanco, en vez de enviar `null` | Del otro lado hace lo mismo (borra), pero el criterio 9 verifica que `payload.color` **sea** `null`, y una clave ausente no lo es. Explícito y verificable gana |

## Consecuencias

**A favor:**

- **Ninguna migración.** El plan de despliegue de F-006 es «desplegar el código», y no hay ventana
  de E-002 (cliente de Prisma viejo sirviendo una columna que no existe).
- Un solo patrón de `updatedAt` para las cinco entidades del contrato, el que F-005 ya dejó escrito.
- El `payload` siempre lleva el estado actual de la fila, porque se construye desde ella.
- `Categoria.color` sigue siendo `NOT NULL`: ningún lector existente tiene que aprender a manejar
  un `null`.

**En contra / coste asumido:**

- **Dos emisiones de la misma entidad dentro del mismo milisegundo hacen que la segunda responda
  `stale`** y no se aplique. `stale` va en `ok`, así que no se reintenta: el cambio se pierde hasta
  el siguiente evento de esa entidad. No se afirma que sea imposible (E-017); se acepta, porque
  requiere dos escrituras de la misma fila en el mismo milisegundo.
- **Dos publicaciones concurrentes de dos productos de la misma categoría** pueden emitir dos
  eventos `CATEGORY` de arranque perezoso (las dos transacciones ven «no sincronizada»). Son
  idénticos salvo el `occurredAt`, así que el segundo se aplica o responde `stale`; en ninguno de
  los dos casos hay daño. Tampoco se afirma que sea imposible.
- **La cadena vacía es un valor legítimo en `Categoria.color`** a partir de aquí. La pantalla de
  categorías tiene que pintar «sin color» y no un cuadro negro; queda como restricción para el
  `ui-designer` y para quien toque esa pantalla.
- El `occurredAt` no dice cuándo se **editó** la entidad, sino cuándo se **emitió**. Nadie de este
  feature necesita la primera fecha; si algún día hiciera falta, sería una columna nueva y otro ADR.

**Impacto en seguridad y escalabilidad:**

- No se añade ninguna columna ni ningún índice: el coste de escritura de `Producto`,
  `ProductoTienda` y `Categoria` no cambia, y ninguna tabla crece.
- El `occurredAt` es un dato del servidor (`new Date()` dentro de la transacción), **nunca** un
  valor que llegue del cliente: un cliente no puede fabricar un evento «del futuro» que bloquee las
  actualizaciones posteriores de una fila del otro lado.
- `toQabCategoryColor` es puro y está cubierto por Vitest, así que la única traducción entre los
  dos modelos de nulabilidad tiene test propio.
