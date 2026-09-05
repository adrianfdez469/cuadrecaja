"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  InputAdornment,
  MenuItem,
  menuItemClasses,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import SearchIcon from "@mui/icons-material/Search";

import { ActionSheet } from "@/components/ActionSheet";
import { AppDialog } from "@/components/AppDialog";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SectionLabel } from "@/components/SectionLabel";
import { ProductosPublicacionMobileList } from "@/components/tiendaOnline/ProductosPublicacionMobileList";
import { ProductosPublicacionTable } from "@/components/tiendaOnline/ProductosPublicacionTable";
import { TiendaOnlineDeniedScreen } from "@/components/tiendaOnline/TiendaOnlineDeniedScreen";
import {
  bulkDialogTitle,
  bulkPublicacionMessage,
  categoriaStripCount,
  payloadRejectedMessage,
  productoPublicacionMessage,
} from "@/components/tiendaOnline/productoPublicacionPresentation";
import {
  QAB_PRODUCT_BULK_MAX,
  QAB_PRODUCT_SEARCH_MAX_LENGTH,
} from "@/constants/qab";
import { TIENDA_ONLINE_OFFLINE_DESCRIPTION } from "@/constants/tiendaOnline";
import { useMessageContext } from "@/context/MessageContext";
import type { IUseTiendaOnlineProductos } from "@/hooks/useTiendaOnlineProductos";
import type { ITiendaOnlineProducto } from "@/schemas/tiendaOnline";
import { fetchCategories } from "@/services/categoryService";
import {
  TiendaOnlineBulkTooLarge,
  TiendaOnlineForbiddenError,
  TiendaOnlinePayloadRejected,
} from "@/services/tiendaOnlineService";
import { shape, touch } from "@/theme/tokens";

/* -------------------------------------------------------------------------- */
/* Copy. Every sentence lives here, once.                                      */
/* -------------------------------------------------------------------------- */

const SIN_LOCAL_PUBLICADO =
  "Todavía no publicaste ningún local. Puedes marcar productos ahora, pero no se van a ver en la tienda online hasta que publiques el local.";
const SIN_PERMISO =
  "Puedes ver qué productos están en la tienda online, pero no cambiarlos: hace falta el permiso de inventario. Pídeselo a quien administra el negocio.";
const SIN_CONEXION_ACCION = "Sin conexión: no se puede publicar ahora.";
const TODAS_LAS_CATEGORIAS = "Todas las categorías";
const ENVIO_NO_INSTANTANEO =
  "Los cambios se envían en unos minutos, no al instante.";
const ERROR_GENERICO = "No se pudo enviar el cambio. Vuelve a intentarlo.";

/**
 * The height of the options of the category menu, written ON THE MENU and not on
 * each `MenuItem`.
 *
 * A `sx` on the item itself does not survive: MUI's own rule for a non-dense
 * item is `[breakpoints.up('sm')]: { minHeight: 'auto' }`, one class deep like
 * the `sx` class and emitted after it inside its media block, so from 600 px up
 * it wins by source order and the option collapses to the height of its text.
 * Descending from the menu makes the selector two classes deep, which no source
 * order can flip.
 */
const MENU_TOUCH_PROPS = {
  sx: {
    [`& .${menuItemClasses.root}`]: { minHeight: touch.min },
  },
} as const;

/** Minimal shape of what `fetchCategories` returns; the filter needs no more. */
interface ICategoriaOption {
  id: string;
  nombre: string;
}

export interface TiendaOnlineProductosTabProps {
  productos: IUseTiendaOnlineProductos;
  isMobile: boolean;
  /** Some local of `tipo: "TIENDA"` of this business is published. */
  algunLocalPublicado: boolean;
  onGoToLocales: () => void;
  onGoToInventario: () => void;
}

