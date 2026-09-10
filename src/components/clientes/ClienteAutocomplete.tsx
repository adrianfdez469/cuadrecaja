"use client";

import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import { touch } from "@/theme";
import {
  CLIENTES_COPY,
  CLIENTES_DOM,
  CLIENTE_SELECTOR_MAX_WIDTH,
} from "@/constants/clientes";
import { useClienteSearch } from "@/hooks/useClienteSearch";
import { ClienteCacheNotice } from "@/components/clientes/ClienteCacheNotice";
import { ClienteQuickCreate } from "@/components/clientes/ClienteQuickCreate";
import { ClienteSaldoAmount } from "@/components/clientes/ClienteSaldoAmount";
import type { IClienteOption } from "@/schemas/clienteSaldo";

export interface IClienteAutocompleteProps {
  value: IClienteOption | null;
  onChange: (cliente: IClienteOption | null) => void;
  label?: string;
  disabled?: boolean;
  error?: string | null;
}

/**
 * The same job as the sheet, with a keyboard: type, walk the list with the arrows, pick with
 * Enter. Like the sheet it calls `useClienteSearch()` itself, so F-036 mounts it in
 * `PedidoEntregaDialog` without changing it.
 *
 * The create action lives UNDER the field and never inside the listbox: the listbox only
 * exists while the popup is open, so a blocked action and its reason would be hidden most of
 * the time — literally what criterion 10 forbids.
 */
export function ClienteAutocomplete({
  value,
  onChange,
  label,
  disabled = false,
  error = null,
}: Readonly<IClienteAutocompleteProps>) {
  const {
    term,
    setTerm,
    results,
    loading,
    source,
    canCreate,
    blockReason,
    createCliente,
  } = useClienteSearch();

  return (
    <Box
      className={CLIENTES_DOM.autocomplete}
      sx={{ width: "100%", maxWidth: CLIENTE_SELECTOR_MAX_WIDTH }}
    >
      <Autocomplete<IClienteOption>
        fullWidth
        disabled={disabled}
        options={results}
        value={value}
        loading={loading}
        // MANDATORY: the filtering was already done by the server (`contains` +
        // `mode: "insensitive"`) or by `filterClientesCache` offline. MUI's default filter
        // would lay a THIRD semantics on top, and two filters over the same list are two
        // answers to the same question.
        filterOptions={(options) => options}
        isOptionEqualToValue={(option, selected) => option.id === selected.id}
        getOptionLabel={(option) => option.nombre}
        inputValue={term}
        onInputChange={(_event, next) => setTerm(next)}
        onChange={(_event, next) => onChange(next)}
        noOptionsText={CLIENTES_COPY.selectorSinResultadosTitulo}
        loadingText={CLIENTES_COPY.selectorCargando}
        clearText={CLIENTES_COPY.selectorLimpiar}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label ?? CLIENTES_COPY.selectorCampoEtiqueta}
            placeholder={CLIENTES_COPY.selectorBuscarPlaceholder}
            error={Boolean(error)}
            helperText={error ?? undefined}
          />
        )}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props as typeof props & {
            key: string;
          };
          return (
            <Box
              component="li"
              key={key}
              {...optionProps}
              sx={{ display: "flex", gap: 1, minHeight: touch.min }}
            >
              <Typography component="span" sx={{ fontSize: "0.9375rem" }}>
                {option.nombre}
              </Typography>
              <Box sx={{ ml: "auto" }}>
                <ClienteSaldoAmount saldo={option.saldo} />
              </Box>
            </Box>
          );
        }}
        sx={{
          // MUI gives both indicators 24px; the direction's touch floor is 44.
          "& .MuiAutocomplete-endAdornment .MuiButtonBase-root": {
            width: touch.min,
            height: touch.min,
          },
        }}
      />

      {source === "cache" && <ClienteCacheNotice sx={{ mt: 1 }} />}

      <Box sx={{ mt: 1 }}>
        <ClienteQuickCreate
          variant="inline"
          term={term}
          canCreate={canCreate}
          blockReason={blockReason}
          onCreate={createCliente}
          onCreated={(cliente) => onChange(cliente)}
        />
      </Box>
    </Box>
  );
}

export default ClienteAutocomplete;
