# ADR 0099: La librería de mapas entra por un solo módulo diferido, detrás de una frontera de error

**Estado:** aceptado
**Fecha:** 2026-09-07
**Feature:** F-025

## Contexto

Dos criterios de F-025 son de arquitectura de carga, no de comportamiento:

- **Criterio 7:** «La librería de mapas no se carga en las pantallas que no la usan. Verificado
  comprobando que el chunk que la contiene no aparece en la carga de `/pos`.»
- **Criterio 4:** «Con el dominio del proveedor de teselas bloqueado en el navegador, la pantalla
  sigue cargando y el local se puede guardar igual: el mapa degrada y NO bloquea el formulario.»

Los dos nacen de la misma restricción: los datos móviles en Cuba son caros y lentos. `/pos` es la
pantalla caliente del producto —la que se abre todo el día— y no puede pagar 42 KB de una librería
que solo usa una pantalla de configuración.

Lo que hay en el repositorio, comprobado:

- **Precedente de carga diferida**: seis archivos ya usan `next/dynamic`, y el más parecido es
  `MovimientosView.tsx`, que saca `xlsx` del bundle de su pantalla con el comentario «solo hace
  falta cuando alguien importa un fichero de verdad».
- **No existe ninguna frontera de error de región.** Las únicas del repositorio son
  `src/app/error.tsx` y `src/app/global-error.tsx`, las dos **de segmento de ruta**.
- La skill `vercel-react-best-practices` marca el tamaño de bundle como CRITICAL, y su regla
  `bundle-barrel-imports` avisa de que un import de barril arrastra miles de módulos que nadie usa.
- El `.next` presente en la rama era de `dev`, y su `app-build-manifest.json` traía `pages` vacío.

Y hay un modo de fallo que el criterio 4 **no** cubre en su redacción, y que es más probable que el
que sí cubre: que el **chunk** no llegue a descargarse. Bloquear el dominio del proveedor de
teselas no bloquea el chunk, que se sirve de nuestro propio origen. Pero con una conexión mala, lo
que falla primero es la descarga.

## Decisión

**Una sola arista, diferida, y una frontera de error alrededor del mapa y solo del mapa.**

### 1. Un único módulo importa la librería

`src/components/tiendaOnline/map/StoreLocationMap.tsx` es el único archivo del repositorio que
importa `leaflet`, `react-leaflet` o `leaflet/dist/leaflet.css`. Verificable de un `grep`:

```bash
grep -rn "react-leaflet\|from \"leaflet\"\|from 'leaflet'\|leaflet/dist" src/
```

Toda coincidencia tiene que estar bajo `src/components/tiendaOnline/map/`.

### 2. Se entra solo por `next/dynamic` con `ssr: false`

```
const StoreLocationMap = dynamic(() => import("./map/StoreLocationMap"), { ssr: false, loading: … });
```

Con la llamada **a nivel de módulo**: dentro del render cambiaría la identidad del componente en
cada pasada y lo remontaría. Y `ssr: false` no es una preferencia: Leaflet toca `window` al
evaluar su módulo.

Se elige `next/dynamic` y no `React.lazy` precisamente por eso: `React.lazy` no desactiva el
renderizado en servidor.

### 3. Cero aristas estáticas hacia ese módulo — incluidas las de tipos

Es la parte que se olvida. Tres consecuencias concretas:

- El **tipo de props** del mapa vive en `storeLocationMapProps.ts`, un `.ts` plano, y no en el
  `.tsx`. Así el envoltorio no necesita ningún `import` —ni `import type`— hacia el módulo que
  arrastra la librería.
- Todo lo que la tarjeta necesita **antes** de que el mapa cargue vive fuera de él:
  `draftToMapPoint` en `src/utils/tiendaOnlineDraft.ts`, `initialMapView` e
  `isPointOutsideBounds` en un `.ts` sin React, y la configuración del proveedor en
  `src/constants/map.ts`. **Si `draftToMapPoint` viviera dentro del módulo del mapa, importarla
  desde `PublicDataCard` arrastraría Leaflet y el criterio 7 caería sin que nadie escribiera nada
  raro.**
- Esa colocación tiene un segundo beneficio: son funciones puras en `.ts`, así que la suite puede
  importarlas. Un símbolo que viva en un `.tsx` no es importable desde ningún test de este
  repositorio (E-015).

### 4. El módulo diferido no recibe la configuración del proveedor por props

`MAP_TILE_PROVIDER` —la URL y la atribución, en un solo objeto (ADR 0097)— lo importa el propio
`StoreLocationMap.tsx` de `src/constants/map.ts`, que es un módulo de valores planos sin Leaflet.
No viaja como prop.

