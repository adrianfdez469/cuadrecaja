# Contratos de integración n8n — Referidos y landing

Este documento describe cada llamada **saliente** desde la aplicación hacia **webhooks de n8n**: variables de entorno, URL, cuerpo JSON, comportamiento ante errores y notas de seguridad.

Convenciones comunes:

- **Método:** `POST`
- **Cabecera:** `Content-Type: application/json`
- **URL:** `process.env.<WEBHOOK>` + opcionalmente `process.env.<API_KEY>` concatenado al final (mismo patrón que el formulario de contacto). Si no usas query string en n8n, deja `API_KEY` vacío y configura la ruta completa solo en `WEBHOOK`.
- **Respuesta esperada:** HTTP **2xx**. Si n8n responde otro código, el comportamiento depende del endpoint (ver cada sección).

---

## 1. Activación de promotor (`promoter-apply`)

**Origen en código:** `src/app/api/promoters/apply/route.ts`  
**Disparo:** Tras validar el cuerpo, generar JWT de activación, persistir hash del token y construir `activationUrl`.

| Variable | Descripción |
|----------|-------------|
| `N8N_PROMOTER_ACTIVATION_WEBHOOK` | URL base del webhook (obligatoria para enviar correo). |
| `N8N_PROMOTER_ACTIVATION_API_KEY` | Sufijo opcional (p. ej. `?token=xxx` o path secreto). |

**Cuerpo JSON enviado a n8n:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `fullName` | string | Nombre del solicitante. |
| `email` | string | Correo (normalizado a minúsculas en validación). |
| `activationUrl` | string | URL completa para activar: `{base}/activar-promotor?token=...` |
| `token` | string | JWT de activación (mismo que va en la URL). |
| `source` | string | Constante: `promoter-apply`. |
| `timestamp` | string | ISO 8601. |

**Errores:**

- Si el webhook no está configurado: no se llama a n8n (solo log de advertencia).
- Si n8n responde **no 2xx**: se lanza error y la API responde **500** al cliente (`/api/promoters/apply`).

**Seguridad:** El token es de un solo uso y expira (ver `REFERRAL_TOKEN_TTL.activationMinutes` en `src/constants/referrals.ts`). No reenviar el correo con el mismo token tras uso.

---

## 2. Login mágico de promotor (`promoter-magic-link`)

**Origen en código:** `src/app/api/promoters/magic-link/request/route.ts`  
**Disparo:** Solo si existe promotor `ACTIVE` con ese email; tras generar token y persistir hash.

| Variable | Descripción |
|----------|-------------|
| `N8N_PROMOTER_MAGIC_LINK_WEBHOOK` | URL base del webhook. |
| `N8N_PROMOTER_MAGIC_LINK_API_KEY` | Sufijo opcional. |

**Cuerpo JSON enviado a n8n:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `email` | string | Correo del promotor. |
| `fullName` | string | Nombre registrado del promotor. |
| `magicLinkUrl` | string | URL: `{base}/promotor/auth?token=...` (el cliente redirige al endpoint que consume el token). |
| `token` | string | JWT de login mágico. |
| `source` | string | Constante: `promoter-magic-link`. |
| `timestamp` | string | ISO 8601. |

**Errores:**

- Webhook no configurado: no se llama (advertencia en log).
- n8n no 2xx: error propagado → API **500**.

**Nota:** Si el email no corresponde a un promotor activo, **no** se llama a n8n y la respuesta HTTP sigue siendo 200 con mensaje neutro (no filtra existencia).

---

## 3. Referido cancelado por no pago (`referral-cancelled-unpaid`)

**Origen en código:** `src/lib/referrals/cancelUnpaidReferral.ts`  
**Disparo:** Tras marcar el referido como `CANCELLED_UNPAID_DELETED` y registrar evento en BD; notificación **best-effort**.

| Variable | Descripción |
|----------|-------------|
| `N8N_REFERRAL_CANCELLED_WEBHOOK` | URL base del webhook. |
| `N8N_REFERRAL_CANCELLED_API_KEY` | Sufijo opcional. |

