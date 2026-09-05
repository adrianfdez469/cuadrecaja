# ADR 0055: El tope de respuesta del pull se computa desde el tamaño de página, y tiene escalera de reintento

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-010

## Contexto

`readBoundedBody` acota los bytes que un cliente de QAB materializa en memoria. Su valor por defecto
es `QAB_HTTP_MAX_RESPONSE_BYTES = 100_000`, el tope del cliente de catálogo.

Reutilizar ese número aquí sería repetir literalmente [E-029]. Allí se fijó un tamaño de página de
2000 items bajo un tope de 100 000 bytes sin comprobar que la confirmación completa de una página
cupiera dentro: a partir de 1250 items la respuesta se rechazaba siempre, y como el orden de la
consulta era determinista, **la corrida siguiente reintentaba la misma página con el mismo
resultado**. No un reintento con éxito eventual: estancamiento permanente.

Aquí el riesgo es mayor, porque el peor caso es mucho más grande y mucho menos predecible. Una página
del pull son 100 pedidos, y **un** pedido lleva contacto, notas, `rateSnapshot`, hasta siete importes
de propuesta y una lista de líneas sin tope declarado por el contrato. Una página de 100 pedidos
gordos son megabytes; el mismo endpoint con 100 pedidos de una línea son unas decenas de kilobytes.
El rango entre el caso típico y el peor caso es de dos órdenes de magnitud.

Y hay una diferencia con F-007 que cambia la solución: **allí el tamaño de la respuesta lo
determinábamos nosotros** (la confirmación de la página que acabábamos de enviar), así que bastaba
computar el tope desde el tamaño de página. Aquí no: el tamaño de la respuesta lo determinan los
pedidos que haya, que son datos de terceros.

## Decisión

**El tope se computa desde el `limit` pedido, con un suelo que cubre un pedido del peor caso; y ante
un `RESPONSE_TOO_LARGE` el pull baja de escalón en una escalera de tamaños de página, sobre el mismo
`since`.**

### El tope, computado

```ts
export function qabOrderPullMaxResponseBytes(limit: number): number {
  return (
    QAB_ORDER_PULL_RESPONSE_ENVELOPE_MAX_BYTES +
    Math.max(QAB_ORDER_MAX_BYTES, limit * QAB_ORDER_TYPICAL_MAX_BYTES)
  );
}
```

Dos presupuestos y no uno, porque miden cosas distintas:

- **`QAB_ORDER_TYPICAL_MAX_BYTES` (16 KB)** es lo que dimensiona una página: un pedido holgado —dos
  docenas de líneas, contacto completo, `rateSnapshot`— con margen. Multiplicado por el `limit`, da
  el tope de una página normal.
- **`QAB_ORDER_MAX_BYTES` es el peor caso de UN pedido**, y no se elige: se **deriva** de los topes
  que este contrato ya impone al parsear
  (`QAB_ORDER_ENVELOPE_MAX_BYTES + QAB_ORDER_MAX_LINES * QAB_ORDER_LINE_MAX_BYTES`). Entra como
  **suelo** del tope, de modo que un pedido que cumple nuestros propios topes **siempre cabe**, aunque
  se pida de uno en uno. Sin ese suelo, bajar el `limit` para escapar de un `tooLarge` reduciría el
  tope por debajo del tamaño del pedido que causó el problema, y el escape no escaparía de nada.

Con los valores fijados en el contrato: `qabOrderPullMaxResponseBytes(100) ≈ 1,56 MB`, `(10) ≈ 161 KB`
y `(1) ≈ 121 KB`, este último por encima de `QAB_ORDER_MAX_BYTES`. **`QAB_HTTP_MAX_RESPONSE_BYTES` no
se usa en este camino** y se queda donde está, sirviendo a los clientes de catálogo y de
aprovisionamiento.

### La escalera

`QAB_ORDER_PULL_PAGE_SIZE_LADDER = [100, 10, 1]`.

Un `tooLarge` **no** es el final del negocio: el pull repite la petición con el **mismo `since`** y
el escalón siguiente. Cada intento cuenta como una página contra
`QAB_ORDER_PULL_MAX_PAGES_PER_RUN` y contra el presupuesto de tiempo (ADR 0054), así que la escalera
no puede alargar una corrida.

La escalera solo se recorre ante `tooLarge`. Cualquier otro error —transporte, estado inesperado,
cuerpo que no valida— termina el negocio con `outcome: "error"`, sin bajar de escalón: reducir la
página no arregla un 401.

