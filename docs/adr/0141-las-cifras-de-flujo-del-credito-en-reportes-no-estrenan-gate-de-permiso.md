# ADR 0141: Las cifras de flujo del crédito en reportes **no** estrenan gate de permiso, y por qué eso hay que mirarlo

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-039 (el crédito en los reportes de operación y rentabilidad)
**Se apoya en:** [ADR 0130](0130-las-dos-cifras-de-flujo-entran-en-los-totales-almacenados.md) ·
[ADR 0116](0116-el-permiso-de-clientes-va-a-vendedor-y-no-a-almacenero.md) ·
[ADR 0139](0139-total-cobrado-deja-de-incluir-el-credito-y-la-base-del-porcentaje-no-se-parte.md) ·
[E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md)

## Contexto

F-036 mostró en el histórico de `/resumen_cierre` las dos cifras de flujo del crédito —
`totalCreditoOtorgado` y `totalCobrosCredito`— y **las puso tras un permiso**:
`shouldShowCreditColumns(verificarPermiso(CUENTAS_POR_COBRAR_PERMISO), sums)`, siendo ese permiso
`recuperaciones.cuentasporcobrar.acceder`, el que nombra la cartera de deudores.

F-039 muestra **esas mismas dos cifras**, sumadas sobre los mismos cierres, en el estado de
resultados de `/reportes/rentabilidad`. Y muestra en `/reportes/operacion` una fila de mix cuyo
importe es `Σ Venta.creditoBase` del rango — que para esos mismos cierres es la misma cantidad que
`Σ totalCreditoOtorgado`, por construcción del motor de cierre.

Las dos pantallas de reportes tienen permisos propios: `recuperaciones.reportes.operacion` y
`recuperaciones.reportes.rentabilidad`. Ninguno de los ocho criterios de aceptación de F-039 menciona
permisos.

Así que hay una pregunta que no se puede dejar sin responder: **¿debe F-039 replicar el gate de
F-036, o no?**

## Decisión

**No se replica. Las dos pantallas de reportes siguen protegidas solo por sus propios permisos, y el
crédito aparece en ellas para todo el que pueda verlas.**

Y la divergencia queda escrita aquí, no escondida, para que se revise con criterio de seguridad.

### Por qué

1. **Esconder la fila `credito` del mix rompería el criterio 2 en silencio, y solo para algunos
   usuarios.** La base de los porcentajes de la tabla incluye el crédito (ADR 0138). Un usuario sin
   el permiso vería una tabla cuyos porcentajes se calculan sobre unas ventas netas que no coinciden
   con las que la propia pantalla muestra arriba — es decir, **exactamente el bug que este feature
   existe para eliminar**, reintroducido para un subconjunto de la plantilla y sin ningún aviso.
   Esconder una fila de un reparto porcentual no oculta la cifra: la delata por la diferencia, y
   además miente sobre el resto.
2. **Lo que el permiso protege es la cartera, no el total.** `recuperaciones.cuentasporcobrar.acceder`
   da acceso a quién debe, cuánto y desde cuándo. F-039 **no muestra ninguna identidad de deudor**:
   ni `Cliente.nombre` ni `clienteId` aparecen en ningún archivo del feature. Lo que añade son dos
   agregados de dinero del período, en una pantalla cuyo permiso ya concede la composición completa
   de los cobros y el estado de resultados entero, márgenes y costos incluidos.
3. **Una guarda que ningún criterio recorre es una rama que nadie prueba** (E-032). Añadir un gate
   que ninguno de los ocho criterios exige significa entregar una rama sin verificación, en un
   feature cuya entrega ya depende de que el `qa` compruebe ocho cosas ejecutándolas.

### Lo que sí queda prohibido

- F-039 **no puede** añadir el nombre del cliente, el `clienteId`, la antigüedad de la deuda ni el
  saldo vivo a ningún reporte. Eso sería una superficie de datos personales nueva y una decisión de
  autorización, no una celda más.
