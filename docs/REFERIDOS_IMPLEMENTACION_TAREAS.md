# Tareas de Implementacion - Modulo de Referidos

Este documento se usara como bitacora viva de implementacion.  
Regla de seguimiento:
- `[ ]` pendiente
- `[-]` en progreso
- `[x]` completada

---

## Caso de uso 0 - Preparacion y base tecnica

- [x] Definir y validar alcance funcional final del modulo (promotores, referidos, fraude, liquidacion manual).
- [x] Crear estructura de entidades y estados en base de datos para promotores, referidos, reglas y liquidaciones.
- [x] Definir constantes globales del modulo (estados, tipos de token, formato de codigo `PRM-XXXX`).
- [x] Crear documento de contratos de eventos internos (primer pago, cancelacion por no pago, etc.).

Notas:
- Se agregaron modelos y enums base del modulo en `prisma/schema.prisma`.
- Se definieron constantes globales en `src/constants/referrals.ts`.
- Se documento el contrato de eventos internos en `docs/REFERIDOS_EVENTOS_INTERNOS.md`.
- El formato de codigo de promocion queda fijo como `PRM-XXXX` (4 caracteres alfanumericos en mayuscula).

---

## Caso de uso 1 - Solicitud y activacion de promotor

- [x] Crear endpoint publico para solicitud de promotor (formulario de aplicacion).
- [x] Generar token de activacion firmado con expiracion y uso unico.
- [x] Integrar endpoint de salida hacia n8n para enviar correo de activacion.
- [x] Crear pagina publica de activacion por token.
- [x] Crear logica de activacion final que persiste el promotor y genera `promoCode` autogenerado.
- [x] Garantizar unicidad de email y de `promoCode`.

Notas:
- El promotor solo se persiste al validar el correo por enlace de activacion.
- Endpoints implementados: `POST /api/promoters/apply` y `POST /api/promoters/activate`.
- Activacion usa token JWT + hash persistido en `AuthToken` para uso unico.
- URL publica creada: `/activar-promotor`.
- Integracion n8n usa variables de entorno `N8N_PROMOTER_ACTIVATION_WEBHOOK` y `N8N_PROMOTER_ACTIVATION_API_KEY`.

---

## Caso de uso 2 - Acceso por login magico del promotor

- [x] Crear endpoint para solicitar enlace magico por email.
- [x] Generar token de login magico firmado con expiracion y uso unico.
- [x] Integrar endpoint de salida hacia n8n para enviar enlace de login magico.
- [x] Crear endpoint/pagina para consumir token y abrir sesion de promotor.
- [x] Definir mecanismo de sesion para promotor (separado de cuentas de negocio).

Notas:
- El acceso al dashboard de promotor no sera por consulta publica directa del email.
- Endpoint implementado: `POST /api/promoters/magic-link/request`.
- Endpoint implementado: `GET /api/promoters/magic-link/consume?token=...` (setea cookie httpOnly y redirige a `/promotor`).
- Vistas publicas creadas: `/promotor/acceso` y `/promotor/auth`.
- Sesion separada de NextAuth mediante cookie `promoter_session`.
- Integracion n8n usa variables `N8N_PROMOTER_MAGIC_LINK_WEBHOOK` y `N8N_PROMOTER_MAGIC_LINK_API_KEY`.

---

## Caso de uso 3 - Captura de referido al crear negocio

- [x] Agregar campo `referido` en formulario de creacion de negocio.
- [x] Soportar precarga de codigo desde query param `?ref=`.
- [x] Validar codigo en backend al crear negocio.
- [x] Crear registro de referido cuando el codigo sea valido.
- [x] Marcar intento de fraude si `emailPromotor == emailAdminNegocioNuevo`.
- [x] Asegurar que el negocio se crea normal aunque el referido sea fraude/rechazado.

Notas:
- El codigo usado en el momento de creacion del negocio es el que gana.
- Se agrego el campo `referido` al formulario de landing y al token de activacion.
- Se uso validacion con Zod en `contact-form` y `activar-cuenta`.
- La captura de referido ocurre en onboarding (`initializeNegocio`) via `captureReferralForNewBusiness`.
- Si el promotor no existe/no esta activo/codigo invalido, el negocio se crea y no se registra referido.
- Si hay coincidencia de correos (promotor vs admin del negocio), se marca `REJECTED_FRAUD`.

---

## Caso de uso 4 - Calificacion del referido por primer pago

