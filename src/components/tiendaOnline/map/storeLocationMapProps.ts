import type { IMapPoint } from "@/schemas/map";

/**
 * The deferred map's props, in a plain `.ts` on purpose: `StoreLocationField`
 * types the lazy component from HERE, so there is not a single static import
 * edge — not even a type one — towards the module that pulls in the library
 * (acceptance criterion 7, ADR 0099).
 */
export interface StoreLocationMapProps {
  /** The point to draw, or `null` for "no marker at all". */
  point: IMapPoint | null;
  /**
   * The merchant put a point somewhere. `IMapPoint`, never `null`: the map has no
   * channel for erasing a coordinate, and none for inventing one out of its own
   * viewport (ADR 0098).
   */
  onPointPicked: (point: IMapPoint) => void;
}
