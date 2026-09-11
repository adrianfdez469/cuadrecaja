# E-079: leer la base de datos de queandabuscando desde un script desechable

**Área:** tests
**Apariciones:** 1 — F-038

## Síntoma

Verificar «contra el otro lado» obliga a leer la base de datos de queandabuscando (QAB), y el
camino obvio —un script de Prisma de usar y tirar dentro de ese repositorio— falla **cuatro veces
seguidas, con cuatro errores distintos y ninguno relacionado con la consulta**:

```
SyntaxError: The requested module '@prisma/client' does not provide an export named 'PrismaClient'
PrismaClientInitializationError: PrismaClient was instantiated without any options.
                                A driver adapter is required to connect to your database.
ERROR: Top-level await is currently not supported with the "cjs" output format
Error: DATABASE_URL is not set — see .env.example
```

Cada arreglo destapa el siguiente. Es fácil interpretarlo como que la base no es accesible y
acabar leyendo el payload emitido en cuadrecaja —justo lo que el criterio prohibía— o, peor,
escribiendo en la base de QAB a mano para «desatascar».

## Causa raíz

Cuatro diferencias de entorno entre los dos repositorios, todas legítimas, ninguna visible desde
cuadrecaja:

1. **El cliente de Prisma de QAB no está en `@prisma/client`.** Su `generator client` declara
   `output = "../src/generated/prisma"`, así que el import es a esa ruta del repositorio, no al
   paquete.
2. **Prisma 7 conecta por un *driver adapter*, no por una URL de datasource.** Un
   `new PrismaClient()` sin opciones no es «sin configurar»: es inválido por construcción.
3. **`tsx` transpila a CJS**, y en CJS no hay `await` de nivel superior. Un script `.ts` con
   `await` suelto ni siquiera llega a ejecutarse.
4. **Nada carga el `.env` por ti.** Next lo hace al arrancar; un script suelto, no.

Las cuatro juntas hacen que el primer intento sea inevitable, y que cada mensaje parezca un
problema nuevo en vez de un escalón de la misma escalera.

## Solución

**No reconstruyas el cliente: importa el que el repositorio ya tiene configurado**, que resuelve
de golpe los puntos 1 y 2, y añade lo que le falta a un script frente a un servidor:

```ts
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.$queryRawUnsafe(`SELECT ... FROM "Business"`);
  console.log(JSON.stringify(rows, null, 1));
}

main();
```

El `main()` envuelto es el punto 3 y el `dotenv/config` el punto 4. El script vive **dentro del
repositorio de QAB** (E-053: fuera no resuelve nada) y se borra en el mismo comando que lo
ejecuta, dejando `git status --porcelain` limpio **en los dos repositorios** — es fácil dejar
basura en el ajeno, donde no se mira.

## Cómo evitarlo

**Antes de escribir la primera línea de un script contra un repositorio que no es este, mira cómo
construye su cliente el propio repositorio** (`src/lib/prisma.ts`, o el equivalente) e **impórtalo**.
Reconstruir el cliente a mano es adivinar cuatro decisiones de configuración ajenas y acertar las
cuatro.

Y la regla de fondo, que es la que evita el daño de verdad: **cuando el acceso de lectura al otro
lado se atasca, la salida NUNCA es escribir en él ni rebajar el criterio a leer el payload
emitido.** Un criterio que exige verificar contra el otro lado se verifica contra el otro lado, o
no se verifica; que el andamiaje cueste cuatro intentos no cambia lo que el criterio dice. El
mismo principio que hizo reabrir una tienda por su mecanismo de producto en vez de por un `UPDATE`:
ver [E-013](E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md).
