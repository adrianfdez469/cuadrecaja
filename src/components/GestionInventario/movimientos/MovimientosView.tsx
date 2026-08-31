"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { StatStrip } from "@/components/StatStrip";
import { squareIconButtonSx } from "@/theme";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Fuera del bundle de la pantalla: arrastra `xlsx`, que solo hace falta
// cuando alguien importa un fichero de verdad.
const ImportarExcelDialog = dynamic(() => import("./importExcelDialog"), {
  ssr: false,
});
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Stack,
  Alert,
  InputAdornment,
  Card,
  CardContent,
  Tooltip,
  Chip,
  useTheme,
  useMediaQuery,
  IconButton,
  Collapse,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  Add,
  Dock,
  Search,
  Refresh,
  ExpandLess,
  FilterAlt,
  FilterListOff,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { AddMovimientoDialog } from "./addMovimientoDialog";
import { DevolucionVentaDialog } from "./DevolucionVentaDialog";
import { usePermisos } from "@/utils/permisos_front";
import { useAppContext } from "@/context/AppContext";
import {
  cretateBatchMovimientos,
  findMovimientos,
  rejectMovimiento,
} from "@/services/movimientoService";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { ITipoMovimiento, MovimientoTipoEnum } from "@/schemas/movimiento";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import SelectableTextField from "@/components/SelectableTextField";
import {
  formatNumber,
  formatDateTime,
  formatMovimientoMotivo,
  formatQuantity,
} from "@/utils/formatters";
import {
  TIPO_MOVIMIENTO_FLOW,
  TIPO_MOVIMIENTO_LABELS,
} from "@/constants/movimientos";
import {
  IProductoDisponible,
  OperacionTipo,
  ProductSelectionModal,
} from "@/components/ProductcSelectionModal/ProductSelectionModal";
import { useProductSelectionModal } from "@/hooks/useProductSelectionModal";
import { useMessageContext } from "@/context/MessageContext";
import { usePendingReceptionStore } from "@/store/pendingReceptionStore";
import { PendingReceptionBanner } from "./PendingReceptionBanner";

const PAGE_SIZE = 20;

const TODOS_TIPOS = MovimientoTipoEnum.options;

interface MovimientosViewProps {
  /** Pestañas Inventario/Movimientos, dibujadas por el padre bajo el título. */
  tabs?: ReactNode;
}

