# E-044: `type-text` duplica el texto en inputs controlados de React/MUI

**Área:** ui
**Apariciones:** 1 — F-021

## Síntoma

Al conducir la aplicación con `orca computer`, escribir en un campo de formulario con `type-text`
deja **el texto duplicado**. Los intentos de corregirlo con retrocesos salen «a medias»: el campo
queda con un contenido que no es ni el tecleado ni el vacío.

Costó varios intentos diagnosticarlo, porque el síntoma parece un problema de foco o de velocidad
de tecleo, y se reprodujo en varios campos distintos (usuario, contraseña) antes de verse el patrón.

## Causa raíz

Los inputs de esta aplicación son **controlados** (React/MUI): su valor lo gobierna el estado del
componente, que se actualiza en cada pulsación. La emulación de tecleo carácter a carácter y ese
ciclo de re-render se pisan, y el resultado es texto repetido.

## Solución

**Usar `paste-text` en vez de `type-text`** para cualquier campo de formulario de esta aplicación.
`paste-text` entrega el valor de una vez y el componente lo recibe en un solo cambio de estado.

## Cómo evitarlo

Al automatizar formularios de este repo con herramientas de nivel de sistema operativo,
`paste-text` es el modo por defecto y `type-text` la excepción — no al revés.

Y una regla más general para quien verifique en navegador: si el contenido de un campo no es el que
escribiste, **sospecha del método de entrada antes que de la aplicación**. Es la misma familia que
[E-005](E-005-resize-window-no-cambia-el-viewport.md) y
[E-022](E-022-clicks-por-coordenada-sobre-una-captura-reescalada.md): el instrumento de
verificación miente, y lo que se acaba depurando es código que estaba bien.
