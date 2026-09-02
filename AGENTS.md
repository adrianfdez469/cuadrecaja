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
npm run dev          # Servidor de desarrollo con Turbopack
npm run dev:https    # Desarrollo con HTTPS vía servidor propio (server.mjs)
npm run build        # Build de producción
npm start            # Levanta la aplicación compilada
npm run lint         # ESLint — ejecutar antes de cada commit
```

```bash
npm test             # Suite Vitest (una sola pasada)
npm run test:watch   # Modo watch
npm run test:ui      # Interfaz web de Vitest
npx tsc --noEmit     # Chequeo de tipos (obligatorio para cambios de UI)
```

```bash
npx prisma generate                    # Regenerar el cliente tras cambios de schema
npx prisma migrate dev --name <name>   # Crear y aplicar una migración
npx prisma studio                      # Explorador visual de la BD
npm run seed                           # Poblar la BD
npm run seed:dev                       # Poblar con datos de desarrollo (SEED_DEV=true)
```

> `postinstall` ejecuta `prisma generate && prisma migrate deploy` automáticamente.

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

> **Los tipos compartidos viven en `src/schemas/`**, no en `src/types/`. Se definen como
> schemas Zod y se derivan con `export type IAlgo = z.infer<typeof algoSchema>`. Nunca
> dupliques una interfaz entre la vista y la capa de servicio: importa la de `src/schemas/`.

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

## Convenciones de Código

- **Idioma: todo el código nuevo se escribe en inglés** — identificadores, comentarios,
  JSDoc, códigos de error y mensajes de log. El chat y la documentación markdown siguen
  en español. Parte del código arrastra nombres en español (`Producto`, `CreateMoviento`,
  `verificarPermisoUsuario`): mantenlos donde ya existen, pero **nunca introduzcas
  identificadores ni comentarios nuevos en español**.
- **Nomenclatura:** componentes en PascalCase (`ProductCard.tsx`); funciones y variables
  en camelCase (`getProductos()`); interfaces en PascalCase con prefijo `I` (`IProducto`).
- **Imports:** usar el alias `@/` para todo lo que venga de `src/`.
- **TypeScript:** evitar `any`; si es inevitable, justificarlo con un comentario. El modo
  estricto está desactivado.
- **`"use client"`:** solo en archivos que realmente necesitan hooks de navegador o interactividad.
- **Clean Code:** componentes pequeños, reutilizables y con una sola responsabilidad.
  Fragmentar la lógica en vez de acumularla en un único archivo.
- **UI:** todo con MUI v6, personalizado a través del theme global (`src/theme/`), no con
  estilos inline ad-hoc.

## Prohibiciones

- **Prop drilling:** no pasar props por múltiples niveles; usar Zustand o Context.
- **Prisma en componentes:** el acceso a base de datos vive en las API routes y en `src/lib/`.
- **Hardcoding:** nada de strings ni números mágicos; usar `src/constants/`.
- **Duplicidad:** si una lógica se repite en dos o más lugares, extraerla a un hook o servicio.
- **Interfaces duplicadas:** nunca redefinir un tipo que ya existe en `src/schemas/`.
- **Directivas innecesarias:** no usar `"use client"` en archivos que no lo requieren.

## Testing

El proyecto **sí tiene** pruebas automatizadas.

- **Runner:** Vitest, configurado en `vitest.config.ts` — entorno `node`, `globals: true`,
  alias `@/`, incluye `src/**/*.test.ts` y `src/**/*.spec.ts`.
- **Ubicación:** `src/__tests__/` — 28 archivos y 682 casos que corren en menos de un segundo.
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

Requeridas para levantar el proyecto:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."   # Conexión directa sin pooling, requerida por Prisma
NEXTAUTH_SECRET="..."           # Mínimo 32 caracteres
NEXTAUTH_URL="http://localhost:3000"
INIT_SECRET="..."               # Bootstrap del primer superadmin vía /api/init-superadmin
```

Opcionales:

