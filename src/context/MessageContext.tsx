"use client"; // Asegúrate de que AppProvider sea un Client Component

interface IAction {
  text: string;
}

import { createContext, useContext, useState } from "react";
import { Alert, AlertColor, Snackbar } from "@mui/material";

const MessageContext = createContext<{
    showMessage: (text: string, severity: AlertColor)=>void,
  }>(null);

export function MessageProvider({ children }: { children: React.ReactNode }) {
  
  const [showInfo, setShowInfo] = useState(false);
  const [textInfo, setTextInfo] = useState("");
  const [severityInfo, setSeverityInfo] = useState<AlertColor>("success");

  const showMessage = (text: string, severity: AlertColor) => {
    setTextInfo(text);
    setSeverityInfo(severity);
    setShowInfo(true);

    setTimeout(() => {
      setShowInfo(false);
    }, 3000);
  }


  return (
    <MessageContext.Provider value={{ 
      showMessage
    }}>
      {children}
      <Snackbar open={showInfo} autoHideDuration={3000} anchorOrigin={{vertical: 'top', horizontal: 'right'}} /*onClose={handleClose}*/>
        <Alert
          // onClose={handleClose}
          severity={severityInfo}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {textInfo}
        </Alert>
      </Snackbar>
    </MessageContext.Provider>
  );
}

export const useMessageContext = () => {
  const { showMessage } = useContext(MessageContext);
  return { showMessage };
}
