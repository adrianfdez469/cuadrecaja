# Cuadre de Caja — Instrucciones del Proyecto

> **Este es el único archivo de instrucciones del proyecto.** `CLAUDE.md` solo lo
> importa (`@AGENTS.md`) para que Claude Code lo cargue automáticamente. No agregues
> reglas en `CLAUDE.md`: edita este archivo.

## Visión General

**Cuadre de Caja** es un sistema **multi-tenant** de punto de venta (POS) e inventario.
Cada `Negocio` es un tenant raíz que posee sus propias tiendas, usuarios, productos y
ventas, **completamente aislados** de los demás negocios.

- **Especialización:** Productos listos para la venta (no productos que requieren elaboración previa).
- **Inventario:** Se actualiza de forma automática conforme se registran ventas en el POS.
- **Multitienda:** Múltiples tiendas por negocio, con traspasos de productos entre ellas.
- **Movimientos:** Compras, ajustes, traspasos, desagregaciones, consignaciones, mermas y devoluciones.
- **Estadísticas:** Módulo de reportes con métricas de ventas para la toma de decisiones.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · MUI v6 · Zustand 5 · NextAuth 4 ·
Prisma 6 · PostgreSQL · Axios · Zod 4 · Vitest 4

**Despliegue:** Vercel.

## Comandos

```bash
npm run dev          # Turbopack · dev:https levanta HTTPS con server.mjs
npm run verify       # lint + tsc --noEmit + test, en serie y sin pipes (E-045)
npm run harness:check # prefijo, rutas, ADR, copy de diseño, backlog, errores, .opencode/
npm run harness:sync # regenera .opencode/ desde .claude/ (agentes y comando de opencode)
npm test             # Vitest una pasada · test:watch · test:ui
npx prisma generate  # OBLIGATORIO tras tocar el schema, o el cliente miente (E-002)
npm run seed         # seed:dev para datos de desarrollo
node scripts/harness/next-id.mjs adr|error|feature   # siguiente identificador, prefijado
```

`npm run build`, `npm start`, `npm run lint`, `npx prisma migrate dev --name <n>` y
`npx prisma studio` son los estándar. `postinstall` ya corre `prisma generate && migrate deploy`.

## Arquitectura por Capas

| Capa | Ruta | Responsabilidad |
|------|------|-----------------|
| Páginas / API Routes | `src/app/` | Rutas, componentes de página y endpoints REST |
| Componentes | `src/components/` | UI reutilizable, organizada por funcionalidad |
| Features | `src/features/` | Módulos verticales autocontenidos (`onboarding`, `printing`) |
| Servicios | `src/services/` | Llamadas Axios a las API routes (un archivo por dominio) |
| Lógica de servidor | `src/lib/` | Lógica de negocio, singleton de Prisma, generación de reportes |
| Estado global | `src/store/` | Stores Zustand (carrito multi-cuenta con persistencia, ventas) |
| Context | `src/context/` | `AppContext` (sesión/auth/navegación), `MessageContext` (toasts) |
| Schemas y tipos | `src/schemas/` | Schemas Zod y los tipos `I*` derivados con `z.infer` |
| Hooks | `src/hooks/` | Hooks propios de React |
| Utilidades | `src/utils/` | Helpers de auth, permisos, exportación y formato |
| Constantes | `src/constants/` | Valores compartidos (denominaciones, permisos, movimientos) |
| Theme | `src/theme/` | Theme global de MUI y design tokens |
| Middleware | `src/middleware.ts`, `src/middleware/` | Auth por JWT, CORS, chequeo de suscripción |
| Tipos ambiente | `src/types/` | Solo declaraciones `.d.ts` de ambiente |

> **Los tipos compartidos viven en `src/schemas/`**, no en `src/types/`: schemas Zod derivados
> con `export type IAlgo = z.infer<typeof algoSchema>`.

## Modelo de Datos

```
Negocio (raíz del tenant)
  ├─ Usuarios  ──[UsuarioTienda]──> Tiendas
  ├─ Tiendas
  │    ├─ ProductoTienda (stock y precio por tienda)
  │    ├─ Ventas
  │    ├─ MovimientoStock
  │    └─ CierrePeriodo
  └─ Productos
       ├─ fraccionDeId → Producto padre (productos fraccionados, ej. cigarros sueltos)
       └─ ProductoTienda (vincula con tiendas, con stock y precio)
```

