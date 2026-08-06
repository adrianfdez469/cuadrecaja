"use client";

import { ReactNode, Ref, RefObject } from "react";
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  Grid2 as Grid,
  Alert,
  alpha,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SelectableTextField from "@/components/SelectableTextField";
import ProductProcessorData, {
  ProductProcessorDataRef,
} from "@/components/ProductProcessorData/ProductProcessorData";
import { IProcessedData } from "@/schemas/processedData";
import { ICart } from "@/store/cartStore";

interface PosBottomBarProps {
  carts: ICart[];
  activeCartId: string;
  onSelectCart: (id: string) => void;
  onCreateCart: () => void;
  onRemoveActiveCart: () => void;
  onRenameCart: (id: string, name: string) => void;
  editingCartId: string | null;
  onStartEditingCart: (id: string, name: string) => void;
  editingCartName: string;
  onEditingCartNameChange: (name: string) => void;
  onStopEditingCart: () => void;
  editCartInputRef: RefObject<HTMLInputElement>;
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
  rootRef?: Ref<HTMLDivElement>;
  /**
   * Mobile search mode: this bar expands into a full search overlay that
   * covers the visible area, keeping the field where the thumb already is
   * and stacking results upward from it. See the layout note on the root
   * Box for why the overlay lives here instead of being its own component.
   */
  searchMode?: boolean;
  /** Real visible height above the keyboard, from `visualViewport`. */
  overlayHeight?: number | null;
  searchHeader?: ReactNode;
  searchResults?: ReactNode;
  searchResultsRef?: Ref<HTMLDivElement>;
}

