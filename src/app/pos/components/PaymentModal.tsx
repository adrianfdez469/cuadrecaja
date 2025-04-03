import React, { useState } from "react";
import { Modal, Box, Typography, Button, FormControl, InputLabel, InputAdornment, OutlinedInput } from "@mui/material";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { moneyRegex } from '../../../utils/regex'
const PaymentModal = ({ open, onClose, total, makePay }) => {
  
  const [cashReceived, setCashReceived] = useState(0);
  const [transferReceived, setTransferReceived] = useState(0);

  const handlePayment = () => {
    makePay(total, cashReceived, transferReceived);
  };

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

  return (
    <Modal open={open} onClose={onClose}>
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
        <Typography variant="h5" fontWeight="bold" mb={2}>Cobrar: ${total.toFixed(2)}</Typography>
          
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



        
        

        <Typography variant="h6" mt={2}>Total: ${total.toFixed(2)}</Typography>
        <Typography variant="h6" color="green" mt={1}>
          Cambio: ${(cashReceived+transferReceived - total).toFixed(2)}
        </Typography>
        
        <Button
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2 }}
          onClick={handlePayment}
          disabled={cashReceived+transferReceived < total}
        >
          Confirmar Pago
        </Button>
      </Box>
    </Modal>
  );
};

export default PaymentModal;