**Tipos de movimiento** (`src/constants/movimientos.ts` es la fuente de verdad):
`COMPRA` · `VENTA` · `AJUSTE_ENTRADA` · `AJUSTE_SALIDA` · `TRASPASO_ENTRADA` ·
`TRASPASO_SALIDA` · `DESAGREGACION_BAJA` · `DESAGREGACION_ALTA` ·
`CONSIGNACION_ENTRADA` · `CONSIGNACION_DEVOLUCION` · `MERMA` · `DEVOLUCION_VENTA`.

`VENTA` se genera automáticamente; `DEVOLUCION_VENTA` tiene su propio flujo dedicado.
El resto puede crearse manualmente (`TIPOS_MOVIMIENTO_MANUAL`).

## Autenticación y Autorización

- **NextAuth** con estrategia JWT y provider de credenciales (validación con bcrypt).
- **Middleware** (`src/middleware.ts`) decodifica el JWT → inyecta cabeceras `x-user-*`
  → verifica el estado de la suscripción.
- **Permisos:** cadenas delimitadas por `|`, almacenadas por usuario y por tienda
  (ej. `pos.vender|inventario.ver`). Se validan **en ambos lados**:
  `src/utils/permisos_front.ts` y `src/utils/permisos_back.ts`.
- **Roles** (`src/utils/roles.ts`): `SUPER_ADMIN` · `ADMIN` · `VENDEDOR`.

## POS y Carrito

- El estado del carrito vive en `src/store/cartStore.ts` (Zustand con persistencia en LocalStorage).
- Soporta **múltiples carritos con nombre** (cuentas/comandas) intercambiables en caliente.
- Las ventas admiten sincronización offline mediante los campos `syncId`, `wasOffline` y `syncAttempts`.
- Axios tiene un interceptor de reintentos (2 intentos) ante fallos de red.

## Suscripciones

- `Negocio.limitTime` controla el vencimiento, con 7 días de gracia.
- `Negocio.suspended` es un interruptor manual de corte.
- El middleware bloquea el login de usuarios no `SUPER_ADMIN` cuando la suscripción está
  vencida o suspendida.

## Convenciones y prohibiciones

- **Idioma: el código nuevo se escribe en inglés** — identificadores, comentarios, JSDoc, códigos
  de error y logs. El chat y el markdown siguen en español. Hay nombres en español heredados
  (`Producto`, `CreateMoviento`, `verificarPermisoUsuario`): mantenlos donde ya están, pero
  **nunca introduzcas identificadores ni comentarios nuevos en español**.
- **Nomenclatura:** componentes `PascalCase.tsx`; funciones y variables `camelCase`; interfaces
  con prefijo `I` (`IProducto`), **derivadas de Zod, nunca redefinidas** — si el tipo ya está en
  `src/schemas/`, se importa.
- **Imports:** alias `@/` para todo lo que venga de `src/`.
- **TypeScript:** evita `any`; si es inevitable, justifícalo en un comentario. El modo estricto
  está **desactivado** (ojo: no estrecha uniones por booleano, E-036).
- **`"use client"`: solo** donde hagan falta hooks de navegador o interactividad.
- **UI:** MUI v6 personalizado por el theme global (`src/theme/`), nunca estilos inline ad-hoc.
- **Nada de prop drilling:** para estado compartido, Zustand o Context.
- **Nada de Prisma en componentes:** la base de datos vive en las API routes y en `src/lib/`.
- **Nada de hardcoding:** ni strings ni números mágicos; van a `src/constants/`.
- **Nada de duplicar lógica:** si se repite en dos sitios, sale a un hook o a un servicio.

## Testing

El proyecto **sí tiene** pruebas automatizadas.

- **Runner:** Vitest, configurado en `vitest.config.ts` — entorno `node`, `globals: true`,
  alias `@/`, incluye `src/**/*.test.ts` y `src/**/*.spec.ts`.
- **Ubicación:** `src/__tests__/`, un archivo por símbolo o por área. La suite entera corre en
  segundos: ejecútala siempre.
- **Alcance:** cubren **lógica pura** — `src/lib/`, `src/app/pos/utils/`, `src/utils/` y
  `src/schemas/`. La aritmética de dinero (`currency`, `changeMath`, `paymentMath`,
  `tipMath`, `billMath`, `discountEngine`) es la parte mejor cubierta.
- **Componentes:** **no existe `@testing-library/react`**. Los componentes se verifican con
  `npx tsc --noEmit`, `npm run lint` y QA manual en el navegador.

**Limitaciones conocidas** — no asumas garantías que no existen:

- No hay CI: la suite solo corre si alguien la ejecuta a mano.
- No hay herramienta de coverage instalada.
- `src/app/api/` y `src/store/` no tienen cobertura de tests.

