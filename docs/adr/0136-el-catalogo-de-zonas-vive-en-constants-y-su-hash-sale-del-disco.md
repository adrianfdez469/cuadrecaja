# ADR 0136: El catálogo de zonas vive en `src/constants/`, se importa como JSON y su hash sale de leer el fichero — nunca de reserializar lo importado

**Estado:** aceptado
**Fecha:** 2026-09-11
**Feature:** F-039 (catálogo geográfico y función de precedencia)
**Se apoya en:** [ADR 0135](0135-la-copia-del-vector-se-commitea-como-markdown-con-su-valla.md) ·
[ADR 0137](0137-gitattributes-fija-eol-lf-en-los-dos-ficheros-fijados-por-hash.md) ·
[E-015](../../.agents/errors/E-015-un-simbolo-en-un-tsx-no-es-importable-desde-un-test.md)

## Contexto

F-039 siembra en este repositorio el artefacto de 184 zonas que publica QAB, byte a byte:
39 166 bytes, versión de catálogo `1.0.0`, sha256
`9bb89dd3564b0b202f975160f98be449efdc3c2b3d8594df6a7ec8009853b019`. El criterio 1 exige que ese
hash se **calcule** en tiempo de ejecución sobre la copia commiteada, no que se lea de ningún sitio.

Hay tres preguntas que quien implemente no puede improvisar, porque `implementer` y `dev-tester`
trabajan en paralelo y sin verse:

1. **Dónde vive el fichero.** `src/constants/` tiene el precedente exacto
   (`src/constants/permisos/permisos.json`, importado por alias desde una ruta de API, desde
   `src/features/onboarding/` y desde tres tests). `src/lib/` es, por `AGENTS.md`, **lógica de
   servidor** — y el consumidor natural del catálogo en F-042 es un selector de municipios que el
   comprador usa en el navegador.
2. **Cómo se carga.** `resolveJsonModule: true` está activo, así que `import zoneIndex from
   "@/constants/zones/zone-index.json"` funciona tanto en Next como en Vitest.
3. **De dónde sale el hash.** Y aquí está la trampa: un `import` de JSON entrega el **objeto
   parseado**, no los bytes. `JSON.stringify` del objeto importado da un texto distinto del fichero
   —sin indentación, con otro orden de escape— así que el hash de esa reserialización no coincide
   con el que publica el contrato, y si alguien lo «arreglara» fijando el hash de la
   reserialización, el test pasaría a medir otra cosa: una copia con la indentación cambiada, o con
   una fila reordenada dentro de un objeto, daría el mismo hash y el test no se movería. Sería
   exactamente el test decorativo que el criterio 1 existe para impedir.

## Decisión

**El catálogo se commitea verbatim en `src/constants/zones/zone-index.json`, se consume por
`import` desde `src/constants/zones/zoneCatalog.ts`, y el sha256 del criterio 1 se calcula leyendo
el fichero del disco con `readFileSync`, nunca reserializando el objeto importado.**

En detalle:

- **Ubicación:** `src/constants/zones/zone-index.json`, con el mismo nombre de fichero que en el
  repositorio de origen, para que un `diff` entre los dos sea directo. Junto a él,
  `src/constants/zones/zoneCatalog.ts` como única puerta de entrada.
- **Tipado:** los tipos compartidos van en `src/schemas/qabZone.ts`, definidos como schemas Zod y
  derivados con `z.infer` y prefijo `I`, como manda `AGENTS.md`. Un `.ts`, nunca un `.tsx` (E-015).
- **Sin `.parse()` al cargar.** `zoneCatalog.ts` exporta el objeto importado tipado como
  `IZoneCatalog`; no ejecuta el schema. La validación de forma se hace **en el test**, que sí
  recorre las 184 filas con `zoneCatalogSchema`.
