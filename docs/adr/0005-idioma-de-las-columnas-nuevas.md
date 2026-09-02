# ADR 0005: Idioma de las columnas nuevas — inglés por defecto, español donde el nombre ya está publicado

**Estado:** aceptado
**Fecha:** 2026-09-01
**Feature:** F-001

## Contexto

`AGENTS.md` es tajante: **todo el código nuevo se escribe en inglés**, identificadores incluidos, y
los nombres en español que ya existen (`Producto`, `ProductoTienda`, `verificarPermisoUsuario`) se
mantienen donde están pero no se replican.

F-001 crea 22 columnas sobre cuatro tablas existentes y tres tablas nuevas, y esa regla choca con
otras dos fuentes que también fijan nombres:

1. **El contrato de queandabuscando publica SQL ejecutable contra nombres concretos.** El SQL espejo
   de la reconciliación nombra `pt."precio"`, `pt."monedaPrecioCode"`, `pt."dispPublicada"` y
   `p."publicarEnTienda"`; la expresión del índice parcial nombra `existencia`, `"umbralBajo"` y
   `"dispPublicada"`; la consulta de drenado del outbox nombra `"procesadoAt"` e `intentos`. Esos
   nombres **no son una propuesta de diseño**: son texto que se copia y se ejecuta, y dos criterios
   de aceptación consisten en ejecutarlo.
2. **El humano fijó los nombres de las columnas de las tablas existentes** en las `notes` del
   feature, en español: `tiendaOnlineHabilitada`, `publicarEnTienda`, `motivoDespublicacion`, las
   trece de `Tienda`.
3. **El propio contrato razona sobre el idioma del cable**: «los nombres van en inglés aunque el
   schema del POS esté en español, para que ninguno de los dos lados traduzca al leer».

Aplicar la regla de `AGENTS.md` sin más produciría un `ProductoTienda.publishedAvailability` contra
el que el SQL del contrato no corre. Renunciar a ella produciría tres tablas nuevas enteras en
español, que es justo lo que la regla existe para evitar.

## Decisión

**El nombre lo pone quien publica texto ejecutable contra él. En todo lo demás, inglés.**

En concreto:

| Ámbito | Idioma | Por qué |
|---|---|---|
| Columnas nuevas sobre `Negocio`, `Producto`, `ProductoTienda`, `Tienda` | **Español**, tal como los fijan las `notes` y el contrato | El SQL espejo y la expresión del índice se ejecutan contra ellos (criterios 3, 4, 5 y 8), y las tablas ya son de nomenclatura española. |
| Columnas de `OutboxEvento` | **Español** (`entidad`, `entidadId`, `operacion`, `ocurridoAt`, `intentos`, `procesadoAt`) | El contrato publica la consulta de drenado —`WHERE "procesadoAt" IS NULL AND intentos < 6 … FOR UPDATE SKIP LOCKED`— y F-002 la va a copiar. Cuatro de sus columnas quedan fijadas por ahí; mezclar idiomas **dentro de un mismo modelo** es peor que elegir uno. |
| **Valores** guardados en `OutboxEvento.entidad` y `.operacion` | **Inglés, los del cable** (`"PRODUCT"`, `"UPDATE"`) | El fragmento TypeScript del contrato escribe `entidad: "PRODUCTO"`, pero es ilustrativo; la lista normativa de `entity` está en inglés. Guardar el valor del cable es lo que permite serializar sin traducir. |
| Columnas de `PedidoEntrante` y `PedidoEntranteLinea` | **Inglés**, las del cable (`code`, `status`, `currencyCode`, `subtotal`, `deliveryFeePending`, `unitPrice`, `lineTotal`…) | Nadie publica SQL contra ellas, y son un espejo casi exacto del cable, que es inglés. Traducirlas metería un diccionario entre el cable y la base sin comprar nada. |
| `negocioId`, `tiendaId`, `pedidoId` en las tablas nuevas | **Español** | Son las claves de tenencia del sistema. Todo el filtrado multi-tenant del repositorio se escribe `where: { negocioId }`; un `businessId` haría que la consulta más crítica del sistema **no se pareciera** a las demás, que es como se cuelan los descuidos. |
| Todo lo demás — `src/schemas/`, `src/constants/`, funciones, tipos, comentarios, JSDoc | **Inglés**, sin excepción | `AGENTS.md`. |

Los nombres de los tres modelos nuevos (`OutboxEvento`, `PedidoEntrante`, `PedidoEntranteLinea`)
están fijados por el spec y el backlog, y no se renombran.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Todo en inglés, sin excepciones | El SQL espejo y la expresión del índice del contrato dejarían de correr, y con ellos cuatro criterios de aceptación. Y el contrato es el documento vinculante: reescribirlo no es una opción nuestra. |
| Todo en español, por coherencia con el schema existente | Contradice frontalmente `AGENTS.md` para tres tablas enteras que nadie obliga a nombrar así. |
| Español en la base e inglés en el código, con una capa de traducción de nombres | Es exactamente lo que el contrato desaconseja («para que ninguno de los dos lados traduzca al leer»): un diccionario más que mantener, y un sitio más donde equivocarse en silencio. |
| `@map` de Prisma para tener campos en inglés sobre columnas en español | El SQL del contrato se ejecuta a mano contra la base, así que las columnas seguirían en español; y quien leyera el schema en inglés no reconocería el SQL que tiene que ejecutar. Añade indirección sin quitar el bilingüismo. |

## Consecuencias

**A favor:**
- El SQL del contrato se copia y se ejecuta sin editar nada, hoy y en las versiones que vengan.
- Las tablas nuevas de pedidos son un espejo legible del cable: quien compare el `payload` con la
  fila ve los mismos nombres.
- El filtrado por `negocioId` se escribe igual en toda la integración que en el resto del repo.

**En contra / coste asumido:**
- El esquema queda bilingüe, y de forma **no uniforme**: `OutboxEvento` en español,
  `PedidoEntrante` en inglés. Sin este ADR, alguien lo leerá como un descuido y lo «arreglará»,
  rompiendo el SQL de F-002. Ese es el motivo principal de que este ADR exista.
- Hay que sostener la distinción entre el **nombre** de la columna `entidad` (español) y su
  **valor** `"PRODUCT"` (inglés). Es rara de leer la primera vez.

**Impacto en seguridad y escalabilidad:**
- Mantener `negocioId` como nombre de la clave de tenencia es una decisión de seguridad, no de
  estilo: hace que toda consulta multi-tenant tenga la misma forma y que una que no filtre destaque
  a simple vista, en una revisión o en un `grep`.
- Sin impacto en rendimiento.
