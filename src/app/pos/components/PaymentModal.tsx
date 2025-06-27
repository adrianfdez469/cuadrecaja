import React, { FC, useEffect, useState } from "react";
import { Modal, Box, Typography, Button, FormControl, InputLabel, InputAdornment, OutlinedInput } from "@mui/material";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { moneyRegex } from '../../../utils/regex'
import { useMessageContext } from "@/context/MessageContext";
import { formatCurrency } from "@/utils/formatters";

interface IProps {
  open: boolean;
  onClose: () => void;
  total: number;
  makePay: (total: number, totalchash: number, totaltransfer: number) => Promise<void>
}

const PaymentModal: FC<IProps> = ({ open, onClose, total, makePay }) => {
  
  const [cashReceived, setCashReceived] = useState(0);
  const [transferReceived, setTransferReceived] = useState(0);
  const { showMessage } = useMessageContext();

  const handlePayment = async () => {
    try {
      // Cerrar el modal inmediatamente
      handleClose();
      
      // Ejecutar el pago de forma asíncrona
      // No mostramos notificaciones aquí porque handleMakePay se encarga de eso
      makePay(total, cashReceived, transferReceived)
        .then(() => {
          console.log("✅ Pago procesado exitosamente");
        })
        .catch((error) => {
          console.error("❌ Error procesando pago:", error);
          // handleMakePay ya maneja las notificaciones de error
        });
      
    } catch (error) {
      console.error("Error en handlePayment:", error);
      showMessage("❌ Error inesperado al iniciar el pago", "error");
    }
  };

  const handleClose = () => {
    // El modal siempre se puede cerrar, sin importar el estado de procesamiento
    setCashReceived(0);
    setTransferReceived(0);
    onClose();
  }

  const validateMoneyInput = (money: string) => {
    return moneyRegex.test(money);
  }

  const handleCashReceived = (cash: string) => {
    if(validateMoneyInput(cash)){
      setCashReceived(Number.parseInt(cash));
    } else if(cash === "") {
      setCashReceived(0);
    }
  }
  
  const handleTransferReceived = (trasnfer: string) => {
    if(validateMoneyInput(trasnfer)){
      setTransferReceived(Number.parseInt(trasnfer));
    } else if(trasnfer === "") {
      setTransferReceived(0);
    }
  }

  useEffect(() => {
    if(open === true){
      setCashReceived(total);
    }
  }, [open, total])

  return (
    <Modal open={open} onClose={handleClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: "white",
          p: 4,
          borderRadius: 2,
          boxShadow: 24,
          width: 400,
        }}
      >
        <Typography variant="h5" fontWeight="bold" mb={2}>
          Cobrar: {formatCurrency(total)}
        </Typography>
          
        <FormControl fullWidth>
          <InputLabel htmlFor="outlined-adornment-amount">Efectivo</InputLabel>
          <OutlinedInput
            id="outlined-adornment-cash"
            startAdornment={<InputAdornment position="start"><AttachMoneyIcon/></InputAdornment>}
            label="Efectivo"
            value={cashReceived}
            onChange={(e) => handleCashReceived(e.target.value)}
          />
        </FormControl>

        <FormControl fullWidth sx={{marginTop: 2}}>
          <InputLabel htmlFor="outlined-adornment-amount">Transferencia</InputLabel>
          <OutlinedInput
            id="outlined-adornment-transfer"
            startAdornment={<InputAdornment position="start"><CreditCardIcon/></InputAdornment>}
            label="Transferencia"
            value={transferReceived}
            onChange={(e) => handleTransferReceived(e.target.value)}
          />
        </FormControl>

        <Typography variant="h6" mt={2}>Total: {formatCurrency(total)}</Typography>
        <Typography variant="h6" color="green" mt={1}>
          Cambio: {formatCurrency(cashReceived+transferReceived - total)}
        </Typography>
        
        <Button
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2 }}
          onClick={handlePayment}
          disabled={cashReceived+transferReceived < total}
        >
          🚀 Confirmar Pago
        </Button>

        <Button
          variant="outlined"
          fullWidth
          sx={{ mt: 1 }}
          onClick={handleClose}
        >
          Cancelar
        </Button>
      </Box>
    </Modal>
  );
};

export default PaymentModal;
