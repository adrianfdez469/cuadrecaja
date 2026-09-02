# F-###: diseño de <título>

> Escrito por el agente `ui-designer`. **Mobile-first: primero 320 px.**
> Sin código, sin `sx`, sin JSX: el `implementer` ejecuta este contrato.
> Todo color se nombra con su ruta `semantic.*`; ningún `#RRGGBB` entra aquí.

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
