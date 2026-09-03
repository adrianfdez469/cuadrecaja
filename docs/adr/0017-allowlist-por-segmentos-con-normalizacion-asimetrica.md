# ADR 0017: La allowlist de `/api/` se compara por segmentos, con normalización asimétrica

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-018

## Contexto

La puerta del [ADR 0016](0016-la-puerta-de-api-valida-solo-la-cookie-de-nextauth.md) es
deny-by-default: toda ruta bajo `/api/` responde 401 sin sesión salvo las nueve entradas que fija
el criterio 5 de F-018. Toda la seguridad del feature descansa, por tanto, en dos preguntas que se
responden sobre una cadena de texto:

1. ¿Esta ruta es una ruta de `/api/`?
2. ¿Está en la allowlist?

Escritas de la forma obvia —`pathname.startsWith('/api/')` y
`ALLOWLIST.some(p => pathname.startsWith(p))`— las dos se pueden eludir:

| Petición | Qué hace el `startsWith` ingenuo | Por qué es un agujero |
|---|---|---|
| `/api/publico-falso` | `startsWith('/api/public')` → **true** | Una ruta gated que empieza por el prefijo de una allowlisted queda abierta. El caso general: `/api/appearance`, `/api/authors`, `/api/promotersXYZ`. |
| `//api/negocio` | `startsWith('/api/')` → **false** | La ruta no se considera de API y la puerta ni se plantea. El segundo matcher del `config` sí la intercepta, así que el middleware corre y la deja pasar. |
| `/api/app/../negocio` | `startsWith('/api/app')` → **true** | Se allowlistea una ruta que, resuelta, es `/api/negocio`. Es el peor de los tres: convierte la allowlist en el vector. |
| `/api/auth/` | Coincide, y bien | Pero `/api/negocio/` tampoco debe cambiar de veredicto por una barra final. |
| `/api/AUTH/session` | No coincide | Correcto por casualidad; conviene que sea correcto a propósito. |

Y hay una asimetría que no se puede ignorar: **normalizar de más es seguro para decidir "esto es
API" y peligroso para decidir "esto está permitido"**. Si decodifico porcentajes agresivamente,
`/api/%2561pp/...` acaba pareciéndose a `/api/app/...` y se allowlistea una ruta que el router de
Next resolvería como un 404 distinto. La misma normalización tiene signo contrario según para qué
pregunta se use.

## Decisión

**Dos formas normalizadas del `pathname`, y cada pregunta usa la suya.**

Normalización estructural, común a las dos (funciones puras, sin dependencias de Next):

1. Colapsar barras repetidas: `/{2,}` → `/`.
2. Resolver segmentos `.` y `..` recorriendo los segmentos (un `..` desapila; nunca sube por encima
   de la raíz).
3. Quitar barras finales, salvo que el resultado sea `/`.

Sobre esa base:

- **`strictPath`** — solo la normalización estructural. Sin decodificar porcentajes, sin tocar
  mayúsculas. **Es la que decide la allowlist.**
- **`loosePath`** — la normalización estructural aplicada tras decodificar porcentajes (hasta tres
  pasadas, deteniéndose si `decodeURIComponent` lanza), y después en minúsculas. **Es la que decide
  si la ruta es de API.**

Y la comparación con cada entrada de la allowlist es **por frontera de segmento**, nunca por
prefijo de cadena:

```
matches(path, entry)  ⟺  path === entry  ||  path.startsWith(entry + '/')
```

De donde:

```
requiresApiAuth(pathname) ⟺ isApiPath(loosePath) && !isAllowlisted(strictPath)
```

El resultado es que **toda ambigüedad se resuelve hacia el 401**: decodificar de más solo puede
hacer que algo se considere API (gatear más), y la allowlist solo reconoce la forma literal
exacta (permitir menos). Una ruta rara que hoy devolvería 404 devolverá 401; nadie pierde nada.

Los casos de arriba quedan así, y son casos de prueba obligatorios del contrato:

| Petición | `loosePath` | `strictPath` | Veredicto |
|---|---|---|---|
| `/api/publico-falso` | `/api/publico-falso` | `/api/publico-falso` | **gated** |
| `//api/negocio` | `/api/negocio` | `/api/negocio` | **gated** |
| `/api/../api/negocio` | `/api/negocio` | `/api/negocio` | **gated** |
| `/api/app/../negocio` | `/api/negocio` | `/api/negocio` | **gated** |
| `/api/AUTH/session` | `/api/auth/session` | `/api/AUTH/session` | **gated** (404 real de todos modos) |
| `/api/auth/` | `/api/auth` | `/api/auth` | allowlisted |
| `/api/backup` | `/api/backup` | `/api/backup` | **gated** (solo `/api/backup/generate` está permitida) |
| `/api/app/health` | `/api/app/health` | `/api/app/health` | allowlisted |
| `/pos` | `/pos` | `/pos` | no es API: la puerta no opina |

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `startsWith` sobre el `pathname` crudo | Los cuatro agujeros de la tabla del contexto. Es el planteamiento que este ADR existe para descartar. |
| Una expresión regular por entrada de la allowlist | Equivalente en potencia y peor en todo lo demás: nueve regex que hay que leer para saber qué está abierto, y una que alguien escriba mal (`/api/public.*`) reabre el agujero en silencio. La comparación por segmentos no admite ese error. |
| Confiar en que Next normaliza el `pathname` antes del middleware | Normaliza *algo* —y ahí está el problema: no está especificado qué, cambia entre versiones menores y no es auditable desde este repositorio. La puerta no puede depender de un detalle interno del framework. Normalizar nosotros es barato y verificable con tests puros. |
| Una sola forma normalizada para las dos preguntas | Obliga a elegir entre gatear de menos (si no se decodifica) o allowlistar de más (si se decodifica). La asimetría es precisamente lo que permite ser agresivo donde conviene serlo. |
| Poner la allowlist en el `matcher` del `config` del middleware | El `matcher` decide si el middleware corre, no si la petición está autorizada. Si el middleware no corre, tampoco se sanean las cabeceras `x-user-*` (criterio 4). Las dos cosas tienen que pasar en el mismo sitio. |

## Consecuencias

**A favor:**
- La lógica es una función pura sobre cadenas: `dev-tester` la cubre con una tabla de casos sin
  levantar Next, sin base de datos y sin HTTP.
- La allowlist es una constante única (`API_AUTH_ALLOWLIST` en `src/constants/apiAuth.ts`).
  Auditar qué está abierto es leer nueve líneas.
- Añadir o quitar una ruta de la lista es una línea, sin tocar la lógica de comparación.

**En contra / coste asumido:**
- Se responde 401 a rutas que no existen (`/api/API/...`, `/api` a secas). Cambia un 404 por un
  401 para peticiones que ningún cliente legítimo hace.
- La normalización es código propio que hay que mantener correcto. Se compensa con que es pura y
  está cubierta por la tabla de casos de arriba, que es parte del contrato.

**Impacto en seguridad y escalabilidad:**
- Cierra la clase entera de elusión por normalización de ruta, no los cuatro ejemplos concretos.
- Coste por petición: unas operaciones de cadena sobre un `pathname`. Irrelevante frente al
  `getToken()` que ya se hacía.
- El sesgo del diseño es explícito y está escrito: **ante la duda, 401**. Un falso 401 es una
  molestia; un falso "permitido" es una fuga entre tenants.
