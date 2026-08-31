"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SelectableTextField from "@/components/SelectableTextField";
import { CartAccountMenu } from "@/app/pos/components/CartAccountMenu";
import { useCartStore } from "@/store/cartStore";
import { useStoreStatus } from "@/hooks/useStoreStatus";
import { shape, touch } from "@/theme";

/**
 * The open accounts, as tabs over the basket they belong to.
 *
 * They used to be a row of chips floating above the search field in the
 * product column — next to the catalogue, the one thing they have nothing to
 * do with, and on a phone occupying the strip right above the on-screen
 * keyboard. The redesign puts them where the basket is: the panel header on a
 * desktop, the basket itself on a phone.
 *
 * Each tab is a 44px pill carrying its name and nothing else, and a «+» of
 * the same size opens another account. Renaming, closing and emptying wait
 * behind a second tap on the active tab (see `CartAccountMenu`): the pencil,
 * the cross and the bin this row used to show were three controls per
 * account competing with the one that matters, which is switching.
 *
 * The right end states what the top bar states — «Sin conexión», «3 sin
 * subir» — because the basket is where a cashier decides whether to keep
 * selling while the server is unreachable.
 *
 * The renaming state came along with the tabs. It lived in the POS page
 * purely to serve this row, which meant twelve props threaded down for a
 * control that owns all of it; the page keeps only what it actually needs,
 * which is knowing that a text field has the keyboard so the hardware
 * scanner stays quiet.
 */

const ROOT_SX = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: 0.75,
  px: 1.25,
  py: 1,
  borderBottom: "1px solid",
  borderColor: "divider",
} as const;

const SCROLLER_SX = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 0.75,
  overflowX: "auto",
  "&::-webkit-scrollbar": { display: "none" },
  scrollbarWidth: "none",
} as const;

