# ADR 0087: El patrón de forma de correo pasa a tener una sola definición, en `src/constants/validation.ts`, y las siete copias literales la importan

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-023
**Se apoya en:** [ADR 0086](0086-el-rechazo-por-usuario-sin-forma-de-correo-es-un-cuarto-desenlace-y-sale-como-un-409-propio.md) ·
[E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) ·
[E-039](../../.agents/errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md) ·
[E-028](../../.agents/errors/E-028-un-ciclo-de-valor-entre-dos-modulos-de-schemas.md) ·
[E-016](../../.agents/errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md)

## Contexto

El patrón `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` está escrito **literal, siete veces**, en siete archivos
que no se importan entre sí. Y bajo **dos nombres distintos**, que es lo que hace que buscarlo por
identificador dé una cuenta incompleta:

| Archivo | Nombre local | Qué valida |
|---|---|---|
| `src/app/api/usuarios/route.ts` | `EMAIL_REGEX` | el **alta** de un usuario |
| `src/app/api/usuarios/[id]/route.ts` | `EMAIL_REGEX` | el **cambio** de `usuario` |
| `src/app/api/auth/solicitar-reset-password/route.ts` | `EMAIL_REGEX` | la solicitud de restablecimiento |
| `src/app/configuracion/usuarios/page.tsx` | `EMAIL_REGEX` | el formulario de alta y edición |
| `src/app/olvide-contrasena/page.tsx` | `EMAIL_REGEX` | el formulario de «olvidé mi contraseña» |
| `src/schemas/tiendaOnline.ts` | `EMAIL_PATTERN` | el correo público de un local (`isEmailOrNull`) |
| `src/app/landing-components/TrialForm.tsx` | `EMAIL_PATTERN` | el correo de contacto del formulario de prueba |

**Las dos últimas no estaban en el diagnóstico.** Ni las `notes` del backlog ni el spec de F-023 las
mencionan, y no por descuido: los dos buscaron `EMAIL_REGEX`, que es como se llama en cinco de los
siete sitios. Aparecen al buscar **el patrón** en vez del nombre. Es exactamente la lección de
[E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) —una
definición repetida se corrige dejándose alguna atrás— con el agravante de que aquí el nombre
distinto es lo que las esconde.

Las siete son idénticas hoy. Nada garantiza que lo sigan siendo, y `AGENTS.md` lo prohíbe sin
matices: «si una lógica se repite en dos o más lugares, extraerla a un hook o servicio».

Pero para el par de arriba la higiene no es el argumento principal. **El argumento es el criterio
3.** F-023 añade una octava comprobación de forma de correo, esta vez en el camino del SSO, y el
criterio 3 exige que un usuario cuyo `usuario` **sí** es un correo funcione «exactamente igual que
hoy». Si la regla del alta y la regla del SSO son dos definiciones separadas, existe —hoy no, pero
el día que alguien toque una de las dos— una cuenta que `POST /api/usuarios` acepta crear y que el
SSO rechaza. El comerciante se queda sin panel con una cuenta que el sistema le dijo que estaba
bien, y el mensaje que F-023 le muestra le manda a hacer algo que ya hizo. Es la forma exacta de
[E-039](../../.agents/errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md): una
definición que ya existe, redicha en otro sitio —con otras palabras, o con el mismo literal, que a
efectos de deriva es lo mismo— y que deja de heredar los casos borde de la original.

Dicho de otro modo: no se trata de que sea feo tener ocho copias. Se trata de que **«tiene forma de
correo» tiene que significar una sola cosa**, porque hay dos puertas que se juzgan entre sí.

## Decisión

**Una sola definición, en un archivo nuevo que no importa nada, y las siete copias pasan a
importarla.**

`src/constants/validation.ts` exporta:

