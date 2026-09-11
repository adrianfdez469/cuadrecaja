# ADR 0118: F-034 edita `src/schemas/pago.ts` y `src/schemas/venta.ts` por delegación escrita de F-031

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-034 (vender a crédito en el POS)

> Cierra la primera pregunta abierta del spec de F-034: **quién edita un archivo de un feature ya
> cerrado con `passes: true`**, y **cómo** se edita para que lo que aquel feature verificó siga
> siendo cierto.

## Contexto

El mapa de propiedad del dosier del epic (`.agents/cuentas-por-cobrar.md`, § 9) da a **F-031**
«`src/schemas/cliente.ts`, `cuentaPorCobrar.ts` y las extensiones de `venta.ts`/`pago.ts`», y a
**F-034** «`src/app/pos/**`, las dos rutas de venta, `src/store/salesStore.ts`,
`src/services/sellService.ts` y `src/features/printing/**`». Cada archivo tiene un dueño, y esa es
la regla que impide que dos features en paralelo se pisen.

F-031 está **cerrado con `passes: true`**. Y sin embargo F-034 necesita tocar dos de sus archivos:

- **`src/schemas/pago.ts`**, dos veces. Una, para que la ruta espejo acepte una venta 100 % a
  crédito con `pagosDetalle: []` — hoy `pagosDetalleAppSchema` lleva `.min(1)` y la rechaza
  (criterio 12). Otra, para transportar el **nombre** del cliente que aún no existe en el alta
  offline: `multimonedaExtrasSchema` tiene `clienteId`, pero no un nombre.
- **`src/schemas/venta.ts`**, una vez. `IVenta` es lo que devuelve el `GET` de la ruta de venta y lo
  que `reloadSales` y `ventaToSale` convierten en el `Sale` local; sin el nombre del cliente ahí,
  una venta a crédito recargada del servidor reimprime su ticket sin cliente, aunque el servidor lo
  tenga bien guardado.

El dosier § 6 asigna los dos **comportamientos** a F-034, pero no dice quién edita los archivos, y
el contrato de F-033 —el otro feature que consume estos schemas— dice explícitamente «Ningún archivo
de F-031 se edita en F-033», lo que podría leerse como una regla general.

Hay dos precedentes que apuntan en direcciones distintas:

- El `arch-guardian` de **F-031** añadió `src/constants/pago.ts`, un archivo que su propio spec no
  enumeraba, porque la necesidad apareció al diseñar y no al planear.
- El `arch-guardian` de **F-033** decidió lo contrario para `src/schemas/cliente.ts`: creó
  `src/schemas/clienteSaldo.ts` aparte en vez de extender el archivo cerrado.

Y hay un dato que decide: el propio contrato de F-031, en su § 3.5, **ya cedió por escrito** el
primero de los dos cambios:

> `pagosDetalleAppSchema` **no cambia en F-031**. El `superRefine` que permite una venta 100 % a
> crédito con `pagosDetalle` vacío es de **F-034** (dosier § 6, «Rutas de venta»), que es dueño de
> las dos rutas de venta.

## Decisión

**F-034 edita `src/schemas/pago.ts` y `src/schemas/venta.ts` directamente, con ediciones
estrictamente aditivas, y crea `src/constants/creditoVenta.ts` para todo lo demás.**

> **Enmienda del 2026-09-09**, al cerrar el hallazgo H1 de `.agents/F-034-seguridad.md`. La
> delegación se amplía a un tercer archivo, **`src/schemas/cliente.ts`** —de **F-033**, cerrado—,
> para añadir la cota de juego de caracteres a `createClienteSchema.nombre`, y se crea
> `src/utils/printableText.ts`. La razón es la del **ADR 0120**: `POST /api/clientes` es el **otro**
> escritor de `Cliente.nombre`, y cerrar una de las dos puertas y no la otra no arregla nada. La
> edición es una sola línea, restrictiva sobre una entrada, y ningún criterio de F-033 usa nombres
> con bytes de control, así que su `passes: true` se sostiene. El razonamiento de abajo se aplica
> igual: es delegación **porque la decisión de dónde vive la cota la toma el arquitecto del feature
> que abre el riesgo**, y F-033 no podía haberla tomado — su `Cliente.nombre` no se imprimía.

Las tres reglas que hacen que eso sea seguro:

1. **Nada de lo que F-031 verificó cambia de comportamiento.** `pagoLineaSchema` se queda idéntico
   —el criterio 12 de F-031 existe precisamente para que nadie le añada un tercer valor a `tipo`— y
   `pagosDetalleAppSchema` se queda idéntico, con su `.min(1)`. El caso nuevo se resuelve con un
   schema **hermano**, `pagosDetalleConCreditoAppSchema`, que la ruta espejo pasa a usar.
2. **Cada campo nuevo es opcional y se inserta antes de la línea-ancla, nunca sustituyéndola**
   (E-047). Son tres campos en total: `clienteNombre` en `multimonedaExtrasSchema`, `clienteNombre`
   en `ventaSchema`, y nada más — `creditoBase` y `clienteId` ya los dejó puestos F-031 en los dos.
3. **Todo lo que no es forma de dato va a un archivo nuevo.** Los mensajes de error, los códigos, el
   número de reintentos, el copy del ticket y las clases de localización viven en
   `src/constants/creditoVenta.ts`, que no tiene dueño previo y no colisiona con nadie.

