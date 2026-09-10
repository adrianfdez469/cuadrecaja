# E-061: Una enmienda del contrato posterior al paso 5 no reabre el trabajo ya entregado

**Área:** build
**Apariciones:** 3 — F-030 · F-033 · F-035 (ver la adenda del final)

## Síntoma

No hay mensaje de error, y no hay nadie a quien atribuirlo. El código de producción es correcto, los
tests están en verde, y aun así **un criterio de aceptación se queda sin cobertura de regresión**.

En F-030, el contrato declaraba en su §2.1 que `refundCashRatio` tenía **dos** llamadores y exigía
que dijeran lo mismo. Su §3 **solo cableaba uno**. El `implementer` lo detectó al escribir, desempató
abriendo el ADR y lo reportó. El `arch-guardian` consolidó las tres fuentes —contrato, sección de
verificación y ADR— y de paso endureció el criterio 11 para exigir las dos mitades del desglose.

Todo eso ocurrió **después de que el `dev-tester` entregara**. Su test cubría el llamador que el §3
cableaba, que era el único que su versión del contrato aterrizaba. QA lo destapó por mutación:
quitar el reparto por ratio del segundo llamador dejaba los 26 tests del archivo en verde.

## Causa raíz

El contrato es un documento vivo durante el paso 4 y **se congela de hecho** cuando arrancan
`implementer` y `dev-tester` en paralelo. Pero nada lo congela de derecho: una auditoría de
seguridad, un arbitraje o un hallazgo del propio paso 5 pueden enmendarlo mientras las dos mitades
corren, o después de que una de ellas haya terminado.

Cuando eso pasa, **quien ya entregó lo hizo contra una versión que ya no existe**, y el pipeline no
tiene ningún mecanismo que lo reabra. Las dos mitades escriben sin verse a propósito —esa es la
razón de ser del gate— así que tampoco pueden notarlo entre ellas.

Es primo de [E-018](E-018-la-redaccion-congelada-de-un-criterio-diferido.md), que describe la
redacción **congelada** de un criterio ya contradicha por un ADR posterior; aquí lo congelado no es
el criterio sino la lectura del contrato que un agente se llevó a su corrida. Y se distingue de
[E-030](E-030-un-contrato-que-se-contradice-entre-su-docstring-y-su-adr.md) en el momento: E-030 es
la contradicción; esto es lo que queda **después** de resolverla.

## Solución

Lo que atrapó el hueco fue **QA leyendo el contrato final**, no el que existía cuando cada agente
empezó, y midiendo por mutación en vez de confiar en que un test verde cubra lo que dice cubrir.

La corrección fue devolver el hallazgo al `dev-tester` con la mutación exacta que lo reproduce, y
volver a verificarla en QA en vez de aceptar su palabra — incluyendo **romper también el otro
llamador**, para distinguir «el hueco se cerró» de «el hueco se movió».

## Cómo evitarlo

Regla para el coordinador: **cuando el contrato se enmienda después de lanzar el paso 5, anotar qué
secciones cambiaron y avisar explícitamente a la mitad que ya entregó.** No basta con que el
documento quede bien: hay que decirle a quien escribió contra la versión anterior qué se movió bajo
sus pies.

Y la señal que lo delata sin depender de que nadie se acuerde: si el `implementer` reporta una
contradicción del contrato —como aquí—, **esa misma contradicción es la lista de lo que hay que
re-verificar en tests**. Una sección que el implementador tuvo que desempatar es, por definición,
una sección que el tester pudo leer del otro modo.

Regla para `qa`: leer siempre el contrato **en su estado final**, y cuando lleve marcas de enmienda,
tratar cada punto enmendado como candidato a hueco de cobertura. Ahí es donde estará.


---

## Adenda F-033 — la reintroduje justo después de evitarla, y en el otro extremo del pipeline

En F-033 el coordinador **evitó este error a propósito** entre el arquitecto y el paso 5: agrupó
seguridad, diseño y una decisión del humano en **una sola ronda de enmienda**, y esperó a cerrarla
antes de lanzar `implementer` y `dev-tester`, citando esta ficha como motivo.

Y luego lo reintrodujo por el otro lado. Cuando el `implementer` ya había entregado, el
`ui-designer` corrigió su contrato de diseño y, entre otras cosas, **cambió un copy**: la acción
del `EmptyState` pasaba de `Limpiar filtros` a `Ver la lista completa`, para resolver una colisión
de dos botones con el mismo texto a 320 px. **Nadie avisó al `implementer` de ese cambio.**

El resultado fue exactamente el que esta ficha describe: el copy nuevo **no existía en ningún sitio
de `src/`**, el criterio 21 seguía fallando, y el QA lo reportó como bloqueante contra código que
nadie había tenido oportunidad de escribir.

**Lo que generaliza:** esta ficha se escribió pensando en el contrato de **interfaces** enmendado
después de que el paso 5 entregara. Aplica igual —y se olvida más fácilmente— al contrato de
**diseño**, que se corrige en rondas posteriores porque sus criterios solo fallan al ejecutarse.
Cada corrección del `ui-designer` posterior a la entrega del `implementer` es una enmienda del
paso 5, aunque solo cambie una cadena de texto.

**Regla, sin excepciones:** después de CUALQUIER corrección de un contrato —interfaces o diseño—
hecha cuando alguien del paso 5 ya entregó, el coordinador le manda **la lista de lo que cambió**.
No «revísalo otra vez»: qué secciones, y qué se espera de él. Un copy cambiado es una enmienda.


---

## Adenda F-035 — la tercera, y la que enseña cómo se detecta sola

En F-035 el coordinador volvió a agrupar las enmiendas para evitar esta ficha, y esta vez cerró
**tres rondas completas antes de abrir el paso 5** (seguridad, la ampliación de la lista de
testabilidad del paso 4b, y el alcance de una excepción de propiedad). Aun así ocurrió una cuarta
vez, por la única vía que quedaba abierta: **el paso 5 destapó un hueco del contrato**.

El `implementer` reportó que `summarizeVentaCobros` dejaba `cobrosMontoBase` **negativo** con una
`REVERSION_ABONO` huérfana, y que el contrato solo había mandado apuntalar el **conteo**. No lo
resolvió por su cuenta —correcto— y el `arch-guardian` lo decidió en una tercera enmienda… **cuando
el `implementer` ya había entregado**. Exactamente lo que esta ficha describe.

**Lo que salvó la situación fue el `dev-tester`.** Escribió el caso nuevo contra el contrato
enmendado y su suite quedó en **69/70 con exit 1**. Ese único rojo era el desfase, y el coordinador
lo cerró con una línea antes de lanzar el `qa`, en vez de dejar que el `qa` lo reportara como
defecto contra código que nadie había tenido oportunidad de escribir.

**Regla nueva, que complementa la de arriba:** cuando una enmienda posterior a la entrega del
`implementer` cambie algo **testeable**, mándala **también** al `dev-tester`. Su rojo es el detector
más barato que tiene el pipeline para esta clase de desfase — más barato que el `qa`, y llega antes.
Un rojo del paso 5 tras una enmienda **no es un fallo del tester**: es la enmienda funcionando.

Y el corolario que esta tercera aparición hace evidente: **agrupar enmiendas reduce la ventana, no
la cierra.** El paso 5 puede destapar un hueco del contrato en cualquier momento, porque es el
primero que ejecuta algo. La defensa no es «enmendar antes», que ya se hizo tres veces aquí, sino
**saber a quién avisar cuando la enmienda llega tarde**.
