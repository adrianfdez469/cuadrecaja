"use client";

import React, { createContext, useContext, useRef } from "react";
import { AlertColor, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  SnackbarProvider,
  useSnackbar,
  closeSnackbar,
  SnackbarKey,
} from "notistack";
import { ONBOARDING_JOYRIDE_Z_INDEX } from "@/features/onboarding/constants";

const MessageContext = createContext<{
  showMessage: (
    text: string,
    severity: AlertColor,
    persistent?: boolean,
    id?: string,
  ) => void;
  removeMessage: (id: string) => void;
}>(null);

function CloseButton({ snackbarKey }: { snackbarKey: SnackbarKey }) {
  return (
    <IconButton
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
  // Repeated identical toasts share one slot with a ×N counter instead of
  // stacking — a burst of five sync failures used to fill the whole stack.
  const activeRef = useRef<
    Map<string, { key: SnackbarKey; text: string; count: number }>
  >(new Map());

  const showMessage = (
    text: string,
    severity: AlertColor,
    persistent: boolean = false,
    id?: string,
  ) => {
    const isError = severity === "error";
    const shouldPersist = persistent || isError;
    const dedupeKey = id ?? `${severity}:${text}`;
    const existing = activeRef.current.get(dedupeKey);
    const count = (existing?.count ?? 0) + 1;
    const key = existing?.key ?? (dedupeKey as SnackbarKey);
    const displayText = count > 1 ? `${text} ×${count}` : text;

    if (existing) closeSnackbar(existing.key);
    activeRef.current.set(dedupeKey, { key, text, count });

    enqueueSnackbar(displayText, {
      variant: severity,
      key,
      persist: shouldPersist,
      autoHideDuration: shouldPersist ? null : 3000,
      style: { zIndex: ONBOARDING_JOYRIDE_Z_INDEX + 10 },
      onExited: () => activeRef.current.delete(dedupeKey),
    });
  };

  const removeMessage = (id: string) => {
    activeRef.current.delete(id);
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
