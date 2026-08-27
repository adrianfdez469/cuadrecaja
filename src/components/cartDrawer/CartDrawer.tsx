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
  /**
   * Drives the step from outside, so the charge bar can open this drawer
   * straight on the checkout. Without it the drawer kept the step to itself
   * and every entry landed on the basket, whichever button was pressed.
   */
  step?: CartStep;
  onStepChange?: (step: CartStep) => void;
  /** An account name is being typed — see CartContent. */
  onRenamingCart?: (renaming: boolean) => void;
  /** Reprints the last sale's ticket — see CartContent. */
  onPrintLastSale?: () => void;
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
  step,
  onStepChange,
  onRenamingCart,
  onPrintLastSale,
}) => {
  // Only the count: closing on an emptied cart never needed the items array,
  // and subscribing to it here put the whole POS page in the subscription.
  const itemCount = useCartItemCount();
  // An emptied basket closes the drawer — except right after a sale, when
  // the basket is emptied by the sale itself and the drawer is showing
  // «Cobro registrado» over it. «Nueva venta» closes it then.
  useEffect(() => {
    if (itemCount === 0 && step !== "done") {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount, step]);

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
          onPrintLastSale={onPrintLastSale}
          step={step}
          onStepChange={onStepChange}
          onRenamingCart={onRenamingCart}
        />
      </Drawer>
    </>
  );
};

export default CartDrawer;
