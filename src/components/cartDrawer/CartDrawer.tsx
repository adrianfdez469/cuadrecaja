import React, { FC, useEffect } from "react";
import { Drawer } from "@mui/material";
import { ICartItem } from "@/store/cartStore";
import { CartContent } from "./components/cartContent";
import type { IMultimonedaExtras } from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";

interface IProps {
  open: boolean;
  cart: ICartItem[];
  onClose: () => void;
  makePay: (
    total: number,
    totalcash: number,
    totaltransfer: number,
    transferDestinationId?: string,
    discountCodes?: string[],
    multimoneda?: IMultimonedaExtras,
  ) => Promise<void>;
  transferDestinations: ITransferDestination[];
  cierreId: string;
  updateQuantity?: (id: string, quantity: number) => void;
  clear?: () => void;
  removeItem?: (id: string) => void;
  total: number;
}

const CartDrawer: FC<IProps> = ({
  open,
  cart,
  onClose,
  makePay,
  transferDestinations,
  cierreId,
  updateQuantity,
  clear,
  removeItem,
  total,
}) => {
  useEffect(() => {
    if (cart.length === 0) {
      onClose();
    }
  }, [cart]);

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        disableEnforceFocus
        disableAutoFocus
        disableRestoreFocus
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        PaperProps={{
          sx: {
            height: "100dvh",
            overflow: "hidden",
          },
        }}
      >
        <CartContent
          cart={cart}
          total={total}
          clear={clear}
          updateQuantity={updateQuantity}
          onClose={onClose}
          removeItem={removeItem}
          makePay={makePay}
          transferDestinations={transferDestinations}
          cierreId={cierreId}
          variant="drawer"
        />
      </Drawer>
    </>
  );
};

export default CartDrawer;
