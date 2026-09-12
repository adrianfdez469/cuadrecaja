# ADR 0120: El nombre del cliente se rechaza en la puerta y se sanea en el ticket

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-034 (vender a crédito en el POS)

> Cierra el hallazgo **H1** de `.agents/security/F-034.md`, que bloqueaba el paso 5. Enmienda el
> **ADR 0119**, cuya evaluación de riesgo no contemplaba esta consecuencia, y amplía la delegación
> escrita del **ADR 0118** para incluir `src/schemas/cliente.ts`.

## Contexto

F-034 hace dos cosas que, por separado, ya existían, y que juntas no habían existido nunca:

1. **Abre un segundo escritor de `Cliente.nombre`.** Hasta hoy el único era
   `POST /api/clientes`, detrás de `configuracion.clientes.acceder` (F-033, § 5.2). F-034 añade las
   dos rutas de venta, que **no exigen ningún permiso** (ADR 0119) porque la venta nunca exigió uno
   (ADR 0078).
2. **Lleva ese campo, por primera vez, a un puerto con acceso al hardware.** La línea nueva del
   ticket (`Cliente: …`, contrato § 7.3) recorre `buildTicketPayload` → `buildTicketLines` →
   `encodeTicketToEscPos` → transporte USB/serie.

Lo que hay al final de ese camino, verificado leyendo el archivo real
(`src/features/printing/lib/escpos/encoder.ts`): la función que emite cada línea de texto es
`function line(text) { return textEncoder().encode(\`${text}\n\`); }`. **No hay ningún escape, ni
ninguna sustitución, ni ningún saneado.** El único filtro del camino es `stripBoldMarkers`
(`ticketLayout.ts`), que retira los `**` del marcado propio del ticket y nada más.

Y una impresora ESC/POS **no distingue el texto de un campo de un comando**: los dos son bytes en
el mismo flujo. Un `ESC p 0 25 250` embebido en un nombre es la secuencia estándar de «kick del
cajón portamonedas» de la mayoría de las térmicas de este mercado. Con el mismo mecanismo se puede
cortar el papel a mitad de ticket, dejar la impresora con otra fuente o alineación el resto del
turno o, según el firmware, colgarla.

La cota que el contrato tenía era **solo de longitud**: `clienteNombre: z.string().min(1).max(200)`.
Y `normalizeClienteNombre` (`src/lib/clientes/clienteNombre.ts`, de F-033, que F-034 reutiliza sin
cambios) hace `.trim().replace(/\s+/g, " ")`: colapsa espacios y **no toca ningún byte de control**
— `\x1B` no es `\s`.

El actor no tiene que ser malicioso. Este POS lee códigos con un escáner en modo teclado
(`src/utils/hardwareScanner.ts`), y un escáner disparado sobre el campo del nombre inyecta bytes de
control sin que nadie lo pretenda. Y quien sí quiera hacerlo puede fabricar la petición a mano: la
ruta no pide permiso.

## Decisión

**Se rechaza en la entrada y se sanea en la salida, con dos controles independientes, y ninguno
sustituye al otro.**

1. **Rechazo, con 400.** Un `.refine` sobre el juego de caracteres en los schemas de **escritura**:
   `multimonedaExtrasSchema.clienteNombre` (y por tanto `creditoExtrasSchema`, que se deriva de él
   con `.pick`) y `createClienteSchema.nombre` (y por tanto `updateClienteSchema`, que es su
   `.partial()`). El rango prohibido es C0, DEL y C1: `[\x00-\x1F\x7F-\x9F]`.
2. **Saneado, en la última milla.** `left()` y `center()` —las dos funciones de módulo que
   construyen **toda** línea de texto del ticket, en `buildTicketLines.ts`— pasan su texto por
   `stripControlCharacters`.
3. **Los modelos de lectura NO se refinan.** `ventaSchema.clienteNombre` y `clienteSchema.nombre`
   se quedan como están: describen lo que el servidor devuelve, no lo que acepta, y una fila
   escrita antes de que la cota existiera tiene que **poder leerse**.
4. **Una sola definición del rango**, en `src/utils/printableText.ts` — un módulo **hoja, sin
   ningún import**, que exporta `CONTROL_CHARACTERS_PATTERN`, `hasControlCharacters`,
   `stripControlCharacters` y `CONTROL_CHARACTERS_MESSAGE`.
5. **El checkout valida antes de aceptar el nombre**, en el momento de teclearlo, y no espera al
   400 del servidor: ese 400 llegaría horas después, sobre una venta ya cobrada, y la cola la
   aparcaría.

