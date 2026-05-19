"use client";

import {
  Box,
  TextField,
  InputAdornment,
  Button,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Autocomplete,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ICategory } from "@/schemas/categoria";
import { StockFilter, ExpiryFilter } from "../hooks/useGestionInventario";

interface InventarioFiltersBarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  categorias: ICategory[];
  selectedCategorias: string[];
  onCategoriasChange: (ids: string[]) => void;
  expiryFilter: ExpiryFilter;
  onExpiryChange: (v: ExpiryFilter) => void;
  stockFilter: StockFilter;
  onStockChange: (v: StockFilter) => void;
  onCreateProduct: () => void;
  onRefresh: () => void;
  loading: boolean;
}

const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "en_stock", label: "En stock" },
  { value: "bajo_stock", label: "Bajo stock" },
  { value: "sin_stock", label: "Sin stock" },
];

const EXPIRY_OPTIONS: { value: ExpiryFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "proximos", label: "Próximos a vencer" },
  { value: "vencidos", label: "Vencidos" },
];

export function InventarioFiltersBar({
  searchTerm,
  onSearchChange,
  categorias,
  selectedCategorias,
  onCategoriasChange,
  expiryFilter,
  onExpiryChange,
  stockFilter,
  onStockChange,
  onCreateProduct,
  onRefresh,
  loading,
}: InventarioFiltersBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const selectedCats = categorias.filter(c => selectedCategorias.includes(c.id));

  return (
    <Box display="flex" flexDirection="column" gap={1.5}>
      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Buscar producto o categoría..."
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateProduct}
          size="small"
          sx={{ whiteSpace: "nowrap" }}
        >
          {isMobile ? "Nuevo" : "Nuevo producto"}
        </Button>
        <Tooltip title="Actualizar">
          <IconButton onClick={onRefresh} disabled={loading} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
        <Autocomplete
          multiple
          size="small"
          options={categorias}
          getOptionLabel={o => o.nombre}
          value={selectedCats}
          onChange={(_, val) => onCategoriasChange(val.map(v => v.id))}
          renderInput={params => <TextField {...params} label="Categorías" />}
          renderTags={(val, getTagProps) =>
            val.map((opt, i) => (
              <Chip
                key={opt.id}
                label={opt.nombre}
                size="small"
                sx={{ bgcolor: opt.color, color: "white" }}
                {...getTagProps({ index: i })}
              />
            ))
          }
          sx={{ minWidth: 200 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Stock</InputLabel>
          <Select
            label="Stock"
            value={stockFilter}
            onChange={e => onStockChange(e.target.value as StockFilter)}
          >
            {STOCK_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Vencimiento</InputLabel>
          <Select
            label="Vencimiento"
            value={expiryFilter}
            onChange={e => onExpiryChange(e.target.value as ExpiryFilter)}
          >
            {EXPIRY_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}
