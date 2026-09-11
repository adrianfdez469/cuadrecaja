# E-052: `prisma format` reformatea modelos ajenos y ensucia un PR atómico

**Área:** prisma
**Apariciones:** 3 — F-008 (el formateo, y su revert, que causó un daño peor); F-029 (`qa`, al
revertir una mutación de auditoría de tests con `git checkout` sobre un archivo — `src/lib/gastos.ts`
— que ya llevaba ~75 líneas sin commitear del propio feature: el checkout se las llevó todas, no
solo la mutación)

## Síntoma

Tras añadir un modelo nuevo a `prisma/schema.prisma`, un `npx prisma format` «de limpieza» dejó un
diff de **62 líneas**, de las cuales **19 eran borrados cosméticos** en modelos que no tenían nada
que ver con el feature: `CierrePeriodo`, `ResumenMonedaCierre` y otro más.

No dio ningún error. `npx prisma validate` seguía en verde y la migración generada era idéntica.

## Causa raíz

`prisma format` **no es idempotente sobre un schema con historia**: realinea las columnas de
**todos** los bloques según su propia regla, así que cualquier modelo cuyo formato se escribiera con
una versión anterior de la herramienta —o a mano— se reescribe entero la primera vez que alguien
formatea.

El daño no es técnico, es de revisión: los PR de este repo tienen que ser **atómicos** (una sola
funcionalidad o corrección), y 19 borrados en código ajeno obligan al revisor a distinguir qué es
del feature y qué es ruido. En un `schema.prisma` eso es especialmente caro, porque es el archivo
donde un borrado accidental sí puede significar algo.

## Solución

Se revirtió el archivo entero con `git checkout` y se volvieron a aplicar **a mano** los dos
añadidos del feature, sin formatear. El diff quedó en **24 inserciones y 0 borrados**.

Se confirmó que no se perdía nada: `npx prisma validate` en verde, y la migración generada sin
cambios — **el formato no entra en el SQL**.

## Cómo evitarlo

**No correr `npx prisma format` al añadir un modelo.** No aporta nada al resultado (ni al cliente
generado, ni a la migración) y solo puede ensuciar el diff.

Si alguna vez hace falta formatear el schema de verdad, es **su propio commit** de `style:`, sin
ningún cambio funcional dentro, para que el ruido quede aislado y revisable de una vez.

Y la comprobación que cierra el caso, después de tocar el schema:

```bash
git diff --stat prisma/schema.prisma   # inserciones esperadas, 0 borrados
```

Si aparecen borrados que no escribiste, no los aceptes porque «compila igual».

---

## Adenda: el `git checkout` que arregla el formateo se lleva el trabajo de OTRO feature

El remedio de arriba —`git checkout prisma/schema.prisma` y reaplicar los añadidos a mano— **causó
una regresión silenciosa peor que el problema que arreglaba**, y no se detectó hasta el momento de
commitear.

En la misma sesión había **dos features en vuelo**. F-027 había añadido, en `prisma/schema.prisma`,
`BUSINESS` al docstring de `OutboxEvento.entidad`. Estaba **sin commitear**, en el árbol de trabajo.
El `git checkout` de F-008 revirtió el archivo **entero** al último commit, así que se llevó
también ese cambio ajeno. Después se reaplicaron **solo** los añadidos de F-008.

Resultado: el schema quedó afirmando que `entidad` es uno de **cinco** valores cuando el código ya
emitía **seis**.

**Por qué no lo ve nadie:**

- No rompe nada: es un comentario `///`. No hay símbolo indefinido ni tipo mal puesto.
- `npx tsc --noEmit`, `npm run lint`, `npx prisma validate` y la suite completa dan **todos exit
  0**, y siguen dándolo con el docstring mal.
- `npx prisma generate` tampoco protesta: los `///` no entran en el cliente ni en el SQL.
- El agente que hizo el checkout verificó **su propio** diff, que quedó correcto (24 inserciones, 0
  borrados). El daño estaba en las líneas que **ya no aparecían** en su diff.

Y el daño es exactamente el que este repositorio castiga: **documentación que miente**, en el
archivo que describe el modelo de datos. Es primo de E-013 y de E-039 — una descripción que dice una
cosa y un código que hace otra.

**Cómo evitarlo:** antes de un `git checkout <archivo>`, mira **qué más hay sin commitear en ese
archivo**:

```bash
git diff --stat <archivo>     # ¿cuánto hay?
git diff <archivo>            # ¿es TODO tuyo?
```

Si el archivo lleva cambios que no son tuyos —y en una sesión con dos features en paralelo, o con un
árbol sucio de antes, lo normal es que los lleve— **un checkout no es una opción**: hay que revertir
solo lo tuyo, o commitear lo ajeno antes.

**La regla general, que es más ancha que Prisma:** `git checkout <archivo>` no deshace *tu* último
cambio, deshace **todo lo no commiteado del archivo**. Usarlo como «ctrl-Z» es seguro solo en un
archivo que sea enteramente tuyo en ese momento.
