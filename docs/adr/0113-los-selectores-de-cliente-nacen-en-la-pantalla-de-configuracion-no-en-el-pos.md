# ADR 0113: Los selectores de cliente nacen montados en la pantalla de configuración, no en el POS

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-033

## Contexto

F-033 entrega tres artefactos que el resto del epic va a consumir: el hook `useClienteSearch`, el
bottom sheet `ClienteSheet` y el `ClienteAutocomplete`. Los tres viven en archivos que el mapa de
propiedad del dosier (`.agents/cuentas-por-cobrar.md`, § 9) asigna a F-033.

Pero **el sitio donde el POS elegiría un cliente no es de F-033**. El mismo § 9 asigna
`src/app/pos/**` a **F-034**, que es el feature que introduce la venta a crédito. F-033 no escribe
ahí.

Eso deja un hueco concreto, y hay que resolverlo antes del paso 5 porque dos criterios de
aceptación de F-033 (`.agents/features.json`) hablan del selector como si ya estuviera montado:

- Criterio 3 — «el cliente desaparece del listado y **del selector del POS**».
- Criterio 10 — «Sin conexión, **el selector** muestra el caché y la acción de crear está
  DESHABILITADA con su motivo VISIBLE al lado».

El `qa` verifica ejecutando, no leyendo código. Un componente que no está montado en ninguna
pantalla no se puede ejecutar.

## Decisión

**F-033 no escribe ni una línea en `src/app/pos/**`. Los dos selectores se entregan montados en
`/configuracion/clientes`, y los criterios 3 y 10 se verifican ahí.**

Tres consecuencias que son contrato:

1. `ClienteSheet` y `ClienteAutocomplete` son las **dos superficies de búsqueda de la pantalla de
   configuración de clientes**. Cuál de las dos se muestra a cada ancho lo decide el `ui-designer`
   en `.agents/designs/F-033.md`; que las dos sean alcanzables desde esa pantalla, no.
2. Sus props quedan fijadas en el contrato de interfaces de F-033 y **F-034 las monta en el
   checkout sin cambiarlas**. Si F-034 necesita una prop más, la añade F-034 y lo anota; F-033 no
   la reserva por adelantado.
3. El refresco en segundo plano del caché se entrega como una función exportada con firma fija
   (`refreshClientesCache`), **sin llamador en F-033 dentro del POS**. F-034 la engancha donde ya
   se agenda `syncPendingSales`, respetando `shouldDeferPosBackgroundOperations`. Es el mismo
   patrón de «firma reservada» que F-031 usó con `applyMovimientoCuentaPorCobrar`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Que F-033 monte el selector en el checkout del POS | Sería un control **muerto en producción** entre la entrega de F-033 y la de F-034: un selector que elige un deudor para una venta que todavía no puede ser a crédito. Y rompe el mapa de propiedad del § 9 sobre el archivo más disputado del epic (`src/app/pos/page.tsx`, donde F-034 tiene que arreglar además los bugs 1 y 2 del dosier § 4) |
| Una ruta de prueba desechable que monte el selector | Código que se escribe para pasar una verificación y que después nadie borra. Y verifica una pantalla que ningún usuario ve |
| Aplazar los dos componentes a F-034 y dejar en F-033 solo el CRUD y el hook | Deja los criterios 8, 9 y 10 sin nada que ejercitar —el caché existe para el selector— y convierte a F-034 en un feature con dos superficies visuales nuevas encima de la venta a crédito |
| Montar el `ClienteAutocomplete` en `PedidoEntregaDialog` | Ese archivo vive en `src/components/tiendaOnline/**`, que el § 9 asigna a **F-038** |

## Consecuencias

**A favor:**
- Los criterios 3 y 10 son ejecutables **sin** que exista la venta a crédito.
- Las dos superficies se estrenan y se corrigen sobre una pantalla de configuración, que es un
  entorno menos caro de equivocarse que el checkout del POS.
- F-034 recibe dos componentes ya ejercitados y una firma de refresco que no tiene que inventar.

**En contra / coste asumido:**
- El criterio 3 dice literalmente «el selector del POS» y se va a verificar sobre
  `/configuracion/clientes`. **Es el mismo componente**, montado en otra pantalla. Queda escrito
  aquí y en el contrato para que el `qa` no lo lea como un incumplimiento, y para que no se
  reescriba el criterio, que la regla del backlog prohíbe (E-018).
- Hasta que F-034 entregue, elegir un cliente en la pantalla de configuración no tiene efecto sobre
  ninguna venta. La selección sirve para abrir su ficha; el flujo de crédito llega después.

**Impacto en seguridad y escalabilidad:**
- Ninguno sobre el aislamiento: las dos superficies leen por `GET /api/clientes`, que está acotado
  por el `negocioId` de la sesión con `withTenantScope("cliente", …, negocioId)`.
- Evita tocar `src/app/pos/page.tsx` desde dos features distintos, que es donde el epic concentra
  su mayor riesgo de colisión.