- [x] Crear accion de administracion para registrar primer pago de plan por negocio.
- [x] Asegurar idempotencia: solo la primera vez dispara calificacion.
- [x] Resolver montos por plan usando tabla de reglas activas.
- [x] Guardar snapshot historico (plan, descuento y recompensa) al calificar.
- [x] Transicionar estados a `CALIFICADO` y `LIQUIDACION_PENDIENTE` cuando corresponda.
- [x] Excluir casos `RECHAZADO_FRAUDE` de incentivos.

Notas:
- La fuente de verdad para calificar referido es el evento "primer pago registrado" por `SUPER_ADMIN`.
- Endpoint implementado: `POST /api/referrals/register-first-payment/[negocioId]`.
- Validacion de payload con Zod (`planId`, `paidAt`, `paymentAmount` opcional).
- Idempotencia por `referral.firstPaidAt` (si ya existe, no recalifica).
- Se actualiza `negocio.planId` al plan pagado en el registro del primer pago.
- Si el referido es fraude (`REJECTED_FRAUD`) se registra evento y no se aplican incentivos.
- Al calificar se guarda snapshot y se crea/actualiza `ReferralLiquidation` en `PENDING`.

---

## Caso de uso 5 - Cancelacion por no pago y limpieza de negocio

- [x] Conectar evento de eliminacion de negocio por no pago con el modulo de referidos.
- [x] Marcar referido como `CANCELADO_SIN_PAGO_ELIMINADO` cuando aplique.
- [x] Integrar endpoint de n8n para notificar al promotor la cancelacion.
- [x] Registrar trazabilidad del evento en bitacora/auditoria.

Notas:
- El referido cancelado no genera recompensa.
- Se creo el servicio `cancelReferralIfBusinessDeletedUnpaid` para centralizar cancelacion + auditoria + notificacion.
- La purga externa (`purge-expired-freemium-landing-negocios`) ahora dispara cancelacion de referido antes de eliminar negocio.
- Se agrego endpoint manual para `SUPER_ADMIN`: `POST /api/referrals/cancel-unpaid/[negocioId]`.
- Variables n8n para este caso: `N8N_REFERRAL_CANCELLED_WEBHOOK`, `N8N_REFERRAL_CANCELLED_API_KEY`.

---

## Caso de uso 6 - Dashboard de promotor

- [x] Crear vista de dashboard de promotor autenticado.
- [x] Mostrar codigo de promocion del promotor.
- [x] Mostrar KPIs basicos (capturados, calificados, pendientes, liquidados, fraude/cancelados).
- [x] Mostrar tabla de referidos con estado y montos.
- [x] Mostrar estado explicito para fraude (sin recompensa).

Notas:
- Datos visibles solo para el promotor autenticado por login magico.
- Vista en `/promotor`: servidor valida cookie y carga datos con `getPromoterDashboardData`.
- Cliente `PromotorDashboardClient` para copiar codigo y cerrar sesion (`POST /api/promoters/logout`).
- KPI "Calificados" cuenta referidos con `firstPaidAt` no nulo.

---

## Caso de uso 7 - Panel de administracion (SUPER_ADMIN)

- [x] Crear listado global de promotores con filtros basicos.
- [x] Crear listado global de referidos con filtros por estado/fecha/plan.
- [x] Crear accion para marcar liquidacion manual.
- [x] Permitir campos opcionales de liquidacion (monto, fecha, metodo, nota).
- [x] Mostrar historial de cambios/acciones por referido.

Notas:
- La forma de entrega de la recompensa (efectivo/descuento externo) se gestiona fuera del sistema.
- UI en `/configuracion/referidos` (menu SUPER_ADMIN) con pestañas Promotores y Referidos.
- APIs: `GET /api/admin/referrals/promoters`, `GET /api/admin/referrals`, `PATCH /api/admin/referrals/[referralId]/liquidate`, `GET /api/admin/referrals/[referralId]/events`.
- Servicio cliente: `src/services/referralAdminService.ts`.
- Registro de primer pago: `POST /api/referrals/register-first-payment/[negocioId]` integrado en **Gestión de Negocios** (icono de pago verde) con diálogo de plan, fecha y monto opcional.

---

## Caso de uso 8 - Integraciones n8n

- [x] Definir contrato n8n: envio de activacion de promotor.
- [x] Definir contrato n8n: envio de login magico de promotor.
- [x] Definir contrato n8n: notificacion de referido cancelado por no pago.
- [x] (Opcional) Definir contrato n8n: notificacion de referido calificado.
- [x] Documentar payload, seguridad y manejo de errores por cada endpoint.

Notas:
- Documento maestro: `docs/REFERIDOS_N8N_CONTRATOS.md` (incluye también landing `contact-form` por uso de `referido` y `activationUrl`).
- La notificacion de referido **calificado** no está implementada en código; el doc deja payload sugerido para una iteración futura.

