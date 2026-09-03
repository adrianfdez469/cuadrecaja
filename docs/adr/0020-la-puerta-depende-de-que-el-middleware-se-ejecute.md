# ADR 0020: La puerta de `/api/` depende de una invariante externa — que Next.js ejecute el middleware — y hay que fijarla

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-018
**Emitido por:** `security-guardian`, en la auditoría obligatoria del paso 4.

## Contexto

Los ADR 0016-0019 diseñan una puerta correcta **asumiendo que `src/middleware.ts` se ejecuta en
toda petición a `/api/`**. Esa suposición no es gratuita: en marzo de 2025 se hizo pública
[CVE-2025-29927](https://github.com/advisories/GHSA-f82v-jwr5-mffw), una vulnerabilidad en el
propio Next.js que permite **saltarse la ejecución del middleware por completo** mandando una
cabecera `x-middleware-subrequest` con el valor interno que Next usa para evitar bucles de
reescritura. Con esa cabecera, cualquier lógica de autorización que viva *solo* en el middleware
—que es exactamente lo que este feature construye— deja de ejecutarse, y la petición llega al route
handler como si el middleware no existiera.

Es la vulnerabilidad más relevante posible para F-018: por bien diseñada que esté la puerta (ADR
0016-0018), si el framework que la aloja puede saltársela por una cabecera, el diseño es correcto y
la protección real es nula.

**Verificado en esta auditoría (2026-09-02):**

- `package.json` fija `"next": "15.2.6"` — **versión exacta, sin `^` ni `~`** — así que
  `npm install`/`npm ci` no puede derivar a una versión distinta por sí solo.
- Las versiones parcheadas de cada rama son: `15.x` desde `15.2.3`, `14.x` desde `14.2.25`, `13.x`
  desde `13.5.9`, `12.x` desde `12.3.5` (`11.x` no tiene parche). `15.2.6` **está parcheada**.
- El proyecto despliega en Vercel (AGENTS.md, sección Stack): los avisos de la propia
  vulnerabilidad señalan que los despliegues alojados en Vercel quedaron protegidos a nivel de
  plataforma independientemente de la versión de Next, como capa adicional.

No es una vulnerabilidad abierta hoy. Es una dependencia externa silenciosa de la que todo el
feature depende, y que ningún ADR anterior nombra. Si mañana alguien edita `package.json` a mano
para bajar de versión —por ejemplo persiguiendo compatibilidad con otra librería— nada en este
repositorio lo impediría ni lo advertiría, y la puerta entera de F-018 dejaría de proteger nada sin
que ningún test lo detecte: los tests de `requiresApiAuth`/`buildSanitizedHeaders` son funciones
puras que no ejercitan si el middleware llegó a ejecutarse.

## Decisión

**Se documenta como invariante explícita del feature, no como nota al margen:** la seguridad de
F-018 depende de que Next.js siga invocando `src/middleware.ts` en toda petición a `/api/`, lo cual
depende a su vez de permanecer en una versión de Next.js igual o posterior a la parcheada de
CVE-2025-29927 para la rama mayor en uso (hoy `15.2.3`).

Dos acciones concretas, ninguna de las cuales es responsabilidad de `implementer`/`dev-tester` en
F-018 —son de gobierno del repositorio, no de código de esta feature— pero quedan registradas aquí
para que no se pierdan:

1. **No bajar la versión de `next` por debajo de `15.2.3`** al resolver conflictos de dependencias
   futuros. Cualquier PR que la toque debe comprobar contra el aviso de esta CVE antes de fusionar.
2. **`qa` añade un caso de verificación explícito a su checklist de F-018:** una petición a una ruta
   gated (por ejemplo `GET /api/negocio` sin cookie) con la cabecera
   `x-middleware-subrequest: middleware` (o el valor que documente la CVE en el momento de correr
   la prueba) debe seguir respondiendo `401`, no llegar al handler. Es una línea de curl, y es la
   única forma de que este ADR deje de ser una promesa de versión y pase a ser un hecho verificado
   en cada verificación del feature.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| No documentar nada, confiar en que `package.json` ya fija la versión | Una versión fijada explica *qué* versión corre hoy, no *por qué* no se puede bajar. Sin el ADR, un futuro downgrade no dispara ninguna señal de alarma porque nada en el repositorio explica que ese número es un límite de seguridad, no una preferencia. |
| Añadir una verificación de versión de Next en tiempo de arranque de la app | Complejidad nueva (leer `next/package.json` en runtime, compararla) para una garantía que ya da mejor `npm ci` con versión exacta más un test de `qa`. Se descarta por desproporcionada. |
| Bloquear el CI si `next` baja de `15.2.3` | Es la protección más fuerte y la más barata de las tres, pero este repositorio **no tiene CI** (AGENTS.md, sección Testing, "Limitaciones conocidas"): no hay dónde engancharla hoy. Queda anotado como la mejora natural el día que exista CI. |

## Consecuencias

**A favor:**
- Convierte una suposición implícita (que hacía correcto todo el diseño de los ADR 0016-0018) en
  un hecho escrito, verificado con fecha, y con una acción concreta de verificación.
- El caso de `qa` (`x-middleware-subrequest`) es una prueba de exactamente un minuto que cierra el
  hueco de "diseñamos bien la puerta pero nadie probó que la puerta se ejecute".

**En contra / coste asumido:**
- No hay enforcement automático (sin CI). El único freno hoy es la revisión humana de PRs que
  toquen `package.json`, y este ADR.
- Si Next.js publica una vulnerabilidad equivalente en el futuro, este ADR no la cubre por
  adelantado: cubre la conocida a fecha de esta auditoría. Cualquier CVE nueva sobre el middleware
  de Next.js debe releerse contra esta decisión.

**Impacto en seguridad y escalabilidad:**
- Sin coste de rendimiento: no añade ningún camino de código nuevo, solo un test de `qa` y una
  restricción de versión ya cumplida hoy.
- Es la pieza que le da sentido a todo el resto: los ADR 0016-0019 son correctos condicionados a
  esto. Sin esta invariante escrita, la condición era verdadera pero invisible.
