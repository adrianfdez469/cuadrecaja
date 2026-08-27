"use client";

import { memo } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Drawer,
  Stack,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useCartStore } from "@/store/cartStore";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { shape, touch } from "@/theme";

/**
 * The open accounts, from the charge bar.
 *
 * The bar already names the account about to be charged, so its caret is the
 * honest place to change it. What that caret opened was a dropdown menu:
 * anchored to a control at the very bottom of the screen, with rows sized for
 * a mouse and «Nueva cuenta» as one more line of the list.
 *
 * The redesign draws a sheet instead — the same object as the POS's own
 * actions, one row per account at 64px carrying what the cashier chooses by
 * (how much is on it and how many articles), and creating another as a real
 * action of its own at the foot.
 *
 * Renaming and closing an account stay in the tabs above the basket. This is
 * the one-handed shortcut, not a second control panel.
 */

const PAPER_SX = {
  borderTopLeftRadius: `${shape.radius.lg}px`,
  borderTopRightRadius: `${shape.radius.lg}px`,
  pb: "calc(8px + env(safe-area-inset-bottom))",
} as const;

const HEAD_SX = { px: 2, pt: 2, pb: 1.5, color: "text.secondary" } as const;

const ROW_SX = {
  width: "100%",
  minHeight: 64,
  px: 2,
  gap: 1.625,
  justifyContent: "flex-start",
  textAlign: "left",
  borderTop: "1px solid",
  borderColor: "divider",
} as const;

const ROW_ACTIVE_SX = {
  ...ROW_SX,
  bgcolor: "semantic.hue.accent.surface",
} as const;

const BADGE_BASE_SX = {
  flex: "0 0 40px",
  width: 40,
  height: 40,
  borderRadius: `${shape.radius.md}px`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
} as const;

const BADGE_SX = {
  ...BADGE_BASE_SX,
  bgcolor: "semantic.hue.neutral.surface",
  color: "semantic.hue.neutral.main",
} as const;

const BADGE_ACTIVE_SX = {
  ...BADGE_BASE_SX,
  bgcolor: "primary.main",
  color: "primary.contrastText",
} as const;

const CTA_WRAP_SX = { px: 1.75, pt: 1.75 } as const;

const CTA_SX = {
  minHeight: touch.comfortable,
  borderRadius: `${shape.radius.md}px`,
  fontSize: "1.03125rem",
  fontWeight: 700,
} as const;

interface CartAccountSheetProps {
  open: boolean;
  onClose: () => void;
}

function CartAccountSheetComponent({ open, onClose }: CartAccountSheetProps) {
  const carts = useCartStore((state) => state.carts);
  const activeCartId = useCartStore((state) => state.activeCartId);
  const setActiveCart = useCartStore((state) => state.setActiveCart);
  const createCart = useCartStore((state) => state.createCart);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: PAPER_SX }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        sx={HEAD_SX}
        component="div"
      >
        <Typography variant="caption" fontWeight={700} letterSpacing=".08em">
          CUENTAS ABIERTAS
        </Typography>
        <Typography variant="caption">
          {carts.length} {carts.length === 1 ? "abierta" : "abiertas"}
        </Typography>
      </Stack>

      {carts.map((cart, index) => {
        const isActive = cart.id === activeCartId;
        const units = cart.items.reduce((sum, item) => sum + item.quantity, 0);

        return (
          <ButtonBase
            key={cart.id}
            component="div"
            sx={isActive ? ROW_ACTIVE_SX : ROW_SX}
            aria-current={isActive}
            onClick={() => {
              setActiveCart(cart.id);
              onClose();
            }}
          >
            <Box sx={isActive ? BADGE_ACTIVE_SX : BADGE_SX}>
              {isActive ? <CheckIcon fontSize="small" /> : index + 1}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body1"
                fontWeight={600}
                lineHeight={1.25}
                noWrap
              >
                {cart.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {units === 0
                  ? "Vacía"
                  : `${units} ${units === 1 ? "artículo" : "artículos"}`}
              </Typography>
            </Box>

            <MultiCurrencyAmount amount={cart.total} align="right" />
          </ButtonBase>
        );
      })}

      <Box sx={CTA_WRAP_SX}>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          sx={CTA_SX}
          onClick={() => {
            createCart();
            onClose();
          }}
        >
          Nueva cuenta
        </Button>
      </Box>
    </Drawer>
  );
}

export const CartAccountSheet = memo(CartAccountSheetComponent);
