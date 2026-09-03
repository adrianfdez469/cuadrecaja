# ADR 0008: Un agente de diseño en el pipeline, que produce contrato y no código

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** transversal

## Contexto

El pipeline de [ADR 0001](0001-harness-de-agentes.md) tiene cinco roles y **ninguno diseña
pantallas**. Cuando un feature tenía UI, el `implementer` improvisaba el layout mientras escribía
el código: no existía un momento en el que alguien decidiera cómo se ve la pantalla en un teléfono
*antes* de que la pantalla existiera, ni por tanto nada contra lo que verificarla después.

Había dos consultores de UI —`ux-ui-designer` y `react-ui-architect`— pero ninguno estaba
enganchado al pipeline: la skill coordinadora no los nombraba ni una vez, y el único consultor con
disparador codificado era `security-guardian`. Las dos referencias cruzadas que existían se
contradecían entre sí: `spec.md` delegaba las decisiones de UI en `ux-ui-designer`, mientras
`specs/TEMPLATE.md` decía que eran del arquitecto. Ninguna de las dos se cumplía.

A esto se sumaba que `ux-ui-designer` estaba **desactualizado de hecho**: recomendaba los tokens
por defecto de MUI (`primary`, `secondary`, `error`…) cuando el repo tiene desde hace tiempo una
capa `theme.palette.semantic` con seis tintas y cinco familias de roles de dominio, y recomendaba
`Grid2`, que este repo casi no usa.

## Decisión

Un sexto rol, **`ui-designer`**, obligatorio cuando el feature añade o cambia una pantalla, un
formulario o un diálogo. Entra en el **paso 4b**, entre el contrato técnico del arquitecto y la
implementación.

- **Produce un contrato, no código.** Escribe `.agents/designs/F-###.md` y tiene prohibido
  `src/**` y `src/theme/**`.
- **Mobile-first literal:** el contrato describe cada pantalla a **320 → 768 → 1440 px**, en ese
  orden. Umbral canónico `down("sm")`; cualquier otro exige justificación escrita.
- **Lo verifica el `qa` en el navegador**, redimensionando y capturando a esos tres anchos. Sin
  capturas, los criterios de diseño no están verificados.
- **Se escribe la frontera entre los tres agentes de UI** en `AGENTS.md`, y se corrige
  `ux-ui-designer` para que describa el theme que el repo tiene de verdad y ceda el diseño de
  pantallas al agente nuevo.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Que el agente diseñe **y** escriba los componentes | Colisiona con `implementer` sobre `src/**` y rompe la frontera disjunta que permite lanzar implementación y tests en paralelo. Es justamente la garantía que sostiene el paso 5. |
| Reescribir `ux-ui-designer` en vez de añadir un agente | Su oficio real —el theme: tokens, contraste, dark mode, deuda de hex— es distinto del de diseñar las pantallas de un feature, y sigue haciendo falta. |
| Retirar los otros dos agentes de UI | `react-ui-architect` cubre estado, Zod, `react-hook-form` y rendimiento, que no se solapan con el diseño de pantallas. |
| Dejarlo opt-in, como los demás consultores | Es exactamente lo que ya había, y el resultado observable es que en todo el harness no se invocó nunca. |
| Apendizar el diseño al spec, como hace `arch-guardian` con el contrato | El spec de F-001 ya tiene 1048 líneas. El contrato de diseño lo consume solo el `implementer`; separarlo lo mantiene legible. |
| Numerar el paso como 5 y correr los demás | Rompería las referencias cruzadas a los pasos 5, 6 y 7 que ya existen en `qa.md`, `implementer.md`, `dev-tester.md` y en los progresos abiertos. |

## Consecuencias

**A favor:**
- El diseño de una pantalla es revisable **antes** de que se escriba, y verificable ejecutándolo
  después. Deja de ser lo único del pipeline que nadie comprobaba.
- El contrato obliga a nombrar qué se reutiliza, lo que empuja hacia `PageContainer`,
  `ContentCard`, `AppDialog`, `EmptyState`, `LoadingState` y `ErrorState` en vez de reinventarlos.
- El repo gana por fin una respuesta escrita a "¿cuál de los tres agentes de UI invoco?".

**En contra / coste asumido:**
- Un paso más en los features con UI, y un artefacto más que mantener.
- El paso 6 se alarga: QA tiene que levantar la app y capturar tres anchos.
- El contrato de diseño puede envejecer respecto del código, como cualquier documento. Se mitiga
  porque vive junto al feature y se escribe justo antes de implementarlo.

**Huecos que este ADR deja abiertos a propósito** — son código, y el `ui-designer` no escribe
código; los hará visibles en cada contrato hasta que el humano decida meterlos en el backlog:

- **No existe `useIsMobile()`**: `useMediaQuery(theme.breakpoints.down("sm"))` está copiado a mano
  en 76 sitios, y en 6 pantallas es `down("md")` sin criterio — "móvil" significa <600px o <900px
  según dónde se mire.
- **No existe `ResponsiveTable`**: el fork tabla/tarjetas se copia a mano en cada pantalla;
  `configuracion/referidos/page.tsx` lo repite tres veces en un solo archivo.
