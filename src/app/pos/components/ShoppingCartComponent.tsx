import React from "react";
import { Badge, Fab } from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useCartItemCount } from "@/store/cartStore";

const FAB_SX = {
  position: "fixed",
  bottom: { xs: 92, sm: 122 },
  right: 16,
  zIndex: (theme: { zIndex: { modal: number } }) => theme.zIndex.modal + 1,
} as const;

interface ShoppingCartComponentProps {
  openCart: boolean;
  handleCartIcon: () => void;
  hidden?: boolean;
}

function ShoppingCartComponent({
  openCart,
  handleCartIcon,
  hidden = false,
}: ShoppingCartComponentProps) {
  // Only the count, never the items array: this badge has no reason to
  // re-render when a quantity changes without adding or removing a line.
  const itemCount = useCartItemCount();
  return (
    <>
      {itemCount > 0 && !openCart && !hidden && (
        <Fab
          color="primary"
          aria-label="cart"
          sx={FAB_SX}
          onClick={handleCartIcon}
        >
          <Badge badgeContent={itemCount} color="secondary">
            <ShoppingCartIcon />
          </Badge>
        </Fab>
      )}
    </>
  );
}

export default React.memo(ShoppingCartComponent);
