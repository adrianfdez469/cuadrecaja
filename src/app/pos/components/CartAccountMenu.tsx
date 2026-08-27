"use client";

import { memo } from "react";
import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import { shape } from "@/theme";

/**
 * What can be done to the account that is already selected.
 *
 * The redesign draws the account tabs as plain pills: a name, and nothing
 * else on them. The pencil and the cross each tab used to carry — 15px
 * glyphs inside a 32px chip — are the reason those tabs could not be the
 * 44px targets they are now. Renaming and closing did not go away: they wait
 * behind a second tap on the active tab, together with emptying the basket,
 * which used to be a red bin of its own at the far end of the row.
 */

const PAPER_SX = {
  mt: 0.5,
  minWidth: 220,
  borderRadius: `${shape.radius.md}px`,
  border: "1px solid",
  borderColor: "divider",
} as const;

const ITEM_SX = { minHeight: 44 } as const;

const ANCHOR_ORIGIN = { vertical: "bottom", horizontal: "left" } as const;
const TRANSFORM_ORIGIN = { vertical: "top", horizontal: "left" } as const;

interface CartAccountMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onRename: () => void;
  /** Absent where the basket cannot be emptied from here. */
  onClear?: () => void;
  canClear: boolean;
  onCloseAccount: () => void;
  /** The last open account cannot be closed: there is always one. */
  canCloseAccount: boolean;
}

function CartAccountMenuComponent({
  anchorEl,
  onClose,
  onRename,
  onClear,
  canClear,
  onCloseAccount,
  canCloseAccount,
}: CartAccountMenuProps) {
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Menu
      open={anchorEl !== null}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={ANCHOR_ORIGIN}
      transformOrigin={TRANSFORM_ORIGIN}
      slotProps={{ paper: { sx: PAPER_SX } }}
    >
      <MenuItem onClick={run(onRename)} sx={ITEM_SX}>
        <ListItemIcon>
          <EditIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Cambiar nombre</ListItemText>
      </MenuItem>
      {onClear && (
        <MenuItem onClick={run(onClear)} disabled={!canClear} sx={ITEM_SX}>
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Vaciar carrito</ListItemText>
        </MenuItem>
      )}
      <MenuItem
        onClick={run(onCloseAccount)}
        disabled={!canCloseAccount}
        sx={ITEM_SX}
      >
        <ListItemIcon>
          <CloseIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Cerrar cuenta</ListItemText>
      </MenuItem>
    </Menu>
  );
}

export const CartAccountMenu = memo(CartAccountMenuComponent);