---

## Caso de uso 9 - Seguridad, auditoria y validaciones finales

- [x] Enforzar expiracion y uso unico de tokens (activacion/login).
- [x] Evitar filtracion de existencia de emails en respuestas publicas.
- [x] Asegurar unicidad de codigo y reglas de formato `PRM-XXXX`.
- [x] Registrar auditoria de transiciones y acciones administrativas.
- [x] Verificar manejo de errores y mensajes consistentes en todo el flujo.

Notas:
- Tokens: JWT con TTL alineado a `AuthToken.expiresAt`; reclamacion atomica con `updateMany` (uso unico) en activacion y consumo de magic link.
- Anti-enumeracion: `POST /api/promoters/apply` no genera token ni llama n8n si ya existe un `Promoter` con ese email; `magic-link/request` ya respondia de forma neutral.
- Codigo `PRM-XXXX`: validacion Zod en landing y payload de activacion de cuenta; `captureReferralForNewBusiness` ignora codigos con formato invalido.
- Auditoria: eventos `PROMOTER_ACTIVATED`, `PROMOTER_MAGIC_LINK_SESSION_STARTED`, `FIRST_PAYMENT_REGISTER_SKIPPED_IDEMPOTENT` en `ReferralEventLog` (los existentes de referido/liquidacion se mantienen).
- Mensajes publicos compartidos en `REFERRAL_PUBLIC_MESSAGES` (`src/constants/referrals.ts`).

---

## Registro de avances

- Fecha: 2026-04-15
  - Cambio: Se completo el Caso de uso 0 con base tecnica inicial para referidos.
  - Tareas impactadas: Caso de uso 0 (todas).
  - Nota: Pendiente crear migracion SQL cuando iniciemos endpoints del Caso de uso 1.
- Fecha: 2026-04-15
  - Cambio: Se completo el Caso de uso 1 (solicitud y activacion de promotor).
  - Tareas impactadas: Caso de uso 1 (todas).
  - Nota: Falta configurar endpoint real de n8n en variables de entorno para envio de activacion.
- Fecha: 2026-04-15
  - Cambio: Se completo el Caso de uso 2 (login magico y sesion de promotor).
  - Tareas impactadas: Caso de uso 2 (todas).
  - Nota: Dashboard de datos en Caso de uso 6.
- Fecha: 2026-04-15
  - Cambio: Se completo el Caso de uso 3 (captura de referido al crear negocio).
  - Tareas impactadas: Caso de uso 3 (todas).
  - Nota: La validacion de formato de referido usa `PRM-XXXX` y la deteccion de fraude no bloquea la creacion del negocio.
- Fecha: 2026-04-15
  - Cambio: Se completo el Caso de uso 4 (primer pago, calificacion e idempotencia).
  - Tareas impactadas: Caso de uso 4 (todas).
  - Nota: La transicion operativa queda en `LIQUIDATION_PENDING` con bitacora de evento y liquidacion pendiente.
- Fecha: 2026-04-15
  - Cambio: Se completo el Caso de uso 5 (cancelacion por no pago y notificacion).
  - Tareas impactadas: Caso de uso 5 (todas).
  - Nota: La cancelacion ocurre en estados pendientes y deja bitacora `BUSINESS_DELETED_UNPAID_REFERRAL_CANCELLED`.
- Fecha: 2026-04-16
  - Cambio: Se completo el Caso de uso 6 (dashboard de promotor).
  - Tareas impactadas: Caso de uso 6 (todas).
  - Nota: Logica de datos en `src/lib/referrals/promoterDashboard.ts`; UI en `PromotorDashboardClient.tsx`.
- Fecha: 2026-04-16
  - Cambio: Se completo el Caso de uso 7 (panel SUPER_ADMIN referidos).
  - Tareas impactadas: Caso de uso 7 (todas).
  - Nota: Etiquetas de estado en `src/constants/referrals.ts` para uso seguro en cliente.
- Fecha: 2026-04-16
  - Cambio: Se completo el Caso de uso 8 (documentacion contratos n8n).
  - Tareas impactadas: Caso de uso 8 (todas).
  - Nota: Ver `docs/REFERIDOS_N8N_CONTRATOS.md`.
- Fecha: 2026-04-16
  - Cambio: Se completo el Caso de uso 9 (seguridad, auditoria, validaciones finales).
  - Tareas impactadas: Caso de uso 9 (todas).
  - Nota: Ver notas del caso 9 en este documento; helper `src/lib/referrals/referralCode.ts`.
