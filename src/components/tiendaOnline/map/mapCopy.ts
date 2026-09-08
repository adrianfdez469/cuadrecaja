/**
 * Every visible string of the map widget. A plain `.ts` and never a `.tsx`, so
 * the suite can import it (E-015). Copy fixed by the F-025 design contract.
 *
 * The degraded notice is a CONSTANT and nothing is ever interpolated into it —
 * not `error.message`, not `error.name`, not the tile URL. A runtime message
 * quotes the data that broke it, and here that data is a third party's URL
 * (E-031).
 */

/** Names the whole group: the section's `aria-label` AND its visible label. */
export const MAP_GROUP_LABEL = "Ubicación del local";

/**
 * The two hints name BOTH ways in — the map and the fields — so each one stays
 * true when the map does not load. Neither component can know that it failed,
 * so the copy is written to hold in both cases instead of being hidden by a
 * branch nobody can take (E-013).
 */
export const MAP_HINT_NO_POINT =
  "Marca el punto en el mapa, o escribe las coordenadas aquí abajo.";
export const MAP_HINT_WITH_POINT =
  "Mueve el punto en el mapa, o corrige las coordenadas aquí abajo.";

/** One string for both degraded forms: for the merchant they are the same fact. */
export const MAP_DEGRADED_NOTICE =
  "El mapa no cargó. Escribe la latitud y la longitud aquí abajo: el local se guarda igual.";

/** Not just "Cargando": that is `LoadingState`'s own label (E-016). */
export const MAP_LOADING_LABEL = "Cargando el mapa";

/** Not just "Quitar": «Quitar el horario» lives on this same tab (E-016). */
export const MAP_REMOVE_POINT_LABEL = "Quitar el punto";

/** Leaflet copies these onto the buttons' `title` and `aria-label`. */
export const MAP_ZOOM_IN_TITLE = "Acercar";
export const MAP_ZOOM_OUT_TITLE = "Alejar";

/** PURE. The hint that fits the current state of the draft's coordinates. */
export function mapHintCopy(hasPoint: boolean): string {
  return hasPoint ? MAP_HINT_WITH_POINT : MAP_HINT_NO_POINT;
}
