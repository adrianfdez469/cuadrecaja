# ADR 0122: El enum de la base dice `CONDONACION` y la cara visible dice «perdonar deuda»

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-035 (panel de cuentas por cobrar y registro de cobros)

> Fija una divergencia **deliberada** entre un valor persistido y su nombre en la interfaz y en el
> permiso. Existe para que nadie la «arregle» después, ni renombrando el enum ni renombrando el
> permiso.

## Contexto

`TipoMovimientoCuentaPorCobrar` es un enum de Prisma con cuatro valores —`ABONO`,
`AJUSTE_DEVOLUCION`, `CONDONACION`, `REVERSION_ABONO`—, migrado y verificado por **F-031**, que
está en `passes: true`. Los mismos cuatro literales viajan en `TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR`
(`src/schemas/cuentaPorCobrar.ts`), que el propio archivo declara «THE ONLY declaration of this list
in the project», y en `MOVIMIENTO_CUENTA_POR_COBRAR_SIGN`
(`src/lib/cuentasPorCobrar/saldo.ts`), un `Record` sobre el enum que no compila si aparece un quinto
tipo sin signo.

F-035 es el primer feature que **escribe** uno de esos valores desde una pantalla, y al llegar a la
redacción el humano señaló lo obvio: *«condonar»* no es una palabra que el usuario de este producto
use. Pidió el sinónimo **«perdonar deuda»** para el botón, el diálogo y el permiso.

Cambiar el enum para que diga `PERDON` cuesta una migración de tipo enumerado de PostgreSQL sobre
un feature ya cerrado, con su `prisma generate`, su reverificación de F-031 y F-032 —que ya leen
esos literales en `periodCollectionsWhere` y en `computeSaldoAlCierre`— y un `passes: true` que
tendría que reabrirse. Y no compra nada que el usuario vea: el valor persistido no aparece en
ninguna pantalla si la capa de presentación no lo pinta crudo.

Dejar la interfaz diciendo «condonar» cuesta lo contrario: un producto que habla en un idioma que
su usuario no tiene.

## Decisión

**El valor persistido se queda en `CONDONACION`. La cara visible —copy, permiso, ruta de la
acción— dice «perdonar».** Concretamente:

| Capa | Literal |
|---|---|
| Enum de Prisma y schema Zod | `CONDONACION` |
| Permiso | `operaciones.cuentasporcobrar.perdonar` |
| Endpoint | `POST /api/cuentas-por-cobrar/[cuentaId]/perdonar` |
| Copy de la UI | «Perdonar deuda» |

La traducción vive **en un solo sitio**: `CUENTAS_POR_COBRAR_COPY` en
`src/constants/cuentasPorCobrar.ts`, junto a las etiquetas de los otros tres tipos. Ningún
componente escribe su propio literal, y ninguna ruta deriva el nombre visible del valor del enum.

Y la regla que esto sienta, que es la razón de que sea un ADR y no un comentario:

> **Un valor persistido y su nombre visible pueden divergir cuando alinearlos costaría una
> migración sobre un feature cerrado.** La divergencia se escribe, se localiza en un único mapa de
> etiquetas, y no se «corrige» en ninguna de las dos direcciones sin volver aquí.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Renombrar el enum a `PERDON` / `PERDON_DEUDA`** | Migración de un tipo enumerado de PostgreSQL sobre F-031, que está en `passes: true` y cuyo criterio 1 se verificó midiendo `\d` sobre las tablas antes y después. Arrastra a F-032, que ya filtra por esos literales en `periodCollectionsWhere`, y a `MOVIMIENTO_CUENTA_POR_COBRAR_SIGN`. Coste alto, ganancia cero para el usuario: nadie ve el valor del enum |
| **Llamar «condonar» también en la interfaz** | Es la palabra que el humano rechazó explícitamente, y con razón: el usuario de este producto es un cajero o un dueño de tienda, no un contable. Un botón que nadie entiende es un botón que nadie pulsa |
| **Un segundo valor `PERDON` conviviendo con `CONDONACION`** | Dos valores para el mismo hecho es la peor de las tres: `MOVIMIENTO_CUENTA_POR_COBRAR_SIGN` tendría dos entradas idénticas, `computeSaldoAlCierre` restaría los dos, y cualquier consulta que filtre por uno olvidaría el otro. Es exactamente la clase de duplicidad que el dosier § 5 evita con el helper único |
| **Dejarlo sin ADR, con un comentario en el archivo de constantes** | Un comentario en `src/constants/` lo lee quien abre ese archivo. La corrección que este ADR previene la haría alguien que abre `schema.prisma` o `permisos.json` y ve una incoherencia aparente. El sitio donde tiene que estar escrito es el registro de decisiones |

## Consecuencias

**A favor:**

- F-031 no se reabre y su `passes: true` sigue significando lo que significaba.
- El usuario lee «Perdonar deuda», que es lo que pidió el humano.
- La traducción está en un único mapa, así que cambiar el copy mañana no toca ni la base ni una
  consulta.

**En contra / coste asumido:**

- **Hay que buscar dos palabras distintas para encontrar todo lo relacionado con esta acción.**
  `grep -rn "perdonar"` no encuentra el enum, y `grep -rn "CONDONACION"` no encuentra el botón. Es
  el coste real y se paga cada vez que alguien investiga este flujo. Lo mitiga que el mapa de
  etiquetas nombre las dos, y este ADR.
- **Un tercer nombre sería un desastre.** Si mañana el copy pasa a «Cancelar deuda», el mapa cambia
  y el enum no; si además alguien renombra el permiso, hay tres vocabularios. El permiso queda
  fijado aquí y **no se renombra** sin un ADR que reemplace a este: los permisos viven en la base,
  por usuario y por tienda, y renombrarlos deja sin acceso a quien ya lo tenía.

**Impacto en seguridad y escalabilidad:**

- **Seguridad:** el permiso `operaciones.cuentasporcobrar.perdonar` se valida en el backend con
  `verificarPermisoUsuario` (`src/utils/permisos_back.ts`), no solo en la pantalla. La divergencia
  de nombres no crea ninguna vía nueva: el permiso y el enum se comprueban en capas distintas y
  ninguna deriva su valor de la otra.
- **Escalabilidad:** ninguna. Es un mapa de cuatro entradas resuelto en memoria.
- **Reversión:** barata en la dirección del copy (cambiar el mapa), cara en la dirección del enum
  (una migración). Esa asimetría es precisamente el argumento.
