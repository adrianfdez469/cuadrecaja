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
  // Monotonic, so no snackbar key is ever reused. Deriving the key from the map
  // counter alone is not enough: `removeMessage` drops the entry before the exit
  // transition ends, so the next message under that same id would restart at 1
  // and collide with the snackbar still on its way out.
  const seqRef = useRef(0);

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
    // A fresh snackbar key on every enqueue. The replaced snackbar stays mounted
    // while its exit transition runs, so reusing its key would put two children
    // with the same key in the same React commit and one of them would vanish.
    // `dedupeKey` remains the deduplication identity and the map key.
    seqRef.current += 1;
    const key: SnackbarKey = `${dedupeKey}#${seqRef.current}`;
    const displayText = count > 1 ? `${text} ×${count}` : text;

    if (existing) closeSnackbar(existing.key);
    activeRef.current.set(dedupeKey, { key, text, count });

    enqueueSnackbar(displayText, {
      variant: severity,
      key,
      persist: shouldPersist,
      autoHideDuration: shouldPersist ? null : 3000,
      style: { zIndex: ONBOARDING_JOYRIDE_Z_INDEX + 10 },
      // Only the snackbar the map still points at may clear the entry: the
      // replaced one exits after its replacement has already registered, and
      // deleting then would reset the ×N counter.
      onExited: (_node, exitedKey) => {
        if (activeRef.current.get(dedupeKey)?.key === exitedKey) {
          activeRef.current.delete(dedupeKey);
        }
      },
    });
  };

  const removeMessage = (id: string) => {
    // The snackbar key is no longer the id, so close whatever key the map holds
    // for it. With nothing registered there is nothing to close.
    const existing = activeRef.current.get(id);
    activeRef.current.delete(id);
    if (existing) closeSnackbar(existing.key);
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