**Cuerpo JSON enviado a n8n:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `promoterEmail` | string | Correo del promotor. |
| `promoterName` | string | Nombre del promotor. |
| `businessName` | string | Nombre del negocio referido. |
| `businessId` | string | UUID del negocio. |
| `deletedAt` | string | ISO 8601 (momento lógico de baja/cancelación). |
| `reason` | string | Ej.: `TRIAL_EXPIRED_UNPAID_PURGE`, `MANUAL_CANCEL_UNPAID`. |
| `source` | string | Constante: `referral-cancelled-unpaid`. |
| `timestamp` | string | ISO 8601. |

**Errores:**

- Webhook no configurado: no se llama (advertencia).
- Fallo de n8n o red: se registra en log **sin** revertir la cancelación en BD.

---

## 4. Formulario de contacto / activación de negocio (landing)

**Origen en código:** `src/app/api/contact-form/route.ts`  
**Disparo:** Tras validar con Zod y generar token JWT de activación de **cuenta de negocio** (`/activar?token=...`).

| Variable | Descripción |
|----------|-------------|
| `N8N_CONTACT_FORM_WEBHOOK` | URL base. |
| `N8N_CONTACT_FORM_API_KEY` | Sufijo; **ambos** deben estar definidos para que se ejecute el `fetch` (comportamiento actual). |

**Cuerpo JSON enviado a n8n:**  
Objeto `payload` de negocio más campos extra:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | string | Nombre del contacto. |
| `nombreNegocio` | string | Nombre del negocio. |
| `correo` | string | Email. |
| `telefono` | string | Teléfono normalizado (puede ser vacío). |
| `numeroLocales` | number | 1–19. |
| `mensaje` | string | Mensaje opcional. |
| `referido` | string | Código `PRM-XXXX` o vacío. |
| `timestamp` | string | ISO 8601. |
| `source` | string | `landing-page`. |
| `token` | string \| null | JWT de activación de negocio (30 min). |
| `activationUrl` | string \| null | URL `.../activar?token=...` |

**Errores:**

- Fallo de n8n: solo **log**; la API igual responde **200** al usuario con éxito del formulario.

---

## 5. (Opcional / no implementado) Referido calificado

**Estado:** No hay webhook dedicado en código tras registrar el primer pago. La calificación queda en BD y el panel admin (`/configuracion/referidos`).

Si en el futuro se desea notificar por n8n al promotor al pasar a `LIQUIDATION_PENDING`, se puede añadir un `fetch` en `registerFirstPaymentForBusiness` o un job, con un payload propuesto:

```json
{
  "source": "referral-qualified",
  "timestamp": "2026-04-16T12:00:00.000Z",
  "referralId": "uuid",
  "promoterEmail": "string",
  "newBusinessName": "string",
  "planNombre": "string",
  "promoterRewardSnapshot": 0
}
```

---

## Checklist para flujos en n8n

1. Webhook **POST** recibe JSON según la tabla correspondiente.
2. Enviar correo con plantilla que use `activationUrl` / `magicLinkUrl` (no inventar dominios; vienen de la app).
3. Responder **200** rápido si el flujo solo encola el envío; si procesas sync, igualmente 2xx si el correo se aceptó en tu proveedor.
4. Para activación de promotor y magic link, fallos en n8n **bloquean** la experiencia del usuario (500); conviene reintentos en n8n o cola interna.

---

## Referencia rápida de variables `.env`

```env
# Promotores
N8N_PROMOTER_ACTIVATION_WEBHOOK=
N8N_PROMOTER_ACTIVATION_API_KEY=
N8N_PROMOTER_MAGIC_LINK_WEBHOOK=
N8N_PROMOTER_MAGIC_LINK_API_KEY=

# Referidos cancelados
N8N_REFERRAL_CANCELLED_WEBHOOK=
N8N_REFERRAL_CANCELLED_API_KEY=

# Landing (contacto / alta negocio)
N8N_CONTACT_FORM_WEBHOOK=
N8N_CONTACT_FORM_API_KEY=
```
