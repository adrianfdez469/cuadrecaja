# ADR 0014: `QAB_API_BASE_URL` ausente significa «corrida en vacío», no un error

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-002

## Contexto

Todas las llamadas de la integración las inicia cuadrecaja (`§ El principio que ordena todo` del
contrato), así que hace falta saber a qué host apuntar. **Hoy no existe ninguna variable de entorno
para eso**: no está en `.env.example`, no está en `AGENTS.md` y el spec de F-002 lo dejó
explícitamente como decisión del arquitecto.

Y hay una asimetría que conviene ver: el **token** es por negocio y vive en la base
(`Negocio.qabToken`), pero el **host** es por entorno —producción, staging, el mock de un
desarrollador— y por tanto es configuración de despliegue, no dato de negocio.

La pregunta con filo no es cómo se llama la variable, sino **qué hace el cron cuando no está**. Y
choca de frente con el criterio 2: *"`GET /api/crons/sync-tienda` … con `Bearer ${CRON_SECRET}`
responde `200`"*. Si la variable ausente fuera un error, ese criterio sería imposible de verificar
en cualquier máquina que no tenga un QAB levantado —empezando por la del desarrollador que va a
implementarlo—.

Se descubrió además que `CRON_SECRET` ya se usa en los dos crons existentes y **tampoco está en
`.env.example`**, pese a que `AGENTS.md` declara ese archivo como la lista completa y actualizada.

## Decisión

**Una sola variable nueva, `QAB_API_BASE_URL`, opcional, con tres comportamientos bien separados:**

| Estado de la variable | Comportamiento |
|---|---|
| Ausente o en blanco | La corrida **no hace nada**: no reclama eventos, no abre ninguna transacción, responde `200` con `skipped: "QAB_API_BASE_URL_NOT_SET"` |
| Presente y válida | Corrida normal |
| Presente y malformada (no parsea como `URL`, o protocolo ≠ `http`/`https`) | `QabConfigError` → `500 { error: "QAB_CONFIG_INVALID" }` |

La distinción entre las dos últimas filas es el fondo de este ADR. **«No configurado» y «mal
configurado» son estados distintos y merecen respuestas distintas.** Un entorno sin la variable es
un entorno donde la integración todavía no se ha cableado —lo normal en desarrollo y en CI hoy—: no
hay nada roto que reportar. Una variable con una errata es un despliegue equivocado, y fallar en
silencio ahí significaría que la sincronización lleva días sin funcionar y nadie lo sabe.

Se añaden a `.env.example` **las dos** variables, con su comentario:

```env
# Integración con queandabuscando (QAB). Origen de la tienda online, sin barra final.
# Si no está definida, el cron /api/crons/sync-tienda responde 200 sin hacer nada:
# "no configurado" no es un error. Una URL malformada sí lo es (500).
QAB_API_BASE_URL="https://queandabuscando.example"

# Secreto de los crons de Vercel. Se compara contra `Bearer ${CRON_SECRET}`.
# Sin ella, los endpoints de /api/crons responden 401 siempre.
CRON_SECRET="your-cron-secret"
```

**El valor es el origen, sin barra final**, y las rutas del contrato se le concatenan desde
constantes (`QAB_CATALOG_SYNC_PATH`, `QAB_ORDERS_PULL_PATH`). Ninguna ruta de `/api/internal/*` se
escribe inline en el código de llamada.

En sentido contrario, `CRON_SECRET` es **fail-closed**: si no está definida, el endpoint responde
`401` siempre, también con cabecera. Los dos crons existentes comparan contra
`` `Bearer ${process.env.CRON_SECRET}` `` sin comprobar que la variable exista, lo que hace que un
literal `Bearer undefined` sea una credencial válida en un entorno mal configurado. El cron nuevo no
hereda ese hueco.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Variable obligatoria: sin ella el cron responde `500` | Rompe el criterio 2 en toda máquina sin QAB levantado, incluida la de quien implemente el feature y la de QA. Y convierte «todavía no lo hemos cableado» en una alarma diaria. |
| Sin ella, responder `200` pero **drenando igual** contra un host por defecto | Un host por defecto adivinado es peor que ninguno: manda catálogo real a un sitio que no es el que se cree. |
| Guardar la URL en la base, junto al token, por negocio | El token es por negocio; el host es por entorno. Meterlos en el mismo sitio significa que restaurar un backup de producción en staging manda tráfico a producción. |
| Derivarla de `NEXTAUTH_URL` como hace `getAppBaseUrlFromRequest` | Esa es la URL de **esta** aplicación. QAB es otro sistema en otro dominio. |
| Aceptar la variable con barra final y normalizar solo al concatenar | Se normaliza igual, pero en un solo punto (`resolveQabBaseUrl` recorta todas las barras finales) en vez de en cada llamada. |
| Añadir también un `QAB_ENABLED` booleano | Dos variables para decir lo mismo. La presencia de la URL ya es el interruptor. |

## Consecuencias

**A favor:**
- El criterio 2 se verifica en cualquier máquina, sin QAB y sin mock.
- Un `.env` incompleto degrada a no-op explícito y **auditable**: el informe del cron dice
  `skipped: "QAB_API_BASE_URL_NOT_SET"`, no un `200` mudo que parezca una corrida correcta.
- Una errata en la URL se ve el primer día, no el tercero.
- `.env.example` vuelve a ser la lista completa que `AGENTS.md` promete.

**En contra / coste asumido:**
- Una corrida en vacío se parece a una corrida sin trabajo pendiente si solo se mira el código de
  estado. Por eso el campo `skipped` va en el informe y no solo en un log.
- Si alguien despliega producción **sin** la variable, la sincronización no arranca y no hay alarma.
  El detector previsto es la reconciliación diaria del contrato (`§⑤`), que es otro feature; hasta
  entonces, es un punto de la lista de verificación del despliegue.
- Cambiar la política de `CRON_SECRET` a fail-closed en **este** cron y no en los otros dos deja una
  inconsistencia momentánea. Alinearlos es un `fix:` de dos líneas, fuera del alcance de F-002 —
  cada PR es atómico.

**Impacto en seguridad y escalabilidad:**
- Ninguna credencial nueva: `QAB_API_BASE_URL` no es un secreto, es un destino. El único secreto de
  la integración sigue siendo el `qabToken`, en la base y por negocio (ADR 0006, ADR 0013).
- **Aislamiento:** el host es común a todos los negocios y no participa de la separación entre
  tenants; esa la hace el token, que es por negocio.
- El fail-closed de `CRON_SECRET` cierra una suplantación real: sin él, cualquiera que sepa que la
  variable falta puede disparar el cron con `Bearer undefined`.
- Reversión inmediata: quitar la variable devuelve el sistema al no-op sin desplegar código.
