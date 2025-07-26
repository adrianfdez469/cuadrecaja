import React, { FC, useEffect } from "react";
import { Drawer } from "@mui/material";
import { ICartItem } from "@/store/cartStore";
import { CartContent } from "./components/cartContent";

interface IProps {
  open: boolean;
  cart: ICartItem[];
  onClose: () => void;
  onOkButtonClick?: () => Promise<void>; 
  updateQuantity?: (id: string, quantity: number) => void;
  clear?: () => void;
  removeItem?: (id: string) => void;
  total: number;
  isCartPinned: boolean;
  setIsCartPinned: (isCartPinned: boolean) => void;
}

const CartDrawer: FC<IProps> = ({
  open,
  cart,
  onClose,
  onOkButtonClick,
  updateQuantity,
  clear,
  removeItem,
  total,
  isCartPinned,
  setIsCartPinned,
}) => {
  

  useEffect(() => {
    if (cart.length === 0) {
      onClose();
    }
  }, [cart]);

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose}>
        <CartContent 
          cart={cart} 
          total={total} 
          clear={clear} 
          updateQuantity={updateQuantity}
          onClose={onClose}
          removeItem={removeItem}
          onOkButtonClick={onOkButtonClick}
          isCartPinned={isCartPinned}
          setIsCartPinned={setIsCartPinned}
        />
      </Drawer>
    </>
  );
};

export default CartDrawer;
