import { MAP_DEFAULT_VIEW, MAP_POINT_ZOOM } from "@/constants/map";
import type { IMapBounds, IMapPoint, IMapView } from "@/schemas/map";

/**
 * Where the map opens: `MAP_DEFAULT_VIEW` when there is no point, the point at
 * `MAP_POINT_ZOOM` when there is one.
 *
 * Read ONCE, at mount, because react-leaflet's `MapContainer` treats `center` and
 * `zoom` as initial-only props. The return type is `IMapView`, never `IMapPoint`,
 * on purpose (ADR 0098).
 */
export function initialMapView(point: IMapPoint | null): IMapView {
  // The constant itself, not a copy of its three numbers: "opens on the default
  // view" is one fact, and a copy would let the two drift apart silently.
  if (point === null) return MAP_DEFAULT_VIEW;
  return { centerLat: point.lat, centerLon: point.lon, zoom: MAP_POINT_ZOOM };
}

/**
 * `true` when `point` falls outside `bounds`. Drives the re-centre of acceptance
 * criterion 3 — and only the re-centre: nothing derived from `bounds` is ever
 * written back into the draft.
 *
 * A point exactly on an edge counts as INSIDE.
 */
export function isPointOutsideBounds(
  point: IMapPoint,
  bounds: IMapBounds,
): boolean {
  return (
    point.lat < bounds.south ||
    point.lat > bounds.north ||
    point.lon < bounds.west ||
    point.lon > bounds.east
  );
}