Dos razones, y la segunda es la que importa: el envoltorio se queda con dos props y ninguna
configuración que reenviar; y la URL y la atribución **no pueden separarse en el camino**, que es
la garantía de licencia que ADR 0097 pide. El proveedor por omisión está horneado, así que
**siempre hay un proveedor**: aquí no hay ninguna rama de «sin proveedor configurado» que nadie
pueda ejercitar (E-013).

### 5. Una frontera de error de región, nueva

`src/components/InlineErrorBoundary.tsx`, un componente de clase con `fallback`, envolviendo el
mapa **dentro** de la tarjeta.

Sin ella, el criterio 4 se incumple en el modo de fallo más probable: si el chunk no llega a
descargarse, la promesa rechazada de `next/dynamic` sube hasta `src/app/error.tsx` y **sustituye
la pantalla entera**. Con ella, lo único que se cae es el mapa, y el resto de `PublicDataCard`,
las demás tarjetas y el guardado siguen en pie.

`componentDidCatch` registra un **mensaje constante** más `error.name`, nunca `error.message`: el
mensaje que fabrica un runtime **cita el dato que lo rompió** (E-031). Con este proveedor la URL de
la tesela no lleva secreto alguno —no tiene query—, así que la gravedad es baja; la regla se queda
porque el patrón es el mismo y porque el proveedor puede cambiarse por entorno a uno cuya URL sí
lleve una clave (ADR 0097).

### 6. El criterio 4 se verifica en tres formas, no en una

Solo la primera está en la redacción del criterio. Las otras dos las añade este ADR porque son los
modos de fallo que de verdad van a ocurrir, y **no reformulan el criterio: se ejecutan además de
él**, igual que el `spec` añadió su criterio 8.

- **(a) La del criterio.** Bloquear `tile.openstreetmap.org` y completar un guardado end-to-end.
  Aquí el fallo **sí** es un error de red, así que `tileerror` se dispara y el estado degradado
  entra.
- **(b) El chunk.** Bloquear en red el asset que contiene la librería y comprobar que el formulario
  sigue en pie y se guarda. Es lo que prueba la frontera de error, y el modo de fallo más probable
  con una conexión mala.
- **(c) La salida de emergencia.** Definir las dos variables de sustitución del proveedor
  (`NEXT_PUBLIC_MAP_TILE_URL_TEMPLATE` y `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION_HTML`, ADR 0097),
  levantar la app y comprobar que el mapa pinta las teselas del proveedor sustituto **y** que la
  atribución cambió con ellas. Sustituye a la verificación «sin clave» de una versión anterior de
  este ADR, que dejó de existir cuando el proveedor pasó a no necesitar credenciales. Verifica algo
  más útil: que el escape que mitiga el riesgo del § 7 de la OSMF **funciona antes** de que haya que
  usarlo con prisa.

Y una cualificación deliberada, para que nadie la escriba como absoluto: **el mapa no puede
detectar todos los fallos de tesela**. Si la OSMF nos bloquea, la respuesta es un **HTTP 200 con
una imagen de cartel** dentro, y en ese caso `tileerror` **no** se dispara (ADR 0097). No se
intenta arreglar con heurísticas de tamaño o de hash de imagen: son frágiles, se rompen cuando
cambien el cartel, y ya hubo un candidato a falso positivo —una tesela legítima de agua de 103
bytes—. El diseño **no depende de detectar el fallo**: el marcador,
la aritmética de coordenadas, los dos campos y el guardado son independientes del contenido de las
teselas. Un proveedor que degrade mal cuesta cosmética, no función.

### 7. La verificación del criterio 7 lleva su mitad discriminante

Tres pasos, escritos en el § 6 del contrato de interfaces. El tercero es el que importa:

1. Build limpio y `grep -rl "leaflet"` sobre `.next/static/` para localizar los assets que
   contienen la librería.
2. Intersección de esa lista con los assets que `app-build-manifest.json` asigna a `/pos`. Debe
   ser vacía. **Si `pages` viene vacío, el build no se hizo** —pasa cuando el `.next` presente es
   de `dev`— y no significa que la intersección sea vacía.
3. En el navegador, **las dos mitades**: que en `/pos` no aparece ninguno de esos assets, **y que
   en `/tienda-online/configuracion` sí aparecen**. Sin la segunda, el criterio pasaría igual con
   el mapa nunca montado (E-008).

### 8. Lo que NO se hace

No se añade `transpilePackages` a `next.config.ts` preventivamente, aunque `react-leaflet` v5 se
distribuya como ESM. No está verificado que Next 15.2.6 lo necesite, y `next.config.ts` afecta a
todo el repositorio. Si el build falla, se añade con el mensaje de error real en el commit.

