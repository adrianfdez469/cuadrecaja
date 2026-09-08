"use client";

// Imported HERE and nowhere else, so the stylesheet travels with the deferred
// chunk instead of the shared bundle (ADR 0099).
import "leaflet/dist/leaflet.css";

import { GlobalStyles, Typography } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { divIcon } from "leaflet";
import type {
  LeafletEvent,
  LeafletMouseEvent,
  Marker as LeafletMarker,
} from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  AttributionControl,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvent,
  ZoomControl,
} from "react-leaflet";

import {
  MAP_ATTRIBUTION_BAR_HEIGHT,
  MAP_MARKER_CLASS,
  MAP_MARKER_DOT_SIZE,
  MAP_MARKER_ICON_SIZE,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_ROOT_CLASS,
  MAP_TILE_PROVIDER,
  MAP_TILE_REFERRER_POLICY,
} from "@/constants/map";
import type { IMapBounds, IMapPoint, IMapView } from "@/schemas/map";
import { shape, touch } from "@/theme/tokens";

import {
  MAP_DEGRADED_NOTICE,
  MAP_ZOOM_IN_TITLE,
  MAP_ZOOM_OUT_TITLE,
} from "./mapCopy";
import { initialMapView, isPointOutsideBounds } from "./mapView";
import type { StoreLocationMapProps } from "./storeLocationMapProps";

/** The white ring that lifts the dot off any tile, and its outer edge. */
const MARKER_RING_WIDTH = 4;
const MARKER_EDGE_WIDTH = 1;
/** Inset of the attribution text from the slot's rounded corner. */
const ATTRIBUTION_INSET = 8;
/** The mandatory credit never drops below this, at any width. */
const ATTRIBUTION_FONT_SIZE = 12;
/** The focus ring of the marker and of the two zoom buttons. */
const FOCUS_RING_WIDTH = 2;
/**
 * Above the tile panes, below Leaflet's own control corners (1000): the degraded
 * band must never end up over the attribution, which is a licence requirement.
 */
const DEGRADED_BAND_Z_INDEX = 900;

/**
 * Everything Leaflet's own stylesheet has to lose, scoped under
 * `MAP_ROOT_CLASS`. Written with tokens and never with a hex value, and always
 * one class deeper than the rule it beats — `.leaflet-touch .leaflet-bar a` in
 * particular, which otherwise wins on a phone and the failure is silent.
 */