`src/features/printing/lib/escpos/encoder.ts` **no se toca**: la deuda general de codificar sin
escapar no es de F-034 y no está en su lista de escritura.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Limpiar en silencio con un `.transform` en vez de rechazar | Una venta offline con el nombre corregido a espaldas del cajero **no es lo que se tecleó**, y el criterio 8 de F-034 se verifica mirando la fila de `Cliente` para comprobar que existe una sola vez: un nombre alterado en el camino complica esa verificación y esconde que algo iba mal. Se limpia donde no se puede rechazar —el ticket, que nunca debe fallar—, y se rechaza donde sí se puede |
| Sanear **solo** en `buildTicketLines`, sin tocar los schemas | Deja la fila envenenada en `Cliente.nombre` para siempre, y con ella cualquier consumidor futuro: un export a Excel, un PDF, un webhook. El saneado del ticket protege a la impresora, no a la base |
| Refinar **solo** el schema, sin tocar el ticket | No cubre lo que ya está escrito —filas anteriores a la cota— ni lo que F-034 no gatea: `Usuario.nombre` llega al ticket por `Cajero: …`, los nombres de producto por los bloques, y ninguno de los dos tiene cota. El siguiente campo que alguien imprima nacería sin protección |
| Sanear en la interpolación de la línea `Cliente: …` únicamente | Cierra **una instancia** de la clase, no la clase. `left()`/`center()` son el sitio donde la cierra entera, y `buildTicketLines.ts` ya está en la lista de escritura de F-034: es el punto más barato al que este feature tiene derecho |
| Arreglar `encoder.ts`, que es donde de verdad está la deuda | No es un archivo de F-034 (contrato § 1) y arreglarlo bien significa decidir el escape de **todo** el flujo, incluidos los bytes `ESC` que el propio encoder emite a propósito para alinear, cortar y dibujar el QR. Es un trabajo con dueño propio, no algo que se hace de paso en un feature de crédito |
| Sustituir cada byte de control por un espacio en vez de borrarlo | Un byte de control no es un separador de palabras, y convertirlo en uno mueve las columnas que `padLine` ya calculó: el importe de la derecha dejaría de cuadrar |
| Refinar también `clienteSchema` y `ventaSchema` (los modelos de lectura) | Haría que **leer** una fila ya almacenada lanzara: `clienteConSaldoSchema` (F-033) extiende `clienteSchema` y sus tests lo parsean, y un `reloadSales` dejaría de traer ventas por un dato incómodo. Un dato sucio en la base es un problema; una pantalla que no carga por él, uno peor |
| Poner el predicado en `src/lib/clientes/clienteNombre.ts` (lo que sugería el informe) | Es lo correcto **si** se elige limpiar, porque entonces la función es parte de la normalización del nombre. Al elegir rechazar, el predicado no es específico de un cliente: lo usan tres schemas y el constructor de líneas del ticket, y meterlo en un módulo del dominio «cliente» obligaría a `buildTicketLines.ts` a importar de `src/lib/clientes/**` para pintar el nombre del cajero |
| Ampliar el rango a todo lo no imprimible en la tabla de la impresora | El juego de caracteres real depende de la *code page* configurada en cada impresora, que este proyecto no lee. Una cota basada en algo que no se puede consultar rechazaría nombres legítimos —los acentos, que en Cuba están en casi todos— por una suposición. El rango C0/DEL/C1 es el que es peligroso **con cualquier code page** |

## Consecuencias

**A favor:**

- El escenario del hallazgo queda cerrado en los dos extremos: no entra por la puerta que F-034
  abre, y no sale por el cable aunque haya entrado por otra.
- El saneado en `left()`/`center()` cierra de paso `Cajero: …`, los nombres de producto y el pie
  de la plantilla, que son tres campos que nadie gateaba y que ya se imprimían.
- El rango se declara **una vez**: las tres cotas de schema y la del ticket leen el mismo símbolo,
  así que corregirlo se hace en un sitio (E-014, E-039).
- El rechazo en el checkout convierte un fallo que llegaría horas tarde, sobre una venta ya
  cobrada, en un mensaje en el momento de teclear.

**En contra / coste asumido:**

- **Se edita un archivo más de un feature cerrado**, `src/schemas/cliente.ts` (F-033). Es una sola
  línea, restrictiva sobre una entrada, y ningún criterio de F-033 usa nombres con bytes de
  control, así que su `passes: true` se sostiene. Aun así es una edición sobre un contrato cerrado
  y queda anotada aquí y en el ADR 0118.
- **Entrada y lectura dejan de validar lo mismo**, a propósito. Es una asimetría que hay que
  explicar cada vez que alguien la encuentre, y por eso está escrita en el contrato (§ 3.3, § 3.4)
  y aquí, y no solo en un comentario del código.
- **Un nombre con un byte de control se rechaza entero**, no se acepta la parte buena. Un cajero
  cuyo escáner metió basura en el campo tiene que reescribirlo. Es el precio de no alterar en
  silencio lo que se tecleó.
- **Aparece un estado de pantalla nuevo** que ningún criterio de aceptación de F-034 ejercita: el
  rechazo en el alta rápida. Su copy es del `ui-designer` y su verificación es manual.
- **Esto no cierra la deuda de `encoder.ts`.** Cualquier campo futuro que llegue al ticket por una
  vía que no pase por `left()`/`center()` vuelve a estar expuesto. Queda anotado, sin dueño, y no
  se le asigna uno desde aquí.

**Impacto en seguridad y escalabilidad:**

- **Lo que este ADR promete, con precisión (E-017):** ninguna línea de **texto** del ticket
  construida con `left()` o `center()` lleva bytes del rango C0/DEL/C1. **No** promete que no
  lleguen bytes `ESC` a la impresora: `encodeTicketToEscPos` los emite a propósito para alinear,
  cortar y dibujar el QR, y ese es su trabajo. Lo que se elimina es que vengan **del texto de un
  campo**.
- No hay impacto en el aislamiento multi-tenant: la cota es sobre la forma del dato, no sobre a
  quién pertenece. Todo lo que el ADR 0117 dice sobre `withTenantScope` sigue igual.
- Coste de ejecución: una expresión regular sobre una cadena de como mucho 200 caracteres por
  campo, y una por línea de ticket. Irrelevante.
- **Reversión:** barata y sin datos que migrar. Quitar el `.refine` deja pasar lo que antes pasaba;
  quitar el saneado del ticket devuelve el problema. No hay columna ni migración implicadas.
