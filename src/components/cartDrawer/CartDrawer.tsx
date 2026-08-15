import React, { FC, useEffect } from "react";
import { Drawer } from "@mui/material";
import { useCartItemCount } from "@/store/cartStore";
import { CartContent, type CartStep } from "./components/cartContent";
import type { IMultimonedaExtras } from "@/schemas/pago";
import type { ITransferDestination } from "@/schemas/transferDestination";

interface IProps {
  open: boolean;
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
  onStepChange?: (step: CartStep) => void;
}

const CartDrawer: FC<IProps> = ({
  open,
  onClose,
  makePay,
  transferDestinations,
  cierreId,
  updateQuantity,
  clear,
  removeItem,
  onStepChange,
}) => {
  // Only the count: closing on an emptied cart never needed the items array,
  // and subscribing to it here put the whole POS page in the subscription.
  const itemCount = useCartItemCount();
  useEffect(() => {
    if (itemCount === 0) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount]);

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
          clear={clear}
          updateQuantity={updateQuantity}
          onClose={onClose}
          removeItem={removeItem}
          makePay={makePay}
          transferDestinations={transferDestinations}
          cierreId={cierreId}
          variant="drawer"
          onStepChange={onStepChange}
        />
      </Drawer>
    </>
  );
};

export default CartDrawer;
