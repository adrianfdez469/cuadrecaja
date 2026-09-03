# F-###: <título>

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

# Contrato de interfaces

> **Añadido por el agente `arch-guardian`, no por `spec`.** El agente `spec` nunca escribe aquí;
> el arquitecto nunca reescribe lo de arriba.
> `implementer` y `dev-tester` programan contra esta sección **sin verse entre ellos**.

## Firmas públicas

```ts
// Schemas Zod en src/schemas/, tipos derivados, firmas de funciones y endpoints.
```

## Contratos de API

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|

## Notas de arquitectura

- Capa donde vive cada pieza.
- Aislamiento multi-tenant: cómo se filtra por `negocioId`.
- ADRs emitidos: docs/adr/####