- F-039 **no lee `CierrePeriodo.totalPorCobrarAlCierre`** en ningún sitio: es el saldo de la cartera
  —un stock— y es lo más parecido a la cartera que hay entre las columnas del cierre.

## La consecuencia que hay que revisar

Con esta decisión, un usuario con `recuperaciones.reportes.rentabilidad` y **sin**
`recuperaciones.cuentasporcobrar.acceder` ve, en el estado de resultados, las dos cifras agregadas
que F-036 decidió esconderle en el histórico de cierres. Es una segunda puerta a la misma
información agregada.

Esto puede ser correcto —los dos permisos son de la familia `recuperaciones.*` y suelen ir juntos en
las plantillas— o puede ser un descuido de la plantilla de permisos que este ADR acaba de hacer
visible. **No es una pregunta de arquitectura, es una pregunta de autorización**, y por eso F-039
dispara un paso de `security-guardian`: que se revise si la intención de F-036 era proteger el
concepto «crédito» o proteger la cartera de deudores. Si era lo primero, el arreglo correcto no es
esconder una fila del mix —ver el punto 1— sino gatear la **pantalla** de rentabilidad, y eso sería
un feature propio.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Gatear las dos cifras del estado de resultados y la fila del mix con `recuperaciones.cuentasporcobrar.acceder` | Rompe el criterio 2 para quien no lo tenga: los porcentajes vuelven a calcularse sobre una base que no incluye el crédito, en silencio y solo para algunos usuarios |
| Gatear solo las dos líneas del estado de resultados y dejar la fila del mix visible | Incoherente: la fila del mix expone la misma cantidad por otra vía. Un gate que la cifra de al lado desmiente es peor que ningún gate, porque parece protección |
| Gatear la fila del mix mostrándola con importe 0 | Una cifra falsa en un reporte. El ADR 0073 ya rechazó el «valor por defecto documentado» con el argumento que aplica igual aquí: un dato ausente es corregible, un dato falso ya está en los libros |
| Estrenar un permiso propio para «ver crédito en reportes» | Un permiso nuevo que nadie tiene asignado esconde el feature entero el día que se despliega, y ningún criterio lo pide. Si hace falta un gate, es sobre la pantalla y es otro feature |
| No escribir nada y dejarlo implícito | Es la divergencia más fácil de no ver: dos features del mismo epic tratando la misma cifra con dos criterios distintos, sin que nadie lo haya decidido |

## Consecuencias

**A favor:**

- La tabla del mix es coherente para todos los usuarios que pueden verla: los porcentajes suman 100
  y la base es la misma que la pantalla declara.
- Ninguna rama de visibilidad sin criterio que la recorra.
- La divergencia con F-036 queda documentada y con dueño: la revisa `security-guardian`, no se
  descubre dentro de seis meses.

**En contra / coste asumido:**

- Dos features del mismo epic tratan la misma cifra agregada con dos criterios de visibilidad
  distintos hasta que alguien unifique. Es deuda declarada, no accidental.
- Si la revisión concluye que hace falta gate, habrá que abrir un feature para ponerlo en el sitio
  correcto —la pantalla— en vez de en una fila.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant intacto y sin tocar.** F-039 no añade ninguna consulta: el crédito viaja
  en filas que `streamNormalizedSales` ya traía bajo `where: { tiendaId: scope.tiendaId, ... }`, y
  las dos cifras de flujo entran como `_sum` en el `aggregate` que `loadClosingDeductions` ya
  ejecutaba con el mismo `where`. `scope.tiendaId` lo resuelve `resolveReportScope`, que para todo
  rol distinto de `SUPER_ADMIN` exige que la tienda pertenezca al usuario de la sesión.
- **Autorización en el backend, no solo en el frontend.** Las dos route handlers siguen llamando a
  `resolveReportScope` con su permiso y devolviendo 401 sin él. Esta decisión no relaja ninguna
  comprobación existente: decide no añadir una nueva.
- **Cero datos personales nuevos.** Ninguna cifra de este feature lleva atado un deudor.
