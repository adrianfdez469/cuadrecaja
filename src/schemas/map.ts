import { z } from "zod";

import {
  LATITUDE_MAX,
  LATITUDE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
} from "@/constants/map";

/** A point somebody chose. The ONLY shape `applyMapPointToDraft` accepts. */
export const mapPointSchema = z
  .object({
    lat: z.number().min(LATITUDE_MIN).max(LATITUDE_MAX),
    lon: z.number().min(LONGITUDE_MIN).max(LONGITUDE_MAX),
  })
  .strict();
export type IMapPoint = z.infer<typeof mapPointSchema>;

/**
 * Where the viewport is looking. Deliberately NOT assignable to `IMapPoint`: a
 * view is not a coordinate anybody chose, and the type system is what keeps the
 * two apart (ADR 0098).
 */
export const mapViewSchema = z
  .object({
    centerLat: z.number().min(LATITUDE_MIN).max(LATITUDE_MAX),
    centerLon: z.number().min(LONGITUDE_MIN).max(LONGITUDE_MAX),
    zoom: z.number().int(),
  })
  .strict();
export type IMapView = z.infer<typeof mapViewSchema>;

/** A viewport's edges, as plain numbers, so the predicate below stays pure. */
export const mapBoundsSchema = z
  .object({
    south: z.number(),
    west: z.number(),
    north: z.number(),
    east: z.number(),
  })
  .strict();
export type IMapBounds = z.infer<typeof mapBoundsSchema>;
