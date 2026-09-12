"use client";

import { useEffect, useState } from "react";
import { Stack, TextField } from "@mui/material";
import { AppDialog } from "@/components/AppDialog";
import { CLIENTES_COPY } from "@/constants/clientes";
import { normalizeClienteNombre } from "@/lib/clientes/clienteNombre";
import type { ICreateCliente } from "@/schemas/cliente";
import type { IClienteConSaldo } from "@/schemas/clienteSaldo";

export interface IClienteFormDialogProps {
  open: boolean;
  /** The row being edited, or null for a new one. */
  cliente: IClienteConSaldo | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: ICreateCliente) => void;
}

const EMPTY = { nombre: "", telefono: "", direccion: "", descripcion: "" };

/**
 * Create and edit, on `AppDialog`.
 *
 * The supplier mould builds its `Dialog` by hand and re-decides the order and the weight of
 * its buttons every time; `AppDialog` already resolves that, goes full screen on a phone and
 * guarantees a way out. What was missing was the body of the form.
 */
export function ClienteFormDialog({
  open,
  cliente,
  saving,
  onClose,
  onSubmit,
}: Readonly<IClienteFormDialogProps>) {
  const [values, setValues] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setValues(
      cliente
        ? {
            nombre: cliente.nombre ?? "",
            telefono: cliente.telefono ?? "",
            direccion: cliente.direccion ?? "",
            descripcion: cliente.descripcion ?? "",
          }
        : EMPTY,
    );
  }, [open, cliente]);

  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const nombreLimpio = normalizeClienteNombre(values.nombre);

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      busy={saving}
      title={
        cliente ? CLIENTES_COPY.formTituloEditar : CLIENTES_COPY.formTituloNuevo
      }
      confirm={{
        label: CLIENTES_COPY.formGuardar,
        onClick: () =>
          onSubmit({
            nombre: nombreLimpio,
            telefono: values.telefono,
            direccion: values.direccion,
            descripcion: values.descripcion,
          }),
        disabled: nombreLimpio === "",
        loading: saving,
      }}
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField
          fullWidth
          required
          autoFocus
          label={CLIENTES_COPY.formNombre}
          placeholder={CLIENTES_COPY.formNombrePlaceholder}
          value={values.nombre}
          onChange={(event) => set("nombre")(event.target.value)}
        />
        <TextField
          fullWidth
          label={CLIENTES_COPY.formTelefono}
          placeholder={CLIENTES_COPY.formTelefonoPlaceholder}
          value={values.telefono}
          onChange={(event) => set("telefono")(event.target.value)}
        />
        <TextField
          fullWidth
          label={CLIENTES_COPY.formDireccion}
          value={values.direccion}
          onChange={(event) => set("direccion")(event.target.value)}
        />
        <TextField
          fullWidth
          multiline
          minRows={2}
          label={CLIENTES_COPY.formDescripcion}
          placeholder={CLIENTES_COPY.formDescripcionPlaceholder}
          value={values.descripcion}
          onChange={(event) => set("descripcion")(event.target.value)}
        />
      </Stack>
    </AppDialog>
  );
}

export default ClienteFormDialog;