La regla general que esto sienta, y que el próximo feature del epic hereda: **cuando un contrato
cerrado cede por escrito un cambio a un feature posterior, ese feature edita el archivo**; cuando no
lo cede, el feature posterior crea un archivo hermano. La diferencia no es de tamaño ni de comodidad:
es si la decisión ya estaba tomada por quien era su dueño.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Crear `src/schemas/pagoCredito.ts` con los schemas nuevos y dejar `pago.ts` intacto | `clienteNombre` tiene que estar **dentro** de `multimonedaExtrasSchema`, que es el objeto que el checkout envía y que `IMultimonedaExtras` tipa en siete sitios del POS. Un schema aparte obligaría a componerlos en cada llamador o a duplicar el tipo, que es justo lo que `AGENTS.md` prohíbe |
| Espejar F-033 y crear `src/schemas/ventaCredito.ts` para `clienteNombre` de `IVenta` | Mismo problema: `IVenta` es lo que devuelve el GET y lo que consumen `reloadSales`, `ventaToSale` y `src/app/ventas/**`. Un tipo paralelo se desincroniza del real a la primera |
| Reabrir F-031 para que hiciera los tres cambios | Está cerrado con `passes: true` y su `qa` verificó doce criterios contra ese árbol. Reabrirlo invalidaría esa firma para arreglar algo que su propio contrato ya había delegado |
| Cambiar `pagosDetalleAppSchema` en sitio, quitándole el `.min(1)` y metiéndole el `creditoBase` | Le cambia el significado a un símbolo compartido para que encaje en un caso nuevo. Su semántica actual —«un array de pagos con al menos una línea»— es correcta para lo que fue escrita, exactamente el mismo razonamiento con el que el dosier § 4 decide **no** tocar `pagadaConUnSoloPago`. Y un `superRefine` sobre un array no puede ver `creditoBase`, que no está en el array: haría falta una factoría, que es peor de testear que un objeto |
| Poner `EMPTY_PAGOS_WITHOUT_CREDIT_MESSAGE` en `src/constants/creditoVenta.ts` con el resto | Cerraría un ciclo de **valor** entre dos módulos que evalúan schemas en el tope: `constants/creditoVenta.ts` importa el vocabulario de violaciones de `lib/cuentasPorCobrar/creditInvariant.ts`, que a su vez importa `schemas/pago.ts`. `tsc --noEmit` daría exit 0 y la carga reventaría con un `TypeError` de Zod tumbando suites ajenas (**E-028**). El mensaje vive en `schemas/pago.ts`, junto al que ese archivo ya lleva inline |
| Reutilizar `src/constants/pago.ts` (F-031) para las constantes nuevas | Es otro archivo cerrado y su contenido es de otro dominio: el aviso de una línea de pago desconocida. Un archivo nuevo no colisiona con nada |

## Consecuencias

**A favor:**

- Un solo lugar declara la forma de cada dato: `IMultimonedaExtras` sigue siendo el tipo del payload
  del checkout y `IVenta` el de la venta, sin tipos paralelos que se separen.
- `creditoExtrasSchema` se deriva con `.pick()` de `multimonedaExtrasSchema` en vez de restatearse,
  así que las rutas validan **exactamente** la misma forma que el cliente envía (E-039).
- La regla del line-level (`transferDestinationId` obligatorio en una transferencia con importe) se
  extrae a una función de módulo que **los dos** schemas llaman: una definición, dos consumidores.
- El criterio 12 se puede verificar **puramente**, importando los dos schemas desde
  `src/__tests__/`, además de llamando a la ruta.

**En contra / coste asumido:**

- **`pagosDetalleAppSchema` se queda sin consumidor en producción.** Sigue exportado y sigue
  testeado como no-regresión. Es deuda menor y consciente: preferimos un símbolo correcto sin
  llamadores a un símbolo compartido con el significado cambiado.
- **La cota de `clienteNombre` está escrita dos veces**: `max(200)` en `multimonedaExtrasSchema` y
  `max(200)` en `clienteSchema` (`src/schemas/cliente.ts`). No se pueden unificar porque el § 3.1
  del contrato de F-031 prohíbe la arista `pago.ts → cliente.ts` para evitar un ciclo. La
  duplicación se convierte en algo que la suite atrapa: un test de la lista de testabilidad de F-034
  comprueba que los dos schemas rechazan un nombre de 201 caracteres.
- **La regla que esto sienta se puede leer mal.** «El feature posterior edita el archivo» no es
  permiso general: es permiso **cuando el contrato del dueño lo cedió por escrito**. Si un feature
  del epic necesita tocar un archivo cerrado sin esa cesión, vuelve al `arch-guardian`.

**Impacto en seguridad y escalabilidad:**

- `creditoExtrasSchema` es lo que cierra el hueco del **`creditoBase` negativo**: el docstring de
  `checkCreditInvariant` advierte que su coerción `Number(x) || 0` **no** normaliza negativos
  —`-50` es *truthy*— y que todo llamador tiene que garantizar que su entrada ya pasó por Zod.
  Ninguna de las dos rutas de venta parsea hoy su cuerpo con `multimonedaExtrasSchema`, así que sin
  este schema la garantía no existía. Un `creditoBase` negativo no dispara ninguna de las cinco
  violaciones por sí solo, y habría escrito una `CuentaPorCobrar` con saldo negativo.
- `clienteId` como `z.string().uuid()` rechaza en la puerta cualquier cosa que no sea un uuid, antes
  de que llegue a un `where`.
- Coste de reversión: nulo. Los tres campos son opcionales y aditivos; quitarlos no toca ninguna
  columna ni ninguna migración.