const mapGlobalStyles = (theme: Theme) => {
  const { semantic } = theme.palette;
  const root = `.${MAP_ROOT_CLASS}`;
  const marker = `${root} .${MAP_MARKER_CLASS}`;

  return {
    [`${root} .leaflet-container`]: {
      height: "100%",
      width: "100%",
      backgroundColor: semantic.surface.sunken,
      fontFamily: "inherit",
    },

    /* The two zoom buttons: Leaflet draws them at 26/30 px, below the tap floor. */
    [`${root} .leaflet-bar, ${root} .leaflet-touch .leaflet-bar`]: {
      border: `1px solid ${semantic.surface.border}`,
      borderRadius: `${shape.radius.sm}px`,
      boxShadow: "none",
    },
    [`${root} .leaflet-bar a, ${root} .leaflet-touch .leaflet-bar a`]: {
      width: touch.min,
      height: touch.min,
      lineHeight: `${touch.min}px`,
      backgroundColor: semantic.surface.raised,
      color: semantic.text.primary,
      borderBottom: `1px solid ${semantic.surface.border}`,
    },
    [`${root} .leaflet-bar a:last-child, ${root} .leaflet-touch .leaflet-bar a:last-child`]:
      {
        borderBottom: "none",
      },
    [`${root} .leaflet-touch .leaflet-control-zoom-in, ${root} .leaflet-touch .leaflet-control-zoom-out`]:
      {
        fontSize: "1.375rem",
      },
    [`${root} .leaflet-bar a:focus-visible, ${marker}:focus-visible`]: {
      outline: `${FOCUS_RING_WIDTH}px solid ${semantic.surface.inverse}`,
      outlineOffset: FOCUS_RING_WIDTH,
    },

    /* The mandatory attribution: an opaque band, full width, never collapsed. */
    [`${root} .leaflet-bottom.leaflet-right`]: {
      left: 0,
      right: 0,
      bottom: 0,
      width: "100%",
    },
    [`${root} .leaflet-bottom .leaflet-control-attribution`]: {
      margin: 0,
      width: "100%",
      height: MAP_ATTRIBUTION_BAR_HEIGHT,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingLeft: ATTRIBUTION_INSET,
      paddingRight: ATTRIBUTION_INSET,
      backgroundColor: semantic.surface.raised,
      color: semantic.text.secondary,
      fontFamily: "inherit",
      fontSize: ATTRIBUTION_FONT_SIZE,
      lineHeight: 1,
      opacity: 1,
      borderRadius: 0,
      boxShadow: "none",
    },
    [`${root} .leaflet-control-attribution a`]: {
      color: semantic.hue.accent.main,
    },

    /* The marker: a 44 px grip with a 24 px mark inside it. */
    [marker]: {
      width: MAP_MARKER_ICON_SIZE,
      height: MAP_MARKER_ICON_SIZE,
      background: "transparent",
      border: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    [`${marker} > span`]: {
      display: "block",
      width: MAP_MARKER_DOT_SIZE,
      height: MAP_MARKER_DOT_SIZE,
      borderRadius: `${shape.radius.pill}px`,
      backgroundColor: semantic.hue.accent.main,
      boxShadow: [
        `0 0 0 ${MARKER_RING_WIDTH}px ${semantic.surface.raised}`,
        `0 0 0 ${MARKER_RING_WIDTH + MARKER_EDGE_WIDTH}px ${semantic.surface.borderStrong}`,
      ].join(", "),
    },
  };
};

/**
 * The ONE gesture on the map surface that writes. Not `moveend`, not `zoomend`,
 * not `viewreset`: those are the door the default view would slip through into
 * the draft (ADR 0098).
 */
function MapClickWriter({
  onPointPicked,
}: Readonly<Pick<StoreLocationMapProps, "onPointPicked">>) {
  useMapEvent("click", (event: LeafletMouseEvent) => {
    onPointPicked({ lat: event.latlng.lat, lon: event.latlng.lng });
  });
  return null;
}

/**
 * Field → map, and only that direction: it READS the viewport and never writes
 * the draft. The view does not move when the point is already on screen, so
 * nothing jumps while somebody types a decimal.
 */
function RecentreOnPoint({ point }: Readonly<{ point: IMapPoint | null }>) {
  const map = useMap();
  // The two numbers and not the object: `draftToMapPoint` builds a fresh object
  // on every render, and depending on it would re-run this on every keystroke.
  const lat = point === null ? null : point.lat;
  const lon = point === null ? null : point.lon;

  useEffect(() => {
    if (lat === null || lon === null) return;
    const current = map.getBounds();
    const bounds: IMapBounds = {
      south: current.getSouth(),
      west: current.getWest(),
      north: current.getNorth(),
      east: current.getEast(),
    };
    if (isPointOutsideBounds({ lat, lon }, bounds)) map.panTo([lat, lon]);
  }, [map, lat, lon]);

  return null;
}

/**
 * The map widget. The ONLY module of the repository that imports `leaflet` or
 * `react-leaflet`, entered only through `next/dynamic` (ADR 0099).
 *
 * No tile is ever pre-fetched, pre-seeded or stored outside the browser's HTTP
 * cache, and no view is walked by code to warm it: the provider's usage policy
 * forbids all three, and no test can catch a breach (ADR 0097).
 */
export default function StoreLocationMap({
  point,
  onPointPicked,
}: Readonly<StoreLocationMapProps>) {
  // Read ONCE, at mount: `MapContainer` treats `center`/`zoom` as mount-only
  // props, and that is exactly what is wanted here.
  const [view] = useState<IMapView>(() => initialMapView(point));
  const [tilesFailed, setTilesFailed] = useState(false);

  // An explicit `divIcon`: Leaflet's default icon resolves `iconUrl`/`shadowUrl`
  // relative to its stylesheet, which is the classic break with a bundler, and a
  // `divIcon` is what lets the global theme paint the mark.
  const markerIcon = useMemo(
    () =>
      divIcon({
        className: MAP_MARKER_CLASS,
        html: "<span></span>",
        iconSize: [MAP_MARKER_ICON_SIZE, MAP_MARKER_ICON_SIZE],
        iconAnchor: [MAP_MARKER_ICON_SIZE / 2, MAP_MARKER_ICON_SIZE / 2],
      }),
    [],
  );

  const handleMarkerDragEnd = (event: LeafletEvent) => {
    const dragged = event.target as LeafletMarker;
    const position = dragged.getLatLng();
    onPointPicked({ lat: position.lat, lon: position.lng });
  };

  return (
    <>
      <GlobalStyles styles={mapGlobalStyles} />

      <MapContainer
        center={[view.centerLat, view.centerLon]}
        zoom={view.zoom}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        // Own zoom control, in Spanish and at the tap floor.
        zoomControl={false}
        // Own attribution control, without Leaflet's optional prefix.
        attributionControl={false}
        // A map inside a long scrolling form must not eat the page's scroll.
        scrollWheelZoom={false}
        // NOT cosmetic: with the default, a double click would write the point
        // TWICE and change the zoom. One gesture, one meaning.
        doubleClickZoom={false}
      >
        <TileLayer
          url={MAP_TILE_PROVIDER.urlTemplate}
          attribution={MAP_TILE_PROVIDER.attributionHtml}
          minZoom={MAP_MIN_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          // Four tiles per tile would quadruple the bytes for the very audience
          // that cannot pay for them, and the requests to a donation-funded
          // server with them.
          detectRetina={false}
          // Origin only. NOT "no-referrer": on the web path the referer IS the
          // application identification the provider's policy requires, because a
          // page cannot set its own User-Agent (ADR 0097).
          referrerPolicy={MAP_TILE_REFERRER_POLICY}
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />

        <ZoomControl
          position="topright"
          zoomInTitle={MAP_ZOOM_IN_TITLE}
          zoomOutTitle={MAP_ZOOM_OUT_TITLE}
        />
        <AttributionControl position="bottomright" prefix={false} />

        <MapClickWriter onPointPicked={onPointPicked} />
        <RecentreOnPoint point={point} />

        {point !== null && (
          // Position derived from the prop on EVERY render, with no internal
          // state: that is the field → map direction, and it cannot quietly stop
          // existing (E-013).
          <Marker
            position={[point.lat, point.lon]}
            icon={markerIcon}
            draggable
            eventHandlers={{ dragend: handleMarkerDragEnd }}
          />
        )}
      </MapContainer>

      {tilesFailed && (
        // A band ABOVE the attribution one, never over it, and it does not cover
        // the map: panning and zooming are what may bring the tiles back. The
        // copy is a CONSTANT — no `error.message`, no `error.tile.src`, no tile
        // URL, ever (E-031).
        <Typography
          variant="body2"
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: `${MAP_ATTRIBUTION_BAR_HEIGHT}px`,
            zIndex: DEGRADED_BAND_Z_INDEX,
            pointerEvents: "none",
            px: 1.5,
            py: 1,
            bgcolor: "semantic.hue.info.surface",
            color: "semantic.hue.info.main",
          }}
        >
          {MAP_DEGRADED_NOTICE}
        </Typography>
      )}
    </>
  );
}