```ts
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

**El literal es byte a byte el que ya había.** No se «mejora» el patrón, no se le añade el flag `i`,
no se cambia por `z.email()`: el comportamiento de las siete puertas existentes tiene que quedar
**idéntico**, y el spec de F-023 lo excluye del alcance de forma explícita.

**Un solo nombre, `EMAIL_REGEX`.** Es el de cinco de los siete sitios, así que en esos cinco la
edición es *borrar una línea y añadir un import*, sin tocar ni un sitio de llamada. En los dos de
`EMAIL_PATTERN` se renombran los tres usos, y **no se importa con alias**: mantener dos nombres para
una constante es reconstruir en el import justo la confusión que se está quitando —es lo que hizo
que estas dos copias no salieran en el diagnóstico.

**Sin flag `g`, y eso importa.** Un `RegExp` sin `g` no lleva estado entre llamadas, así que
compartir **una sola instancia** entre ocho módulos es seguro. Con `g`, `.test()` avanza `lastIndex`
y devuelve resultados alternos para la misma entrada: el día que alguien le añada ese flag, dejará
de fallar en un sitio y empezará a fallar en los ocho, de forma intermitente. Queda escrito aquí
porque es el único riesgo que introduce compartir la instancia.

**El archivo no importa nada**, igual que `src/constants/qab.ts` y `qabSso.ts`, así que no puede
participar en ningún ciclo ([E-028](../../.agents/errors/E-028-un-ciclo-de-valor-entre-dos-modulos-de-schemas.md)).
Eso importa especialmente para `src/schemas/tiendaOnline.ts`, que es un módulo de schemas y evalúa
en el tope.

La función pura de F-023, `isQabSsoIssuableEmail`, **consume esta constante**; no define un patrón
propio ni describe el criterio con sus palabras.

**La propiedad es comprobable ejecutando algo**, que es lo que la hace algo más que una intención:

```bash
grep -rn --include='*.ts' --include='*.tsx' -e '\[\^\\s@\]' src/ | grep -v '^src/__tests__/'
```

devuelve **exactamente una línea**, la de `src/constants/validation.ts`. El filtro de
`src/__tests__/` no es trampa: un test de la constante puede escribir el patrón en un `expect` o en
un comentario, y un criterio de ausencia por `grep` que cae con el texto de quien lo escribe es
[E-016](../../.agents/errors/E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md).

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Que F-023 escriba su propio patrón y deje las siete copias donde están | Serían **ocho** definiciones de la misma regla, añadidas por el mismo feature que exige que dos de ellas coincidan. Y desacopla justo el par que el criterio 3 obliga a mantener acoplado: el alta y el SSO |
| Extraer solo las cinco de `EMAIL_REGEX` y dejar las dos de `EMAIL_PATTERN` | Es el estado que el diagnóstico describía porque no las había visto. Dejarlas conscientemente es peor: quedan dos copias bajo otro nombre, que es la forma en que se escondieron la primera vez, y un `grep` del patrón deja de tener una sola respuesta |
| Ponerlo en `src/utils/regex.ts` | Ese archivo ya existe y contiene exactamente un export, `moneyRegex`, que **no tiene ni un solo importador en todo `src/`**. Un módulo muerto no es un hogar compartido: lo primero que le pasaría a la constante nueva es heredar la invisibilidad del vecino. F-023 tampoco lo borra, que es otro feature |
| Ponerlo en `src/constants/userAccount.ts` | Es el archivo temáticamente más cercano al par que importa, pero sus constantes son de los JWT de invitación y restablecimiento. La regla la usan ahora ocho sitios de cuatro áreas —usuarios, auth, tienda online y landing—, y ninguna es dueña de las otras |
| Un schema Zod compartido (`z.email()`) en `src/schemas/` | Cambia el comportamiento. `z.email()` y este patrón no aceptan ni rechazan exactamente el mismo conjunto de cadenas, y el criterio 3 pide «exactamente igual que hoy». Migrar de un criterio al otro es una decisión de producto sobre qué correos se admiten, no un refactor |
| Importar en los dos sitios con alias (`EMAIL_REGEX as EMAIL_PATTERN`) | No toca los sitios de llamada, que es lo único a favor, y a cambio deja escrito que hay dos nombres para una cosa. Tres líneas de renombrado son más baratas que esa ambigüedad |
| Dejarlo para un feature de limpieza posterior | El feature que añade la octava copia es el que tiene que no añadirla. Un «lo ordenamos luego» aquí significa escribir a mano el mismo literal por octava vez, con el ADR 0086 delante diciendo que las dos puertas tienen que coincidir |

## Consecuencias

**A favor:**

- «Tiene forma de correo» significa una cosa, y se cambia desde un sitio. Si mañana se decide
  admitir otro conjunto de direcciones, el alta, la edición, el reset, los dos formularios, el
  correo público del local, el de la landing y el SSO cambian a la vez o no cambia ninguno.
- Un `grep` del patrón tiene **una** respuesta, así que la próxima vez que alguien tenga que
  contarlas no se dejará dos por el camino.
- La constante es importable desde `src/__tests__/` —es un `.ts`, no un `.tsx`
  ([E-015](../../.agents/errors/E-015-un-simbolo-en-un-tsx-no-es-importable-desde-un-test.md))—, así
  que por primera vez la regla se puede fijar con un test.

**En contra / coste asumido:**

- **F-023 toca siete archivos que no son suyos**, tres de ellos `.tsx`. Es el mayor ensanchamiento
  de alcance del feature y hay que decirlo: son ediciones mecánicas, pero son ediciones. En cinco no
  cambia ni un sitio de llamada; en dos se renombran tres usos.
- El `qa` verifica el alta de todos modos, porque el criterio 3 necesita crear un usuario con
  `usuario` de correo por `POST /api/usuarios`. Los otros cuatro flujos —reset, olvidé mi
  contraseña, correo público del local y formulario de la landing— **no** los recorre ningún
  criterio de F-023, y eso es lo que hay que sopesar al aceptar esto.
- **Es reversible a coste casi nulo**: revertir es volver a pegar el literal en cada archivo. Esa
  reversibilidad es parte de por qué se acepta el ensanchamiento.

**Impacto en seguridad y escalabilidad:**

- **Ninguna puerta se relaja.** El literal es idéntico y ninguna de las siete comprobaciones cambia
  de sitio, de orden ni de resultado. Lo único que cambia es de dónde viene el patrón.
- La regla que decide quién puede emitir un JWT de SSO y la que decide qué `usuario` se puede crear
  pasan a ser **la misma**, que es lo que impide un desajuste entre dos puertas de identidad.
- Sin coste en tiempo de ejecución: una `RegExp` literal se compila una vez por módulo, y ahora una
  vez en total.
