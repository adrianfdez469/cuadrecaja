# ADR 0081: El cierre va en cuatro tandas, y el contador de desprotegidas es el trinquete

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-021

## Contexto

El triaje encuentra **39 verbos desprotegidos en 31 archivos**. No es un arreglo puntual: es una
campaña. Y una campaña tiene dos maneras conocidas de salir mal.

La primera es cerrarlo todo en un solo cambio: 31 archivos tocados a la vez, y si el POS se rompe no
hay forma barata de saber cuál lo rompió. El criterio 5 —«ninguna pantalla del POS pierde
funcionalidad», verificado recorriendo venta, cierre e inventario en el navegador— se vuelve un
recorrido de todo o nada.

La segunda es partirlo y **dejarlo a medias**. Es lo que pasa con las campañas: las tres primeras
tandas entran, la cuarta se queda en una rama, y en `features.json` aparece un `passes: true` que
vale para la mitad del trabajo. La pregunta que este ADR tiene que contestar no es «¿en cuántos
trozos?», sino **«¿qué impide que un trozo se quede fuera sin que nadie lo note?»**.

## Decisión

**Cuatro tandas, y un trinquete que las cuenta.**

### Las tandas

**Tanda 0 — la pieza y el censo. Ninguna ruta cambia todavía.**
Entra `src/lib/tenantScope.ts` (ADR 0076), entra el inventario con las **229** entradas clasificadas
(ADR 0079) y entra su test. Las 39 desprotegidas están marcadas como tales y el trinquete queda
armado en 39. La aplicación se comporta exactamente igual que antes: es un cambio de andamiaje, y su
diff se puede revisar sin miedo.

**Tanda 1 — el piloto: los dos verbos del arranque del POS. 2 verbos.**
`GET /api/transfer-destinations` y `GET /api/cierre/[tiendaId]/last`.

Son los dos que nombran los criterios 2 y 3, y no van primero por eso: van primero porque son
**exactamente los dos que el POS llama al arrancar**, en el mismo `Promise.all` de
`src/app/pos/page.tsx:1390-1393`. Son, de las 39, las que más fácilmente romperían el criterio 5. Con
el diff más pequeño posible, la primera tanda que toca comportamiento contesta la pregunta más cara:
*¿la guarda deja pasar al cajero legítimo?* Si la respuesta fuera no, se descubre con dos archivos
tocados y no con veintinueve. Y de paso deja escrito el patrón que las otras 37 copian —en
`transfer-destinations/route.ts` el patrón ya estaba en el `POST`, veinte líneas más abajo del bug.

**Tanda 2 — las escrituras cruzadas. 15 verbos.**
Web: `venta POST` · `movimiento/import POST` · `movimiento/rechazo POST` · `cpp/migrate POST` ·
`cierre/open PUT` · `cash-breakdown PUT` · `moneda-breakdown PUT` · `locales/[id] PUT` ·
`productos_tienda POST` · `productos_tienda PUT` · `proveedores-consignadores/cierre PUT` ·
`notificaciones/auto-check POST`.
APK: `app/venta POST` · `app/periodo/abrir POST` · `app/venta/[ventaId] DELETE`.

Van antes que las lecturas porque **el daño de una escritura no se deshace**: inyectar ventas en otro
negocio, inflar existencias ajenas, pisar costos históricos, reescribir las asignaciones de usuarios
de una tienda ajena.

**Tanda 3 — las lecturas. 22 verbos.**
Web: `venta GET` · `cpp GET` · `cpp/migrate GET` · `productos_tienda GET` · `.../with-codes GET` ·
`.../catalogo_pos GET` · `.../productos_venta GET` · `productos_tienda/expirando GET` ·
`resumen-dia GET` · `movimiento/recepcion GET` · `cash-breakdown GET` · `moneda-breakdown GET` ·
`tasas-at-close GET`.
APK: `app/venta/[ventaId] GET` · `app/venta GET` · `app/periodo/actual GET` ·
`app/transfer-destinations GET` · `app/productos GET` · `app/resumen-dia GET` ·
`app/descuentos/preview POST` (escribe nada: solo calcula sobre filas ajenas).
Halladas fuera del censo: `discounts/preview POST` · `discounts/active GET` — las gemelas web de la
anterior, encontradas por el `implementer` al leer `applyDiscountsForSale` por otro motivo
(`.agents/specs/F-021.md` § 0.4).

Cada tanda es un commit, con su porción del inventario actualizada y su porción de tests.

> **El trinquete funcionó, y conviene dejar constancia de cómo.** El censo llegó al paso 5 con 37, y
> el `implementer` encontró 2 más. Porque el contador vive en el código y la suite lo comprueba, la
> corrección fue subir la constante y cerrar las dos en la misma tanda — visible en el diff. Con el
> inventario en un documento, esas dos se habrían cerrado en silencio o no se habrían cerrado, y el
> `qa` habría certificado un «0 desprotegidas» medido contra una lista incompleta. **Un trinquete no
> impide que el censo esté mal: hace que corregirlo sea barato y ruidoso**, que es todo lo que se le
> puede pedir.

