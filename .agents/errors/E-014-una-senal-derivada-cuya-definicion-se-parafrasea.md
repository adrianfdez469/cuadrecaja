# E-014: Una señal derivada cuyo nombre y definición no coinciden

**Área:** api
**Apariciones:** 1 — F-005 (ciclo 2; el sustituto del defecto de [E-013](E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md))

## Síntoma

Ninguno visible, y ese es el problema. El recorrido **normal** del comerciante rompe un criterio de
aceptación sin ningún error, ninguna traza y ningún test en rojo:

```
Local nunca publicado → rellenar sus datos públicos → Guardar (sin publicar)
  → encender el interruptor de publicar
  → el diálogo de marca NO se abre: nunca se preguntó, y ya no se preguntará
```

## Causa raíz

La señal se llamaba `firstPublishPending` —«el primer publish sigue pendiente»— pero se calculaba
como **«nunca se emitió un evento `STORE` para este local»**:

```ts
const previous = await tx.outboxEvento.findFirst({
  where: { negocioId, entidad: STORE_ENTITY, entidadId: tiendaId },
});
const firstPublishPending = previous === null;
```

Y el mismo contrato, unas secciones antes, decidía que **todo `PATCH` aplicado emite un evento**,
publique o no — una buena decisión, tomada por otro motivo (que el criterio del «editar el teléfono
no reabre una tienda» fuera cierto sin lógica). Las dos decisiones son correctas por separado y se
destruyen juntas: guardar consume la señal del publicar.

Lo que lo hizo invisible: **el nombre decía la verdad y la implementación no**, así que cada lector
posterior —incluidos el implementador, el tester y el primer ciclo de QA— leía el identificador y
daba por buena la semántica sin ir a mirar la consulta.

Agravante de la misma familia: la definición estaba **parafraseada en ocho sitios** entre el
contrato de interfaces, el contrato de diseño y los comentarios del código. Corregirla obligó a
tocarlos todos, y uno se quedó atrás por una carrera entre dos agentes en paralelo.

## Solución

[ADR 0035](../../docs/adr/0035-la-senal-del-primer-publish-se-filtra-por-el-payload.md). La señal
pasa a filtrar por el contenido del evento, no por su existencia:

```ts
payload: { path: ["publishToStore"], equals: true }
```

Sin migración — verificado ejecutando el predicado contra la base real antes de prescribirlo: sobre
un local con 10 eventos, 5 daban `true` y 5 `false`, así que discrimina.

Tres remates que valen tanto como el arreglo:

- **`operacion: CREATE|UPDATE` dejó de compartir la variable.** Preguntaba otra cosa —«¿existe ya
  la fila del otro lado?»— y estaba colapsada en la misma señal.
- Había un **tercer sitio** con el mismo defecto que nadie había visto: la respuesta del `PATCH`
  devolvía `firstPublishPending: false` fijo.
- El nombre **se mantuvo**: con la definición corregida ya es literal. Lo que mentía era el
  comentario que lo definía, y eso es lo que se reescribió.

## Cómo evitarlo

- **Una señal derivada se define en UN sitio.** Si su definición aparece parafraseada en el
  contrato, en el diseño y en tres comentarios, la próxima corrección va a dejar alguna atrás.
- **Cuando el nombre y la consulta discrepan, gana la consulta — y el nombre es el bug.** Un
  identificador honesto es una defensa real: nadie va a leer el `where` si el nombre ya le dijo
  lo que quería oír.
- **Al fijar dos reglas que tocan la misma tabla, comprobar si una consume lo que la otra observa.**
  Aquí, «todo `PATCH` emite» y «la señal es que no haya eventos» eran incompatibles y estaban a
  cuarenta líneas de distancia en el mismo documento.
- Y una del harness: **un tipo que el contrato usa y no declara es una colisión garantizada** entre
  el implementador y el tester, que programan en paralelo sin verse. Pasó con `IStoreSyncRow` — uno
  le puso un campo, el otro escribió el test sin él, y `tsc` lo cazó a mitad del paso.
