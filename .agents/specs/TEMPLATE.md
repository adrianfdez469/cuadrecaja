# F-###: <título>

> El identificador lo emite `node scripts/harness/next-id.mjs feature`, con tu prefijo delante.

> Escrito por el agente `spec`. **Solo lo esencial que otros agentes necesiten.**
> Sin diseño técnico ni pseudocódigo (eso es del arquitecto), y sin decisiones de UI, layout
> ni responsive (eso es del `ui-designer`, en `.agents/designs/F-###.md`).

## Qué hay que lograr

<2-4 frases. El problema y el resultado esperado.>

## Alcance

**Incluye:**
- <...>

**No incluye:**
- <...>

## Criterios de aceptación

Cada uno debe ser **verificable ejecutando algo**, no leyendo código.

1. <criterio comprobable>

## Contexto necesario

- Archivos o módulos existentes que el implementador debe conocer.
- Reglas de negocio no evidentes desde el código.

---

> El **contrato de interfaces** de este feature no vive aquí: está en
> `.agents/contracts/F-###.md`, lo escribe el `arch-guardian` y es un fichero aparte a propósito.
> Así el `qa` verifica criterios sin cargar el contrato, y el `implementer` programa contra el
> contrato sin cargar la justificación del alcance.