Al agregar lógica pura nueva, acompáñala de su test en `src/__tests__/`.

## Seguridad

- **Aislamiento multi-tenant:** toda consulta debe filtrar por `negocioId`. Una fuga de datos
  entre negocios es el fallo más grave posible en este sistema.
- **Autenticación:** verificar siempre la identidad del usuario antes de operar.
- **Autorización:** validar permisos en el backend (`permisos_back.ts`), nunca confiar
  únicamente en la comprobación del frontend.
- **Entrada externa:** validar con los schemas Zod de `src/schemas/` antes de persistir.

## Variables de Entorno

**`.env.example` es la fuente**: lleva las 25 variables con su comentario y distingue las
obligatorias de las opcionales. La lista no se duplica aquí — la copia que había ya se había
quedado en 16.

## Workflow, Commits y PRs

- **Ramas:** `feature/descripcion` o `fix/descripcion`. Las ramas de issue llevan el número
  por delante (ej. `159-bug-...`).
- **Antes de commitear:** `npm run lint` y, si tocaste UI, `npx tsc --noEmit`.
- **Base de datos:** tras cambiar el schema, ejecutar `npx prisma generate` y coordinar la migración.
- **Commits (Conventional Commits):** `feat:` · `fix:` · `refactor:` · `docs:` · `style:` · `chore:`
- **PRs:** descripción clara del cambio y del problema que resuelve; **atómicos** (una sola
  funcionalidad o corrección por PR); revisados contra las convenciones de este documento.

## Flujo de Trabajo con Agentes

El repositorio tiene un pipeline de desarrollo asistido con estado persistente en `.agents/`, para
que cualquier trabajo a medias pueda retomarse en otra sesión. Ver [ADR 0001](docs/adr/0001-harness-de-agentes.md).

### Antes de tocar código — siempre

1. Lee **[`.agents/COMMON_ERRORS.md`](.agents/COMMON_ERRORS.md)**. Es un índice de una línea por
   error; abre solo la ficha de tu área. Es bibliografía, no burocracia: evita repetir fallos que
   ya costaron tiempo. Las lecciones que se pueden comprobar solas ya no dependen de que las leas:
   `npm run harness:check` las ejecuta.
2. Comprueba si hay un progreso abierto en `.agents/progress/`. Si existe, **retómalo desde su
   sección "Próximo paso concreto"** en vez de empezar de cero.
3. Consulta `.agents/features.json` para saber qué falta. Solo contiene los features **abiertos**;
   los cerrados están en `.agents/features-archive.json`, que no se lee salvo para resolver un
   `depends_on` ausente del activo.

### El pipeline

Se invoca con **`/feature <F-### o descripción>`** y es **opt-in**: un arreglo pequeño no necesita
arrastrar seis agentes. La skill coordinadora vive en `.claude/skills/feature/SKILL.md`, y la leen
los dos clientes soportados (ver «El mismo harness en opencode»).

```
/feature
  └─ 1. spec              → .agents/specs/F-###.md      (el QUÉ: alcance y criterios)
     2. arch-guardian ─┐ EN PARALELO → .agents/contracts/F-###.md + docs/adr/
        security-guard ─┘ (solo si toca auth/permisos/tenants) → .agents/security/F-###.md
     3. ui-designer       → .agents/designs/F-###.md    (el CÓMO visual; solo si hay pantalla)
     4. implementer ─┐ EN PARALELO
        dev-tester  ─┘ (ambos contra el contrato, sin verse)
     5. qa               → verifica ejecutando; único que autoriza passes:true
```

| Rol | Agente | Escribe en | Nunca toca |
|-----|--------|-----------|------------|
| Especificación | `spec` | `.agents/specs/` | código, `.agents/contracts/` |
| Arquitectura | `arch-guardian` | `.agents/contracts/` + `docs/adr/` | código, `.agents/specs/` |
| Seguridad | `security-guardian` | `.agents/security/` | código y tests |
| Diseño de pantallas | `ui-designer` | `.agents/designs/` | código y `src/theme/` |
| Implementación | `implementer` | `src/**` | `src/__tests__/**` |
| Tests | `dev-tester` | `src/__tests__/**` | `src/**` |
| Verificación | `qa` | informes | código y tests |

Las fronteras son **disjuntas por diseño**: por eso los dos últimos corren en paralelo sin
colisionar, y el `dev-tester` escribe contra el contrato **sin ver la implementación**.

`security-guardian` y `ui-designer` son **obligatorios cuando aplican** —auth/permisos/tenants el
primero, pantalla/formulario/diálogo el segundo—, no opcionales. Bajo demanda: `ux-ui-designer`,
`react-ui-architect`, `code-refactorer`.

