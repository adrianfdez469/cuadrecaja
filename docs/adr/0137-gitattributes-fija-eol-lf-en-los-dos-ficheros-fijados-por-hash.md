# ADR 0137: Se estrena `.gitattributes` para fijar `eol=lf` en los dos ficheros cuyos bytes están clavados por un hash

**Estado:** aceptado
**Fecha:** 2026-09-11
**Feature:** F-039 (catálogo geográfico y función de precedencia)
**Se apoya en:** [ADR 0135](0135-la-copia-del-vector-se-commitea-como-markdown-con-su-valla.md) ·
[ADR 0136](0136-el-catalogo-de-zonas-vive-en-constants-y-su-hash-sale-del-disco.md)

## Contexto

F-039 commitea dos ficheros cuyo contenido está fijado byte a byte contra un sha256 publicado por el
contrato de QAB:

| Fichero | Qué se hashea |
|---------|---------------|
| `src/constants/zones/zone-index.json` | los 39 166 bytes del fichero entero, **incluido** su salto de línea final |
| `src/__tests__/fixtures/zoneTariffPrecedenceVector.md` | los 10 777 bytes del bloque entre vallas, **sin** ningún salto de línea final |

Los dos ficheros de origen son LF puro: lo comprobé, ninguno contiene un solo `\r`.

Hoy el repositorio **no tiene** `.gitattributes`, ni Prettier, ni husky, ni lint-staged. Nada
reescribe los bytes al commitear. Ese es el estado de partida, y es bueno.

El riesgo que queda no es de esta máquina: es de un clon con `core.autocrlf=true`, el valor **por
defecto de Git for Windows**. Ahí Git convertiría los dos ficheros a CRLF al sacarlos al árbol de
trabajo, y **los dos hashes fallarían a la vez sin que nadie hubiera tocado un carácter**. El
síntoma sería el peor posible de diagnosticar: dos tests rojos, un `git status` limpio, y un `diff`
que no muestra nada.

## Decisión

**Se crea un `.gitattributes` en la raíz con `text eol=lf` para esos dos ficheros, y nada más.**

```gitattributes
src/constants/zones/zone-index.json          text eol=lf
src/__tests__/fixtures/zoneTariffPrecedenceVector.md text eol=lf
```

Se declaran los dos ficheros por su ruta exacta, no por un patrón `*.json` o `*.md`: la regla existe
por el hash, y solo estos dos tienen hash. Un patrón amplio cambiaría el tratamiento de cientos de
ficheros para resolver un problema de dos.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| No hacer nada y declararlo riesgo asumido | El coste de evitarlo son dos líneas y el coste de sufrirlo es una sesión de depuración sobre un `diff` vacío. La desproporción decide |
| `-text` (tratar los ficheros como binarios, nunca convertir) | Es la garantía más fuerte de byte-exactitud, pero Git deja de diffear el contenido y muestra «Binary files differ». El catálogo se revisa en PR fila a fila —es su única revisión humana— y perder el diff cuesta más de lo que aporta la garantía extra. `text eol=lf` cubre el riesgo real, que es la conversión automática a CRLF |
| `* text=auto eol=lf` para todo el repositorio | Es probablemente lo correcto a largo plazo, pero cambiaría el tratamiento de todo el árbol dentro de un feature que va de otra cosa. Si alguien lo quiere, que sea una decisión propia con su ADR |
| Un test que compruebe que los ficheros no contienen `\r` | Detecta el problema, no lo evita, y redunda: los dos tests del hash ya fallan en ese caso. Lo que falta no es señal, es la prevención |

## Consecuencias

**A favor:**
- Los dos hashes dejan de depender de la configuración de Git de quien clone.
- El fichero deja escrito **por qué** esas dos rutas son especiales, para quien lo encuentre dentro
  de un año.

**En contra / coste asumido:**
- `text eol=lf` implica que Git **normaliza a LF al commitear**. Si alguien introdujera CRLF en uno
  de estos dos ficheros, la normalización lo corregiría en silencio — que en este caso es lo
  deseado, porque el hash correcto es el de LF, pero es una reescritura de bytes en un feature cuya
  tesis es que nada reescribe bytes. Se acepta a sabiendas y solo para estas dos rutas.
- El repositorio estrena un mecanismo que antes no existía. Cualquiera que añada después una entrada
  a `.gitattributes` por otro motivo tiene que saber que estas dos líneas están ahí por un hash.

**Impacto en seguridad y escalabilidad:**
- Ninguno sobre datos ni consultas. El efecto es sobre la **fiabilidad de la verificación**: sin
  esta regla, el mecanismo que detecta una copia editada del catálogo o del vector puede dar un
  falso positivo por una razón que no tiene nada que ver con el contenido, y un test que grita por
  el motivo equivocado es un test que la gente acaba desactivando.
