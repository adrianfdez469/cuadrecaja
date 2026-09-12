"use client";

import { useEffect, useState } from "react";
import { Box, Button, ButtonBase, Stack, TextField, Typography } from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { touch } from "@/theme";
import { SHEET_ROW_SX } from "@/app/pos/components/checkout/BottomSheet";
import { CLIENTES_DOM, CLIENTES_EXTRA_COPY } from "@/constants/clientes";
import {
  clienteCreateActionLabel,
  CLIENTE_CREATE_BLOCK_COPY,
} from "@/lib/clientes/clienteCopy";
import { normalizeClienteNombre } from "@/lib/clientes/clienteNombre";
import { toClienteOption } from "@/lib/clientes/clienteCache";
import type { IClienteCreateBlockReason } from "@/lib/clientes/clienteSearch";
import type { ICreateCliente } from "@/schemas/cliente";
import type {
  IClienteOption,
  IClienteUpsertResponse,
} from "@/schemas/clienteSaldo";

export interface IClienteQuickCreateProps {
  /** `sheet` is the 56px row of the bottom sheet; `inline` the 44px one under the field. */
  variant: "sheet" | "inline";
  term: string;
  canCreate: boolean;
  blockReason: IClienteCreateBlockReason | null;
  onCreate: (input: ICreateCliente) => Promise<IClienteUpsertResponse | null>;
  onCreated: (cliente: IClienteOption, action: "CREATE" | "REACTIVATE") => void;
  /** Lets the surface fold away its own search field while the short form is open. */
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * THE only implementation of criterion 10, used by BOTH selection surfaces: duplicating it in
 * `ClienteSheet` and `ClienteAutocomplete` would duplicate the criterion, and the day one is
 * fixed the other stays as it was.
 *
 * Blocked, the action stays exactly where it was — dimmed, not hidden — and its reason lives
 * OUTSIDE the dimmed row, as a sibling at full opacity. Element for element it is
 * `src/components/tiendaOnline/PedidoPagoFields.tsx`: `aria-disabled`, `opacity: 0.6`,
 * `cursor: "default"` and a secondary `Typography` that is not a child of the row. Inside it,
 * the dimming would eat the reason and criterion 10 would be met in the DOM and broken on the
 * screen.
 */
export function ClienteQuickCreate({
  variant,
  term,
  canCreate,
  blockReason,
  onCreate,
  onCreated,
  onExpandedChange,
}: Readonly<IClienteQuickCreateProps>) {
  const [expanded, setExpanded] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [saving, setSaving] = useState(false);

  const label = clienteCreateActionLabel(term);

  // A blocked action can never stay unfolded: losing the connection with the short form open
  // would leave a form nobody can submit.
  useEffect(() => {
    if (!canCreate && expanded) {
      setExpanded(false);
      onExpandedChange?.(false);
    }
  }, [canCreate, expanded, onExpandedChange]);

  const rowSx =
    variant === "sheet"
      ? { ...SHEET_ROW_SX, fontWeight: 600 }
      : {
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 1.25,
          width: "100%",
          minHeight: touch.min,
          fontSize: "0.9375rem",
          fontWeight: 600,
          textAlign: "left",
        };

  const open = () => {
    setNombre(normalizeClienteNombre(term));
    setTelefono("");
    setExpanded(true);
    onExpandedChange?.(true);
  };

  const close = () => {
    setExpanded(false);
    onExpandedChange?.(false);
  };

  const submit = async () => {
    const nombreLimpio = normalizeClienteNombre(nombre);
    if (nombreLimpio === "" || saving) return;

    setSaving(true);
    try {
      const response = await onCreate({
        nombre: nombreLimpio,
        ...(telefono.trim() !== "" && { telefono: telefono.trim() }),
      });
      if (!response) return;
      close();
      onCreated(toClienteOption(response.cliente), response.action);
    } finally {
      setSaving(false);
    }
  };

  if (expanded && canCreate) {
    return (
      <Stack spacing={1.5} sx={{ px: variant === "sheet" ? 2 : 0, py: 1.5 }}>
        <TextField
          fullWidth
          autoFocus
          label={CLIENTES_EXTRA_COPY.quickNombre}
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
        />
        <TextField
          fullWidth
          label={CLIENTES_EXTRA_COPY.quickTelefono}
          value={telefono}
          onChange={(event) => setTelefono(event.target.value)}
        />
        <Button
          variant="contained"
          onClick={submit}
          disabled={saving || normalizeClienteNombre(nombre) === ""}
          sx={{ minHeight: touch.comfortable }}
        >
          {CLIENTES_EXTRA_COPY.quickCrear}
        </Button>
        <Button variant="text" onClick={close} disabled={saving}>
          {CLIENTES_EXTRA_COPY.quickCancelar}
        </Button>
      </Stack>
    );
  }

  if (!canCreate) {
    return (
      <Box>
        <Box
          className={CLIENTES_DOM.createAction}
          aria-disabled="true"
          sx={{
            ...rowSx,
            color: "semantic.text.disabled",
            opacity: 0.6,
            cursor: "default",
          }}
        >
          <PersonAddIcon
            fontSize="small"
            sx={{ color: "semantic.text.disabled" }}
          />
          {label}
        </Box>
        {blockReason && (
          <Typography
            variant="body2"
            className={CLIENTES_DOM.createReason}
            sx={{
              mt: 1,
              px: variant === "sheet" ? 2 : 0,
              color: "semantic.text.secondary",
              opacity: 1,
            }}
          >
            {CLIENTE_CREATE_BLOCK_COPY[blockReason]}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <ButtonBase
      className={CLIENTES_DOM.createAction}
      onClick={open}
      sx={{ ...rowSx, color: "semantic.hue.accent.main" }}
    >
      <PersonAddIcon
        fontSize="small"
        sx={{ color: "semantic.hue.accent.main" }}
      />
      {label}
    </ButtonBase>
  );
}

export default ClienteQuickCreate;
