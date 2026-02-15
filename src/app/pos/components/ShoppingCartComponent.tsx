import React from 'react';
import {Badge, Fab} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import {useCartStore} from "@/store/cartStore";

interface ShoppingCartComponentProps {
  openCart: boolean;
  handleCartIcon: () => void;
}

function ShoppingCartComponent({openCart, handleCartIcon}: ShoppingCartComponentProps) {

  const {items} = useCartStore()
  return (
      <>
        {
            items.length > 0 && !openCart && (
                <Fab
                    color="primary"
                    aria-label="cart"
                    sx={
                      {
                        position: "fixed",
                        bottom: 122, right: 16,
                        zIndex: (theme) => theme.zIndex.modal + 1
                      }}
                    onClick={handleCartIcon}
                >
                  <Badge badgeContent={items.length} color="secondary">
                    <ShoppingCartIcon/>
                  </Badge>
                </Fab>
            )
        }
      </>

  );
}

export default ShoppingCartComponent;