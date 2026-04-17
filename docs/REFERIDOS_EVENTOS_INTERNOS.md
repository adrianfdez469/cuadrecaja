# Contratos de Eventos Internos - Referidos

Este documento define los eventos internos que usa el modulo de referidos para transiciones de estado.

## Evento: Primer pago registrado

- **Nombre tecnico:** `referral.first_payment_registered`
- **Origen:** modulo de administracion (`SUPER_ADMIN`)
- **Objetivo:** marcar la primera conversion de trial a plan pago para un negocio
- **Regla de idempotencia:** si el negocio ya tiene primer pago registrado, no vuelve a procesar

### Payload

```json
{
  "businessId": "uuid",
  "planId": "uuid",
  "paidAt": "2026-04-15T18:30:00.000Z",
  "registeredByUserId": "uuid",
  "paymentAmount": 100
}
```

### Efectos esperados

1. Buscar referido por `businessId`.
2. Si no existe referido: terminar sin error.
3. Si estado es `REJECTED_FRAUD`: terminar sin incentivos.
4. Resolver regla activa por `planId`.
5. Guardar snapshot (`plan`, descuento, recompensa).
6. Transicionar a `QUALIFIED` y luego `LIQUIDATION_PENDING`.
7. Registrar evento en bitacora.

---

## Evento: Negocio eliminado por no pago

- **Nombre tecnico:** `referral.business_deleted_unpaid`
- **Origen:** flujo de limpieza automatica de negocios trial
- **Objetivo:** cancelar referido pendiente cuando el negocio no llego a pagar

### Payload

```json
{
  "businessId": "uuid",
  "deletedAt": "2026-04-20T09:00:00.000Z",
  "reason": "TRIAL_EXPIRED_UNPAID"
}
```

### Efectos esperados

1. Buscar referido por `businessId`.
2. Si no existe: terminar sin error.
3. Si estaba pendiente de pago: pasar a `CANCELLED_UNPAID_DELETED`.
4. Registrar evento en bitacora.
5. Disparar notificacion al promotor (integracion n8n).

---

## Evento: Liquidacion manual registrada

- **Nombre tecnico:** `referral.manual_liquidation_marked`
- **Origen:** modulo de administracion (`SUPER_ADMIN`)
- **Objetivo:** cerrar operativamente un referido ya listo para liquidacion

### Payload

```json
{
  "referralId": "uuid",
  "status": "LIQUIDATED",
  "liquidatedAt": "2026-04-22T15:00:00.000Z",
  "paidAmount": 20,
  "paymentMethod": "EFECTIVO",
  "note": "Liquidacion manual confirmada",
  "liquidatedByUserId": "uuid"
}
```

### Efectos esperados

1. Validar que el referido esta en `LIQUIDATION_PENDING`.
2. Crear o actualizar registro de liquidacion manual.
3. Mover referido a `LIQUIDATED_MANUALLY`.
4. Registrar evento en bitacora.

---

## Convenciones transversales

- Todos los eventos deben incluir `traceId` para trazabilidad cuando sea posible.
- Los handlers deben ser tolerantes a reintentos (idempotentes).
- El modulo no ejecuta pagos reales, solo registra estados y evidencias.