// 44px, 13.5px, the neutral wash; the selected one is violet and bold. The
// same pill as the category filter, one size up.
const TAB_SX = {
  flex: "0 0 auto",
  height: touch.min,
  px: 1.75,
  borderRadius: `${shape.radius.pill}px`,
  bgcolor: "semantic.hue.neutral.surface",
  color: "text.secondary",
  fontSize: "0.84375rem",
  fontWeight: 400,
  maxWidth: 180,
  "& > span": {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
} as const;

const TAB_ACTIVE_SX = {
  ...TAB_SX,
  bgcolor: "primary.main",
  color: "primary.contrastText",
  fontWeight: 700,
  gap: 0.25,
} as const;

const NEW_TAB_SX = {
  flex: `0 0 ${touch.min}px`,
  width: touch.min,
  height: touch.min,
  borderRadius: `${shape.radius.pill}px`,
  bgcolor: "semantic.hue.neutral.surface",
  color: "text.secondary",
  fontSize: "1.25rem",
} as const;

const STATUS_SX = {
  flex: "0 0 auto",
  ml: "auto",
  textAlign: "right",
  fontSize: "0.6875rem",
  lineHeight: 1.3,
  color: "text.secondary",
  whiteSpace: "nowrap",
} as const;

const EDIT_FIELD_SX = { minWidth: 140, flex: "0 0 auto" } as const;

const EDIT_INPUT_PROPS = {
  inputProps: {
    inputMode: "text" as const,
    autoComplete: "off",
    autoCorrect: "off",
    autoCapitalize: "off",
    spellCheck: false,
  },
};

interface CartAccountTabsProps {
  /** Pinned to the far right of the row — the drawer's close button. */
  endAdornment?: ReactNode;
  /**
   * Reports whether an account name is being typed. The POS page holds the
   * hardware scanner open by default, and every keystroke of a rename would
   * otherwise be read as a scanned barcode.
   */
  onRenamingChange?: (renaming: boolean) => void;
  /** «Vaciar carrito», offered in the active tab's menu when present. */
  onClearCart?: () => void;
  canClearCart?: boolean;
}

function CartAccountTabsComponent({
  endAdornment,
  onRenamingChange,
  onClearCart,
  canClearCart = false,
}: CartAccountTabsProps) {
  const carts = useCartStore((state) => state.carts);
  const activeCartId = useCartStore((state) => state.activeCartId);
  const setActiveCart = useCartStore((state) => state.setActiveCart);
  const createCart = useCartStore((state) => state.createCart);
  const renameCart = useCartStore((state) => state.renameCart);
  const removeActiveCart = useCartStore((state) => state.removeActiveCart);
  const storeStatus = useStoreStatus();

  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [editingCartName, setEditingCartName] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onRenamingChange?.(editingCartId !== null);
  }, [editingCartId, onRenamingChange]);

  // Forcing focus this way is what makes the keyboard come up on mobile: the
  // field is only mounted by this same render, so a focus call in the handler
  // that opened it lands on nothing.
  useEffect(() => {
    if (!editingCartId) return;
    const focusLater = () => {
      const el = editInputRef.current;
      if (!el) return;
      try {
        el.focus({ preventScroll: true } as FocusOptions);
      } catch {
        try {
          el.focus();
        } catch {}
      }
      // SelectableTextField selects the text in its own onFocus.
    };
    const raf = requestAnimationFrame(() => setTimeout(focusLater, 0));
    return () => cancelAnimationFrame(raf);
  }, [editingCartId]);

  const activeCart = carts.find((c) => c.id === activeCartId);

  const startEditing = useCallback(() => {
    if (!activeCart) return;
    setEditingCartId(activeCart.id);
    setEditingCartName(activeCart.name);
  }, [activeCart]);

  const stopEditing = useCallback(() => {
    if (editingCartId) {
      const cart = carts.find((c) => c.id === editingCartId);
      renameCart(
        editingCartId,
        (editingCartName || "").trim() || cart?.name || "",
      );
    }
    setEditingCartId(null);
  }, [editingCartId, editingCartName, carts, renameCart]);

  // First tap selects; a tap on the tab already selected opens its menu.
  const handleTabClick = (event: MouseEvent<HTMLElement>, id: string) => {
    if (id === activeCartId) {
      setMenuAnchor(event.currentTarget);
      return;
    }
    setActiveCart(id);
  };

  // Split on the same separator the top bar joins with: the drawing stacks
  // the two facts on two lines here.
  const statusLines = storeStatus?.split(" · ");

  return (
    <Box sx={ROOT_SX}>
      <Box sx={SCROLLER_SX}>
        {carts.map((c) =>
          editingCartId === c.id ? (
            <SelectableTextField
              key={c.id}
              size="small"
              value={editingCartName}
              autoFocus
              ref={editInputRef}
              onChange={(e) => setEditingCartName(e.target.value)}
              onBlur={stopEditing}
              onKeyDown={(e) => {
                const key = e.key;
                // Keep IME composition and global key handlers out of it.
                const composing = e?.nativeEvent?.isComposing ?? false;
                if (!composing && (key === "Enter" || key === "NumpadEnter")) {
                  e.preventDefault();
                  e.stopPropagation();
                  stopEditing();
                } else if (key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingCartId(null);
                }
              }}
              InputProps={EDIT_INPUT_PROPS}
              sx={EDIT_FIELD_SX}
            />
          ) : (
            <ButtonBase
              key={c.id}
              onClick={(event) => handleTabClick(event, c.id)}
              aria-pressed={c.id === activeCartId}
              aria-haspopup={c.id === activeCartId ? "menu" : undefined}
              aria-label={
                c.id === activeCartId
                  ? `${c.name}, cuenta activa — abrir opciones`
                  : undefined
              }
              sx={c.id === activeCartId ? TAB_ACTIVE_SX : TAB_SX}
            >
              <span>{c.name}</span>
              {/* The active pill is also what opens rename/vaciar/cerrar
                  (see CartAccountMenu), and nothing about a selected chip
                  says that on its own — this caret is the same affordance
                  PosPayBar uses for its own menus. */}
              {c.id === activeCartId && (
                <ExpandMoreIcon sx={{ fontSize: 18 }} />
              )}
            </ButtonBase>
          ),
        )}
        <ButtonBase
          onClick={() => createCart()}
          aria-label="Nueva cuenta"
          sx={NEW_TAB_SX}
        >
          +
        </ButtonBase>
      </Box>

      {statusLines && (
        <Typography component="div" sx={STATUS_SX}>
          {statusLines.map((line) => (
            <Box key={line}>{line}</Box>
          ))}
        </Typography>
      )}

      {endAdornment}

      <CartAccountMenu
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        onRename={startEditing}
        onClear={onClearCart}
        canClear={canClearCart}
        onCloseAccount={removeActiveCart}
        canCloseAccount={carts.length > 1}
      />
    </Box>
  );
}

export const CartAccountTabs = memo(CartAccountTabsComponent);