### Qué agente de UI toca

Se resuelve por **qué produce cada uno**: `ui-designer` el contrato de una pantalla en
`.agents/designs/` (no escribe código, y va **antes** del componente); `ux-ui-designer` el theme en
sí (`src/theme/**`: tokens, contraste, dark mode); `react-ui-architect` el componente de
producción (estado, Zod, `react-hook-form`, rendimiento). Si la pregunta es *"cómo se ve y cómo se
usa esta pantalla"*, es del `ui-designer`.

### Todo identificador nuevo lleva tu prefijo delante

Dos personas en paralelo cuentan «el último existente» y llegan al mismo número: así salieron dos
ADR `0036` y cuatro features que hubo que renumerar. Un ADR, una ficha de error o un feature
**nuevos** no se numeran a mano:

```bash
node scripts/harness/next-id.mjs adr|error|feature   # → ADRIAN-0151, con las rutas que le tocan
```

El prefijo abre el identificador (`ADRIAN-F-051`) y sale de `.agents/.local-prefix`, ignorado por
git porque es de tu máquina. **Si falta, el comando dice qué hacer: parar y pedirle el prefijo al
humano. Nunca lo inventes ni lo deduzcas del autor de los commits.**

Lo heredado **no se renumera** —los checks aceptan las dos formas—, y aquí y en los prompts
`F-###` significa el identificador completo, prefijo incluido.

### Nada de rutas de una máquina concreta

Todo lo que vive en `.claude/`, `.agents/` y `.opencode/` se comparte por git. **Ningún archivo de
esas tres carpetas puede contener una ruta absoluta ni una que empiece por `~`** (ver
[E-001](.agents/errors/E-001-rutas-de-maquina-en-archivos-compartidos.md), 3 apariciones). Ya no se
revisa a ojo: lo comprueba `npm run harness:check`, y su alcance incluye **los informes que los
propios agentes escriben** — la tercera aparición entró justo por ahí.

La documentación que vive fuera de este repo se declara en `references.external_docs` de
`.agents/features.json` con **una variable de entorno**, nunca con una ruta. Las reglas de cuándo
releerla y qué pasa cuando su contrato sube de versión son las `rules` de ese mismo archivo, que el
coordinador lee entero: no se repiten aquí.

### El mismo harness en opencode

El harness no es de Claude Code: casi todo él son markdown y JSON que lee el modelo, y `AGENTS.md`,
`.agents/skills/` y `.claude/skills/` los carga opencode de forma nativa. Lo único que no viaja son
**los agentes**: opencode busca sus definiciones solo en `.opencode/` (y en su config global), nunca
en `.claude/agents/`. Sin ellas, `/feature` se cae en el paso 3.

Por eso `.opencode/` existe y **está generado**:

```bash
npm run harness:sync    # .claude/agents/*.md  →  .opencode/agent/*.md + .opencode/command/feature.md
```

**La fuente sigue siendo `.claude/agents/`. `.opencode/` no se edita a mano** — cada archivo lo dice
en su cabecera, y `npm run harness:check` falla si hay deriva. Ese check no es ceremonia: dos juegos
de definiciones mantenidos a mano se desincronizan a la tercera edición y nadie se entera hasta que
opencode corre un `implementer` con el prompt viejo.

Qué hace la traducción, y por qué:

| Campo | En `.opencode/` | Motivo |
|-------|-----------------|--------|
| `description`, cuerpo | **literal** | La `description` es lo que dispara al subagente. Si cambiara, dejaría de invocarse solo. El generador falla si no sale idéntica. |
| `mode: subagent` | **añadido** | El default de opencode es `all`: sin esto, los diez salen como agentes primarios. |
| `permission` | **añadido** | Ver abajo. |
| `model` | **descartado** | El alias `opus` no existe en opencode, que quiere el id exacto de models.dev. Cada agente hereda el modelo de la sesión. **Se pierde el reparto por niveles** (`qa` en sonnet, `react-ui-architect` en haiku); el único requisito real —el coordinador necesita Opus— lo comprueba la skill en su paso 0. |
| `color` | **descartado** | Decoración, y con otro juego de valores. Ojo: un color con nombre en opencode no es un aviso sino un **error de schema que deja al agente sin cargar, en silencio**. |
| `memory` | **descartado** | `.claude/agent-memory/` es de Claude Code y está en `.gitignore`. No hay equivalente. |

