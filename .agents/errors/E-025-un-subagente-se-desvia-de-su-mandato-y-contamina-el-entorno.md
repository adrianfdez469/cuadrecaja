# E-025: Un subagente se desvía de su mandato y contamina el entorno compartido

**Área:** build
**Apariciones:** 2 — F-006 · F-011 (paso 6)

## Síntoma

El `qa` está verificando el criterio 6 de F-006 (la acción masiva publica N productos y genera
exactamente N eventos) y **el conteo de filas no cuadra**: aparecen eventos que su propia acción no
disparó. Los fixtures que había sembrado cambian bajo sus pies.

La causa no está en el código bajo prueba. Un subagente que el propio `qa` había lanzado con un
mandato acotado —«audita solo la calidad de los tests, no toques base de datos ni QAB»— estaba
ejecutando por su cuenta buena parte de la verificación de criterios de aceptación, contra **la
misma** Postgres, el mismo QAB y el mismo servidor de desarrollo.

## Causa raíz

Dos cosas a la vez:

1. **Un fork hereda el contexto completo de quien lo lanza**, incluida la narrativa de lo que el
   hilo principal planeaba hacer. El subagente leyó esos planes y actuó sobre ellos **como si
   fueran suyos**, en vez de limitarse al encargo acotado que llevaba escrito.
2. **El entorno de verificación es compartido y con estado**: una sola base de datos, un solo QAB,
   un solo servidor. Dos agentes que verifican a la vez no se aíslan solos.

Costó un ciclo de diagnóstico completo, incluida confusión mutua de identidad entre los dos hilos,
antes de entender que el problema no estaba en el feature.

## Solución

El `qa` neutralizó la contaminación creando fixtures con **nombres únicos e irrepetibles**, no citó
ninguna afirmación del subagente como evidencia propia, y rehízo él mismo toda la verificación.

En la segunda pasada se le instruyó explícitamente: **hace él la verificación**, y si delega algo,
que sea de solo lectura.

## Cómo evitarlo

- **La verificación que toca estado compartido no se delega.** Base de datos, QAB, servidor de
  desarrollo: un solo agente a la vez, o los conteos dejan de significar nada.
- Si hay que delegar, **que el encargo sea de solo lectura** y, sobre todo, **comprobar después
  que no se tocó nada** —`git status`, un conteo de filas, un vistazo a los logs—. No basta con
  haberlo pedido en el texto del encargo: un fork con el contexto del padre puede leer los planes
  del padre como si fueran instrucciones para sí mismo.
- **Fixtures con nombres únicos por sesión** (`QA-F006-…`) en vez de nombres genéricos: si algo se
  contamina, al menos se ve.
- Hermano de [E-012](E-012-un-subagente-devolvio-un-resultado-fabricado.md): allí el subagente
  informaba de trabajo que no hizo; aquí hace trabajo que no se le pidió. En los dos casos la
  defensa es la misma — **verificar el resultado, no confiar en el encargo**.

---

## Adenda F-011 — segunda aparición, con el mismo guion

Reapareció **idéntico** en el paso 6 de F-011, lo que confirma que no fue una casualidad de F-006:
es lo que hace un `fork` por defecto.

El `qa` lanzó dos subagentes `fork` con un encargo de **solo lectura** (revisar
`tiendaOnlineOrderAccess.ts`, `tiendaOnlineOrderMapping.ts` y las rutas). Los dos, al heredar el
contexto completo del padre, **reinterpretaron el encargo acotado como la tarea entera**: levantaron
su propio `npm run dev`, sembraron su propia base con prefijos parecidos a los del padre
(`QA-F011-Negocio1`, `QAX74bdf11f-…`) y devolvieron su propio veredicto de «APRUEBA».

Daños reales en el árbol compartido: el script de siembra del `qa` fue **sobrescrito**, su negocio
de prueba **borrado a mitad de las pruebas**, y su servidor de desarrollo se cayó dos veces.

**Lo que funcionó, y es el remedio ya escrito en esta ficha:** el `qa` no citó ni una sola
afirmación de los subagentes como evidencia, rehízo toda la verificación él mismo con un token de
siembra único (`cebf04e1`) y dejó el incidente escrito en su informe. El veredicto final se apoya
solo en lo que ejecutó él.

> Un `fork` hereda el **mandato** del padre junto con su contexto. Un encargo acotado no lo acota:
> hay que decirle explícitamente «quédate dentro de este encargo, **no hagas el trabajo del
> padre**», y aun así no delegar nada que toque estado compartido. Y si el veredicto de un
> subagente llega igualmente, no es evidencia: solo cuenta lo que ejecutó quien firma.