/** A calm notice: something is missing, nothing is broken. */
function InfoNotice({
  children,
  action,
}: Readonly<{ children: string; action?: React.ReactNode }>) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="flex-start"
      sx={{
        p: 1.5,
        mb: 2,
        borderRadius: `${shape.radius.md}px`,
        bgcolor: "semantic.hue.info.surface",
        color: "semantic.hue.info.main",
      }}
    >
      <InfoOutlinedIcon fontSize="small" sx={{ mt: 0.25 }} />
      <Stack spacing={1} sx={{ flex: 1 }}>
        <Typography variant="body2">{children}</Typography>
        {action}
      </Stack>
    </Stack>
  );
}

/**
 * The Productos tab: which products of this business go out to the online store.
 *
 * It promises nothing about immediacy — the cron runs every two minutes — and it
 * reads nothing back from the online store: it can only state what the merchant
 * marked and how OUR send went.
 */
export function TiendaOnlineProductosTab({
  productos,
  isMobile,
  algunLocalPublicado,
  onGoToLocales,
  onGoToInventario,
}: Readonly<TiendaOnlineProductosTabProps>) {
  const { showMessage } = useMessageContext();
  const [categorias, setCategorias] = useState<ICategoriaOption[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bulkPublicar, setBulkPublicar] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((rows: ICategoriaOption[]) => {
        if (active) setCategorias(rows);
      })
      .catch(() => {
        // The filter degrades to «Todas las categorías»; the list still works.
      });
    return () => {
      active = false;
    };
  }, []);

  const categoriaNombre = useMemo(
    () =>
      categorias.find((categoria) => categoria.id === productos.categoriaId)
        ?.nombre ?? "",
    [categorias, productos.categoriaId],
  );

  const hasFilters =
    productos.categoriaId.length > 0 || productos.search.trim().length > 0;
  const total = productos.total;
  const bulkTooLarge = total !== null && total > QAB_PRODUCT_BULK_MAX;
  const bulkDisabled =
    !productos.puedePublicar || !productos.online || bulkTooLarge;

  const disabledReason = !productos.puedePublicar
    ? SIN_PERMISO
    : !productos.online
      ? SIN_CONEXION_ACCION
      : "";

  const handleToggle = (producto: ITiendaOnlineProducto, next: boolean) => {
    void productos
      .publicarProducto(producto.id, next)
      .then((updated) => showMessage(productoPublicacionMessage(updated), "success"))
      .catch((error: unknown) => {
        if (error instanceof TiendaOnlineForbiddenError) {
          showMessage("No tienes permiso para cambiar esto.", "error");
          // So `puedePublicar` catches up and the controls turn off.
          productos.reload();
          return;
        }
        if (error instanceof TiendaOnlinePayloadRejected) {
          showMessage(payloadRejectedMessage(error.code, "producto"), "error");
          return;
        }
        showMessage(ERROR_GENERICO, "error");
      });
  };

  const handleBulkConfirm = () => {
    if (bulkPublicar === null || productos.categoriaId.length === 0) return;
    const publicar = bulkPublicar;
    const announced = total ?? 0;

    void productos
      .publicarCategoria(productos.categoriaId, publicar)
      .then((result) => {
        setBulkPublicar(null);
        showMessage(
          bulkPublicacionMessage({
            productos: result.productos,
            total: announced,
            categoriaNombre,
            publicar,
          }),
          "success",
        );
      })
      .catch((error: unknown) => {
        setBulkPublicar(null);
        if (error instanceof TiendaOnlineForbiddenError) {
          showMessage("No tienes permiso para cambiar esto.", "error");
          productos.reload();
          return;
        }
        if (error instanceof TiendaOnlineBulkTooLarge) {
          showMessage(
            `Esta categoría tiene ${error.productos} productos y de una sola vez se pueden marcar ${error.max}. Hay que hacerlo de uno en uno.`,
            "error",
          );
          return;
        }
        if (error instanceof TiendaOnlinePayloadRejected) {
          showMessage(payloadRejectedMessage(error.code, "categoria"), "error");
          return;
        }
        showMessage(ERROR_GENERICO, "error");
      });
  };

  if (productos.status === "forbidden") return <TiendaOnlineDeniedScreen />;

  const filtros = (
    <Stack
      direction={isMobile ? "column" : "row"}
      spacing={1.5}
      sx={{ mb: 2 }}
      // `flex-start` and not `center`: the two controls have different heights
      // (44 and 56), and centring them would leave their tops on different
      // lines. Sharing a row means sharing a top.
      alignItems={isMobile ? "stretch" : "flex-start"}
    >
      <TextField
        value={productos.search}
        onChange={(event) => productos.setSearch(event.target.value)}
        placeholder="Buscar por nombre"
        fullWidth={isMobile}
        inputProps={{ maxLength: QAB_PRODUCT_SEARCH_MAX_LENGTH }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          sx: { minHeight: touch.min },
        }}
        sx={isMobile ? undefined : { flex: 1, minWidth: 240 }}
      />
      <TextField
        select
        label="Categoría"
        value={productos.categoriaId}
        onChange={(event) => productos.setCategoriaId(event.target.value)}
        fullWidth={isMobile}
        InputProps={{ sx: { minHeight: touch.comfortable } }}
        SelectProps={{ MenuProps: MENU_TOUCH_PROPS }}
        sx={isMobile ? undefined : { width: 260 }}
      >
        <MenuItem value="">{TODAS_LAS_CATEGORIAS}</MenuItem>
        {categorias.map((categoria) => (
          <MenuItem key={categoria.id} value={categoria.id}>
            {categoria.nombre}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );

  const tira =
    productos.categoriaId.length > 0 && total !== null ? (
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={1.5}
        alignItems={isMobile ? "stretch" : "center"}
        justifyContent="space-between"
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: `${shape.radius.md}px`,
          bgcolor: "semantic.surface.sunken",
        }}
      >
        <Stack spacing={0.5} sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            {categoriaStripCount(categoriaNombre, total)}
          </Typography>
          {!productos.online && (
            <Typography
              variant="body2"
              sx={{ color: "semantic.text.secondary" }}
            >
              {SIN_CONEXION_ACCION}
            </Typography>
          )}
          {bulkTooLarge && (
            <Typography
              variant="body2"
              sx={{ color: "semantic.text.secondary" }}
            >
              {`Esta categoría tiene ${total} productos y de una sola vez se pueden marcar ${QAB_PRODUCT_BULK_MAX}. Hay que hacerlo de uno en uno.`}
            </Typography>
          )}
        </Stack>

        {isMobile ? (
          <Button
            variant="outlined"
            fullWidth
            disabled={bulkDisabled}
            onClick={() => setSheetOpen(true)}
            sx={{ minHeight: touch.min }}
          >
            Acciones de la categoría
          </Button>
        ) : (
          <Stack direction="row" spacing={1}>
            <Button
              variant="text"
              disabled={bulkDisabled}
              onClick={() => setBulkPublicar(false)}
              sx={{ minHeight: touch.min }}
            >
              Quitar todos
            </Button>
            <Button
              variant="contained"
              disabled={bulkDisabled}
              onClick={() => setBulkPublicar(true)}
              sx={{ minHeight: touch.min }}
            >
              Publicar todos
            </Button>
          </Stack>
        )}
      </Stack>
    ) : null;

  return (
    <Box>
      {!algunLocalPublicado && (
        <InfoNotice
          action={
            <Box>
              <Button
                variant="outlined"
                color="inherit"
                onClick={onGoToLocales}
                sx={{ minHeight: touch.min }}
              >
                Ir a Locales
              </Button>
            </Box>
          }
        >
          {SIN_LOCAL_PUBLICADO}
        </InfoNotice>
      )}

      {!productos.puedePublicar && productos.status === "ready" && (
        <InfoNotice>{SIN_PERMISO}</InfoNotice>
      )}

      {filtros}
      {tira}

      {productos.status === "loading" && (
        <LoadingState
          variant={isMobile ? "list" : "table"}
          count={isMobile ? 6 : 8}
          columns={5}
        />
      )}

      {productos.status === "error" && (
        <ErrorState
          kind="error"
          title="No se pudieron cargar los productos"
          description="Vuelve a intentarlo en un momento."
          onRetry={productos.reload}
        />
      )}

      {productos.status === "offline" && (
        <ErrorState
          kind="offline"
          title="Sin conexión"
          description={TIENDA_ONLINE_OFFLINE_DESCRIPTION}
          onRetry={productos.reload}
        />
      )}

      {productos.status === "ready" &&
        productos.productos.length === 0 &&
        !hasFilters && (
          <EmptyState
            variant="empty"
            size="page"
            title="Este negocio todavía no tiene productos."
            description="Créalos en Inventario y vuelve aquí para elegir cuáles salen en la tienda online."
            action={{ label: "Ir a Inventario", onClick: onGoToInventario }}
          />
        )}

      {productos.status === "ready" &&
        productos.productos.length === 0 &&
        hasFilters && (
          <EmptyState
            variant="no-results"
            size="compact"
            title="Ningún producto coincide con lo que buscas."
            description="Prueba con otro nombre o quita el filtro de categoría."
            action={{
              label: "Quitar los filtros",
              onClick: productos.clearFilters,
            }}
          />
        )}

      {productos.status === "ready" && productos.productos.length > 0 && (
        <>
          <SectionLabel>PRODUCTOS</SectionLabel>
          {isMobile ? (
            <ProductosPublicacionMobileList
              productos={productos.productos}
              hideCategoria={productos.categoriaId.length > 0}
              puedePublicar={productos.puedePublicar}
              online={productos.online}
              pendingProductoIds={productos.pendingProductoIds}
              disabledReason={disabledReason}
              onToggle={handleToggle}
            />
          ) : (
            <ProductosPublicacionTable
              productos={productos.productos}
              puedePublicar={productos.puedePublicar}
              online={productos.online}
              pendingProductoIds={productos.pendingProductoIds}
              disabledReason={disabledReason}
              onToggle={handleToggle}
            />
          )}

          {productos.nextCursor !== null && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                fullWidth={isMobile}
                loading={productos.loadingMore}
                onClick={productos.loadMore}
                sx={{ minHeight: touch.min }}
              >
                Cargar más productos
              </Button>
            </Box>
          )}
        </>
      )}

      <ActionSheet
        open={sheetOpen && isMobile}
        onClose={() => setSheetOpen(false)}
        title="Acciones de la categoría"
        items={[
          {
            key: "publicar",
            icon: <CheckCircleOutlineIcon />,
            label: "Publicar todos en la tienda online",
            onClick: () => setBulkPublicar(true),
          },
          {
            key: "quitar",
            icon: <RemoveCircleOutlineIcon />,
            label: "Quitar todos de la tienda online",
            onClick: () => setBulkPublicar(false),
          },
        ]}
      />

      <AppDialog
        open={bulkPublicar !== null}
        onClose={() => setBulkPublicar(null)}
        title={bulkDialogTitle(total ?? 0, bulkPublicar === true)}
        busy={productos.bulkPending}
        confirm={{
          label: bulkPublicar === true ? "Publicar" : "Quitar",
          onClick: handleBulkConfirm,
          loading: productos.bulkPending,
          // Never `danger`: taking a product out of the online store destroys
          // nothing, and the opposite action is in the same place.
          tone: "primary",
        }}
      >
        <Stack spacing={1}>
          <Typography variant="body2">
            {bulkPublicar === true
              ? `Todos los productos de «${categoriaNombre}» van a quedar visibles para cualquiera que abra tu tienda online.`
              : "Dejan de verse en tu tienda online. Se siguen vendiendo con normalidad en el punto de venta."}
          </Typography>
          <Typography variant="body2">{ENVIO_NO_INSTANTANEO}</Typography>
        </Stack>
      </AppDialog>
    </Box>
  );
}

export default TiendaOnlineProductosTab;
