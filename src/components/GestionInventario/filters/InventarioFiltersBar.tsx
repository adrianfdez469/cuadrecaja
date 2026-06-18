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
  Collapse,
  Menu,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import FilterListIcon from "@mui/icons-material/FilterList";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import TableViewIcon from "@mui/icons-material/TableView";
import UploadIcon from "@mui/icons-material/Upload";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useState, useRef, useMemo } from "react";
import { ICategory } from "@/schemas/categoria";
import { StockFilter, ExpiryFilter } from "../hooks/useGestionInventario";
import { uniqueBy } from "@/utils/arrayUtils";

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
  onExportExcel?: () => void;
  onImportExcel?: () => void;
  exporting?: boolean;
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

function hasActiveFilters(
  selectedCategorias: string[],
  stockFilter: StockFilter,
  expiryFilter: ExpiryFilter,
) {
  return (
    selectedCategorias.length > 0 ||
    stockFilter !== "todo" ||
    expiryFilter !== "todos"
  );
}

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
  onExportExcel,
  onImportExcel,
  exporting,
}: InventarioFiltersBarProps) {
  console.log({ categorias });
  const uniqueCategories = useMemo(
    () =>
      uniqueBy<ICategory>(
        categorias,
        "nombre",
        (current, candidate) => candidate.esGlobal === true,
      ),
    [categorias],
  );
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);

  const selectedCats = categorias.filter((c) =>
    selectedCategorias.includes(c.id),
  );
  const activeFilters = hasActiveFilters(
    selectedCategorias,
    stockFilter,
    expiryFilter,
  );

  const handleClearFilters = () => {
    onSearchChange("");
    onCategoriasChange([]);
    onStockChange("todo");
    onExpiryChange("todos");
  };

  if (isMobile) {
    return (
      <Box display="flex" flexDirection="column" gap={1}>
        <Box
          ref={searchRowRef}
          display="flex"
          gap={0.5}
          alignItems="center"
          sx={{ scrollMarginTop: "64px" }}
        >
          <TextField
            size="small"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            inputRef={searchInputRef}
            onFocus={() =>
              searchRowRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
            onBlur={() =>
              setTimeout(
                () =>
                  searchRowRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  }),
                300,
              )
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
          />
          <IconButton color="primary" onClick={onCreateProduct} size="small">
            <AddIcon />
          </IconButton>
          <Tooltip title="Filtros avanzados">
            <IconButton
              size="small"
              onClick={() => setFiltersOpen((v) => !v)}
              color={filtersOpen || activeFilters ? "primary" : "default"}
            >
              <FilterListIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Limpiar filtros">
            <IconButton
              size="small"
              onClick={handleClearFilters}
              disabled={!searchTerm && !activeFilters}
              color={activeFilters || searchTerm ? "warning" : "default"}
            >
              <CleaningServicesIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Actualizar">
            <IconButton onClick={onRefresh} disabled={loading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {(onExportExcel || onImportExcel) && (
            <>
              <Tooltip title="Más opciones">
                <IconButton
                  size="small"
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                >
                  <MoreVertIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
              >
                {onImportExcel && (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null);
                      onImportExcel();
                    }}
                    disabled={loading}
                  >
                    <ListItemIcon>
                      <UploadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Importar Excel</ListItemText>
                  </MenuItem>
                )}
                {onExportExcel && (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null);
                      onExportExcel();
                    }}
                    disabled={exporting || loading}
                  >
                    <ListItemIcon>
                      <TableViewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Exportar Excel</ListItemText>
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
        </Box>

        {/* Filtros extra colapsables */}
        <Collapse in={filtersOpen}>
          <Box display="flex" flexDirection="column" gap={2}>
            <Autocomplete
              id="categorias-autocomplete-mobile"
              multiple
              size="small"
              options={uniqueCategories}
              getOptionLabel={(o) => o.nombre}
              value={selectedCats}
              onChange={(_, val) => onCategoriasChange(val.map((v) => v.id))}
              renderInput={(params) => (
                <TextField {...params} label="Categorías" />
              )}
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
              fullWidth
            />

            <FormControl size="small" fullWidth>
              <InputLabel>Stock</InputLabel>
              <Select
                label="Stock"
                value={stockFilter}
                onChange={(e) => onStockChange(e.target.value as StockFilter)}
              >
                {STOCK_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Vencimiento</InputLabel>
              <Select
                label="Vencimiento"
                value={expiryFilter}
                onChange={(e) => onExpiryChange(e.target.value as ExpiryFilter)}
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Collapse>
      </Box>
    );
  }

  // Desktop layout
  return (
    <Box display="flex" flexDirection="column" gap={1.5}>
      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Buscar producto o categoría..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateProduct}
          size="small"
          sx={{ whiteSpace: "nowrap" }}
        >
          Nuevo producto
        </Button>
        {onImportExcel && (
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={onImportExcel}
            disabled={loading}
            size="small"
            sx={{ whiteSpace: "nowrap" }}
          >
            Importar Excel
          </Button>
        )}
        {onExportExcel && (
          <Button
            variant="outlined"
            startIcon={<TableViewIcon />}
            onClick={onExportExcel}
            disabled={exporting || loading}
            size="small"
            sx={{ whiteSpace: "nowrap" }}
          >
            {exporting ? "Exportando..." : "Exportar Excel"}
          </Button>
        )}
        <Tooltip title="Actualizar">
          <IconButton onClick={onRefresh} disabled={loading} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Limpiar filtros">
          <IconButton
            onClick={handleClearFilters}
            disabled={!searchTerm && !activeFilters}
            size="small"
            color={activeFilters || searchTerm ? "warning" : "default"}
          >
            <CleaningServicesIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
        <Autocomplete
          multiple
          size="small"
          options={categorias}
          getOptionLabel={(o) => o.nombre}
          value={selectedCats}
          onChange={(_, val) => onCategoriasChange(val.map((v) => v.id))}
          renderInput={(params) => <TextField {...params} label="Categorías" />}
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
            onChange={(e) => onStockChange(e.target.value as StockFilter)}
          >
            {STOCK_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Vencimiento</InputLabel>
          <Select
            label="Vencimiento"
            value={expiryFilter}
            onChange={(e) => onExpiryChange(e.target.value as ExpiryFilter)}
          >
            {EXPIRY_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}