- **El literal del sha256 vive únicamente en `src/__tests__/`.** Ningún módulo de `src/**` fuera de
  los tests contiene ese hash, ni una constante `"1.0.0"` escrita a mano: la versión se lee del
  propio catálogo (`ZONE_CATALOG.version`) y el test es quien afirma cuál debe ser.
- **El nivel y la provincia nunca se derivan del código.** `zoneCatalog.ts` no tiene ninguna función
  que corte los dos primeros caracteres de un `code` ni que mire su longitud. La fila 184
  (`40.01`, Isla de la Juventud, `MUNICIPALITY`, provincia `40`) es la que hace que esa derivación
  sea una trampa, y el ADR 0032 del repositorio de QAB explica por qué.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| El fichero y el cargador en `src/lib/zones/` | `src/lib/` es lógica de servidor por convención de `AGENTS.md`. El catálogo es **dato**, y su consumidor de F-042 es una pantalla de selección que corre en el navegador. Meterlo en `src/lib/` invita a que alguien arrastre al cliente un módulo que la convención declara de servidor |
| `zoneCatalogSchema.parse(zoneIndex)` en el momento de importar | Recorre 184 filas con Zod en **cada** bundle que toque el catálogo, incluido el del navegador, para comprobar algo que el hash ya garantiza mejor. Y si alguna vez fallara, fallaría **lanzando en tiempo de importación en producción**, que es peor que un test rojo. La validación de forma cabe entera en el test, donde su coste es cero y su señal es la correcta |
| Hashear `JSON.stringify(zoneIndex)` | Mide otra cosa. Deja pasar una copia reindentada o con las claves de una fila reordenadas, y no coincide con el hash que el contrato publica, que es el del fichero |
| Leer el catálogo de `QAB_DOCS_PATH` en tiempo de ejecución | El artefacto tiene que estar **en este repositorio**: lo pide el criterio 1, y un módulo de producción no puede depender de que otro repositorio esté clonado al lado |
| Guardar las 184 filas como objeto literal en un `.ts` | Rompe el criterio 1 de raíz: no hay fichero cuyo hash calcular, y la copia deja de ser comparable byte a byte con la de QAB |

## Consecuencias

**A favor:**
- Los bytes de los dos lados son idénticos y comparables con un `shasum`, que es lo que el contrato
  dice que arbitra cuando los catálogos difieran.
- El cargador es trivial y sin ramas: no hay una función que «deduzca» nada, así que no hay dónde
  colar la deducción por forma del código que el criterio 2 persigue.
- `src/constants/zones/` queda como sitio evidente para la geometría de F-042, si llega.

**En contra / coste asumido:**
- El objeto importado se afirma como `IZoneCatalog` con una aserción de tipo, porque TypeScript
  infiere `level` como `string` desde el JSON. Es una aserción, no una comprobación: lo que la
  sostiene es el test del hash más el test de forma, no el compilador. Queda escrito aquí a
  propósito para que nadie la lea como una garantía del tipo.
- 39 KB de JSON entran en cualquier bundle que importe el módulo. Es aceptable para 184 filas y es
  la razón por la que **no** se añade Zod al camino de carga.
- Actualizar el catálogo a una versión futura de QAB será un cambio de dos ficheros —los bytes y el
  literal del hash en el test— y de nada más. Es reversible con un `git revert`.

**Impacto en seguridad y escalabilidad:**
- **Multi-tenant: ninguno.** El catálogo es geografía pública, idéntica para todos los negocios; no
  contiene, deriva ni indexa nada por `negocioId` ni por `tiendaId`, y ninguna consulta a base de
  datos participa en este feature. El aislamiento entra en escena en F-041, cuando el tarifario
  pase a ser una tabla por tienda.
- **Escalabilidad:** 184 filas se cargan una vez por proceso. Las búsquedas por código van sobre un
  `Map` construido una sola vez a nivel de módulo, no sobre un `find` lineal repetido — importa
  porque F-042 resolverá la cobertura zona a zona sobre la lista entera.