```env
NODE_ENV="development"

# JWT de enlaces por correo
ACTIVATION_JWT_SECRET="..."      # Activación desde la landing (vigencia 48h)
USER_ACCOUNT_JWT_SECRET="..."    # Invitación 48h, reset 24h, cambio de correo 24h

# Webhooks de envío de correos (n8n)
N8N_USER_INVITE_WEBHOOK="..."
N8N_USER_INVITE_API_KEY="..."
N8N_USER_PASSWORD_RESET_WEBHOOK="..."
N8N_USER_PASSWORD_RESET_API_KEY="..."
N8N_USER_EMAIL_CHANGE_WEBHOOK="..."
N8N_USER_EMAIL_CHANGE_API_KEY="..."

PURGE_LANDING_NEGOCIOS_API_KEY="..."  # Purga de negocios freemium vencidos vía API externa
ELTOQUE_API_TOKEN="..."               # Tasas de referencia elTOQUE (TRMI)
```

Sin `ELTOQUE_API_TOKEN` la vista de tasas de cambio funciona igual: solo oculta el panel
de referencia.

**`.env.example` es la lista completa y actualizada** — consúltalo antes de agregar una variable.

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

1. Lee **[`.agents/COMMON_ERRORS.md`](.agents/COMMON_ERRORS.md)**. Es un índice corto de errores ya
   resueltos; abre solo la ficha de tu área. Es bibliografía, no burocracia: evita repetir fallos
   que ya costaron tiempo.
2. Comprueba si hay un progreso abierto en `.agents/progress/`. Si existe, **retómalo desde su
   sección "Próximo paso concreto"** en vez de empezar de cero.
3. Consulta `.agents/features.json` para saber qué está hecho y qué falta.

### El pipeline

Se invoca con **`/feature <F-### o descripción>`** y es **opt-in**: un arreglo pequeño no necesita
arrastrar seis agentes. La skill coordinadora vive en `.claude/skills/feature/SKILL.md`.

```
/feature
  └─ 1. spec           → .agents/specs/F-###.md   (el QUÉ)
     2. arch-guardian  → contrato de interfaces + docs/adr/  (el CÓMO técnico)
     3. ui-designer    → .agents/designs/F-###.md (el CÓMO visual; solo si hay pantalla)
     4. implementer ─┐ EN PARALELO
        dev-tester  ─┘
     5. qa            → verifica ejecutando; único que autoriza passes:true
```

| Rol | Agente | Escribe en | Nunca toca |
|-----|--------|-----------|------------|
| Especificación | `spec` | `.agents/specs/` | código |
| Arquitectura | `arch-guardian` | contrato + `docs/adr/` | código |
| Diseño de pantallas | `ui-designer` | `.agents/designs/` | código y `src/theme/` |
| Implementación | `implementer` | `src/**` | `src/__tests__/**` |
| Tests | `dev-tester` | `src/__tests__/**` | `src/**` |
| Verificación | `qa` | informes | código y tests |

Las fronteras de escritura son **disjuntas por diseño**: por eso implementación y tests pueden
correr en paralelo sin colisionar. El dev-tester escribe contra el contrato **sin ver la
implementación**, para que los tests verifiquen lo acordado y no lo que se acabó escribiendo.

Dos pasos son **obligatorios y condicionales**, no opcionales: `security-guardian` si el feature
toca auth, permisos o datos entre tenants, y `ui-designer` si añade o cambia una pantalla, un
formulario o un diálogo. **Consultores** invocables bajo demanda: `ux-ui-designer`,
`react-ui-architect`, `code-refactorer`.

### Qué agente de UI toca

Los tres existen y no se solapan. La duda de cuál invocar se resuelve por **qué produce cada uno**:

| Agente | Cuándo | Produce |
|--------|--------|---------|
| `ui-designer` | Las pantallas de un feature: layout, estados, responsive | Contrato en `.agents/designs/` — **no escribe código** |
| `ux-ui-designer` | El theme en sí: `tokens.ts`, contraste, dark mode, deuda de hex | Código de `src/theme/**` |
| `react-ui-architect` | Estado, Zod, `react-hook-form`, rendimiento y bundle | Componentes en `src/**` |

