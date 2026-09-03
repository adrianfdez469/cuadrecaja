# E-006: una comilla sin escapar en `description` borra al agente del registro, sin decir nada

**Área:** build
**Apariciones:** 1 — harness (alta de `ui-designer`)

## Síntoma

No hay mensaje de error. El agente editado **desaparece de la lista de agentes disponibles** en el
siguiente arranque, como si nunca hubiera existido:

```
The following agent types are no longer available:
- ux-ui-designer
```

El archivo sigue en `.claude/agents/`, con su contenido intacto y su tamaño de siempre.

## Causa raíz

El `description` del frontmatter es un escalar YAML **entre comillas dobles**. Los ejemplos que
lleva dentro contienen diálogo, y ese diálogo también va entre comillas:

```yaml
description: "... user: "Los colores no se ven iguales" ..."
                        ↑ aquí YAML da la cadena por terminada
```

La segunda comilla cierra la cadena y el resto queda como basura sintáctica, así que el frontmatter
entero no parsea y el cargador descarta el agente **en silencio**. Los agentes que ya existían lo
hacían bien —escriben `\"`— pero es invisible al leerlos, porque la barra se confunde con el
`\n` escapado que también llevan.

Se detectó de rebote: al recargarse el registro apareció el agente nuevo y desapareció el editado.
Sin ese aviso, el archivo habría quedado roto en el repo sin que nada fallara.

## Solución

Escapar las comillas interiores como `\"` y validar el frontmatter antes de dar por bueno el
archivo:

```bash
python3 - <<'PY'
import yaml, glob
for p in sorted(glob.glob('.claude/agents/*.md')):
    lines = open(p).read().split('\n')
    end = [i for i, l in enumerate(lines[1:], 1) if l.strip() == '---'][0]
    try:
        d = yaml.safe_load('\n'.join(lines[1:end]))
        assert list(d) == ['name', 'description', 'model', 'color', 'memory']
        print(f'  OK  {d["name"]}')
    except Exception as e:
        print(f'  !!! {p}: {e}')
PY
```

## Cómo evitarlo

**Después de editar el frontmatter de cualquier agente, parsear el YAML.** Que el archivo se lea
bien no prueba nada: este fallo no rompe el markdown, no rompe el lint y no imprime nada. Comprobar
que sigue teniendo exactamente las cinco claves `name`, `description`, `model`, `color`, `memory`.
