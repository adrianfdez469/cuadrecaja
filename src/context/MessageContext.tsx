"use client"; // Asegúrate de que AppProvider sea un Client Component

import { createContext, useContext, useState } from "react";
import { Alert, AlertColor, Snackbar, Stack, Box, Typography, LinearProgress } from "@mui/material";

interface PersistentMessage {
  id: string;
  text: string;
  severity: AlertColor;
  persistent?: boolean;
  progress?: number; // Para mostrar progreso (0-100)
}

const MessageContext = createContext<{
  showMessage: (text: string, severity: AlertColor, error?, persistent?: boolean, id?: string) => void,
  updateMessage: (id: string, text: string, progress?: number) => void,
  removeMessage: (id: string) => void,
}>(null);

export function MessageProvider({ children }: { children: React.ReactNode }) {
  
  const [showInfo, setShowInfo] = useState(false);
  const [textInfo, setTextInfo] = useState("");
  const [severityInfo, setSeverityInfo] = useState<AlertColor>("success");
  const [persistentMessages, setPersistentMessages] = useState<PersistentMessage[]>([]);

  const showMessage = (text: string, severity: AlertColor, error?, persistent: boolean = false, id?: string) => {
    console.log("Error: ", error);
    
    if (persistent && id) {
      // Mensaje persistente
      setPersistentMessages(prev => {
        const existing = prev.find(msg => msg.id === id);
        if (existing) {
          // Actualizar mensaje existente
          return prev.map(msg => msg.id === id ? { ...msg, text, severity } : msg);
        } else {
          // Agregar nuevo mensaje persistente
          return [...prev, { id, text, severity, persistent: true }];
        }
      });
    } else {
      // Mensaje temporal normal
      setTextInfo(text);
      setSeverityInfo(severity);
      setShowInfo(true);

      setTimeout(() => {
        setShowInfo(false);
      }, 3000);
    }
  }

  const updateMessage = (id: string, text: string, progress?: number) => {
    setPersistentMessages(prev => 
      prev.map(msg => 
        msg.id === id 
          ? { ...msg, text, progress }
          : msg
      )
    );
  }

  const removeMessage = (id: string) => {
    setPersistentMessages(prev => prev.filter(msg => msg.id !== id));
  }

  return (
    <MessageContext.Provider value={{ 
      showMessage,
      updateMessage,
      removeMessage
    }}>
      {children}
      
      {/* Mensajes temporales normales */}
      <Snackbar open={showInfo} autoHideDuration={3000} anchorOrigin={{vertical: 'top', horizontal: 'right'}}>
        <Alert
          severity={severityInfo}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {textInfo}
        </Alert>
      </Snackbar>

      {/* Mensajes persistentes */}
      {persistentMessages.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            top: 80,
            right: 16,
            zIndex: 1400,
            maxWidth: 400,
          }}
        >
          <Stack spacing={1}>
            {persistentMessages.map((message) => (
              <Alert
                key={message.id}
                severity={message.severity}
                variant="filled"
                sx={{ width: '100%' }}
              >
                <Typography variant="body2">{message.text}</Typography>
                {message.progress !== undefined && (
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={message.progress} 
                      sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: 'rgba(255,255,255,0.8)'
                        }
                      }}
                    />
                  </Box>
                )}
              </Alert>
            ))}
          </Stack>
        </Box>
      )}
    </MessageContext.Provider>
  );
}

export const useMessageContext = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessageContext must be used within a MessageProvider');
  }
  const { showMessage, updateMessage, removeMessage } = context;
  return { showMessage, updateMessage, removeMessage };
}