Si la pregunta es *"cómo se ve y cómo se usa esta pantalla"*, es del `ui-designer`, y va **antes**
de escribir el componente.

### Nada de rutas de una máquina concreta

Todo lo que vive en `.claude/` y en `.agents/` se comparte por git: es configuración del equipo,
no de un disco. **Ningún archivo de esas dos carpetas puede contener una ruta absoluta ni una que
empiece por `~`.**

No es teórico, y ya pasó dos veces (ver [E-001](.agents/errors/E-001-rutas-de-maquina-en-archivos-compartidos.md)):

- Los 6 agentes originales apuntaban a `/Users/kmilo/WebstormProjects/...`, la máquina de otro
  desarrollador. El bloque de memoria debe referenciar `.claude/agent-memory/<agente>/` en
  **relativo**.
- El backlog inicial apuntaba a la carpeta de documentación de QAB en la máquina de quien lo
  escribió.

La ruta se hornea al generar el archivo y queda fija para todo el que clone el repo. Falla en
silencio: no hay nada que compile ni que la valide.

**Documentación que vive fuera de este repo** —el contrato de integración con queandabuscando, por
ejemplo— se declara en `.agents/features.json`, en `references.external_docs`, con **el nombre de
una variable de entorno** y la URL de su repositorio, nunca con una ruta. Cada desarrollador
define esa variable en su `.env` (está en `.env.example`). Si no está definida, el agente **para y
le pregunta al humano**: nunca adivina una ruta, y nunca sigue adelante sin haber leído el
documento. Y no se guarda una copia versionada aquí: se queda vieja en silencio, y una copia vieja
de un contrato es peor que no tenerla.

**Esa documentación cambia, y la versión es el mecanismo para saber qué.** El contrato de QAB
lleva su versión en la línea 3 de `sync-contract.md` (`**Versión N** · <fecha>`) y es el único de
sus documentos que la lleva: es el reloj de toda la integración. Antes de empezar un feature se
compara esa versión con `contrato.version_verificada` de `features.json`. Si subió, **no se relee
el contrato entero**: el propio documento trae una sección `## Cambios respecto a la vN` por cada
salto, y ahí está escrito qué cambió.

Y lo que hay que tener presente: **un salto de versión de ese contrato no es aditivo por defecto**
—tres de los cuatro rompieron compatibilidad, sin periodo de convivencia— así que puede invalidar
un feature ya cerrado. `"passes": true` vale para la versión con la que se verificó, anotada en
`contrato_version`. Cuando un salto lo afecta, no se edita ese feature: se abre uno de migración.

**Revisa esto cada vez que crees o regeneres un agente, o que toques `.agents/`.** El agente `qa`
lo verifica; a mano es un comando:

```bash
grep -rnE '(/Users/|/home/|~/|[A-Z]:\\)' .agents/ .claude/ --include='*.md' --include='*.json'
```

### Artefactos

| Archivo | Qué es |
|---------|--------|
| `.agents/features.json` | Backlog y fuente de verdad de qué está hecho. **Lo define el humano**, no los agentes. |
| `.agents/progress/F-###.md` | Trabajo en curso. Uno por feature; en paralelo, archivos separados. Se borra al cerrar. |
| `.agents/specs/F-###.md` | Spec del feature + contrato de interfaces. |
| `.agents/designs/F-###.md` | Contrato de diseño de las pantallas. Solo si el feature toca UI. |
| `.agents/COMMON_ERRORS.md` | Índice de errores conocidos. Los que llegan a 3 apariciones suben con su fix resumido. |
| `.agents/errors/E-###-*.md` | Ficha por error: síntoma, causa raíz, solución, cómo evitarlo. |
| `docs/adr/NNNN-*.md` | Decisiones técnicas: contexto, decisión, alternativas, consecuencias. |

