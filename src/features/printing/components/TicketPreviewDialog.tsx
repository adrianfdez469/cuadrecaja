"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Vista previa del ticket</DialogTitle>
      <DialogContent>
        {payload ? (
          <TicketPreviewContent payload={payload} />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" onClick={handlePrint} disabled={!payload}>
          Imprimir
        </Button>
      </DialogActions>
    </Dialog>
  );
};
