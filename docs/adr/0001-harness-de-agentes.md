# ADR 0001: Harness de agentes con estado persistente en `.agents/`

**Estado:** aceptado
**Fecha:** 2026-08-31
**Feature:** transversal

## Contexto

El repositorio tenía 6 subagentes en `.claude/agents/` invocables de forma ad-hoc, sin ningún
mecanismo compartido de estado. Eso dejaba tres preguntas sin respuesta en cada sesión:

1. **¿Qué está hecho y qué falta?** No existía backlog. `docs/superpowers/` guarda 5 specs y 5
   planes fechados, pero son registros históricos de trabajo ya cerrado, no un estado vivo.
2. **¿Dónde quedó el trabajo a medias?** Al cortarse una sesión, el contexto se perdía y el
   siguiente agente reempezaba o duplicaba.
3. **¿Este error ya lo resolvimos?** Cada agente volvía a tropezar con los mismos fallos.

Restricción técnica relevante: en Claude Code, un subagente que a su vez lanza subagentes no es
fiable — tiende a ejecutar el trabajo él mismo en vez de delegar.

## Decisión

Un pipeline de 6 roles coordinados por una **skill `/feature`** que corre en la sesión principal,
con todo el estado persistido en disco bajo `.agents/`.

- **Coordinador:** skill, no subagente, porque solo la sesión principal puede lanzar subagentes
  en paralelo de forma fiable.
- **Estado:** `.agents/features.json` (backlog), `.agents/progress/F-###.md` (trabajo en curso),
  `.agents/specs/F-###.md` (spec + contrato), `.agents/errors/` + `COMMON_ERRORS.md` (bibliografía
  de fallos), `docs/adr/` (decisiones técnicas).
- **Paralelismo:** el arquitecto cierra un **contrato de interfaces** antes de lanzar en paralelo
  a `implementer` (solo `src/**`) y `dev-tester` (solo `src/__tests__/**`). Fronteras de escritura
  disjuntas, sin posibilidad de colisión.
- **Reutilización:** `arch-guardian` y `quality-guardian` se adaptan en vez de duplicarse.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Coordinador como subagente `coordinator.md` con `model: opus` | La delegación anidada no es fiable; el subagente acaba implementando en vez de coordinar. |
| Crear 6 agentes nuevos junto a los 6 existentes | Dos arquitectos y dos QA compitiendo, con responsabilidades solapadas. |
| Borrar los 6 agentes y empezar limpio | Se perdía la memoria acumulada en `.claude/agent-memory/` y prompts ya afinados al proyecto. |
| TDD estricto secuencial (tests → código) | Correcto pero más lento; el contrato de interfaces permite paralelizar sin riesgo de colisión. |
| Un único archivo de progreso reutilizable | Impide trabajar en features en paralelo. |

## Consecuencias

**A favor:**
- Cualquier agente puede retomar trabajo a medias leyendo un solo archivo.
- Los errores se acumulan como bibliografía en vez de repetirse.
- `COMMON_ERRORS.md` es solo un índice: el contexto global no se satura.
- Las decisiones técnicas quedan trazables y referenciadas desde el backlog.

**En contra / coste asumido:**
- La skill corre con el modelo de la sesión principal: **no se puede fijar Opus en frontmatter**.
  Se mitiga con una comprobación explícita en el primer paso de la skill.
- Mantener el estado en disco añade pasos de escritura tras cada fase del pipeline.
- El pipeline completo es opt-in (`/feature`); los cambios pequeños siguen siendo directos, lo
  que significa que no todo el trabajo queda registrado.

**Impacto en seguridad y escalabilidad:**
- `security-guardian` pasa a ser de invocación **obligatoria** cuando un feature toca
  autenticación, permisos o datos que cruzan tenants.
- La regla de que `passes` solo se marca tras **verificación ejecutada** es la defensa directa
  contra tests decorativos como el actual `src/__tests__/health.test.ts`, que valida sus propios
  fixtures y nunca importa el route handler que dice probar.