export default function MovimientosView({ tabs }: MovimientosViewProps) {
  const [movimientos, setMovimientos] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [devolucionDialogOpen, setDevolucionDialogOpen] = useState(false);
  const { verificarPermiso } = usePermisos();
  const [searchTerm, setSearchTerm] = useState("");
  const { user, loadingContext } = useAppContext();
  const [loadingData, setLoadingData] = useState(true);
  // Solo la primera carga tapa la pantalla; los refetch posteriores muestran
  // una barra de progreso sin desmontar la vista ni los diálogos abiertos.
  const [primeraCarga, setPrimeraCarga] = useState(true);
  const [noLocalActual, setNoLocalActual] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { items: pendienteRecepcion, fetch: fetchPendienteRecepcion } =
    usePendingReceptionStore();
  const [tipoFilter, setTipoFilter] = useState<ITipoMovimiento[]>([]);
  const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(null);
  const [fechaFin, setFechaFin] = useState<Dayjs | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const { showMessage } = useMessageContext();

  // 🆕 Estados para paginación mejorada
  const [totalMovimientos, setTotalMovimientos] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [searchInputValue, setSearchInputValue] = useState(""); // 🆕 Valor del input no controlado

  const {
    isOpen: pendienteRecepcionDialogOpen,
    operacion: pendienteRecepcionOperacion,
    openModal: pendienteRecepcionOpenModal,
    closeModal: pendienteRecepcionCloseModal,
    handleConfirm: pendienteRecepcionHandleConfirm,
    setOnConfirm: pendienteRecepcionSetOnConfirm,
  } = useProductSelectionModal();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  // An empty table means two different things, and they need opposite answers:
  // a filter that matched nothing offers a way to clear it, a store with no
  // history explains where movements come from.
  const hayFiltrosActivos = Boolean(
    searchTerm ||
    searchInputValue ||
    tipoFilter.length > 0 ||
    fechaInicio ||
    fechaFin,
  );
  const disabledCleanFilter = !hayFiltrosActivos || loadingData;

  const [skip, setSkip] = useState(0);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Llegada desde la notificación de "movimientos pendientes": abre el modal
  // de aceptación en cuanto los pendientes terminan de cargarse, y limpia el
  // parámetro para no reabrirlo en un refresh posterior.
  useEffect(() => {
    if (
      searchParams.get("openPending") === "1" &&
      pendienteRecepcion.length > 0
    ) {
      pendienteRecepcionOpenModal("ENTRADA");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("openPending");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, pendienteRecepcion, pathname, router]);

  const handleReject = async (
    producto: IProductoDisponible,
    motivo: string,
  ) => {
    try {
      if (!producto.movimientoOrigenId) return;
      await rejectMovimiento(producto.movimientoOrigenId, motivo);
      showMessage("Entrada rechazada correctamente", "success");
      // Actualizar el contador de pendientes
      await fetchPendienteRecepcion(user.localActual.id);
    } catch (error) {
      console.error("Error al rechazar producto:", error);
      showMessage("Error al rechazar el producto", "error");
      throw error;
    }
  };

  const fetchMovimientos = async (
    nuevoSkip = skip,
    searchFilter = searchTerm,
    tipoParam: ITipoMovimiento[] = tipoFilter,
    inicioParam: Dayjs | null = fechaInicio,
    finParam: Dayjs | null = fechaFin,
  ) => {
    try {
      setLoadingData(true);
      const tiendaId = user.localActual.id;

      const intervalo =
        inicioParam || finParam
          ? { fechaInicio: inicioParam?.toDate(), fechaFin: finParam?.toDate() }
          : undefined;

      const result = await findMovimientos(
        tiendaId,
        PAGE_SIZE,
        nuevoSkip,
        undefined,
        tipoParam.length > 0 ? tipoParam : undefined,
        intervalo,
        searchFilter,
      );

      setMovimientos(result?.data || []);
      setTotalMovimientos(result?.total || 0);
      setHasMoreData(
        (result?.data?.length || 0) === PAGE_SIZE &&
          nuevoSkip + PAGE_SIZE < (result?.total || 0),
      );
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
      setMovimientos([]);
      setTotalMovimientos(0);
      setHasMoreData(false);
    } finally {
      setLoadingData(false);
      setPrimeraCarga(false);
    }
  };

  const handleFilter = () => {
    setSearchTerm(searchInputValue);
    setSkip(0);
    setCurrentPage(0);
    fetchMovimientos(0, searchInputValue, tipoFilter, fechaInicio, fechaFin);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchInputValue("");
    setTipoFilter([]);
    setFechaInicio(null);
    setFechaFin(null);
    setSkip(0);
    setCurrentPage(0);
    fetchMovimientos(0, "", [], null, null);
  };

  const handleInputChange = (value: string) => {
    setSearchInputValue(value);
  };

  const fecthPendientesRecep = async () => {
    await fetchPendienteRecepcion(user.localActual.id);
    pendienteRecepcionSetOnConfirm((prods) => {
      // Crear documento de tipo TRASPASO_ENTRADA con los productos
      crearMovimientosRecepción(prods);
    });
  };

  const crearMovimientosRecepción = async (prods) => {
    try {
      setLoadingData(true);
      const localId = user.localActual.id;
      await cretateBatchMovimientos(
        {
          tiendaId: localId,
          tipo: "TRASPASO_ENTRADA",
          usuarioId: user.id,
        },
        prods.map((item) => {
          return {
            cantidad: item.cantidad,
            productoId: item.productoId,
            costoUnitario: item.costo,
            costoTotal: item.costoTotal,
            // Moneda tal cual venía de la tienda origen — nunca reinterpretar
            // el costo en la moneda base del destino (bug: CUP leído como USD).
            monedaCompra: item.monedaCostoCode,
            // Precio de venta origen — usado solo si el producto no existía
            // aún en la tienda destino (ver CreateMoviento).
            precio: item.precio,
            monedaPrecio: item.monedaPrecioCode,
            ...(item.proveedor && { proveedorId: item.proveedor.id }),
            movimientoOrigenId: item.movimientoOrigenId,
          };
        }),
      );
    } catch (error) {
      console.error(error);
      showMessage("No se pudo crear los movimientos de entrada", "error");
      setLoadingData(false);
      return;
    }

    // Ya está registrado: los refetch solo refrescan la vista y un fallo aquí
    // no debe reportarse como si el movimiento hubiera fallado.
    // fetchMovimientos apaga el indicador al terminar.
    await Promise.all([
      fetchMovimientos(0),
      fecthPendientesRecep().catch((error) => console.error(error)),
    ]);
  };

  const loadPendientesRecep = async (
    _operacion: OperacionTipo,
    _take: number,
    _skip: number,
    _filter?: { categoriaId?: string; text?: string },
  ): Promise<IProductoDisponible[]> => {
    return pendienteRecepcion.map((item) => {
      return {
        productoId: item.productoTienda.productoId,
        nombre: item.productoTienda?.producto?.nombre,
        categoriaId: item.productoTienda?.producto?.categoriaId,
        categoria: item.productoTienda?.producto?.categoria,
        productoTiendaId: item.productoTiendaId,
        precio: item.productoTienda?.precio,
        monedaPrecioCode: item.productoTienda?.monedaPrecioCode,
        costo: item.productoTienda?.costo,
        monedaCostoCode: item.productoTienda?.monedaCostoCode,
        existencia: item.productoTienda?.existencia,
        proveedorId: item.productoTienda?.proveedorId,
        proveedor: item.productoTienda?.proveedor,
        permiteDecimal: item.productoTienda?.producto?.permiteDecimal,
        movimientoOrigenId: item.movimientoOrigenId,
        codigosProducto: item.productoTienda?.producto?.codigosProducto,
      };
    });
  };

  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        try {
          setNoLocalActual(false);

          if (!user.localActual || !user.localActual.id) {
            setNoLocalActual(true);
            setLoadingData(false);
            return;
          }

          setSkip(0);
          setCurrentPage(0);
          await fetchMovimientos(0);
          fecthPendientesRecep(); // fetch pendientes de recepcion asincronico
        } catch (error) {
          console.error("Error al cargar datos:", error);
        } finally {
          setLoadingData(false);
        }
      }
    })();
  }, [loadingContext]);

  const handleInicio = () => {
    setSkip(0);
    setCurrentPage(0);
    fetchMovimientos(0);
  };

  const handleAnterior = () => {
    const nuevoSkip = Math.max(skip - PAGE_SIZE, 0);
    const nuevaPagina = Math.max(currentPage - 1, 0);
    setSkip(nuevoSkip);
    setCurrentPage(nuevaPagina);
    fetchMovimientos(nuevoSkip);
  };

  const handleSiguiente = () => {
    const nuevoSkip = skip + PAGE_SIZE;
    const nuevaPagina = currentPage + 1;
    setSkip(nuevoSkip);
    setCurrentPage(nuevaPagina);
    fetchMovimientos(nuevoSkip);
  };

  // Cálculos para estadísticas
  const movimientosEntrada = movimientos.filter(
    (m) => !isMovimientoBaja(m.tipo),
  ).length;
  const movimientosSalida = movimientos.filter((m) =>
    isMovimientoBaja(m.tipo),
  ).length;
  const productosAfectados = [
    ...new Set(movimientos.map((m) => m.productoTiendaId)),
  ].length;

  if (loadingContext || (primeraCarga && loadingData)) {
    // Skeleton inside the page shell, not instead of it. A skeleton exists to
    // hold the layout still, so the header and the title have to already be
    // there — otherwise the whole page still jumps when the rows land, which
    // is what the old full-screen spinner did.
    return (
      <PageContainer
        title="Movimientos de Stock"
        subtitle="Historial de entradas y salidas de inventario"
        tabs={tabs}
        maxWidth="xl"
      >
        <ContentCard>
          {/*
            This view renders a table on desktop and one card per movement on
            phones, so the skeleton has to follow. A table skeleton in front of
            incoming cards is just a spinner with extra steps.
          */}
          {isMobile ? (
            <LoadingState variant="cards" count={5} />
          ) : (
            <LoadingState variant="table" columns={6} count={8} />
          )}
        </ContentCard>
      </PageContainer>
    );
  }

  if (noLocalActual) {
    return (
      <PageContainer
        title="Movimientos de Stock"
        tabs={tabs}
        breadcrumbs={[
          { label: "Inicio", href: "/home" },
          { label: "Movimientos" },
        ]}
      >
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para ver y gestionar los movimientos de stock, necesitas tener una
            tienda seleccionada como tienda actual.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Si no tienes ninguna tienda creada, primero debes crear una desde la
            configuración.
          </Typography>
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              href="/configuracion/tiendas"
              sx={{ mr: 2 }}
            >
              Ir a Configuración de Tiendas
            </Button>
          </Box>
        </Alert>
      </PageContainer>
    );
  }

  const handleImportExcel = () => {
    setImportDialogOpen(true);
  };

  const puedeDevolucionVenta = verificarPermiso(
    "operaciones.movimientos.crear.devolucion_venta",
  );
  const puedeImportarExcel =
    (movimientos.length === 0 && !searchTerm) || user.rol === "SUPER_ADMIN";

  // Orden del mockup: secundarias primero, "Crear Movimiento" al final — es
  // la acción principal y va pegada al borde, no perdida entre las demás.
  // En mobile no vive acá: baja al contenido como botón de ancho completo
  // (mismo criterio que "Cerrar caja" en /cierre, ver pattern_mobile_sticky_cta).
  const headerActions = !isMobile ? (
    <Stack direction="row" spacing={1} alignItems="center">
      {puedeDevolucionVenta && (
        <Button
          variant="outlined"
          onClick={() => setDevolucionDialogOpen(true)}
        >
          Devolución de venta
        </Button>
      )}
      {puedeImportarExcel && (
        <Button
          variant="outlined"
          startIcon={<Dock />}
          onClick={handleImportExcel}
        >
          Importar Excel
        </Button>
      )}
      <Tooltip title="Actualizar movimientos">
        <IconButton
          onClick={() => fetchMovimientos(skip)}
          disabled={loadingData}
          sx={squareIconButtonSx}
        >
          <Refresh />
        </IconButton>
      </Tooltip>
      <Button
        variant="contained"
        startIcon={<Add />}
        onClick={() => setDialogOpen(true)}
      >
        Crear Movimiento
      </Button>
    </Stack>
  ) : undefined;

  // Componente de estadística móvil optimizado
  /**
   * The chip printed the raw enum — `DESAGREGACION_ALTA` — even though readable
   * labels already existed and the filter dropdown right above it used them.
   *
   * Colour follows the movement's flow role rather than a rises/falls boolean.
   * Under the old rule the two halves of one disaggregation came out green and
   * red, reading as a success beside a failure when they are a single operation:
   * opening a box to sell its loose units.
   */
  const getMovimientoChip = (tipo: string) => {
    const flow =
      theme.palette.semantic.flow[
        TIPO_MOVIMIENTO_FLOW[tipo as ITipoMovimiento]
      ];
    return (
      <Chip
        label={TIPO_MOVIMIENTO_LABELS[tipo as ITipoMovimiento] ?? tipo}
        size="small"
        variant="filled"
        sx={{
          fontWeight: 500,
          bgcolor: flow.surface,
          color: flow.main,
        }}
      />
    );
  };

  return (
    <PageContainer
      title="Movimientos de Stock"
      subtitle="Historial de entradas y salidas de inventario"
      tabs={tabs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      <PendingReceptionBanner
        count={pendienteRecepcion.length}
        onClick={() => pendienteRecepcionOpenModal("ENTRADA")}
      />

      <StatStrip
        stats={
          // El orden cambia por viewport: mobile agrupa "Productos" antes de
          // Entradas/Salidas (rejilla 2×2), desktop las deja seguidas.
          isMobile
            ? [
                {
                  label: "Total Movimientos",
                  value: formatNumber(totalMovimientos),
                },
                {
                  label: "Productos",
                  value: formatNumber(productosAfectados),
                },
                {
                  label: "Entradas",
                  value: formatNumber(movimientosEntrada),
                  tone: "positive",
                },
                {
                  label: "Salidas",
                  value: formatNumber(movimientosSalida),
                  tone: "negative",
                },
              ]
            : [
                {
                  label: "Total Movimientos",
                  value: formatNumber(totalMovimientos),
                },
                {
                  label: "Entradas",
                  value: formatNumber(movimientosEntrada),
                  tone: "positive",
                },
                {
                  label: "Salidas",
                  value: formatNumber(movimientosSalida),
                  tone: "negative",
                },
                {
                  label: "Productos",
                  value: formatNumber(productosAfectados),
                },
              ]
        }
      />

      {/* En mobile, "Crear Movimiento" es de ancho completo y las secundarias
          bajan a una fila propia — mismo criterio que el header de escritorio
          usa Stack, acá no entraban ni comprimidas. */}
      {isMobile && (
        <Stack spacing={1.25} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
            sx={{ minHeight: 52 }}
          >
            Crear Movimiento
          </Button>
          <Stack direction="row" spacing={1}>
            {puedeDevolucionVenta && (
              <Button
                variant="outlined"
                onClick={() => setDevolucionDialogOpen(true)}
                sx={{ flex: 1 }}
              >
                Devolución de venta
              </Button>
            )}
            {puedeImportarExcel && (
              <Tooltip title="Importar Excel">
                <IconButton
                  onClick={handleImportExcel}
                  sx={{ ...squareIconButtonSx, flex: "0 0 auto" }}
                >
                  <Dock />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Actualizar movimientos">
              <IconButton
                onClick={() => fetchMovimientos(skip)}
                disabled={loadingData}
                sx={{ ...squareIconButtonSx, flex: "0 0 auto" }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      )}

      {/* Lista de movimientos */}
      <ContentCard
        title="Historial de Movimientos"
        subtitle={
          !isMobile
            ? "Registro detallado de todas las transacciones de inventario"
            : undefined
        }
        headerActions={
          isMobile ? (
            // El mockup (`rediseno/movimientos-stock-movil.html`) parte esta
            // barra en dos filas a 390px: buscar+Filtrar arriba, Limpiar
            // filtros abajo. El toggle "Más filtros" (panel de Tipo/Fecha) no
            // está en el mockup — es una función previa a la migración que
            // hay que conservar, así que se suma a la segunda fila.
            <Stack spacing={1}>
              <Stack direction="row" spacing={1}>
                <SelectableTextField
                  size="small"
                  placeholder="Buscar..."
                  value={searchInputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleFilter();
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <Button
                  variant="outlined"
                  startIcon={<FilterAlt fontSize="small" />}
                  onClick={handleFilter}
                  disabled={loadingData}
                  sx={{ flexShrink: 0 }}
                >
                  Filtrar
                </Button>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Tooltip
                  title={filtersExpanded ? "Ocultar filtros" : "Más filtros"}
                >
                  <IconButton
                    onClick={() => setFiltersExpanded((v) => !v)}
                    color={
                      tipoFilter.length > 0 || fechaInicio || fechaFin
                        ? "primary"
                        : "default"
                    }
                    sx={squareIconButtonSx}
                  >
                    {filtersExpanded ? <ExpandLess /> : <FilterAlt />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Limpiar todos los filtros">
                  <Button
                    variant="outlined"
                    startIcon={<FilterListOff fontSize="small" />}
                    onClick={handleClearSearch}
                    disabled={disabledCleanFilter}
                  >
                    Limpiar filtros
                  </Button>
                </Tooltip>
              </Stack>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <SelectableTextField
                size="small"
                placeholder="Buscar movimiento..."
                value={searchInputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleFilter();
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 200, maxWidth: 250 }}
              />
              <Tooltip
                title={filtersExpanded ? "Ocultar filtros" : "Más filtros"}
              >
                <IconButton
                  onClick={() => setFiltersExpanded((v) => !v)}
                  color={
                    tipoFilter.length > 0 || fechaInicio || fechaFin
                      ? "primary"
                      : "default"
                  }
                  sx={squareIconButtonSx}
                >
                  {filtersExpanded ? <ExpandLess /> : <FilterAlt />}
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<FilterAlt fontSize="small" />}
                onClick={handleFilter}
                disabled={loadingData}
              >
                Filtrar
              </Button>

              <Tooltip title="Limpiar todos los filtros">
                <Button
                  variant="outlined"
                  startIcon={<FilterListOff fontSize="small" />}
                  onClick={handleClearSearch}
                  disabled={disabledCleanFilter}
                >
                  Limpiar filtros
                </Button>
              </Tooltip>
            </Stack>
          )
        }
        noPadding
        fullHeight
      >
        {loadingData && <LinearProgress />}

        {/* Panel de filtros adicionales */}
        <Collapse in={filtersExpanded}>
          <Box sx={{ px: isMobile ? 1.5 : 3, pt: 2, pb: 2 }}>
            <Stack
              direction={isMobile ? "column" : "row"}
              spacing={2}
              alignItems={isMobile ? "stretch" : "flex-end"}
            >
              <FormControl
                size="small"
                sx={{ minWidth: 220, maxWidth: isMobile ? "100%" : 320 }}
              >
                <InputLabel>Tipo de movimiento</InputLabel>
                <Select
                  multiple
                  value={tipoFilter}
                  label="Tipo de movimiento"
                  onChange={(e) =>
                    setTipoFilter(e.target.value as ITipoMovimiento[])
                  }
                  renderValue={(selected) =>
                    (selected as ITipoMovimiento[])
                      .map((t) => TIPO_MOVIMIENTO_LABELS[t])
                      .join(", ")
                  }
                >
                  {TODOS_TIPOS.map((tipo) => (
                    <MenuItem key={tipo} value={tipo}>
                      {TIPO_MOVIMIENTO_LABELS[tipo]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <DatePicker
                label="Fecha inicio"
                value={fechaInicio}
                onChange={(val) => setFechaInicio(val)}
                maxDate={fechaFin ?? dayjs()}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: { maxWidth: isMobile ? "100%" : 180 },
                  },
                  actionBar: { actions: ["clear"] },
                }}
              />
              <DatePicker
                label="Fecha fin"
                value={fechaFin}
                onChange={(val) => setFechaFin(val)}
                minDate={fechaInicio ?? undefined}
                maxDate={dayjs()}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: { maxWidth: isMobile ? "100%" : 180 },
                  },
                  actionBar: { actions: ["clear"] },
                }}
              />
            </Stack>
          </Box>
          <Divider />
        </Collapse>

        {movimientos.length === 0 ? (
          hayFiltrosActivos ? (
            <EmptyState
              variant="no-results"
              title="No se encontraron movimientos"
              description="Ningún movimiento coincide con los filtros aplicados."
              action={{ label: "Limpiar filtros", onClick: handleClearSearch }}
            />
          ) : (
            <EmptyState
              title="Todavía no hay movimientos de stock"
              description="Se registran solos con cada venta, entrada de inventario, ajuste o traspaso entre tiendas. También podés crear uno a mano."
            />
          )
        ) : isMobile ? (
          // Vista móvil: `rediseno/movimientos-stock-movil.html` — nombre y
          // pill apilados a la izquierda, la cantidad es el dato grande a la
          // derecha; motivo y usuario van sin etiquetas ("Motivo:"/"Por:"
          // eran redundantes, el texto ya se explica solo).
          <Box sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
              {movimientos.map((movimiento, i) => (
                <Card key={i} variant="outlined">
                  <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={1.5}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: "1rem",
                            fontWeight: 700,
                            lineHeight: 1.35,
                          }}
                        >
                          {movimiento.proveedor?.nombre
                            ? `${movimiento.productoTienda?.producto?.nombre} - ${movimiento.proveedor.nombre}`
                            : movimiento.productoTienda?.producto?.nombre ||
                              "Producto no encontrado"}
                        </Typography>
                        <Box sx={{ mt: 0.75 }}>
                          {getMovimientoChip(movimiento.tipo)}
                        </Box>
                      </Box>
                      <Typography
                        sx={{
                          flexShrink: 0,
                          fontSize: "1.375rem",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          color: isMovimientoBaja(movimiento.tipo)
                            ? "error.main"
                            : "success.main",
                        }}
                      >
                        {isMovimientoBaja(movimiento.tipo) ? "-" : "+"}
                        {formatNumber(Math.abs(movimiento.cantidad))}
                      </Typography>
                    </Box>

                    {movimiento?.motivo && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1.25 }}
                      >
                        {formatMovimientoMotivo(movimiento.motivo)}
                      </Typography>
                    )}

                    <Stack
                      direction="row"
                      alignItems="center"
                      sx={{
                        mt: 1.5,
                        pt: 1.25,
                        borderTop: 1,
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(movimiento.fecha)}
                      </Typography>
                      {movimiento.usuario?.nombre && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: "auto" }}
                        >
                          {movimiento.usuario.nombre}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        ) : (
          // Vista desktop con tabla
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Producto</TableCell>
                  <TableCell>Motivo</TableCell>
                  <TableCell align="center">Cantidad</TableCell>
                  {!isTablet && <TableCell>Usuario</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {movimientos.map((movimiento, i) => (
                  <TableRow
                    key={i}
                    sx={{
                      "&:nth-of-type(odd)": {},
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateTime(movimiento.fecha)}
                      </Typography>
                    </TableCell>
                    <TableCell>{getMovimientoChip(movimiento.tipo)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {movimiento.proveedor?.nombre
                          ? `${movimiento.productoTienda?.producto?.nombre} - ${movimiento.proveedor.nombre}`
                          : movimiento.productoTienda?.producto?.nombre ||
                            "Producto no encontrado"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {formatMovimientoMotivo(movimiento.motivo)}
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={
                          isMovimientoBaja(movimiento.tipo)
                            ? "error.main"
                            : "success.main"
                        }
                      >
                        {isMovimientoBaja(movimiento.tipo) ? "-" : "+"}
                        {formatQuantity(Math.abs(movimiento.cantidad))}
                      </Typography>
                    </TableCell>
                    {!isTablet && (
                      <TableCell>
                        <Typography variant="body2">
                          {movimiento.usuario?.nombre || "Sistema"}
                        </Typography>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Paginación */}
        {movimientos.length > 0 && (
          <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Stack
              direction="row"
              spacing={1}
              justifyContent="center"
              alignItems="center"
            >
              <Button
                variant="outlined"
                size="small"
                onClick={handleInicio}
                disabled={skip === 0}
              >
                Inicio
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleAnterior}
                disabled={skip === 0}
              >
                Anterior
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                Mostrando {skip + 1} -{" "}
                {Math.min(skip + movimientos.length, totalMovimientos)} de{" "}
                {totalMovimientos} movimientos
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={handleSiguiente}
                disabled={!hasMoreData}
              >
                Siguiente
              </Button>
            </Stack>
            {(searchTerm ||
              tipoFilter.length > 0 ||
              fechaInicio ||
              fechaFin) && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", textAlign: "center", mt: 1 }}
              >
                Filtros activos:{searchTerm ? ` "${searchTerm}"` : ""}
                {tipoFilter.length > 0
                  ? ` · ${tipoFilter.map((t) => TIPO_MOVIMIENTO_LABELS[t]).join(", ")}`
                  : ""}
                {fechaInicio
                  ? ` · desde ${fechaInicio.format("DD/MM/YYYY")}`
                  : ""}
                {fechaFin ? ` · hasta ${fechaFin.format("DD/MM/YYYY")}` : ""}
              </Typography>
            )}
          </Box>
        )}
      </ContentCard>

      {/* Dialog para crear movimiento */}
      <AddMovimientoDialog
        dialogOpen={dialogOpen}
        // productos={productos}
        closeDialog={() => setDialogOpen(false)}
        fetchMovimientos={fetchMovimientos}
      />
      <DevolucionVentaDialog
        dialogOpen={devolucionDialogOpen}
        closeDialog={() => setDevolucionDialogOpen(false)}
        tiendaId={user.localActual.id}
        onSuccess={fetchMovimientos}
      />
      {/* Montado solo al abrirlo: arrastra `xlsx`. */}
      {importDialogOpen && (
        <ImportarExcelDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          onSuccess={() => {
            fetchMovimientos(0);
          }}
        />
      )}
      {pendienteRecepcionDialogOpen && (
        <ProductSelectionModal
          open={pendienteRecepcionDialogOpen}
          onClose={pendienteRecepcionCloseModal}
          loadProductos={loadPendientesRecep}
          operacion={pendienteRecepcionOperacion}
          iTipoMovimiento={"TRASPASO_ENTRADA"}
          onConfirm={pendienteRecepcionHandleConfirm}
          onReject={handleReject}
        />
      )}
    </PageContainer>
  );
}
