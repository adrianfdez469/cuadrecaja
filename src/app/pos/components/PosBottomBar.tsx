"use client";

import { Ref, RefObject } from "react";
import type { MouseEvent } from "react";
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
   * The cashier is actively searching on mobile. Only shrinks this bar:
   * every pixel it gives up here is one more pixel of products visible
   * above the on-screen keyboard.
   */
  searchMode?: boolean;
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
}: PosBottomBarProps) {
  return (
    <Box
      ref={rootRef}
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
        "@media (min-width:700px)": {
          position: "static",
          zIndex: "auto",
        },
      }}
    >
      {/* Píldoras de carritos: se ocultan mientras se busca. La cuenta
          activa no cambia por teclear, y es la fila que está justo encima
          del teclado, donde el espacio es más caro. */}
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
          p: searchMode ? 0.75 : 1,
          background: (theme) =>
            `linear-gradient(to top, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
          backdropFilter: "blur(10px)",
          boxSizing: "border-box",
        }}
      >
        <Stack direction="row" spacing={1}>
          <SelectableTextField
            ref={searchInputRef}
            fullWidth
            variant="outlined"
            // Cada píxel de esta fila es un píxel menos de resultados
            // arriba del teclado, así que al buscar el campo se achica.
            size={searchMode ? "small" : "medium"}
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
  );
}