export function PosBottomBar({
  carts,
  activeCartId,
  onSelectCart,
  onCreateCart,
  onRemoveActiveCart,
  onRenameCart,
  editingCartId,
  onStartEditingCart,
  editingCartName,
  onEditingCartNameChange,
  onStopEditingCart,
  editCartInputRef,
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
  rootRef,
  searchMode = false,
  overlayHeight,
  searchHeader,
  searchResults,
  searchResultsRef,
}: PosBottomBarProps) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        // Below the cart panel's own breakpoint (page.tsx's
        // showCartPanel, 700px) there's no sidebar for this to overlap
        // with, so it's safe — and necessary — to be position:fixed:
        // that's what correctly follows the on-screen keyboard on mobile
        // Safari. A flex-flow element inside a dvh-sized column does not
        // reliably do this. At 700px+ it goes back to normal flow, which
        // is what avoids the cart-panel overlap this component exists to
        // prevent in the first place.
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        // Search mode grows this same fixed box into a full overlay
        // instead of mounting a separate one, for two reasons. (1) Focus:
        // the field must keep its DOM identity across the switch, or the
        // very focus event that opens search would unmount the input and
        // dismiss the keyboard. (2) Coordinates: with the keyboard up,
        // iOS Safari scrolls the visual viewport inside the layout
        // viewport, so anything in document flow sits higher than it
        // appears and `dvh` doesn't reflect the visible area — only
        // `position: fixed` tracks it. Anchoring to `bottom: 0` with an
        // explicit visualViewport height makes the overlay cover exactly
        // what's visible, with no offset math to get wrong.
        ...(searchMode && {
          top: "auto",
          height: overlayHeight != null ? `${overlayHeight}px` : "100dvh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
        }),
        "@media (min-width:700px)": {
          position: "static",
          height: "auto",
          display: "block",
          zIndex: "auto",
        },
      }}
    >
      {searchMode && searchHeader}

      {/* Resultados, apilados hacia arriba desde el buscador. El
          preventDefault del mousedown evita que tocar «+», «−» o la
          cantidad le robe el foco al buscador: sin él, cada producto
          agregado cerraría el teclado y desmontaría esta capa. */}
      {searchMode && (
        <Box
          ref={searchResultsRef}
          onMouseDown={(e) => e.preventDefault()}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column-reverse",
            gap: 1,
            p: 1,
          }}
        >
          {searchResults}
        </Box>
      )}

      <Box
        // Only the bar itself is measured (page.tsx reserves this much
        // space at the foot of the product grid). Measuring the root
        // would report the whole overlay's height in search mode.
        ref={searchMode ? null : rootRef}
        sx={{ flexShrink: 0 }}
      >
        {/* Píldoras de carritos: se ocultan mientras se busca — el espacio
            arriba del teclado vale más como resultados, y la cuenta activa
            se sigue viendo en el encabezado de la capa. */}
        {!searchMode && (
          <Box
            sx={{
              m: 0,
              p: 1,
              background:
                "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)",
              backdropFilter: "blur(10px)",
              borderTop: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 -2px 1px rgba(0,0,0,0.1)",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ overflowX: "auto", pb: 0.5 }}
            >
              {carts.map((c) => (
                <Box key={c.id} sx={{ display: "flex", alignItems: "center" }}>
                  {editingCartId === c.id ? (
                    <SelectableTextField
                      size="small"
                      value={editingCartName}
                      autoFocus
                      ref={editCartInputRef}
                      onChange={(e) => onEditingCartNameChange(e.target.value)}
                      onBlur={onStopEditingCart}
                      onKeyDown={(e) => {
                        const key = e.key;
                        // Evitar interferencia de IME y de manejadores globales
                        const composing = e?.nativeEvent?.isComposing ?? false;
                        if (
                          !composing &&
                          (key === "Enter" || key === "NumpadEnter")
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                          onRenameCart(
                            c.id,
                            (editingCartName || "").trim() || c.name,
                          );
                          onStopEditingCart();
                        } else if (key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          onStopEditingCart();
                        }
                      }}
                      InputProps={{
                        inputProps: {
                          inputMode: "text",
                          autoComplete: "off",
                          autoCorrect: "off",
                          autoCapitalize: "off",
                          spellCheck: false,
                        },
                      }}
                      sx={{ minWidth: 140 }}
                    />
                  ) : (
                    <Chip
                      tabIndex={-1}
                      label={
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              maxWidth: 140,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.name}
                          </Box>
                          <IconButton
                            aria-label="Editar nombre"
                            size="small"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onStartEditingCart(c.id, c.name);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchMove={(e) => {
                              e.stopPropagation();
                            }}
                            edge="end"
                            sx={{ p: 0.25 }}
                          >
                            <EditIcon fontSize="inherit" />
                          </IconButton>
                        </Box>
                      }
                      color={c.id === activeCartId ? "primary" : "default"}
                      variant={c.id === activeCartId ? "filled" : "outlined"}
                      onClick={() => onSelectCart(c.id)}
                      onDelete={() => {
                        if (carts.length <= 1) return; // mantener al menos uno
                        if (c.id !== activeCartId) {
                          onSelectCart(c.id);
                        }
                        onRemoveActiveCart();
                      }}
                      sx={{
                        cursor: "pointer",
                        "& .MuiChip-label": {
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        },
                      }}
                    />
                  )}
                </Box>
              ))}
              <Chip
                label="Nueva cuenta"
                variant="outlined"
                onClick={onCreateCart}
                sx={{ cursor: "pointer" }}
              />
            </Stack>
          </Box>
        )}

        {/* Buscador */}
        <Box
          data-tour="pos-search"
          sx={{
            p: 1,
            background: (theme) =>
              `linear-gradient(to top, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
            backdropFilter: "blur(10px)",
            boxSizing: "border-box",
            // Sin las píldoras encima, el buscador necesita su propio
            // borde para no fundirse con la lista de resultados.
            ...(searchMode && {
              borderTop: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
            }),
          }}
        >
          <Stack direction="row" spacing={1}>
            <SelectableTextField
              ref={searchInputRef}
              fullWidth
              variant="outlined"
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
                },
                sx: {
                  bgcolor: "background.paper",
                  borderRadius: "12px",
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                  },
                },
              }}
            />
            <Grid size={{ xs: 7, sm: 10 }} data-tour="pos-toolbar-scanner">
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
            </Grid>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
