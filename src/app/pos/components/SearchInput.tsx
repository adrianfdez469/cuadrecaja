"use client";

import { useRef, useState } from "react";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { normalizeSearch } from "@/utils/formatters";

interface IProps {
  onSearch: (normalizedTerm: string) => void;
  placeholder?: string;
  sx?: SxProps<Theme>;
}

// Llama a onSearch solo cuando el texto esté vacío o tenga al menos 3 caracteres.
// El término que recibe el padre ya está normalizado (sin tildes, minúsculas, espacios colapsados).
export default function SearchInput({ onSearch, placeholder = "Buscar...", sx }: IProps) {
  const [value, setValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSearch = (raw: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (raw.length === 0 || raw.length >= 3) {
        onSearch(normalizeSearch(raw));
      }
    }, 300);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    scheduleSearch(val);
  };

  const handleClear = () => {
    setValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch("");
  };

  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      fullWidth
      sx={sx}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClear} edge="end">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
}
