# E-042: Un barrido cuenta una *mención* como si fuera un filtro

**Área:** build
**Apariciones:** 1 — F-021 (dos veces en el mismo feature)

## Síntoma

Un censo de seguridad clasifica dos rutas como **protegidas, con las tres señales en verde**:

```
discounts/active/route.ts    GET   SESSION|PERM|NEGOCIOID
discounts/preview/route.ts   POST  SESSION|PERM|NEGOCIOID
```

Las dos estaban **desprotegidas**: cualquier usuario autenticado podía leer las reglas de descuento
de otro negocio. Se descubrieron por casualidad, leyendo la librería a la que delegan por un motivo
distinto.

## Causa raíz

La señal `NEGOCIOID` la satisfacía **la única mención de negocio de todo el archivo**:

```ts
if (!session?.user?.negocio?.id) {          // guarda de nulidad, no filtro
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}
```

**El instrumento buscó una palabra y encontró una palabra.** Ni siquiera un segundo barrido, escrito
para cazar «`negocioId` que no viene de la sesión», las vio: aquí el `negocioId` **sí** viene de la
sesión — simplemente no se usa para nada después.

El diagnóstico intuitivo era otro y era peor: «el barrido no seguía la llamada hasta `src/lib/`».
Eso también era cierto, pero no es lo que falló: **el barrido sí miró esos archivos y los aprobó.**

En el mismo feature apareció la **variante hermana**: eximir en bloque 49 rutas porque otro feature
las cubría. Ese otro feature resolvía **identidad**, no alcance. En palabras del arquitecto:

> **Una exención en bloque es una clasificación sin hacer.**

## Solución

Corregir la lente y **volver a pasarla sobre los dos árboles** —el de antes y el de después de la
implementación—, para comprobar que la lente nueva encuentra lo que la vieja perdió:

- Descartar menciones que estén en **guardas de nulidad, comentarios y logs**.
- Exigir que el identificador de tenant aparezca **como valor dentro de la consulta** o **como
  argumento de la función** a la que se delega.
- **Seguir la llamada** hasta `src/lib/` cuando el handler no consulta directamente.

## Cómo evitarlo

**Un barrido de seguridad no puede afirmar que algo está protegido; solo puede señalar dónde
mirar.** La clasificación «protegida» exige leer, y la certificación exige ejecutar.

Tres reglas concretas:

1. **Buscar el identificador no es buscar el filtro.** Comprueba que el valor entra en la consulta,
   no que la palabra aparece en el archivo.
2. **Ninguna exención en bloque.** Si un grupo queda fuera del triaje «porque otra cosa lo cubre»,
   ve a leer qué cubre exactamente esa otra cosa. Identidad, permiso y alcance son tres ejes
   distintos y casi nunca los resuelve el mismo mecanismo.
3. **Cierra el hueco con algo que no dependa del barrido.** En F-021 lo que quedó no fue el censo
   sino un **inventario versionado con un test que lo contrasta contra el árbol real**: una ruta
   nueva sin clasificar rompe la suite. Es lo único que protege contra la ruta número 40.

Emparenta con [E-008](E-008-datos-de-prueba-que-no-discriminan.md) —el instrumento pasa sin
discriminar— y con [E-039](E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md): las dos
son formas de confundir el nombre de una cosa con la cosa.
