"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { ITicketPayload } from "../types/ITicketData";
import { buildTicketLines } from "../lib/buildTicketLines";
import { printHtmlSilently } from "../lib/printHtmlSilently";
import { buildTicketPrintHtmlFromRendered } from "../lib/ticketPrintHtml";
import { generateTicketMarketingQrDataUrl } from "../lib/generateTicketMarketingQr";
import { getCharsPerLine } from "../lib/ticketLayout";
import { TicketPreviewContent } from "./TicketPreviewContent";

interface TicketPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  payload: ITicketPayload | null;
}

export const TicketPreviewDialog: React.FC<TicketPreviewDialogProps> = ({
  open,
  onClose,
  payload,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const ancho = payload
    ? ((payload.plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80)
    : 58;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void generateTicketMarketingQrDataUrl().then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const handlePrint = () => {
    if (!payload) return;
    const width = getCharsPerLine(ancho);
    const rendered = buildTicketLines(payload);
    void printHtmlSilently(
      buildTicketPrintHtmlFromRendered(
        rendered,
        width,
        ancho,
        qrDataUrl ?? undefined,
      ),
      { paperWidthMm: ancho },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        Vista previa del ticket
        {isMobile && (
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent>
        {payload ? <TicketPreviewContent payload={payload} /> : null}
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: isMobile ? "column-reverse" : "row",
          alignItems: "stretch",
        }}
      >
        <Button
          onClick={onClose}
          fullWidth={isMobile}
          sx={{ minHeight: isMobile ? 44 : undefined }}
        >
          Cerrar
        </Button>
        <Button
          variant="contained"
          onClick={handlePrint}
          disabled={!payload}
          fullWidth={isMobile}
          size={isMobile ? "large" : "medium"}
          sx={{ minHeight: isMobile ? 56 : undefined }}
        >
          Imprimir
        </Button>
      </DialogActions>
    </Dialog>
  );
};
