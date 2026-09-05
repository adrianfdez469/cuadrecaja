# Solicitudes abiertas al equipo de queandabuscando

Cosas que el contrato exige o presupone y que su API no ofrece hoy. Cada una bloquea features
concretos de [`features.json`](features.json). Se registran aquí para que no se pierdan entre
conversaciones y para que el bloqueo tenga una causa nombrada.

Al resolverse: anotar la versión del contrato que la incorpora, desbloquear los features
afectados y borrar la entrada de la tabla de abiertas.

## Abiertas

| # | Qué falta | Bloquea | Desde |
|---|-----------|---------|-------|
| S-002 | Qué hace el SQL espejo con un producto borrado en blando | F-008 | contrato v7 · 2026-09-01 |
| S-003 | El claim `email` del SSO exige forma de correo y el contrato no lo dice | ninguno — riesgo de producción de F-009 | contrato v10.1 · 2026-09-05 |

## Resueltas

| # | Qué faltaba | Resuelta en | Cuándo |
|---|-------------|-------------|--------|
| S-001 | Releer un pedido concreto sin depender del cursor | contrato v8 (F-033 de QAB) | 2026-09-03 |

---

### S-001 · No hay forma de releer un pedido concreto — RESUELTA en la v8

> **Cerrada el 2026-09-03.** La v8 del contrato (F-033 de QAB) concede **las dos** formas que se
> pidieron abajo, no una. Ver § ③④ Pedidos, «Las lecturas laterales». F-013 y F-017 pasan de
> `blocked` a `pending`; F-015 sigue bloqueado, pero por su otro motivo —el lado receptor de la
> v6— y no por esto. El apaño de `?since=<id-1>&limit=1` se descarta: nunca se construyó.
>
> Lo que quedó, y ata al implementar:
>
> - `GET /api/internal/orders?status=<UN estado>` — un solo estado, la coma es `400`. Es la
>   relectura del ciclo normal, y el contrato la nombra literalmente para los `AWAITING_CUSTOMER`.
> - `GET /api/internal/orders?ids=<a>,<b>` — hasta **100** ids; por encima es `400
>   IDS_LIMIT_EXCEEDED`, nunca la lista recortada en silencio. Un id de otro negocio responde igual
>   que uno inexistente: `200 { "orders": [] }`.
> - `?after=` pagina **solo** `?status=`, sobre su propio puntero `nextAfter`. Sin `?status=` es
>   `400`.
> - `nextCursor` es **siempre `null`** en las dos, y **ninguna lateral mueve el cursor del pull**:
>   repetir el pull con el mismo `since` devuelve el mismo cuerpo. `nextAfter` no viaja nunca en el
>   pull incremental.
> - Una lateral **no marca `PULLED`**, así que **no cuenta** para «un solo pull en vuelo por
>   negocio» y puede lanzarse en paralelo. Sí aplica los dos vencimientos antes de leer.
> - Dos laterales simultáneas pueden ver **estados distintos del mismo pedido** si su vencimiento
>   cae entre las dos. No es un bug que reportar: gana la más reciente.
> - `400 INVALID_QUERY` entra por fin en el vocabulario de errores; la ruta lo emitía desde F-007
>   sin que el contrato lo recogiera.

**El problema, tal como se planteó.** El único endpoint de lectura de pedidos era
`GET /api/internal/orders?since=&limit=`, que filtra `id > since`. Pero la resolución de una
propuesta ocurre siempre sobre un pedido que el POS **ya pulleó**, cuyo `id` es por tanto **menor
que el cursor**. El pull incremental nunca lo devolvía.

Consecuencia directa: **el encargado no se enteraba nunca de que el comprador aceptó o rechazó.**
No era un caso raro — con el envío cotizado de la v6, cotizar *es* proponer, así que el camino
pasa por ahí en cada pedido a domicilio de una tienda en `QUOTED_PER_ORDER`.

**Lo que se pidió.** Cualquiera de las dos, `?ids=` o `?status=`, con preferencia por la segunda
porque el POS no tiene por qué llevar la lista. Llegaron las dos, y con `nextCursor` sin moverse,
que era la condición que se puso.

---

### S-002 · El SQL espejo no dice qué hacer con un borrado en blando

**El problema.** El SQL espejo de reconciliación que publica el contrato (§ ⑤) selecciona de
`ProductoTienda` filtrando por tienda, por `publicarEnTienda`, por `precio` no nulo y por
`monedaPrecioCode` no nulo. No filtra nada más, porque no puede: el schema de cuadrecaja es de
cuadrecaja y vosotros no lo conocéis.

