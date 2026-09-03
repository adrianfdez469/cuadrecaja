# E-002: Un servidor de desarrollo levantado antes de la migración produce un falso aprobado en QA

**Área:** prisma
**Apariciones:** 1 — F-001

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
