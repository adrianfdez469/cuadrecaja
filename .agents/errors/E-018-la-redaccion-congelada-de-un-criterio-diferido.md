# E-018: La redacción congelada de un criterio diferido, desactualizada por una decisión posterior

**Área:** tests
**Apariciones:** 1 — F-020 (el criterio de diseño 21 de F-005, diferido y luego contradicho por el ADR 0038)

## Síntoma

Un criterio diferido de un feature anterior se ejecuta tal como está escrito, y **rechaza una
implementación correcta**. El criterio 21 de `.agents/designs/F-005.md` decía:

```
Con `slugQab === null`, el campo de slug sigue editable.
```

Verificarlo literalmente en F-020 habría rechazado el código, porque para entonces el ADR 0038 había
decidido lo contrario: el campo se bloquea con `firstPublishPending`, sin esperar a conocer el slug
asignado.

## Causa raíz

Diferir un criterio lo **congela con su redacción**, y esa redacción envejece contra las decisiones
que se toman entre el feature que lo difirió y el que lo hereda. [E-013](E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md)
ya había registrado que un criterio diferido trae su propio «qué comprobar en su lugar»; lo que no
estaba registrado es que **el criterio original también puede volverse falso**, no solo quedar
inaplicable.

El mecanismo del harness invita a esto: los criterios diferidos «conservan su número y siguen en la
lista» a propósito, para que se puedan citar. Eso los hace fáciles de encontrar y fáciles de ejecutar
sin releer.

## Solución

Se detectó **antes** de ejecutarlo, no después: el ADR 0038 dejó escrito en sus consecuencias que ese
control cambiaba, el `arch-guardian` lo marcó en el § 9 del contrato de interfaces, y el coordinador
se lo pasó al `qa` como aviso explícito antes de que verificara nada. El criterio se ejecutó con el
control nuevo y pasó.

## Cómo evitarlo

**Un criterio diferido hay que releerlo contra los ADR posteriores antes de ejecutarlo.** No es
opcional y no basta con localizarlo: hay que comprobar qué se decidió sobre su área entre el feature
que lo difirió y hoy.

- **Quien difiere un criterio deja escrito contra qué decisión lo difirió**, para que se pueda
  detectar si esa decisión cambió.
- **Quien emite un ADR que contradice un criterio diferido lo dice en las consecuencias del ADR**,
  nombrando el criterio por su número. Es lo que salvó este caso.
- **Quien coordina no le pasa al `qa` una lista de criterios diferidos sin revisarla.** Un aviso de
  una línea cuesta menos que un ciclo de rechazo.
