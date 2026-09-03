# E-002: Un servidor de desarrollo levantado antes de la migración produce un falso aprobado en QA

**Área:** prisma
**Apariciones:** 2 — F-001, F-003

## Síntoma

El agente `qa` verificó por HTTP que una columna secreta nueva no salía en la respuesta de un
endpoint y lo dio por bueno. La comprobación decía ✅ y era mentira:

```
GET /api/negocio → 200
  claves: id, nombre, descripcion, createdAt, limitTime, planId, ...
  (NO aparece qabToken)                     ← se interpretó como "la defensa funciona"
  (tampoco aparecen tiendaOnlineHabilitada, qabTokenActualizadoAt, qabUltimoPedidoVisto)
```

Lo que delató el falso positivo fue lo **segundo**: tampoco salían las columnas nuevas que **sí**
tenían que salir.

## Causa raíz

El `npm run dev` llevaba levantado desde **antes** de que existieran la migración y el
`prisma generate` correspondiente. Next mantiene en memoria el `PrismaClient` que cargó al
arrancar, así que el proceso servía un cliente generado contra el schema **anterior**: ninguna de
las columnas nuevas existía para él.

El campo secreto no aparecía porque el cliente lo ignoraba, no porque la defensa (`omit`) lo
estuviera ocultando. La verificación estaba midiendo la caché del proceso, no el código.

## Solución

Reiniciar el servidor después de cualquier `prisma migrate` o `prisma generate`, y **volver a
ejecutar la comprobación entera**. Además, plantar un centinela en la base para que el criterio
tenga algo real que ocultar:

```sql
UPDATE "Negocio" SET "qabToken" = 'qab_live_SENTINELA_F001_9f3a' WHERE id = ...;
```

Y un mutante de control: instanciar un `PrismaClient` **sin** la defensa y comprobar que ahí el
valor **sí** se filtra. Si no se filtra ni siquiera sin la defensa, lo que se está probando no es
la defensa.

## Cómo evitarlo

**Un servidor de desarrollo que arrancó antes de una migración no sirve para verificar nada.**
Reinícialo antes de la primera comprobación por HTTP, y no des por buena una ausencia sin
confirmarla contra una presencia: si el campo que debe ocultarse no aparece, comprueba que los
campos que **sí** deben aparecer aparecen. Una ausencia que se explica por dos causas distintas —la
defensa funciona, o el cliente no conoce la columna— no es evidencia de ninguna de las dos.

Corolario general: **ningún criterio de "X no aparece" se verifica sin un centinela y un control
negativo.** Sin ellos, un entorno roto se ve exactamente igual que un feature correcto.

---

## Reaparición en F-003 (2026-09-03) — al otro lado de la frontera

Mismo error, distinto repositorio. Al verificar el criterio 4 contra **queandabuscando real**, su
ruta de aprovisionamiento respondía `500`:

```
./src/features/sync/schemas.ts:2:1
Error: Export DeliveryFeeMode doesn't exist in target module
  import { CheckoutMode, DeliveryFeeMode } from "@/generated/prisma/enums";
```

Su `schema.prisma` era del 2 de septiembre y su cliente generado del 31 de agosto: la migración
estaba aplicada, pero nadie había corrido `prisma generate`. Se resolvió con un
`npx prisma generate` en ese repositorio.

**Lo que añade esta aparición:** cuando se integra con otro sistema, un `500` suyo puede ser
exactamente este error **en su repo**, y desde aquí parece un fallo de integración. Antes de
depurar el código propio, comprobar que el otro lado compila. El síntoma es el mismo de siempre —un
cliente Prisma que no conoce algo que el schema sí— pero el sitio donde mirar es el que no
esperas.
