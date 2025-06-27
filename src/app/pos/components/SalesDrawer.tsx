import { Sale, useSalesStore } from "@/store/salesStore";
import {
  Close,
  CloudUpload,
  Done,
  Sync,
  Wifi,
  WifiOff,
  SyncDisabled,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { FC, useEffect, useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { ProducsSalesDrawer } from "./ProductsSalesDrawer";
import { createSell, getSells, removeSell } from "@/services/sellService";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import { useAppContext } from "@/context/AppContext";
import { ICierrePeriodo } from "@/types/ICierre";

interface IProps {
  showSales: boolean;
  period: ICierrePeriodo;
  handleClose: () => void;
}

export const SalesDrawer: FC<IProps> = ({ showSales, period, handleClose }) => {
  const {
    sales,
    markSynced,
    markSyncError,
    markSyncing,
    deleteSale,
    synchronizeSales,
  } = useSalesStore();

  const [showProducts, setShowProducts] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale>();
  const [disableAll, setDisableAll] = useState(false);
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const [offline, setOffline] = useState(false);
  const { user } = useAppContext();

  const handleSelectViewSale = (sale) => {
    setSelectedSale(sale);
    setShowProducts(true);
  };

  const handleSyncAll = async () => {
    setDisableAll(true);
    const salesToSync = sales.filter((sale) => !sale.synced);
    for (const syncObj of salesToSync) {
      try {
        markSyncing(syncObj.identifier);
        const ventaDb = await createSell(
          syncObj.tiendaId,
          syncObj.cierreId,
          syncObj.usuarioId,
          syncObj.total,
          syncObj.totalcash,
          syncObj.totaltransfer,
          syncObj.productos,
          syncObj.identifier
        );
        markSynced(syncObj.identifier, ventaDb.id);
        setOffline(false);
      } catch (error) {
        markSyncError(syncObj.identifier);
        console.error(`Error sincronizando venta ${syncObj.identifier}`, error);
        if (error && error.code && error.code === "ERR_NETWORK") {
          showMessage("Error de red al sincronizar ventas", "warning", error);
          setOffline(true);
        } else {
          showMessage("Error al sincronizar ventas", "error", error);
        }
      } finally {
        setDisableAll(false);
      }
    }
  };

  const handleSyncOne = async (sale: Sale) => {
    setDisableAll(true);
    const syncObj = sales.find((s) => s.identifier === sale.identifier);
    try {
      markSyncing(syncObj.identifier);
      const ventaDb = await createSell(
        syncObj.tiendaId,
        syncObj.cierreId,
        syncObj.usuarioId,
        syncObj.total,
        syncObj.totalcash,
        syncObj.totaltransfer,
        syncObj.productos,
        syncObj.identifier
      );
      markSynced(syncObj.identifier, ventaDb.id);
      setOffline(false);
    } catch (error) {
      markSyncError(syncObj.identifier);
      console.error(`Error sincronizando venta ${syncObj.identifier}`, error);
      if (error && error.code && error.code === "ERR_NETWORK") {
        setOffline(true);
        showMessage("Error de red al sincronizar venta", "warning", error);
      } else {
        showMessage("Error al sincronizar venta", "error", error);
      }
    } finally {
      setDisableAll(false);
    }
  };

  const handleDeleteOne = async (sale: Sale) => {
    await confirmDialog(
      "Está seguro que desea elimnar las venta seleccionada?",
      async () => {
        try {
          setDisableAll(true);
          console.log(sale);

          if (sale.synced) {
            // eliminar de las ventas en backend
            const tiendaId = user.tiendaActual.id;
            await removeSell(tiendaId, period.id, sale.dbId, user.id);
          }

          // eliminar de las ventas y los productos en el storage
          deleteSale(sale.identifier);
          setOffline(false);
          showMessage("La venta fue eliminada satisfactoriamente", "success");
        } catch (error) {
          console.log(error);

          if (error && error.code && error.code === "ERR_NETWORK") {
            setOffline(true);
            showMessage(
              "La venta no puedo ser eliminada por error de conexión",
              "warning",
              error
            );
          } else {
            showMessage("La venta no puedo ser eliminada", "error", error);
          }
        } finally {
          setDisableAll(false);
        }
      }
    );
  };

  const syncronizeProdsAndSales = async () => {
    try {
      setDisableAll(true);
      const tiendaId = user.tiendaActual.id;
      const ventasDb = await getSells(tiendaId, period.id);
      const salesSust: Sale[] = ventasDb.map((venta) => {
        const sale: Sale = {
          cierreId: venta.cierrePeriodoId,
          identifier: venta.syncId,
          synced: true,
          syncState: "synced",
          tiendaId: venta.tiendaId,
          total: venta.total,
          totalcash: venta.totalcash,
          totaltransfer: venta.totaltransfer,
          usuarioId: venta.usuarioId,
          dbId: venta.id,
          productos: venta.productos.map((p) => {
            return {
              name: p.name,
              cantidad: p.cantidad,
              productId: p.id,
              productoTiendaId: p.productoTiendaId,
            };
          }),
        };
        return sale;
      });
      synchronizeSales(salesSust);
      setOffline(false);
    } catch (error) {
      if (error && error.code && error.code === "ERR_NETWORK") {
        setOffline(true);
        showMessage("Ocurrió un error de red al sincronizar", "warning", error);
      } else {
        showMessage("Ocurrió un error al sincrinozar los datos con el servidor", 'error', error);
      }
    } finally {
      setDisableAll(false);
    }
  };

  useEffect(() => {
    (async () => {
      await syncronizeProdsAndSales();
    })();
  }, [showSales]);

  return (
    <>
      <Drawer anchor="bottom" open={showSales} onClose={handleClose}>
        <Box
          sx={{
            width: "100vw",
            p: 2,
            display: "flex",
            flexDirection: "column",
            height: "100vh",
          }}
        >
          <Box
            display={"flex"}
            flexDirection={"row"}
            justifyContent={"space-between"}
            alignItems={"center"}
          >
            {sales.length > 0 ? (
              <Chip
                label={offline ? `Desconectado` : "Conectado!"}
                onDelete={() => {}}
                deleteIcon={offline ? <WifiOff /> : <Wifi />}
                color={offline ? "warning" : "success"}
              />
            ) : (
              <Box />
            )}
            <IconButton
              onClick={handleClose}
              color="default"
            >
              <Close />
            </IconButton>
          </Box>

          {sales.filter((s) => !s.synced).length > 0 && (
            <Box
              sx={{ mt: 2 }}
              display={"flex"}
              flexDirection={"row"}
              justifyContent={"space-around"}
              gap={2}
            >
              <Button
                variant="contained"
                color="primary"
                onClick={handleSyncAll}
                disabled={disableAll}
                startIcon={<CloudUpload />}
              >
                Sincronizar todos
              </Button>
            </Box>
          )}

          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell align="right">
                    <b>Efectivo</b>
                  </TableCell>
                  <TableCell align="right">
                    <b>Transf</b>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sales
                  // .filter((s) => !s.synced)
                  .sort((a, b) => {
                    if (!a.synced && b.synced) {
                      return -1;
                    }
                    if (a.synced && !b.synced) {
                      return 1;
                    }
                    return 0;
                  })
                  .map((s, index) => {
                    return (
                      <>
                        <TableRow sx={{ borderColor: "Highlight" }}>
                          <TableCell>
                            <Box
                              display={"flex"}
                              flexDirection={"row"}
                              justifyContent={"space-between"}
                              alignContent={"center"}
                            >
                              {s.synced ? (
                                <Sync fontSize="small" color="success" />
                              ) : (
                                <SyncDisabled
                                  fontSize="small"
                                  color="warning"
                                />
                              )}

                              {`#${index + 1}`}
                            </Box>
                          </TableCell>
                          <TableCell align="right">${s.totalcash}</TableCell>
                          <TableCell align="right">
                            ${s.totaltransfer}
                          </TableCell>
                        </TableRow>
                        <TableRow
                          sx={{
                            "&:last-child td, &:last-child th": { border: 0 },
                          }}
                        >
                          <TableCell align="right">Total:</TableCell>
                          <TableCell align="right">
                            <Typography variant="h6">${s.total}</Typography>
                          </TableCell>
                          <TableCell>
                            <Box
                              width={"100%"}
                              display={"flex"}
                              flexDirection={"row"}
                              justifyContent={"space-around"}
                              alignItems={"center"}
                            >
                              <IconButton
                                aria-label="view"
                                color="default"
                                onClick={() => handleSelectViewSale(s)}
                                disabled={disableAll}
                              >
                                <VisibilityIcon />
                              </IconButton>

                              {s.syncState === "syncing" ? (
                                <CircularProgress size="24px" />
                              ) : (
                                <IconButton
                                  aria-label="sync"
                                  color="primary"
                                  onClick={() => handleSyncOne(s)}
                                  disabled={disableAll || s.synced}
                                >
                                  {s.synced ? <Done /> : <Sync />}
                                </IconButton>
                              )}

                              <IconButton
                                aria-label="delete"
                                color="error"
                                onClick={() => handleDeleteOne(s)}
                                disabled={disableAll || (offline && s.synced)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ backgroundColor: "ButtonFace" }}>
                          <TableCell colSpan={4}></TableCell>
                        </TableRow>
                      </>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Drawer>

      {selectedSale && (
        <ProducsSalesDrawer
          setShowProducts={setShowProducts}
          showProducts={showProducts}
          productos={selectedSale.productos.map((p) => ({
            id: p.productId,
            nombre: p.name,
            cantVendida: p.cantidad,
          }))}
        />
      )}

      {ConfirmDialogComponent}
    </>
  );
};
