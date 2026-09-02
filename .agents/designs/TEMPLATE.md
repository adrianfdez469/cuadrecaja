# F-###: diseño de <título>

> Escrito por el agente `ui-designer`. **Mobile-first: primero 320 px.**
> Sin código, sin `sx`, sin JSX: el `implementer` ejecuta este contrato.
> Todo color se nombra con su ruta `semantic.*`; ningún `#RRGGBB` entra aquí.

## Fuentes

<De dónde se escribió este contrato: el spec, la entrada de `features.json`, los modelos de
Prisma, y la versión de la documentación externa si el feature declara `requires_docs`. Si el spec
no existía todavía, decirlo aquí.>

## Lo que este feature NO diseña

<Lo que queda explícitamente fuera, y de qué feature es. Evita que el implementer rellene huecos
que pertenecen a otro, y que el QA rechace por algo que nunca estuvo en el alcance.>

## Pantallas afectadas

| Pantalla | Ruta | Nueva o existente |
|---|---|---|
| <nombre> | `/...` | <nueva \| cambia> |

---

## <Pantalla 1>

### Qué resuelve

<1-3 frases. Qué viene a hacer aquí quien abre esta pantalla, y con qué se va.>

### Layout

**320 px** — <qué se ve y en qué orden; qué desaparece o se pliega respecto de 1440.>

**768 px** — <qué cambia al ensanchar.>

**1440 px** — <la forma completa.>

### Umbral responsive

`useMediaQuery(theme.breakpoints.down("sm"))`.

<Si se usa otro, justificarlo aquí por escrito. Sin justificación, va `sm`.>

### Shell y componentes reutilizados

| Pieza | Se usa para |
|---|---|
| `PageContainer` | <...> |

### Piezas nuevas

<Vacío es lo deseable. Si hay algo, por qué no sirve nada de lo existente.>

| Pieza | Qué es | Por qué no basta lo que hay |
|---|---|---|

### Tokens por estado

| Elemento o estado | Token |
|---|---|
| <...> | `semantic.<rol>.<valor>.<main\|surface\|contrast>` |

### Estados

| Estado | Qué se muestra |
|---|---|
| Cargando | `LoadingState variant="..."` |
| Vacío | `EmptyState variant="empty"` — <copy> |
| Sin resultados de filtro | `EmptyState variant="no-results"` — <copy> |
| Error | `ErrorState kind="error"` |
| Sin conexión | `ErrorState kind="offline"` — <o cómo se degrada, si la pantalla funciona offline> |

### Destinos táctiles

| Control | Tamaño |
|---|---|
| <...> | <≥ 44 px> |

### Prohibiciones de copy

<Lo que la pantalla NO debe decir nunca, y por qué. Cuando un criterio de aceptación depende de
que dos situaciones distintas no se presenten igual, la prohibición es la parte verificable.>

| Nunca | Porque |
|---|---|
| <texto o presentación prohibida> | <qué induce a creer que es falso> |

---

## Preguntas abiertas

- <lo que el spec no define y no se ha podido decidir>

---

## Criterios de diseño verificables en navegador

> Los ejecuta el agente `qa` a 320, 768 y 1440 px. Cada línea se comprueba **midiendo**, no
> opinando.

1. A 320 px no hay scroll horizontal en `<ruta>`.
2. <control> mide ≥ 44 px de alto en los tres anchos.
3. A 320 px se renderiza `<ComponenteMóvil>` y no `<table>`.
4. <...>
