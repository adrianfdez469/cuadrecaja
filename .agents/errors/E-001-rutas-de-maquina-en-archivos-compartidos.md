# E-001: Rutas del sistema de archivos de una máquina concreta en archivos compartidos por git

**Área:** build
**Apariciones:** 3 — los 6 agentes originales, el backlog inicial, y F-041 (informe de `qa`)

## Síntoma

No hay mensaje de error. El archivo funciona perfectamente en la máquina donde se escribió y
apunta a la nada en cualquier otra:

```
.claude/agents/*.md   → /Users/kmilo/WebstormProjects/...   (ruta de otro dev, aquí no existe)
.agents/features.json → ~/Documents/PROJECTS/cuadre-caja/queandabuscando/docs
```

El agente que lee esa ruta no encuentra nada. Según el caso, o sigue adelante sin la
documentación que necesitaba —y trabaja a ciegas contra un contrato que nunca leyó—, o se para
sin saber explicar por qué.

## Causa raíz

La ruta se escribe en el momento de generar el archivo, tomándola del entorno de quien lo genera,
y **queda horneada**. Todo lo que vive en `.agents/` y `.claude/` se comparte por git: es
configuración del equipo, no de una máquina. Nada de lo que hay ahí puede depender del layout de
un disco concreto.

El fallo es silencioso por naturaleza y sobrevive a los tests: no hay nada que compile, ejecute
ni valide esas rutas.

## Solución

Una indirección por variable de entorno. El archivo compartido nombra la **variable**, nunca la
ruta; cada desarrollador define la suya en su `.env`:

```jsonc
// .agents/features.json — references.external_docs.qab
{
  "env_var": "QAB_DOCS_PATH",     // no la ruta: el nombre de la variable
  "repo": "queandabuscando",      // el identificador estable
  "subruta": "docs/",
  "si_falta": "Preguntarle al humano dónde está. No adivinar la ruta."
}
```

Con `QAB_DOCS_PATH` documentada en `.env.example`, y en `.claude/agents/`, el bloque de memoria
en relativo (`.claude/agent-memory/<agente>/`).

## Cómo evitarlo

Ningún archivo de `.agents/` o `.claude/` contiene una ruta absoluta ni una que empiece por `~`.
Lo que está fuera del repo se declara con una variable de entorno más la URL de su repositorio, y
si la variable no está definida el agente **para y pregunta** en vez de adivinar. Verificación en
un comando:

```bash
grep -rnE '(/Users/|/home/|~/|[A-Z]:\\\\)' .agents/ .claude/ --include='*.md' --include='*.json'
```

El agente `qa` ya comprueba esto para `.claude/agents/`; el mismo grep cubre `.agents/`.


---

## Adenda F-041 — la tercera, y la escribió un agente que TENÍA la regla en su encargo

Las dos primeras fueron rutas de **otra** máquina heredadas al generar archivos. La tercera es
distinta y por eso vale: el agente `qa` de F-041 abrió su informe `.agents/archive/F-041-qa.md` con una
línea de contexto perfectamente razonable —**Verificado en:** más la ruta del worktree— y esa ruta
era la de la máquina donde corría.

Lo que la hace instructiva:

- **El encargo del agente incluía E-001 explícitamente**, y aun así la escribió. No por
  desobediencia: la regla se lee como «no escribas rutas en las **instrucciones**», y esto era
  metadato de cabecera, el sitio donde una ruta parece información honesta sobre dónde se verificó.
- **El propio informe ejecutaba el `grep` de E-001 y lo daba por limpio.** El comando apuntaba a los
  ficheros del feature —spec, ADRs, código— y no a sí mismo. Un chequeo que no se incluye en su
  propio alcance siempre pasa.
- Lo cazó el coordinador en el paso 7, al correr el `grep` sobre **todo lo nuevo del feature,
  incluido el informe de QA**.

**La regla que deja:** el `grep` de E-001 se corre sobre **todos** los archivos que el feature
añadió a `.agents/`, y el informe de QA es uno de ellos. Y para quien escriba un informe: la
cabecera «verificado en» no necesita una ruta — la rama y el hecho de que sea un worktree son toda
la información que le sirve a quien lo lea desde otro disco.
