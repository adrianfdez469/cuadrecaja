# E-072: Una validación de caracteres de control adoptada sin mirar qué control de UI la alimenta

**Área:** build
**Apariciones:** 1 — F-033

## Síntoma

Ningún error: **dos documentos correctos por separado que no pueden cumplirse a la vez.**

- El informe de seguridad exigía rechazar el rango `[\x00-\x1F\x7F-\x9F]` en el campo `motivo`,
  por consistencia con el control que el ADR 0113 adoptó tras la inyección ESC/POS de F-032.
- El contrato de diseño, escrito por otro agente y en otro documento, especificaba ese `motivo`
  como un campo **multilínea**.

`\n` es `\x0A`. Está dentro del rango. **Un campo multilínea no puede pasar su propia validación.**

## Causa raíz

Seguridad y diseño escribieron, cada uno en su documento y sin verse, **una sola decisión**: qué
puede contener ese campo. El de seguridad la tomó mirando el destino del dato —una impresora
ESC/POS, donde un byte de control es una orden y no un carácter—. El de diseño la tomó mirando el
uso —una nota que el cajero escribe, que se lee mejor en varias líneas—. Ninguno de los dos tenía
por qué mirar el documento del otro, y ninguno se equivocó.

La forma general: **una regla de validación y el control de UI que la alimenta son la misma
decisión**, y cuando se reparten entre dos contratos, cada mitad es defendible y el conjunto es
incumplible. No lo atrapa `tsc`, ni `lint`, ni una revisión por lectura de cualquiera de los dos
documentos por separado. Lo atrapó el `implementer` al tener que escribir las dos mitades a la vez.

## Solución

El campo pasa a ser de **una sola línea** y el rango se rechaza **entero**, incluido `\x0A`.

La alternativa —excluir `\x0A` del `.refine`— se descartó a propósito: la consistencia con el ADR
0113 vale más que permitir saltos de línea en una nota de 300 caracteres, y una excepción en un
control de seguridad es una rama que después nadie recuerda por qué existe.

Dos detalles del cierre que importan:

- **Mensaje propio** (`MOTIVO_CONTROL_CHARACTERS_MESSAGE`), sin editar
  `CONTROL_CHARACTERS_MESSAGE`: F-032 verificó criterios contra el texto de aquel, que además dice
  «El **nombre**…» y aquí el campo es «Motivo».
- El mensaje vive **en el schema y no en `constants/`**, para no cerrar el ciclo de valor que
  [E-028] ya documenta.
- **La razón quedó escrita en el docstring del schema**, no solo en el contrato de diseño: así se
  lee desde el lado del código, que es desde donde alguien intentará algún día «arreglar» el campo
  para que admita varias líneas.

## Cómo evitarlo

Cuando adoptes una validación sobre un campo de texto libre, **mira qué control de UI lo
alimenta** antes de fijar el rango — y al revés: al especificar un `multiline`, mira qué valida ese
campo. Son la misma decisión.

Y la regla de proceso, que es la que generaliza: cuando dos contratos distintos tocan el mismo
campo, **la última palabra la tiene quien tenga que escribir las dos mitades a la vez**. Si nadie
las escribe juntas hasta el paso 5, la contradicción llega intacta hasta ahí.
