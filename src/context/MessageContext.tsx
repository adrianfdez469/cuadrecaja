"use client";

import React, { createContext, useContext } from "react";
import { AlertColor, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { SnackbarProvider, useSnackbar, closeSnackbar, SnackbarKey } from "notistack";

const MessageContext = createContext<{
  showMessage: (text: string, severity: AlertColor, persistent?: boolean, id?: string) => void;
  removeMessage: (id: string) => void;
}>(null);

function CloseButton({ snackbarKey }: { snackbarKey: SnackbarKey }) {
  return (
    <IconButton
      size="small"
      color="inherit"
      onClick={() => closeSnackbar(snackbarKey)}
      sx={{ alignSelf: "center" }}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  );
}

function MessageProviderInner({ children }: { children: React.ReactNode }) {
  const { enqueueSnackbar } = useSnackbar();

  const showMessage = (text: string, severity: AlertColor, persistent: boolean = false, id?: string) => {
    const isError = severity === "error";
    const shouldPersist = persistent || isError;

    enqueueSnackbar(text, {
      variant: severity,
      key: id as SnackbarKey | undefined,
      persist: shouldPersist,
      autoHideDuration: shouldPersist ? null : 3000,
      preventDuplicate: !!id,
    });
  };

  const removeMessage = (id: string) => {
    closeSnackbar(id as SnackbarKey);
  };

  return (
    <MessageContext.Provider value={{ showMessage, removeMessage }}>
      {children}
    </MessageContext.Provider>
  );
}

export function MessageProvider({ children }: { children: React.ReactNode }) {
  return (
    <SnackbarProvider
      maxSnack={5}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      action={(key) => <CloseButton snackbarKey={key} />}
    >
      <MessageProviderInner>{children}</MessageProviderInner>
    </SnackbarProvider>
  );
}

export const useMessageContext = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessageContext must be used within a MessageProvider");
  }
  return context;
};
