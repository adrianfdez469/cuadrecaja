"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from "@mui/material";
import { TICKET_FOOTER_URL } from "@/constants/ticket";
import { ITicketPayload } from "../types/ITicketData";
import { ticketPayloadToTextLines } from "../lib/escpos/encoder";
import { printHtmlSilently } from "../lib/printHtmlSilently";
import { buildTicketPrintHtml } from "../lib/ticketPrintHtml";

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
  const lines = payload ? ticketPayloadToTextLines(payload) : [];

  const handlePrint = () => {
    if (!payload) return;
    void printHtmlSilently(buildTicketPrintHtml(lines));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Vista previa del ticket</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            bgcolor: "grey.100",
            p: 1.5,
            borderRadius: 1,
            fontFamily: "monospace",
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {lines.length > 0 ? (
            lines.map((line, i) => (
              <Typography key={i} component="div" variant="body2" sx={{ fontFamily: "inherit" }}>
                {line}
              </Typography>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              Sin datos de ticket
            </Typography>
          )}
          <Typography
            component="div"
            variant="body2"
            sx={{ fontFamily: "inherit", mt: 1, textAlign: "center" }}
          >
            {TICKET_FOOTER_URL}
          </Typography>
        </Box>
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
