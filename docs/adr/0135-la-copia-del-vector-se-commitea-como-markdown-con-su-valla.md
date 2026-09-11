# ADR 0135: La copia commiteada del vector de precedencia se guarda como Markdown con su valla, no como JSON desnudo

**Estado:** aceptado
**Fecha:** 2026-09-11
**Feature:** F-039 (catálogo geográfico y función de precedencia)
**Se apoya en:** [ADR 0136](0136-el-catalogo-de-zonas-vive-en-constants-y-su-hash-sale-del-disco.md) ·
[ADR 0137](0137-gitattributes-fija-eol-lf-en-los-dos-ficheros-fijados-por-hash.md)

## Contexto

El criterio 7 de F-039 pide que la copia local del vector de 13 casos se fije contra el sha256
`0a4fbe39e79054ffcd47b42450f1deeb35d823644b610b7602c147ff0e175bc0`, que el contrato de QAB publica
en su sección «El hash del bloque JSON de arriba (S-007, punto 6)».

Ese hash **no es el hash de un fichero**. Es el hash de los 10 777 bytes que quedan **entre** el
delimitador de apertura ` ```json\n ` y el de cierre ` \n``` ` del bloque que vive dentro de
`sync-contract.md`, sin incluir ninguna de las dos vallas y sin ninguna normalización. Lo verifiqué
recalculándolo sobre el documento de origen: coincide exactamente.

De ahí sale el problema: los bytes que hay que hashear **no terminan en salto de línea**. El último
byte es la llave de cierre del JSON, porque el `\n` que la sigue pertenece a la valla de cierre y
queda fuera del hash. Y eso choca con una costumbre universal de las herramientas de texto: casi
todo editor, casi todo formateador y `printf`/`echo` de casi cualquier script añaden un `\n` final.

La comparación que lo deja claro es el otro fichero del mismo feature: el catálogo
`zone-index.json` **sí** termina en `\n`, y ese `\n` está **dentro** de sus 39 166 bytes hasheados.
Es decir, F-039 commitea dos ficheros con requisitos de salto de línea final **opuestos**, y los dos
con un hash que cae en silencio si alguien se equivoca.

El otro lado ya resolvió esto: su `src/features/zones/precedence.test.ts` extrae el bloque del
propio Markdown con el grupo 1 de `/```json\n([\s\S]*?)\n```/`, según declara el contrato en esa
misma sección.

## Decisión

**La copia commiteada del vector es un fichero Markdown que reproduce la valla ` ```json ` … ` ``` `
verbatim, y el test extrae el grupo 1 de `/```json\n([\s\S]*?)\n```/` antes de hashear.**

Vive en `src/__tests__/fixtures/zoneTariffPrecedenceVector.md`, contiene **exactamente una** valla
`json`, y el mismo string extraído se usa para **las dos cosas**: calcular el sha256 y hacer
`JSON.parse` de los casos. Nunca se hashea una cosa y se ejecuta otra.

Con esta forma, un `\n` final del fichero —el que cualquier editor añade— cae **fuera** del grupo 1
y no toca el hash. El fichero es robusto a la costumbre en vez de frágil ante ella.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un `.json` con exactamente los 10 777 bytes y **sin** salto de línea final, hasheando el fichero entero | Es más simple de leer (`readFileSync` + `createHash`, sin regex) pero apuesta toda la verificación a que nadie abra el fichero con una herramienta que añada el `\n` que todas añaden. Y el fallo no sería un error de nadie: sería un editor haciendo lo correcto. Además obliga a que los dos ficheros hasheados del feature tengan reglas de salto final contrarias, que es justo el tipo de detalle que se pierde en la sexta revisión |
| Un `.json` con salto final, hasheando `contenido.slice(0, -1)` | Mueve la fragilidad de sitio en vez de quitarla: el `slice` es una normalización, y el criterio 7 prohíbe explícitamente normalizar antes de hashear. Un fichero con **dos** saltos finales pasaría a hashear algo distinto sin que nadie lo note |
| Guardar el vector como módulo `.ts` con el objeto literal | Imposible: el hash es de bytes de texto JSON. Reserializar con `JSON.stringify` da otros bytes y el test dejaría de detectar una copia editada — exactamente el fallo que el criterio 7 existe para impedir |
| No commitear copia y leer el contrato vía `QAB_DOCS_PATH` | Es lo que el criterio 7 prohíbe de frente: un test que se salta a sí mismo cuando la variable falta es decorativo, y el contrato no está en disco de CI ni en el de todo el que clone |

## Consecuencias

**A favor:**
- El test es **simétrico** con el del otro lado: los dos extraen el mismo grupo 1 de la misma
  expresión sobre el mismo texto. Si alguna vez divergen, diverge algo real, no la forma del envase.
- Un salto de línea final del fichero —el caso frecuente— no rompe nada.
- La copia es legible en una revisión de PR: el fichero Markdown puede llevar encima una línea que
  diga de dónde salió el bloque, y esa prosa **no** entra en el hash.

**En contra / coste asumido:**
- El test necesita una expresión regular para extraer el bloque, y un fallo de extracción (un
  fichero sin valla, o con dos) se manifiesta como un hash distinto, no como un mensaje claro. Se
  acota exigiendo que el fichero tenga exactamente una valla `json` y que la extracción falle de
  forma explícita si no encuentra ninguna.
- El fichero sigue siendo frágil a una conversión de fin de línea (CRLF), que sí entra en el grupo 1.
  Eso lo cubre el [ADR 0137](0137-gitattributes-fija-eol-lf-en-los-dos-ficheros-fijados-por-hash.md).

**Impacto en seguridad y escalabilidad:**
- Ninguno directo: es un fixture de test, no toca datos de ningún negocio ni ninguna consulta.
- Sí tiene impacto en la **integridad de la integración**: este hash es lo único que impide que
  alguien «arregle» un caso del vector editando la copia local en vez de arreglar la
  implementación. Una copia editada a mano haría que las dos implementaciones divergieran sin que
  nada se pusiera rojo, y el síntoma en producción sería un importe de envío cobrado distinto del
  que el comerciante configuró.