**Las 10 de `/api/app` se reparten entre las tandas 2 y 3, no van en una propia.** Agruparlas por
cliente —«las de la APK»— es la tentación y es la equivocada: el criterio de orden es el **daño**, no
quién llama. Un `venta POST` cruzado destroza igual desde la APK que desde la web, y separarlas por
cliente dejaría tres escrituras irreversibles esperando detrás de trece lecturas.

**Con una salvedad que hay que decir:** el criterio 5 se recorre en el navegador y **no cubre la
APK**. Esas 10 necesitan su propio recorrido —abrir período, vender, cancelar y consultar el resumen
desde la aplicación—, declarado por separado en el informe del `qa`. Sin dispositivo disponible, eso
no habilita dar la tanda por buena: obliga a escribir que esa parte quedó verificada solo por `curl`.

### El trinquete

El inventario declara una constante, `DESPROTEGIDAS_ABIERTAS`, y el test del ADR 0079 afirma que el
número de entradas `desprotegida` **es exactamente ese**. Cada tanda la baja: `39 → 39 → 37 → 22 → 0`.

Eso da tres propiedades, y son las que contestan la pregunta del contexto:

- **Nada se queda a medias en silencio.** Mientras la constante no valga 0, el inventario dice por
  escrito —en el código, no en una nota— cuántas rutas siguen abiertas y cuáles.
- **Nada retrocede.** Bajarla exige cerrar rutas; subirla exige editar la constante en el mismo
  commit, donde se ve en el diff. No hay forma callada de reabrir una.
- **El `qa` tiene un gate binario.** `passes: true` requiere `DESPROTEGIDAS_ABIERTAS === 0` y la suite
  en verde. No es una lectura de código: es una afirmación que se ejecuta.

Al cerrar el feature la constante desaparece y el test pasa a afirmar `=== 0` de forma permanente.
Combinado con el contraste contra el árbol real, una `route.ts` nueva sin clasificar rompe la suite, y
clasificarla como `desprotegida` también: **la única salida es decidir su alcance**.

### Reversión

Cada tanda se revierte sola: son commits independientes sobre una pieza que la tanda 0 ya dejó
puesta. Revertir la tanda 3 no toca la 2. Lo único no reversible con un `git revert` limpio es la
tanda 0, y no cambia comportamiento.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un solo commit con las 39 | Ante una regresión del POS, 31 archivos sospechosos y un recorrido manual de todo o nada. Y el diff no se revisa de verdad |
| Un commit por ruta (39 commits) | El ruido esconde la señal, y el recorrido manual del criterio 5 habría que repetirlo 39 veces. Las rutas de una misma tanda comparten patrón y se revisan mejor juntas |
| Ordenar por archivo, o alfabéticamente | Ignora que unas hacen daño irreversible y otras no, y desaprovecha la oportunidad de descubrir barato un fallo del criterio 5 |
| Empezar por las escrituras, que son las graves | Deja el riesgo del criterio 5 para el final. Las dos rutas del arranque del POS son las que pueden romper una pantalla; conviene saberlo con dos archivos tocados |
| Fiar el «no queda ninguna» a la revisión de la PR | Es exactamente lo que falla cuando la campaña se alarga. La regla del repositorio es que un criterio se da por cumplido **ejecutando**, no leyendo |
| Un `TODO` o un issue por cada ruta pendiente | No se ejecuta y no rompe nada. Un contador que la suite comprueba, sí |

## Consecuencias

**A favor:**
- El riesgo más caro —romper el POS— se descubre en la tanda más pequeña.
- El estado real del cierre está escrito en el código y comprobado por la suite, no en la cabeza de
  quien lo empezó. Si el trabajo se retoma en otra sesión, `DESPROTEGIDAS_ABIERTAS` dice dónde iba.
- Ninguna tanda deja la aplicación en un estado peor que el anterior.

**En contra / coste asumido:**
- Entre la tanda 0 y la 3 hay una ventana con rutas todavía abiertas. Es inevitable en cualquier
  reparto y se acorta poniendo las cuatro tandas en la misma PR.
- La constante hay que tocarla en cada tanda. Es el punto: obliga a decir en voz alta cuántas
  quedan.

**Impacto en seguridad y escalabilidad:**
- La ventana de exposición se ordena por daño: lo irreversible se cierra antes que lo reversible.
- El trinquete sobrevive al feature. Es la parte que impide que dentro de seis meses vuelva a haber
  39 rutas abiertas sin que nadie se entere.
