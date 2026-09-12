# ADR 0132: La nota del crédito no reutiliza `note`, y los criterios se anclan en `data-testid`

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-036 (el crédito en el cierre y en el resumen de cierres)

## Contexto

Dos problemas distintos que se resuelven en el mismo sitio —la tarjeta de totales del cierre— y que
tienen la misma raíz: **un criterio congelado nombra algo que el código no llama así.**

**1. La prop `note`.** El criterio 7 exige que la tarjeta de totales no gane ninguna celda y que la
mención al crédito vaya «en la nota bajo "Ventas Netas"». El plan del epic decía reutilizar la prop
`note` que `Cell` ya acepta. Al leer el archivo, `note` no sirve para esto por dos razones:

- se pinta **con `textDecoration: "line-through"`** en las dos ramas (`CierreTotalsCard.tsx:88`
  y `:119`) — está hecha para el bruto que un descuento reemplazó, y una cifra de crédito tachada
  se lee como «este número fue reemplazado»;
- **ya está ocupada** en esa misma celda cuando hubo descuento (`:202-206`), así que un período con
  descuento y crédito tendría que elegir cuál de las dos notas pierde.

**2. El nombre de la celda.** Ninguna celda de `CierreTotalsCard` se llama «Ventas Netas»: la cifra
neta de descuento tiene `label: "Total Venta"` (`:199`). El criterio nombra el **concepto**. Si el
`qa` lo verifica buscando la cadena literal, rechaza código correcto; y si lo verifica buscando
`"Total Venta"` y el `ui-designer` decide más adelante renombrar la celda, el criterio vuelve a
fallar por el otro lado. Es E-016, con cinco apariciones en este repositorio, en sus dos
direcciones a la vez.

Y no es solo esta celda: cuatro de los doce criterios de F-036 son afirmaciones sobre el DOM —«la
tarjeta no aparece», «las dos columnas no están», «la nota está bajo esta celda», «el número de
celdas no cambia»— y todas son frágiles si se anclan en texto que el diseño puede cambiar.

## Decisión

**Se añade una prop nueva a `CellProps` para la nota que no se tacha, y las afirmaciones sobre el
DOM se anclan en `data-testid`, no en copy.**

- **`footnote?: string`**: texto secundario **debajo del valor** —el criterio dice «bajo», y `note`
  en escritorio se pinta encima—, sin `textDecoration`, sin signo y sin color de error. `note`
  conserva su significado actual (el bruto tachado) y sigue funcionando en el mismo período.
  **Ninguna celda nueva**, que es lo que el criterio 7 congela.
- La celda que la recibe es la de `label: "Total Venta"`, por concepto. **F-036 no la renombra**: si
  el humano o el `ui-designer` prefieren «Ventas Netas», es una decisión de copy del
  `ui-designer` y no cambia nada de este ADR ni el conteo de celdas.
- **Las anclas viven en una constante compartida**, `CREDIT_TEST_IDS`, en el mismo módulo puro que
  la lógica de la pantalla. El `qa` la lee de ahí y no transcribe cadenas: una `data-testid` que
  solo existe en el JSX y en el script de verificación es dos copias de la misma decisión.
- Los `data-testid` de este feature son ocho, y cada uno responde a un criterio: la raíz de la
  tarjeta de crédito (criterio 5, por ausencia), cada celda de la tarjeta de totales (criterio 7,
  por conteo), la nota (criterio 7, por contenido), las dos líneas por moneda (criterio 4), el
  aviso del diálogo (criterio 8) y las dos cifras del histórico (criterios 9 y 10).
- **El mismo `data-testid` se pone en las tres apariciones de cada cifra del histórico** —la celda
  de cabecera, la de cuerpo y el campo de la tarjeta móvil—, así que «no está en el DOM» se
  comprueba como «cero nodos» **a cualquier ancho**, sin depender de qué rama responsive esté
  montada ni del texto de la cabecera.
- El contenido de un texto que un criterio exija se compara contra **la misma función de copy que
  lo pinta** (`CREDIT_COPY`), nunca contra una transcripción.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reutilizar `note` tal cual | Pinta la cifra tachada, y colisiona con el bruto del descuento en la única celda donde hace falta |
| Quitarle el tachado a `note` y usarla para las dos cosas | Rompe el patrón bruto→final que `GananciaCard` y esta misma tarjeta ya usan, en una celda que no es de este feature. Y seguiría siendo una sola ranura para dos notas |
| Usar la prop `extra` (un `ReactNode` que ya existe y está libre en esa celda) | Funcionaría, pero mete la decisión de estilo en el llamador y deja el copy como JSX en vez de como texto: se pierde el `data-testid` estable y la comparación contra la función de copy |
| Añadir una sexta celda al array | Lo prohíbe el criterio 7, y con razón: las cifras de esa tarjeta son comparables entre sí como dinero de ventas, y una de crédito rompe esa escala |
| Renombrar la celda a «Ventas Netas» para que el criterio sea literal | Es copy, y el copy lo dicta el `ui-designer`. Decidirlo aquí sería invadir su contrato — y no hace falta, porque el ancla no es el nombre |
| Anclar los criterios en el texto visible | E-016, cinco apariciones. Aquí falla en las dos direcciones: la cadena del criterio no existe hoy, y la que sí existe puede cambiar mañana |

## Consecuencias

**A favor:**

- Los cuatro criterios de DOM de F-036 se vuelven verificables sin interpretar copy, y sobreviven a
  un cambio de palabras posterior.
- La nota de crédito y el bruto del descuento pueden coexistir en la misma celda, que es el caso
  real de un período con descuentos **y** ventas a crédito.
- El conteo de celdas del criterio 7 deja de depender de contar hijos de un `Box` con `display:
  grid` —que es E-011, medir el contenedor equivocado de MUI— y pasa a ser un `querySelectorAll`
  sobre las celdas mismas.

**En contra / coste asumido:**

- **Se estrena `data-testid` como convención en este repositorio.** Solo hay un precedente
  (`HardwareQrScanner.tsx:115`), así que esto es un patrón nuevo, con su coste: ocho atributos que
  no hacen nada en producción y que alguien puede borrar por «limpieza» sin que falle ningún test
  automático. Están todos declarados en `CREDIT_TEST_IDS` y referenciados desde el contrato de
  interfaces, que es la única defensa que tienen.
- `CellProps` gana un campo, y `Cell` una rama de render más en cada una de sus dos versiones.
- El criterio 7 se verifica por concepto y no por literal. Queda escrito en el contrato para que
  el `qa` no lea la divergencia con el texto del criterio como una desviación.

**Impacto en seguridad y escalabilidad:**

- Ninguno. Un `data-testid` no expone ningún dato que la página no pinte ya, y los atributos no
  añaden coste de render apreciable.