No se añade `optimizePackageImports` ni se cambia ninguna política de bundling global. Este feature
no es el sitio para tocar la configuración de build de todo el repositorio.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Importar el mapa estáticamente desde `PublicDataCard` | Es el criterio 7 incumplido en una línea, si algún día `/pos` acaba compartiendo un chunk con la pantalla de configuración |
| `React.lazy` + `<Suspense>` en vez de `next/dynamic` | No desactiva el renderizado en servidor, y Leaflet toca `window` al evaluar su módulo |
| Poner el `dynamic()` dentro del render, «donde se usa» | Cambia la identidad del componente en cada pasada y lo remonta: el mapa se reconstruiría en cada tecleo del formulario |
| Tipar el componente diferido con `import type { … } from "./map/StoreLocationMap"` | Un `import type` se borra al compilar, sí, pero depende de que quien lo escriba no olvide la palabra `type`. Un `.ts` aparte no depende de eso |
| Poner `draftToMapPoint` y `initialMapView` dentro del módulo del mapa, junto a lo que las usa | Importarlas arrastraría la librería al bundle de la pantalla. Y en un `.tsx` no serían importables desde ningún test (E-015) |
| Meter el mapa detrás de un botón («Marcar en el mapa») para ahorrar datos | Contradice la letra del criterio 5, que dice que un local sin coordenadas «abre el mapa en una vista por defecto». Y haría **vacua** la verificación del criterio 4: si el mapa nunca se monta, bloquear el dominio no prueba nada. El ahorro de datos se consigue con el criterio 7, que confina el coste a esta pantalla, con `detectRetina: false` y con el tope de zoom |
| Confiar en `src/app/error.tsx` como frontera del mapa | Es de segmento de ruta: sustituiría la pantalla entera, que es lo contrario del criterio 4 |
| Escribir el criterio 4 solo con la forma que dice su redacción | Bloquear el dominio de teselas **no** bloquea el chunk, que se sirve de nuestro origen. El modo de fallo que se lleva la pantalla entera quedaría sin probar |
| Verificar el criterio 7 solo con el build output | El criterio dice «no aparece en la carga de `/pos`», que es una observación de red. Y sin la mitad que comprueba que **sí** aparece en la pantalla de configuración, un mapa nunca montado pasaría el criterio (E-008) |

## Consecuencias

**A favor:**

- `/pos` no paga ni un byte del mapa. La librería viaja en un chunk que solo descarga la pantalla
  que la usa.
- El criterio 7 se verifica de dos formas independientes —build output y red— y con su mitad
  discriminante, así que no puede pasar por accidente.
- El criterio 4 se cumple en los tres modos de fallo reales, no solo en el que su redacción
  describe.
- La frontera de error queda disponible para el resto del repositorio, que hoy no tiene ninguna de
  región.
- Cambiar de librería de mapas es reescribir **un** archivo, porque solo uno la importa.

**En contra / coste asumido:**

- **Un componente compartido nuevo** (`InlineErrorBoundary`) y un componente de clase, que es lo
  único que React ofrece para esto: no hay equivalente con hooks.
- **Tres archivos donde parecería que bastan dos**: el widget, su envoltorio y el `.ts` de sus
  props. La separación existe para que no haya ninguna arista estática hacia el widget, y está
  explicada en el contrato.
- **La regla del `grep` hay que respetarla a mano.** Nada en el build impide que alguien importe
  `leaflet` en otro archivo; lo que hay es una verificación en el paso 5 y un `grep` de una línea.
  Un lint propio que lo prohibiera sería mejor, y es una mejora aparte.
- El primer render del mapa tiene un salto: el `loading` primero y el mapa después. El
  `ui-designer` reserva el alto para que no reflote la página.
- La verificación del criterio 7 exige un **build de producción limpio**, que no es gratis en
  tiempo.

**Impacto en seguridad y escalabilidad:**

- **Escalabilidad del cliente**, que es la que este ADR ataca: el coste de la librería está
  confinado a una pantalla de configuración que se abre de vez en cuando, en vez de repartido
  sobre la pantalla que se abre todo el día.
- **Aislamiento multi-tenant**: sin cambios. Este ADR solo mueve código entre archivos; no toca
  ninguna consulta ni ninguna ruta. El widget diferido recibe un punto, una función y una
  plantilla de URL, y **ningún identificador de tenant**.
- **Superficie de fallo reducida**: la frontera de error acota el radio de un fallo del chunk o de
  un error de render del widget a la propia tarjeta. Sin ella, un fallo de un tercero podía tumbar
  una pantalla de configuración entera y con ella un borrador sin guardar.
- **Coste de reversión: bajo.** Quitar la carga diferida es cambiar el `dynamic()` por un
  `import`; quitar el mapa entero es borrar tres archivos del directorio `map/`, el envoltorio y
  una prop.
