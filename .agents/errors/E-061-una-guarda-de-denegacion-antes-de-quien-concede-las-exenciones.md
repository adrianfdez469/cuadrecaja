# E-061: Una guarda de denegación colocada antes de la función que concede las exenciones

**Área:** auth
**Apariciones:** 1 — F-029 (§ 10.1, ADR 0107)

## Síntoma

Tras cerrar el agujero de permisos por tienda, **un `SUPER_ADMIN` recibía 403 en las siete rutas
con permiso**, incluida la que estrenaba el feature. Justo el rol que existe para no quedarse
fuera de nada, expulsado por un arreglo de seguridad.

Ni error ni aviso: `npx tsc --noEmit` y `npm run lint` en **exit 0**. Lo destaparon **dos tests que
ya existían** y que nadie había tocado en el feature.

El segundo síntoma es peor que el primero y pasa desapercibido: el `SUPER_ADMIN` está exento del
eje de **permisos** pero **no** del de **tenant**, y la guarda mal colocada convertía un
`OUT_OF_TENANT` en un `MISSING_PERMISSION`. Veredicto equivocado **y** diagnóstico tapado.

## Causa raíz

La función recibía los permisos del usuario **en esa tienda** y debía fallar cerrado cuando no los
tuviera. Se escribió como un `return` anticipado:

```ts
if (permisosEnTienda === undefined) return "MISSING_PERMISSION";
const autorizado = verificarPermisoUsuario(permisosEnTienda, permisoRequerido, session.user.rol);
```

Pero el atajo del rol vive **dentro** de `verificarPermisoUsuario`. Un `SUPER_ADMIN` no tiene por
qué tener fila de `UsuarioTienda` en ninguna tienda, así que **nunca llegaba** a la línea que lo
eximía.

Lo revelador: el docstring de la propia función, tres líneas más arriba, decía *«Not needed for
SUPER_ADMIN, who passes on the role alone, exactly as `verificarPermisoUsuario` already resolves it
today»*. **La intención estaba escrita y el orden de las guardas la anulaba.** No contradecía
ningún tipo — solo contradecía su propia prosa.

## Solución

Que la denegación por dato ausente se exprese **como el peor dato posible** y pase por el mismo
evaluador que concede las excepciones, en vez de cortocircuitarlo:

```ts
const permisos = permisosEnTienda === undefined ? "" : permisosEnTienda;
const autorizado = verificarPermisoUsuario(permisos, permisoRequerido, session.user.rol);
if (!autorizado) return "MISSING_PERMISSION";
```

La cadena vacía **no es un origen de permisos**: es «ninguno en esta tienda». Deniega a todo el
mundo salvo al rol exento por diseño, y no reintroduce la lectura de `session.user.permisos`, que
era el hueco original.

## Cómo evitarlo

**Una guarda de denegación colocada antes de la función que concede las exenciones las elimina
todas.** Cuando una comprobación tiene un evaluador con excepciones dentro, el caso «no tengo el
dato» no se resuelve con un `return` propio: se traduce al valor más restrictivo posible y se deja
pasar por el evaluador, que es el único sitio donde las excepciones están escritas una vez.

Detectarlo cuesta **un** caso de test: el rol exento **sin** el dato. Un test que solo pruebe el rol
exento *con* permisos, o un rol normal sin ellos, pasa en verde con el bug puesto.

Y una señal de alarma barata al revisar: si el docstring afirma una exención, comprobar que el
camino de código puede llegar a ella. Emparentado con [[E-014]] —el nombre dice una cosa y la
consulta calcula otra— y con [[E-030]], donde docstring y criterio se contradicen entre documentos;
aquí la contradicción es entre la prosa y el código **del mismo archivo**.
