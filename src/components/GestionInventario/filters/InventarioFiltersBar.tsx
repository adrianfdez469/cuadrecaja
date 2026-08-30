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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import FilterListIcon from "@mui/icons-material/FilterList";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import TableViewIcon from "@mui/icons-material/TableView";
import UploadIcon from "@mui/icons-material/Upload";
import PrintIcon from "@mui/icons-material/Print";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ViewListIcon from "@mui/icons-material/ViewList";
import { useRef, useState, useMemo } from "react";
import { ICategory } from "@/schemas/categoria";
import { StockFilter, ExpiryFilter } from "../hooks/useGestionInventario";
import { uniqueBy } from "@/utils/arrayUtils";
import SelectableTextField from "@/components/SelectableTextField";
import { ActionSheet } from "@/components/ActionSheet";
import { squareIconButtonSx } from "@/theme";

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
  /** Solo se usa en mobile: en desktop "Nuevo producto" vive en el header. */
  onCreateProduct: () => void;
  onRefresh: () => void;
  loading: boolean;
  onExportExcel?: () => void;
  onImportExcel?: () => void;
  onPrintLabels?: () => void;
  exporting?: boolean;
  /** Mobile: vive dentro de la hoja "Más acciones", no como botón propio. */
  showDetails?: boolean;
  onToggleDetails?: () => void;
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
  onPrintLabels,
  exporting,
  onToggleDetails,
}: InventarioFiltersBarProps) {
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
  const [moreOpen, setMoreOpen] = useState(false);
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
          gap={1}
          alignItems="center"
          sx={{ scrollMarginTop: "64px" }}
        >
          <SelectableTextField
            size="small"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            ref={searchInputRef}
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
          <Tooltip title="Nuevo producto">
            <IconButton
              data-tour="gi-create-btn"
              onClick={onCreateProduct}
              sx={{
                ...squareIconButtonSx,
                borderColor: "primary.main",
                bgcolor: "primary.main",
                color: "primary.contrastText",
                "&:hover": {
                  bgcolor: "primary.dark",
                  borderColor: "primary.dark",
                },
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* "Limpiar filtros", "Detalles" e Importar/Exportar Excel/Etiquetas
            viven en la hoja "Más acciones" — el mockup mobile ya no les da
            un botón propio en esta fila. */}
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            size="small"
            variant="outlined"
            color={filtersOpen || activeFilters ? "primary" : "inherit"}
            startIcon={<FilterListIcon />}
            onClick={() => setFiltersOpen((v) => !v)}
            sx={{ flex: 1 }}
          >
            Filtros
          </Button>
          <Tooltip title="Actualizar">
            <IconButton
              onClick={onRefresh}
              disabled={loading}
              size="small"
              sx={squareIconButtonSx}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Más acciones">
            <IconButton
              onClick={() => setMoreOpen(true)}
              size="small"
              sx={squareIconButtonSx}
            >
              <MoreHorizIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <ActionSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title="Más acciones"
          items={[
            {
              key: "limpiar",
              icon: <FilterListOffIcon fontSize="small" />,
              label: "Limpiar filtros",
              onClick: handleClearFilters,
              disabled: !searchTerm && !activeFilters,
            },
            ...(onToggleDetails
              ? [
                  {
                    key: "detalles",
                    icon: <ViewListIcon fontSize="small" />,
                    label: "Detalles",
                    onClick: onToggleDetails,
                  },
                ]
              : []),
            ...(onImportExcel
              ? [
                  {
                    key: "importar",
                    icon: <UploadIcon fontSize="small" />,
                    label: "Importar Excel",
                    onClick: onImportExcel,
                    disabled: loading,
                  },
                ]
              : []),
            ...(onExportExcel
              ? [
                  {
                    key: "exportar",
                    icon: <TableViewIcon fontSize="small" />,
                    label: "Exportar Excel",
                    onClick: onExportExcel,
                    disabled: exporting || loading,
                  },
                ]
              : []),
            ...(onPrintLabels
              ? [
                  {
                    key: "etiquetas",
                    icon: <PrintIcon fontSize="small" />,
                    label: "Etiquetas",
                    onClick: onPrintLabels,
                  },
                ]
              : []),
          ]}
        />

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
      {/* Buscar y filtrar en una fila; "Nuevo producto" vive en el header de
          la página, no acá — dejaba de ser el único botón contained entre
          seis controles de filtro. */}
      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
        <SelectableTextField
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

        <Tooltip title="Actualizar">
          <IconButton
            onClick={onRefresh}
            disabled={loading}
            size="small"
            sx={squareIconButtonSx}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Limpiar filtros">
          <IconButton
            onClick={handleClearFilters}
            disabled={!searchTerm && !activeFilters}
            size="small"
            color={activeFilters || searchTerm ? "warning" : "default"}
            sx={squareIconButtonSx}
          >
            <FilterListOffIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {(onImportExcel || onExportExcel || onPrintLabels) && (
        <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
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
          {onPrintLabels && (
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={onPrintLabels}
              disabled={loading}
              size="small"
              sx={{ whiteSpace: "nowrap" }}
            >
              Etiquetas
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
