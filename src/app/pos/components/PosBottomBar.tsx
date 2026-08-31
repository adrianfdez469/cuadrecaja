"use client";

import { memo, Ref, RefObject } from "react";
import type { MouseEvent } from "react";
import { Box, IconButton, InputAdornment, Stack, Alert } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import SelectableTextField from "@/components/SelectableTextField";
import ProductProcessorData, {
  ProductProcessorDataRef,
} from "@/components/ProductProcessorData/ProductProcessorData";
import { IProcessedData } from "@/schemas/processedData";
import { shape, touch } from "@/theme";

// Flat `background.paper`, and 12/12/10 as the redesign measures it.
//
// This row used to carry a `backdrop-filter: blur(10px)` over a near-opaque
// gradient — both leftovers from when it was a floating bar over the product
// list. The blur had nothing to show through it and cost a full-width layer
// the browser re-snapshots on every scroll frame; the gradient now paints a
// fade between a colour and itself. In flow at the top of the column, the row
// simply sits on the page.
const SEARCH_ROW_SX = {
  px: 1.5,
  pt: 1.5,
  pb: 1.25,
  bgcolor: "background.paper",
  boxSizing: "border-box",
} as const;
// Painted from here rather than inside the scanner component, which is also
// mounted in the inventory dialogs: violet and 56px are what this row asks
// for, not what a scan button is everywhere.
// The redesign's field: 56px and a near-black 2px rule, so the one control
// the cashier types into is the most present object on the row. A 1px divider
// grey box could not carry that job while sitting next to a violet tile.
const SEARCH_INPUT_SX = {
  height: touch.comfortable,
  bgcolor: "background.paper",
  borderRadius: `${shape.radius.md}px`,
  "& .MuiOutlinedInput-notchedOutline": {
    borderWidth: 2,
    borderColor: "semantic.surface.inverse",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "semantic.surface.inverse",
  },
} as const;

const SCANNER_SX = {
  flexShrink: 0,
  alignSelf: "center",
  "& .MuiButton-root": {
    minWidth: touch.comfortable,
    width: touch.comfortable,
    height: touch.comfortable,
    p: 0,
    borderRadius: `${shape.radius.md}px`,
    "& .MuiButton-startIcon": { m: 0 },
    "& .MuiSvgIcon-root": { fontSize: 26 },
  },
} as const;

// The redesign gives the three controls of this row the same 56px block: the
// field, the actions button and the scanner. They are the targets a cashier
// hits without looking, and the old row mixed a medium field with a 44px and
// a 40px icon.
const ACTIONS_BUTTON_SX = {
  flex: `0 0 ${touch.comfortable}px`,
  width: touch.comfortable,
  height: touch.comfortable,
  alignSelf: "center",
  bgcolor: "background.paper",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: `${shape.radius.md}px`,
  color: "text.secondary",
} as const;

interface PosBottomBarProps {
  searchInputRef: RefObject<HTMLInputElement>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onSearchMouseDown: () => void;
  scannerRef: RefObject<ProductProcessorDataRef>;
  onProductScan: (code: string) => void;
  onCameraOpenChange: (open: boolean) => void;
  scannerError: string | null;
  onDismissScannerError: () => void;
  /** Opens the POS's own actions — sync, my sales, starting point, print. */
  onOpenActions: () => void;
  rootRef?: Ref<HTMLDivElement>;
}

function PosBottomBarComponent({
  searchInputRef,
  searchQuery,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onSearchMouseDown,
  scannerRef,
  onProductScan,
  onCameraOpenChange,
  scannerError,
  onDismissScannerError,
  onOpenActions,
  rootRef,
}: PosBottomBarProps) {
  return (
    <Box
      ref={rootRef}
      sx={{
        flexShrink: 0,
        // Plain flex child, at the top of the POS column.
        //
        // This used to be `position: fixed; bottom: 0` — the only way to keep
        // a search field above the on-screen keyboard on mobile Safari, which
        // does not shrink the layout viewport. Moved to the top, the problem
        // disappears instead of being worked around: the keyboard rises from
        // the bottom and never reaches here, and the column's top edge is
        // correct in both modes — below the app bar normally, and at the top
        // of the visual viewport while it is pinned to it during a search.
      }}
    >
      {/* Buscador */}
      <Box data-tour="pos-search" sx={SEARCH_ROW_SX}>
        <Stack direction="row" spacing={1}>
          <SelectableTextField
            ref={searchInputRef}
            fullWidth
            variant="outlined"
            size="medium"
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            onMouseDown={onSearchMouseDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onSearchChange("")}>
                    <CloseIcon />
                  </IconButton>
                </InputAdornment>
              ),
              inputProps: {
                // Disables iOS's QuickType suggestion bar above the
                // keyboard — it only shows when autocorrect is on, and
                // product names aren't dictionary words it can usefully
                // suggest for.
                autoComplete: "off",
                autoCorrect: "off",
                spellCheck: false,
                // Selecting on focus is not enough here. The quantity
                // controls on a product card preventDefault their mousedown
                // (see PosProductItemLayout) so adding a product does not
                // close the keyboard mid-sale — which means the search never
                // blurs, and tapping it again to look up the next product
                // fires no focus event. Without this the cashier lands on a
                // stray caret and has to wipe the previous term by hand.
                // Deferred for the same reason SelectableTextField defers its
                // own: the browser settles the caret on the mouseup that
                // follows the click — and when the click lands inside an
                // already selected term it collapses it after this runs.
                onClick: (event: MouseEvent<HTMLInputElement>) => {
                  const input = event.currentTarget;
                  setTimeout(() => input.select(), 0);
                },
              },
              sx: SEARCH_INPUT_SX,
            }}
          />
          {/* Everything the point of sale can do that is not selling: it used
              to be seven bare icons in the app bar, which at 430px ran off
              the screen. See PosActionsSheet. */}
          <IconButton
            aria-label="Acciones del POS"
            onClick={onOpenActions}
            data-tour="pos-toolbar-actions"
            sx={ACTIONS_BUTTON_SX}
          >
            <MoreHorizIcon />
          </IconButton>

          {/* Plain flex item: this used to be a `<Grid size={{xs:7}}>` with no
              Grid container above it, so its width came from the flex row
              anyway — and once the actions button joined the row, the twelfth
              of nothing it asked for squeezed the scanner under it. */}
          <Box sx={SCANNER_SX} data-tour="pos-toolbar-scanner">
            <ProductProcessorData
              ref={scannerRef}
              onProcessedData={(data: IProcessedData) => {
                if (data?.code) onProductScan(data.code);
              }}
              enableHardwareScanner={false}
              onCameraOpenChange={onCameraOpenChange}
            />
            {scannerError && (
              <Alert
                severity="warning"
                onClose={onDismissScannerError}
                sx={{ mt: 1 }}
              >
                {scannerError}
              </Alert>
            )}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

export const PosBottomBar = memo(PosBottomBarComponent);