Y cuando el escalón deja de ser 100, **no vuelve a subir dentro de la misma corrida**: las páginas
que queden se piden con el escalón al que se bajó. La corrida siguiente empieza otra vez por 100,
porque nada garantiza que la página siguiente sea igual de grande.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reutilizar `QAB_HTTP_MAX_RESPONSE_BYTES = 100_000` | Es literalmente [E-029]. Una página de 100 pedidos con líneas lo rebasa con facilidad, y el orden del pull es determinista: el mismo `since` produciría el mismo rechazo para siempre |
| Un tope fijo grande, elegido a ojo | Un número fijo bajo un tamaño de página fijo sigue descansando sobre una suposición no escrita sobre lo que ocupa un pedido, que es el mecanismo exacto del defecto anterior. Y no da ninguna salida cuando muerde |
| Bajar `QAB_ORDER_PULL_PAGE_SIZE` a 25 y no tener escalera | Cabría casi siempre, pero cuadruplica los viajes en el caso normal para cubrir un caso raro, contradice el `limit=100` del alcance del spec, y **sigue sin tener salida** el día que un solo pedido no quepa |
| Sin suelo: `envelope + limit * TYPICAL` a secas | El escape sería falso. Con `limit=1` el tope bajaría a ~17 KB, por debajo del peor caso de un pedido: bajar de escalón empeoraría la situación en vez de arreglarla |
| Un tope por pedido en vez de por respuesta | `readBoundedBody` acota el flujo antes de parsear; no hay ningún punto donde se pueda medir «un pedido» sin haber leído ya la respuesta entera |

## Consecuencias

**A favor:**

- El tope y el tamaño de página no se pueden volver a fijar por separado: uno se calcula del otro.
- Un `tooLarge` deja de ser terminal. La escalera lo convierte en un reintento con éxito probable
  dentro de la **misma** corrida.
- El suelo hace que la escalera signifique algo: al llegar al escalón 1, un pedido que respeta
  nuestros propios topes cabe **por construcción**.
- `QAB_HTTP_MAX_RESPONSE_BYTES` deja de ser un número compartido por clientes con respuestas de
  naturalezas distintas.

**En contra / coste asumido:**

- **Queda un estancamiento residual, y es honesto decirlo:** si un solo pedido supera
  `QAB_ORDER_MAX_BYTES`, en el escalón 1 la respuesta sigue sin caber. No podemos leer su `id`, así
  que el cursor no puede avanzar por encima de él (ADR 0053 avanza sobre lo *recibido*, y aquí no se
  recibe nada), y ese negocio se estanca. Es **visible** —`outcome: "error"` en cada corrida, con su
  contador de páginas— y tiene salida: las lecturas laterales de F-017, o subir el cursor a mano. Se
  acepta porque el pedido que lo provoca viola topes fijados muy por encima de cualquier pedido real,
  y porque converger en silencio a partir de un cuerpo que sabemos que no cabe sería peor.
- Un tope de ~1,56 MB significa que una respuesta hostil puede hacernos materializar 1,5 MB antes de
  cortarla. Es el precio de que una página legítima de 100 pedidos quepa; el corte sigue existiendo, y
  sin él el límite sería la memoria de la función.
- Tres escalones son tres constantes más que mantener coherentes. Se pagan con la aserción ejecutable
  de más abajo.

**Impacto en seguridad y escalabilidad:**

- El cuerpo que un tercero puede hacernos leer sigue acotado, y ahora el número está justificado en
  vez de heredado.
- Los topes de los que se deriva `QAB_ORDER_MAX_BYTES` son los mismos que se aplican al parsear, así
  que el presupuesto de memoria y la validación no pueden desincronizarse.

## Cómo se comprueba que esto no se desincroniza

La lección de [E-029] es que la aserción que relaciona dos constantes derivadas de las mismas dos
constantes es **tautológica** y no protege nada. Aquí se exigen tres comprobaciones, y la segunda es
la que importa:

1. `qabOrderPullMaxResponseBytes(1) >= QAB_ORDER_MAX_BYTES`. Se cumple por construcción, por el
   `Math.max`. Se queda por si alguien reescribe la aritmética, y **no** hay que leerla como la que
   protege el supuesto vivo.
2. **Un pedido del peor caso, serializado de verdad.** Construir un pedido con
   `QAB_ORDER_MAX_LINES` líneas, cada `name` a `QAB_ORDER_LINE_NAME_MAX_LENGTH`, `notes` y
   `proposal.message` a `QAB_ORDER_TEXT_MAX_LENGTH`, los cuatro `contact*` a
   `QAB_ORDER_CONTACT_MAX_LENGTH` y un `rateSnapshot` de `QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES`;
   medir `Buffer.byteLength(JSON.stringify(order), "utf8")` y comprobar que es
   `<= QAB_ORDER_MAX_BYTES`. Es lo que ata el presupuesto a los topes reales, y lo que se rompe el
   día que alguien suba un tope de texto sin recalcular el presupuesto.
3. **Una página llena contra el cliente de verdad, y su negativo.** `global.fetch` sustituido por una
   respuesta de `QAB_ORDER_PULL_PAGE_SIZE` pedidos típicos: el resultado tiene que ser `kind: "ok"`,
   **no** un `TRANSPORT:RESPONSE_TOO_LARGE`. Y emparejado con su control ([E-008]): un cuerpo
   deliberadamente por encima del tope **sí** tiene que dar `TRANSPORT:RESPONSE_TOO_LARGE`, o el
   primer test pasaría igual con el límite desactivado.

[E-008]: ../../.agents/errors/E-008-datos-de-prueba-que-no-discriminan.md
[E-029]: ../../.agents/errors/E-029-un-tope-heredado-que-no-cabe-el-lote-propio.md