Pero cuadrecaja **no borra productos, los marca**: `Producto` y `ProductoTienda` tienen `deletedAt`
y el borrado es blando. Una fila borrada de esa forma sigue existiendo, sigue teniendo precio y
moneda, y sigue colgando de un producto con `publicarEnTienda = true` — así que **el espejo la
cuenta**. Del vuestro, en cambio, ese producto ya no está: lo despublicamos y os llegó su baja.

Consecuencia: el hash diverge y **no vuelve a converger nunca**. Y esa divergencia es exactamente
la señal con la que F-008 concluye que la sincronización se rompió, así que dispara la
recuperación (poner `dispPublicada = NULL` en todas las filas de la tienda) y la alerta, una y
otra vez, sobre unos datos que en realidad están bien.

**Lo que preguntamos.** No es una petición de API: es una aclaración del contrato, y creemos que
la respuesta correcta es la primera.

- ¿Confirmáis que el espejo debe excluir las filas dadas de baja, y que la exclusión es
  responsabilidad del lado que la tiene (nosotros añadimos `AND p."deletedAt" IS NULL AND
  pt."deletedAt" IS NULL`)? Si es así, nos vale con que quede escrito en el § ⑤ como nota, para
  que el siguiente que lo lea no tenga que deducirlo.
- ¿O hay algún caso en el que un producto retirado deba seguir contando por vuestro lado?

**Por qué no lo decidimos solos.** Podríamos añadir el filtro y seguir. Pero el hash es un acuerdo
entre dos bases de datos de dos organizaciones: si cada lado ajusta el espejo por su cuenta para
que le cuadre, deja de detectar lo que existe para detectar. Preferimos que la regla esté escrita
en el documento vinculante.

**Mientras tanto** no bloquea nada inmediato. F-001 solo comprueba que el SQL corre contra el
schema real, y ahí el soft delete no interviene. Quien tiene que estar resuelto antes es **F-008**,
que es donde el hash pasa a ser una decisión operativa.


---

### S-003 · El claim `email` del SSO se valida como correo, y eso no está escrito en ninguna parte

**Cómo apareció.** Verificando F-009 de punta a punta contra una instancia de desarrollo de
queandabuscando. No lo encontró una lectura del contrato: lo encontró un canje real que falló.

**El problema.** El ADR 0067 de cuadrecaja decidió emitir el claim `email` desde `Usuario.usuario`
—que es el campo de identidad de cuadrecaja, único y validado con `EMAIL_REGEX` **en el alta**—
apoyándose en que el contrato **no publica ningún requisito de formato** para ese claim. Y no lo
publica: ni `sync-contract.md`, ni `despliegue.md` § 8.4, ni el bloque «Fase 1 · B» de
`flujos-cc-qab.html` dicen nada del formato.

Pero el código receptor sí lo exige. En `src/lib/auth/ssoToken.ts` de queandabuscando, el claim se
valida con `z.email().optional()`. Un token cuyo `email` no tenga forma de correo se rechaza con:

```
401 {"error":"SSO_REJECTED","reason":"malformed"}
```

**Por qué importa, y por qué no lo detecta cuadrecaja.** `EMAIL_REGEX` se aplica al **alta** de un
usuario. Las cuentas creadas **antes** de esa validación conservan un `usuario` que puede ser
`admin`, `vendedor` o cualquier cosa. Esos usuarios verán el botón, recibirán un enlace bien
firmado, y el canje fallará **del lado de queandabuscando**, sin que nada del lado de cuadrecaja
haya ido mal. El fallo aparece en producción, en la cara del comerciante, y el log útil está en la
otra organización.

**Lo que preguntamos.** No es una petición de API: es una discrepancia entre el documento y el
código, y hay dos salidas legítimas. Preferimos que lo decidáis vosotros, porque el que valida sois
vosotros.

- ¿Confirmáis que el formato de correo **es** un requisito del claim? Si es así, basta con que quede
  escrito en `despliegue.md` § 8.4, y el arreglo es nuestro: cuadrecaja tendrá que decidir qué
  emite para una cuenta cuyo `usuario` no es un correo.
- ¿O el `z.email()` es más estricto de lo que pretendíais, y el claim debería aceptar cualquier
  cadena no vacía —siendo `sub` la identidad real y `email` solo un dato de presentación?

**Qué NO bloquea.** F-009 está cerrado y verificado: cuadrecaja emite `Usuario.usuario` verbatim,
que es exactamente lo que su ADR 0067 decidió, y todos sus criterios de aceptación pasan. Esto es un
riesgo de despliegue, no un feature detenido. **Conviene resolverlo antes de que el SSO llegue a
producción**, no antes de seguir programando.
