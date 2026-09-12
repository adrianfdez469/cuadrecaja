# F-###: contrato de interfaces

> Escrito por el agente `arch-guardian`. El agente `spec` nunca escribe aquí; el arquitecto nunca
> reescribe `.agents/specs/F-###.md`.
> `implementer` y `dev-tester` programan contra este fichero **sin verse entre ellos**: es lo único
> que evita que choquen.

**Este documento refleja el estado final acordado, no su historial.** Si una decisión cambia, se
reescribe la sección afectada y el *por qué* del cambio va a un ADR. Nada de enmiendas fechadas
acumuladas aquí: un contrato con tres versiones de la misma firma no es un contrato.

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

## ADRs emitidos

- `docs/adr/NNNN-<slug>.md` — <qué decide>
