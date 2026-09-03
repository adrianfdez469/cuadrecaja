# ADR 0026: Dos clientes HTTP separados hacia QAB, y ningún módulo importa los dos secretos

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-003
**Se apoya en:** [ADR 0013](0013-lectura-del-qabtoken-con-select-explicito.md) ·
[ADR 0014](0014-qab-api-base-url-ausente.md) ·
ADR 0029 de queandabuscando, «El alta de un negocio es una llamada de cuadrecaja, con un secreto de
integrador»

## Contexto

Desde la v10 del contrato hay **dos credenciales con sujetos distintos**:

- El **`qabToken`**, uno por negocio, que vive en `Negocio.qabToken` y autentica las siete rutas de
  `/api/internal/*`. Identifica **a un negocio**.
- El **`QAB_PROVISIONING_SECRET`**, uno solo, en el entorno y en claro, que autentica
  `POST /api/provisioning/credential`. Identifica **a cuadrecaja como integrador**, no a ningún
  negocio.

El ADR 0029 de queandabuscando lo dice del lado de ellos con una frase que no admite lectura
amable: *"El secreto de aprovisionamiento no autentica, ni autenticará, ninguna ruta de
`/api/internal/*`. Está prohibido pasarlo a `resolveCaller()`… si algún día hiciera falta otra
cosa, se supera esta ADR con otra, no se cablea el guard."* Y explica el motivo: su ADR 0013 había
retirado un secreto único de plataforma precisamente porque **una promesa de scoping a medias es
peor que no hacerla**, y reintroducir un segundo secreto sin esa frase escrita sería dejar la misma
trampa otra vez.

El criterio 10 de F-003 es la versión comprobable de eso, **en las dos direcciones**: el secreto de
aprovisionamiento como bearer de `/api/internal/*` tiene que ser rechazado, y el `qabToken` de un
negocio como bearer de `/api/provisioning/credential` tiene que responder 401.

La mitad de ese criterio la garantiza QAB. La otra mitad —que cuadrecaja no mande nunca la
credencial equivocada— es de este lado, y hoy no hay nada que lo impida: `postQabCatalogBatch`
recibe un `token: string` y le da igual de dónde venga.

Hay además un vector que ninguno de los dos contratos nombra. Los dos valores acaban **concatenados
en una cabecera `Authorization`**:

```ts
headers: { Authorization: `Bearer ${token}` }
```

Un `qabToken` pegado a mano con un salto de línea —copiado de un correo, de un chat, de un PDF— es
inyección de cabeceras HTTP. Y el campo de pegar a mano del criterio 13 es exactamente una entrada
de texto libre hacia esa concatenación.

## Decisión

**Cuatro reglas, todas estructurales: ninguna depende de que alguien recuerde algo.**

1. **Dos clientes en archivos distintos, y ninguno importa al otro.**

   | Cliente | Archivo | Credencial | Vocabulario |
   |---|---|---|---|
   | Sync (7 rutas) | `src/lib/qab/qabCatalogClient.ts` | `qabToken` de `loadQabTokens` | § Vocabulario de errores (v9) |
   | Aprovisionamiento | `src/lib/qab/qabProvisioningClient.ts` | `QAB_PROVISIONING_SECRET` | § Aprovisionamiento de negocios (v10) |

   Lo único que comparten es `readBoundedBody`, extraída a `src/lib/qab/qabHttp.ts`: una lectura
   acotada del cuerpo, sin credenciales ni vocabulario. Compartir una función pura no es cablear
   nada — es la misma distinción que hace el ADR 0029 con `hashSyncToken` y `readBearerToken`.

   Las constantes también se separan: `src/constants/qab.ts` para el sync,
   `src/constants/qabProvisioning.ts` para el alta. Que sean archivos distintos es lo que hace
   visible de un vistazo que no se mezclan.

2. **Ningún módulo lee las dos credenciales.** `QAB_PROVISIONING_SECRET` solo la lee
   `qabProvisioningEnv.ts`; el `qabToken` solo lo lee `loadQabTokens` en `outboxDrain.ts`
   (ADR 0013, ADR 0024). El criterio 10 deja de ser una convención y pasa a ser comprobable:

   ```bash
   grep -rln "QAB_PROVISIONING_SECRET" src/            # → qabProvisioningEnv.ts, y nada más
   grep -rn "qabToken: true" src/ | grep -v "omit:"    # → outboxDrain.ts, y nada más
   ```

   El `grep -v "omit:"` del segundo comando descarta las dos apariciones del `omit` global del
   ADR 0006, que son la defensa y no un lector. Ver ADR 0024, § «La invariante auditable».

   Ningún archivo aparece en las dos listas. Esa es la propiedad.