En opencode se gana además una cosa que en Claude Code no se puede: la tabla «Escribe en / Nunca
toca» de arriba deja de ser prosa dentro del prompt y pasa a ser una regla del runtime, vía
`permission` por agente. El `implementer` **no puede** escribir en `src/__tests__/`, aunque se lo
pidas. Dos detalles que deciden si eso funciona o es decorativo, y que el generador ya respeta: gana
la **última** regla que casa, no la primera, así que el catch-all `"*"` va delante; y si la última
que casa es `"*": "deny"`, opencode le retira la herramienta entera al agente.

Lo que **no** tiene equivalente: `/feature` no es un slash command en opencode —allí las skills se
invocan con la herramienta `skill`—, así que `.opencode/command/feature.md` existe justo para que
`/feature <F-###>` se escriba igual en los dos clientes.

### Artefactos

| Archivo | Qué es |
|---------|--------|
| `.agents/features.json` | Backlog **abierto**: solo lo pendiente. **Lo define el humano**, no los agentes. |
| `.agents/features-archive.json` | Los features cerrados y deprecados. El pipeline no lo lee: al cerrar un feature, su entrada se mueve aquí. |
| `.agents/progress/F-###.md` | Trabajo en curso. Uno por feature; en paralelo, archivos separados. Se borra al cerrar. |
| `.agents/specs/F-###.md` | Spec del feature: problema, alcance y criterios de aceptación. |
| `.agents/contracts/F-###.md` | Contrato de interfaces, en su propio fichero. Lo escribe el `arch-guardian`; `implementer` y `dev-tester` programan contra él sin verse. Refleja el estado final, no su historial. |
| `.agents/security/F-###.md` | Informe del `security-guardian`. Destino único: nunca en la raíz de `.agents/`. |
| `.agents/designs/F-###.md` | Contrato de diseño de las pantallas. Solo si el feature toca UI. |
| `.agents/COMMON_ERRORS.md` | Índice de errores conocidos. Los que llegan a 3 apariciones suben con su fix resumido. |
| `.agents/errors/E-###-*.md` | Ficha por error: síntoma, causa raíz, solución, cómo evitarlo. |
| `docs/adr/NNNN-*.md` | Decisiones técnicas: contexto, decisión, alternativas, consecuencias. El número lo asigna `node scripts/harness/check-adr.mjs`, no se cuenta a ojo. |
| `.agents/designs/PATRONES.md` | Catálogo de patrones de pantalla vigentes. Lo lee el `ui-designer` en vez del árbol de componentes entero. |
| `.agents/archive/` | Informes de un solo uso (qa, tests, implementación) de features ya cerrados. Nadie los relee; se conservan por trazabilidad. |
| `.opencode/` | **Generado** desde `.claude/` por `npm run harness:sync`, para que opencode cargue los agentes y `/feature`. Se commitea, no se edita. |
| `.agents/.local-prefix` | Tu prefijo para los identificadores nuevos. **Ignorado por git**: es de tu máquina. Si falta, se pregunta y se crea. |

### La regla que sostiene todo esto

> Un feature solo se marca `"passes": true` cuando **todos** sus criterios de aceptación se
> verificaron **ejecutando algo, no leyendo código**.

Sin eso, `features.json` se convierte en un checklist decorativo. El agente `qa` es el único que
puede autorizarlo.

## Skills Disponibles

Tres skills de terceros en `.agents/skills/`, fijadas por hash en `skills-lock.json`. **No se
editan a mano**: se actualizan desde su origen. `.junie/skills/` son symlinks a estas rutas.

| Skill | Cuándo aplica |
|-------|---------------|
| [`next-best-practices`](.agents/skills/next-best-practices/SKILL.md) | Escribir o revisar Next.js. 20 documentos temáticos; los que más se usan aquí son `route-handlers.md` (~152 handlers en `src/app/api/`) y `async-patterns.md` (en Next 15 `params`, `searchParams`, `cookies()` y `headers()` son asíncronos). |
| [`vercel-react-best-practices`](.agents/skills/vercel-react-best-practices/SKILL.md) | Rendimiento de React/Next. 62 reglas en `rules/<nombre>.md`, **se leen de una en una**. ⚠️ No abras su `AGENTS.md`: es salida generada —la concatenación de las 62— y cuesta ~9.700 tokens sin aportar nada. |
| [`react-components`](.agents/skills/react-components/SKILL.md) | ⚠️ **Asume Vite + Tailwind, y este proyecto es Next.js + MUI.** No introduzcas Tailwind ni clases utilitarias por seguirla. Solo sirven sus principios generales: componentes modulares, lógica en hooks propios, props `Readonly<...Props>`. |
