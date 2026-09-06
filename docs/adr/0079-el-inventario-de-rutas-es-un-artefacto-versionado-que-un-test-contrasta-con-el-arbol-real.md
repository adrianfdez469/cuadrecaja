# ADR 0079: El inventario de rutas es un artefacto versionado que un test contrasta con el árbol real

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-021

## Contexto

El criterio 1 pide «un inventario escrito de las 170 route handlers de `src/app/api`, clasificando
cada una en pública a propósito, protegida por helper, o desprotegida, con el motivo en una línea».

Un inventario escrito como documento tiene una vida útil corta y conocida. F-018 ya produjo uno
—`.agents/specs/F-018.md` § *Inventario de rutas*, «153 `route.ts`, contado el 2026-09-02»— y hoy,
tres días y cuatro features después, **son 170**. El documento no mintió: se quedó viejo, que es lo
mismo pero más difícil de detectar, porque nada avisa.

Peor: el problema de fondo que F-018 identificó —«una ruta nueva que alguien olvide proteger queda
abierta por omisión»— sigue en pie. La puerta de F-018 obliga a autenticarse, pero **no** obliga a
nadie a decidir el alcance por tenant de un handler nuevo. Un inventario en prosa no lo obliga
tampoco.

Y hay un detalle de forma que el spec fija y que ningún documento en prosa respeta bien: la
clasificación es **por archivo Y por verbo HTTP**. `transfer-destinations/route.ts` es el caso que lo
obliga —`GET` desprotegido, `POST` correcto, veinte líneas más abajo— y no es único:
`productos_tienda/[tiendaId]/route.ts` tiene la misma asimetría.

## Decisión

El inventario **no es un documento: es un archivo de datos versionado, y un test lo contrasta contra
el árbol real de `src/app/api/`**.

Tres piezas, siguiendo el precedente de `src/constants/permisos/permisos.json`, que ya es un archivo
de datos en `src/constants/` consumido por código:

1. **`src/constants/routeGuards/routeGuards.json`** — una entrada por **(archivo, verbo)**, con su
   clasificación, su motivo en una línea, y —cuando aplica— el helper que la protege, el modelo por
   el que se aísla y el permiso exigido (o el motivo de que no haya, ADR 0078).
2. **`src/schemas/routeGuards.ts`** — el schema Zod que da forma a ese JSON y del que se derivan sus
   tipos con `z.infer`. El JSON no se lee sin validar.
3. **`src/lib/routeGuards/routeInventory.ts`** — el lector, y el **extractor de verbos**: recorre
   `src/app/api/**/route.ts` y devuelve, por archivo, qué verbos exporta.

Y el test que lo convierte en algo comprobable (`dev-tester`, en `src/__tests__/`) afirma:

- **Ni falta ni sobra:** el conjunto de pares (archivo, verbo) del JSON es **exactamente** el que el
  extractor encuentra en el disco. Un `route.ts` nuevo sin clasificar rompe la suite; una entrada
  que sobrevive al borrado de su ruta, también.
- **Todo motivo está escrito:** ninguna entrada tiene el motivo vacío.
- **Toda entrada `publica` declara `devuelveDatosDeNegocio: false`** — el criterio 4.
- **Toda entrada `protegida` nombra su helper y su modelo de aislamiento** — el criterio 8.
- **El contador de desprotegidas coincide con la constante de la tanda en curso** (ADR 0081), y al
  cerrar el feature vale **0**.

El extractor no se cree bajo palabra: se comprueba contra un puñado de fuentes de mentira escritas a
mano —un archivo con `GET` y `POST`, un `export const GET =`, un `export { handler as GET }`, un
`GET` que solo aparece dentro de un comentario o de una cadena— antes de dejarle recorrer el árbol de
verdad. Un extractor que no encuentra nada haría vacuo todo lo demás, que es E-008 con otro disfraz.

**Regla de extracción, normativa** (para que el `implementer` y el `dev-tester` no la deduzcan cada
uno por su lado): un archivo `route.ts` **declara** el verbo `V`, con `V` en
`GET · POST · PUT · PATCH · DELETE · HEAD · OPTIONS`, si y solo si contiene alguna de estas **cuatro**
formas:

1. `export async function V(`
2. `export function V(`
3. `export const V =`
4. `export { … as V … }`

La cuarta no es teórica y por poco se queda fuera de este ADR: `auth/[...nextauth]/route.ts` declara
sus dos verbos con `export { handler as GET, handler as POST }`, y es el único archivo del árbol que
lo hace. Un extractor de tres formas cuenta **227** verbos donde hay **229**, y el test acusaría dos
entradas de sobra para siempre.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Una tabla Markdown en `.agents/specs/F-021.md` | Es lo que hizo F-018 y se quedó viejo en tres días. Nada avisa, y 229 filas de Markdown no se revisan |
| Un `docs/` con la tabla, regenerado a mano de vez en cuando | «De vez en cuando» no ocurre. Y no ata a nadie: una ruta nueva no rompe nada por no estar |
| Un script de CI que haga el barrido | **No hay CI** en este repositorio: la suite solo corre si alguien la ejecuta a mano (`AGENTS.md`). Un test dentro de la suite es lo que sí se ejecuta |
| Un lint rule de ESLint que exija llamar a la guarda | Detectaría la llamada, no el **alcance**: `assertNegocioAccess` es una llamada a una guarda y resuelve dos de tres (trampa que el spec documenta). Y no distingue una ruta pública a propósito de una olvidada |
| Poner el inventario en `.agents/` y leerlo desde el test | Cruza la frontera entre el estado de los agentes y el código del producto. `src/constants/` ya tiene el precedente exacto con `permisos.json` |
| Derivar la clasificación automáticamente del código, sin archivo | Es indecidible sin leer la intención: «pública a propósito» exige un motivo humano escrito, y el criterio 4 lo pide explícitamente |

## Consecuencias

**A favor:**
- El criterio 1 pasa a comprobarse **ejecutando** (`npm test`), no leyendo — que es la regla que
  sostiene el pipeline entero.
- La puerta que F-018 no pudo poner queda puesta: una `route.ts` nueva **no compila la suite** hasta
  que alguien decida y escriba su clasificación. Es el remedio de fondo a «abierta por omisión».
- El inventario se revisa en el diff de la PR, junto al código que clasifica.
- El JSON es la lista de la que el criterio 6 saca sus casos (ADR 0080): una sola fuente para los
  criterios 1, 4, 6, 7, 8, 9 y 10.

**En contra / coste asumido:**
- Añadir una ruta cuesta ahora una entrada en un JSON. Es el precio buscado: la fricción está
  justamente donde debe estar.
- 229 entradas iniciales que hay que escribir a mano una vez. Se puede partir del barrido mecánico,
  pero **cada línea de motivo la escribe una persona**: un motivo autogenerado no es un motivo.
- El extractor es una heurística de texto, no un parser de TypeScript. Se acepta porque el error
  posible es de un solo signo: si no reconoce un verbo, el test dice «sobra una entrada» y alguien
  mira. Nunca da por clasificado lo que no lo está.

**Impacto en seguridad y escalabilidad:**
- Convierte el aislamiento multi-tenant en un invariante comprobable en vez de una convención.
- Coste en la suite: un recorrido de ~170 archivos con `fs`. La suite entera tarda hoy menos de un
  segundo y esto no la saca de ahí.
