import { MapOutlined } from "@mui/icons-material";
import { Box, Button, Skeleton, Typography } from "@mui/material";
import dynamic from "next/dynamic";

import { InlineErrorBoundary } from "@/components/InlineErrorBoundary";
import { MAP_HEIGHT, MAP_ROOT_CLASS } from "@/constants/map";
import type { IMapPoint } from "@/schemas/map";
import { shape, touch } from "@/theme/tokens";

import {
  MAP_DEGRADED_NOTICE,
  MAP_LOADING_LABEL,
  MAP_REMOVE_POINT_LABEL,
} from "./map/mapCopy";
import type { StoreLocationMapProps } from "./map/storeLocationMapProps";

export interface StoreLocationFieldProps {
  point: IMapPoint | null;
  /** `null` clears the point. Always called with a merchant gesture behind it. */
  onPointChange: (point: IMapPoint | null) => void;
}

/** The reading measure of the degraded copy, and its single decorative glyph. */
const DEGRADED_MEASURE = 420;
const DEGRADED_ICON_SIZE = 24;

/**
 * A block, not lines, rows or cards — which is why `LoadingState`'s four
 * variants do not fit. It fills the reserved slot, so the page does not reflow
 * when the map lands. NEVER a `CircularProgress`: a ring says «wait» without
 * saying what is coming, and on an expensive, slow connection this state is the
 * normal one, not the rare one.
 */
function StoreLocationMapLoading() {
  return (
    <Box
      role="status"
      aria-busy="true"
      aria-label={MAP_LOADING_LABEL}
      sx={{ height: "100%", width: "100%" }}
    >
      <Skeleton variant="rounded" sx={{ height: "100%", width: "100%" }} />
    </Box>
  );
}

/**
 * The degraded panel of acceptance criterion 4 in its chunk form.
 *
 * Not `ErrorState`: nothing has failed FOR THE MERCHANT — the form is intact and
 * the answer is in the two fields beside it — so an alarm glyph and a retry
 * button would send them to fix what is not broken. And it would not fit: that
 * component's content is taller than the shortest slot.
 *
 * No attribution either: nothing of OpenStreetMap is on screen to credit.
 */
function StoreLocationMapDegraded() {
  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        px: 2,
        bgcolor: "semantic.hue.info.surface",
      }}
    >
      <MapOutlined
        sx={{
          fontSize: DEGRADED_ICON_SIZE,
          color: "semantic.hue.info.main",
        }}
      />
      <Typography
        variant="body2"
        sx={{
          maxWidth: DEGRADED_MEASURE,
          textAlign: "center",
          color: "semantic.hue.info.main",
        }}
      >
        {MAP_DEGRADED_NOTICE}
      </Typography>
    </Box>
  );
}

/**
 * The map's ONLY entry point, deferred. The `dynamic()` call is at module level:
 * inside the render it would change the component's identity on every pass and
 * remount the map on every keystroke of the form. And `ssr: false` is not a
 * preference — Leaflet touches `window` while its module evaluates (ADR 0099).
 */
const StoreLocationMap = dynamic<StoreLocationMapProps>(
  () => import("./map/StoreLocationMap"),
  { ssr: false, loading: () => <StoreLocationMapLoading /> },
);

/**
 * The wrapper: the reserved slot, the deferred load, the error boundary and the
 * action that takes the point away. Three things and nothing else.
 *
 * It does NOT know `ITiendaOnlineDraft`: it takes a point and hands back a
 * point, so it has no way to write any other field of the form. And it has no
 * «no provider configured» branch — the default provider is baked in, so there
 * is always one, and a branch nobody can exercise is E-013.
 */
export function StoreLocationField({
  point,
  onPointChange,
}: Readonly<StoreLocationFieldProps>) {
  return (
    <Box>
      {/* `position: relative` + `zIndex: 0` is a REQUIREMENT, not a detail:
          Leaflet's control container paints at z-index 1000 and
          `.leaflet-container` creates no stacking context of its own, so without
          this the zoom buttons would cover `SaveBar` (zIndex 1) — the only
          action that closes the task. The slot also keeps the SAME height while
          loading, loaded and degraded, so the page never reflows. */}
      <Box
        className={MAP_ROOT_CLASS}
        sx={{
          position: "relative",
          zIndex: 0,
          height: MAP_HEIGHT,
          borderRadius: `${shape.radius.md}px`,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "semantic.surface.border",
          bgcolor: "semantic.surface.sunken",
        }}
      >
        {/* Inside the card, so what falls is the map and nothing else. Without
            it the rejected `next/dynamic` promise climbs to the route segment's
            boundary and replaces the whole screen. */}
        <InlineErrorBoundary fallback={<StoreLocationMapDegraded />}>
          <StoreLocationMap point={point} onPointPicked={onPointChange} />
        </InlineErrorBoundary>
      </Box>

      {point !== null && (
        // No confirmation: it is undone by touching the map again and nothing
        // has been saved yet. The reversible half of acceptance criterion 5 —
        // «no point» has to stay reachable, or one mis-tap becomes permanent.
        <Button
          variant="text"
          onClick={() => onPointChange(null)}
          sx={{ minHeight: touch.min, px: 0 }}
        >
          {MAP_REMOVE_POINT_LABEL}
        </Button>
      )}
    </Box>
  );
}

export default StoreLocationField;