3. **Fail-closed, verificable sin red (criterio 9).** `mintQabBusinessCredential` comprueba
   `isUsableQabProvisioningSecret(secret)` **antes de tocar `fetch`** y, si es falso, devuelve
   `{ kind: "upstream_error", code: "PROVISIONING_NOT_CONFIGURED", retryable: false }` sin llamar
   ni una vez. No es defensa duplicada ociosa: la ruta ya devuelve 503 antes de llegar aquí, pero
   esta comprobación convierte *"nunca se llama a QAB con un `Authorization` vacío"* en un **test
   unitario con un espía de `fetch`**, en vez de una inspección de código. Y protege al siguiente
   llamador, que puede no ser esta ruta.

   `resolveQabProvisioningSecret` sigue la distinción del ADR 0014: **ausente ≠ mal configurada.**
   Ausente o en blanco → `null`, la acción no se ofrece, sin alarma. Presente pero inservible →
   `QabProvisioningConfigError` y 500, porque un despliegue equivocado tiene que verse el primer día.

   **Con las dos variables mal a la vez gana el secreto**, y no por preferirlo: es el orden en que
   la ruta comprueba (el secreto en el paso 2, la URL en el paso 3), y la razón que la pantalla
   muestra tiene que ser la misma que provocaría el error al pulsar. Si la lista dijera
   `BASE_URL_INVALID` y el `POST` fallara por el secreto, el operador arreglaría la variable
   equivocada y seguiría sin funcionar. La precedencia es el orden de declaración de
   `QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS`, para que no haya dos fuentes que puedan divergir.

4. **Todo valor que vaya a una cabecera `Authorization` se valida contra
   `/^[\x21-\x7E]+$/`** —una línea de ASCII imprimible, sin espacios ni saltos— con longitud mínima
   de 32. Se aplica a los tres sitios por donde puede entrar: el secreto del entorno, el token
   pegado a mano (`qabTokenPasteSchema`) y el token que devuelve QAB en el `201`
   (`qabProvisioningMintedResponseSchema`). Un valor que no lo cumpla nunca llega a concatenarse.

   Y el corolario: **ninguna ruta que valide un token devuelve ni registra `error.issues`**. Un
   issue de Zod puede arrastrar consigo el valor que lo provocó, y esa es la única forma en que un
   secreto podría salir por la puerta de la validación que existe para protegerlo.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un solo cliente HTTP parametrizado por credencial | Es la refactorización que alguien propondrá: dos funciones que hacen `fetch` con un `Bearer`. Y es exactamente el cableado que el ADR 0029 prohíbe: con un solo cliente, mandar la credencial equivocada pasa a ser un argumento mal puesto en vez de un imposible |
| Un solo archivo de constantes para toda la integración | El contrato separa los dos vocabularios **a propósito** («deliberadamente fuera del § Vocabulario de errores general»). Juntarlos invita a reutilizar un código donde no corresponde |
| Confiar en que QAB rechace la credencial equivocada | Es la mitad del criterio 10 que ya está cubierta. La otra mitad es no mandarla: un secreto de integrador enviado a las siete rutas de sync queda escrito en los logs de acceso de QAB, y un secreto que aparece donde no debe ya es un secreto que hay que rotar |
| Validar la forma del token solo al pegarlo | El `201` de QAB también acaba en una cabecera. Y una fila de `Negocio` restaurada de un backup viejo, o editada a mano en producción, es otra entrada. La validación va donde el valor se usa, no solo donde se teclea |
| Guardar el secreto de aprovisionamiento cifrado o en la base | Es configuración de entorno, no dato de negocio, exactamente igual que `QAB_API_BASE_URL` (ADR 0014). Meterlo en la base significa que restaurar un backup de producción en staging se lleva la credencial del integrador |
| Rechazar localmente un secreto de menos de 32 caracteres como «no configurado» | Escondería una configuración equivocada detrás de la misma pantalla que «todavía no lo hemos cableado». Es «mal configurado», y va con 500 |

## Consecuencias

**A favor:**
- El criterio 10 se puede verificar en las dos direcciones **y** además se sostiene por la
  estructura del código, no por la disciplina de quien lo escriba.
- El criterio 9 pasa de ser una revisión de código a un test unitario con un espía de `fetch`.
- Se cierra un vector de inyección de cabeceras que ni el contrato de QAB ni los criterios
  nombraban, en las tres entradas posibles.
- Los dos vocabularios de error no se pueden mezclar por descuido: viven en archivos distintos.

**En contra / coste asumido:**
- Dos clientes HTTP con estructura parecida. La duplicación es de forma, no de lógica —la parte
  común está extraída— y este ADR es lo que la justifica frente a la prohibición de duplicidad de
  `AGENTS.md`.
- La comprobación del secreto está en dos sitios (la ruta y el cliente). Deliberado: la de la ruta
  da la respuesta correcta al usuario, la del cliente hace el criterio 9 comprobable y protege al
  siguiente llamador.
- El regex rechaza tokens con caracteres no ASCII. Los que QAB genera son `base64url`, así que no
  hay caso real; si algún día lo hubiera, esta línea es donde se ve.

**Impacto en seguridad y escalabilidad:**
- **Aislamiento de credenciales:** el secreto de integrador no puede llegar a las siete rutas de
  sync porque ningún módulo que las llame lo importa, y el `qabToken` no puede llegar a la ruta de
  aprovisionamiento por lo mismo. Verificable con dos `grep`.
- **Aislamiento entre tenants:** el secreto de aprovisionamiento no identifica a ningún negocio, así
  que no amplía la superficie de un tenant. El `externalId` viaja en el cuerpo y sale del path
  (ADR 0023), nunca del cliente.
- Un secreto ausente no deja pasar nada: la invariante que el ADR 0008 de QAB llama «un secreto
  ausente jamás significa deja pasar todo», aplicada también de este lado.
- Reversión inmediata: son archivos nuevos y una función extraída. Ningún dato persistido cambia.