### La regla que sostiene todo esto

> Un feature solo se marca `"passes": true` cuando **todos** sus criterios de aceptación se
> verificaron **ejecutando algo, no leyendo código**.

Sin eso, `features.json` se convierte en un checklist decorativo. El agente `qa` es el único que
puede autorizarlo.

## Skills Disponibles

El repositorio trae tres skills de terceros instaladas en `.agents/skills/`, fijadas por hash
en `skills-lock.json`. **No se editan a mano**: se actualizan desde su origen. Las carpetas de
`.junie/skills/` son symlinks a estas mismas rutas.

| Skill | Ruta | Cuándo aplica |
|-------|------|---------------|
| `next-best-practices` | [`.agents/skills/next-best-practices/SKILL.md`](.agents/skills/next-best-practices/SKILL.md) | Al escribir o revisar código Next.js |
| `vercel-react-best-practices` | [`.agents/skills/vercel-react-best-practices/SKILL.md`](.agents/skills/vercel-react-best-practices/SKILL.md) | Al optimizar rendimiento de React/Next |
| `react-components` | [`.agents/skills/react-components/SKILL.md`](.agents/skills/react-components/SKILL.md) | Diseños de Stitch → React (**ver advertencia**) |

### `next-best-practices`

20 documentos temáticos sobre convenciones de archivos, límites RSC, APIs asíncronas de
Next 15, metadata, error handling, hydration, Suspense y bundling. Los más relevantes aquí:

- [`route-handlers.md`](.agents/skills/next-best-practices/route-handlers.md) — este repo
  tiene ~152 route handlers en `src/app/api/`.
- [`async-patterns.md`](.agents/skills/next-best-practices/async-patterns.md) — en Next 15
  `params`, `searchParams`, `cookies()` y `headers()` son asíncronos.
- [`rsc-boundaries.md`](.agents/skills/next-best-practices/rsc-boundaries.md) y
  [`directives.md`](.agents/skills/next-best-practices/directives.md) — refuerzan la
  prohibición de `"use client"` innecesario.
- [`data-patterns.md`](.agents/skills/next-best-practices/data-patterns.md) — Server
  Components vs Server Actions vs Route Handlers, y cómo evitar waterfalls.

### `vercel-react-best-practices`

62 reglas en 8 categorías priorizadas por impacto. Cada regla es un archivo suelto en
`rules/<nombre>.md`; se leen individualmente, no de corrido. Las de mayor impacto son las
de waterfalls y bundle size (ambas CRITICAL). Directamente aplicables a este POS:

- [`client-localstorage-schema`](.agents/skills/vercel-react-best-practices/rules/client-localstorage-schema.md) — versionar y minimizar lo que persiste `cartStore`.
- [`js-index-maps`](.agents/skills/vercel-react-best-practices/rules/js-index-maps.md) y [`js-set-map-lookups`](.agents/skills/vercel-react-best-practices/rules/js-set-map-lookups.md) — aplican a `buildProductIndex`.
- [`bundle-barrel-imports`](.agents/skills/vercel-react-best-practices/rules/bundle-barrel-imports.md) — relevante con MUI, que es propenso a imports de barril pesados.
- [`async-parallel`](.agents/skills/vercel-react-best-practices/rules/async-parallel.md) — `Promise.all` en las route handlers de reportes.

### `react-components` — advertencia

⚠️ Esta skill asume **Vite + Tailwind CSS**, un archivo `src/data/mockData.ts` y un servidor
MCP de Stitch. **Este proyecto es Next.js + MUI v6 y no usa Tailwind**: la UI se personaliza
mediante el theme global de MUI. **Sus reglas de estilo no aplican tal cual — no introduzcas
Tailwind ni clases utilitarias en este repo por seguirla.** Solo son aprovechables sus
principios generales: componentes modulares en archivos independientes, lógica extraída a
hooks propios y props tipadas como `Readonly<[ComponentName]Props>`.
