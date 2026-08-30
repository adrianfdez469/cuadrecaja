"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { Refresh, PlayArrow, Close } from "@mui/icons-material";
import { PageContainer } from "@/components/PageContainer";
import { StatStrip } from "@/components/StatStrip";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import {
  formatDate,
  formatDaysRemaining,
  getDaysRemainingColor,
} from "@/utils/formatters";
import { useRouter } from "next/navigation";
import { SubscriptionService } from "@/services/subscriptionService";
import { getNegocios } from "@/services/negocioServce";
import useConfirmDialog from "@/components/confirmDialog";
import dayjs from "dayjs";

interface NegocioSuspension {
  id: string;
  nombre: string;
  limitTime: Date;
  suspended: boolean;
  suspendedAt?: Date;
  isActive: boolean;
  daysRemaining: number;
  isExpired: boolean;
  canRenew: boolean;
  gracePeriodDays: number;
  stats?: {
    tiendas: number;
    usuarios: number;
    productos: number;
  };
}

interface SuspensionStats {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  gracePeriod: number;
}

export default function SuspensionesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const router = useRouter();

  const [negocios, setNegocios] = useState<NegocioSuspension[]>([]);
  const [stats, setStats] = useState<SuspensionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [managingDays, setManagingDays] = useState<string | null>(null);

  const [reactivateDialog, setReactivateDialog] = useState<{
    open: boolean;
    negocio: NegocioSuspension | null;
    daysToAdd: number;
    useSpecificDate: boolean;
    specificDate: string;
  }>({
    open: false,
    negocio: null,
    daysToAdd: 30,
    useSpecificDate: false,
    specificDate: "",
  });

  const [manageDaysDialog, setManageDaysDialog] = useState<{
    open: boolean;
    negocio: NegocioSuspension | null;
    daysToAdd: number;
    useSpecificDate: boolean;
    specificDate: string;
  }>({
    open: false,
    negocio: null,
    daysToAdd: 30,
    useSpecificDate: false,
    specificDate: "",
  });
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();

  // Protección: Solo SUPER_ADMIN puede acceder
  useEffect(() => {
    if (!loadingContext && user) {
      //   if (user.rol !== "SUPER_ADMIN") {
      //     showMessage("No tienes permisos para acceder a la gestión de suspensiones", "error");
      //     router.push("/");
      //     return;
      //   }
    }
  }, [user, loadingContext, router, showMessage]);

  const fetchNegocios = async () => {
    if (!user || user.rol !== "SUPER_ADMIN") return;

    setLoading(true);
    try {
      // Obtener estadísticas generales
      const stats = await SubscriptionService.getSubscriptionStats();
      setStats(stats);

      // Obtener lista de negocios con estado de suscripción
      const negociosData = await getNegocios();

      // Obtener estado de suscripción para cada negocio
      const negociosConEstado = await Promise.all(
        negociosData.map(async (negocio) => {
          try {
            const status = await SubscriptionService.getSubscriptionStatus(
              negocio.id,
            );
            return {
              ...negocio,
              ...status,
            };
          } catch (error) {
            console.error(
              `Error al obtener estado de ${negocio.nombre}:`,
              error,
            );
            return {
              ...negocio,
              isActive: true,
              daysRemaining: 999,
              isExpired: false,
              isSuspended: false,
              canRenew: false,
              gracePeriodDays: 7,
            };
          }
        }),
      );

      setNegocios(negociosConEstado as unknown as NegocioSuspension[]);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      showMessage("Error al cargar los datos de suspensiones", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.rol === "SUPER_ADMIN") {
      fetchNegocios();
    }
  }, [user]);

  const handleReactivar = async (negocio: NegocioSuspension) => {
    setReactivateDialog({
      open: true,
      negocio,
      daysToAdd: 30,
      useSpecificDate: false,
      specificDate: dayjs().add(30, "day").format("YYYY-MM-DD"),
    });
  };

  const handleActivar = async (negocio: NegocioSuspension) => {
    setActivating(negocio.id);
    try {
      await SubscriptionService.activateBusiness(negocio.id);
      showMessage(`Negocio ${negocio.nombre} activado exitosamente`, "success");
      fetchNegocios();
    } catch (error) {
      console.error("Error al activar:", error);
      showMessage("Error al activar el negocio", "error");
    } finally {
      setActivating(null);
    }
  };

  const handleManageDays = async (negocio: NegocioSuspension) => {
    setManageDaysDialog({
      open: true,
      negocio,
      daysToAdd: 30,
      useSpecificDate: false,
      specificDate: dayjs(negocio.limitTime)
        .add(30, "day")
        .format("YYYY-MM-DD"),
    });
  };

  const confirmReactivar = async () => {
    if (!reactivateDialog.negocio) return;

    setReactivating(reactivateDialog.negocio.id);
    try {
      const payload: { specificDate?: string; daysToAdd?: number } = {};

      if (reactivateDialog.useSpecificDate) {
        payload.specificDate = reactivateDialog.specificDate;
      } else {
        payload.daysToAdd = reactivateDialog.daysToAdd;
      }

      await SubscriptionService.reactivateBusiness(
        reactivateDialog.negocio.id,
        payload,
      );

      showMessage(
        `Negocio ${reactivateDialog.negocio.nombre} reactivado exitosamente`,
        "success",
      );
      setReactivateDialog({
        open: false,
        negocio: null,
        daysToAdd: 30,
        useSpecificDate: false,
        specificDate: "",
      });
      fetchNegocios(); // Recargar datos
    } catch (error) {
      console.error("Error al reactivar:", error);
      showMessage("Error al reactivar el negocio", "error");
    } finally {
      setReactivating(null);
    }
  };

  const confirmManageDays = async () => {
    if (!manageDaysDialog.negocio) return;

    setManagingDays(manageDaysDialog.negocio.id);
    try {
      if (manageDaysDialog.useSpecificDate) {
        // Usar API de establecer fecha específica
        await SubscriptionService.setExpirationDate(
          manageDaysDialog.negocio.id,
          new Date(manageDaysDialog.specificDate),
        );
      } else {
        await SubscriptionService.extendSubscription(
          manageDaysDialog.negocio.id,
          manageDaysDialog.daysToAdd,
        );
      }

      showMessage(
        `Suscripción del negocio ${manageDaysDialog.negocio.nombre} actualizada exitosamente`,
        "success",
      );
      setManageDaysDialog({
        open: false,
        negocio: null,
        daysToAdd: 30,
        useSpecificDate: false,
        specificDate: "",
      });
      fetchNegocios(); // Recargar datos
    } catch (error) {
      console.error("Error al gestionar días:", error);
      showMessage("Error al actualizar la suscripción", "error");
    } finally {
      setManagingDays(null);
    }
  };

  const handleSuspender = async (negocio: NegocioSuspension) => {
    confirmDialog(
      `¿Estás seguro de que quieres suspender el negocio ${negocio.nombre}?`,
      async () => {
        try {
          await SubscriptionService.suspendBusiness(negocio.id);
          showMessage(
            `Negocio ${negocio.nombre} suspendido exitosamente`,
            "success",
          );
          fetchNegocios(); // Recargar datos
        } catch (error) {
          console.error("Error al suspender:", error);
          showMessage("Error al suspender el negocio", "error");
        }
      },
      undefined,
      { severity: "warning" },
    );
  };

  const getStatusColor = (negocio: NegocioSuspension) => {
    if (negocio.suspended) return "error";
    if (negocio.isExpired) return "warning";
    if (negocio.daysRemaining <= 7) return "warning";
    return "success";
  };

  const getStatusText = (negocio: NegocioSuspension) => {
    if (negocio.suspended) return "Suspendido";
    if (negocio.isExpired) return "En gracia";
    if (negocio.daysRemaining <= 7) return "Por vencer";
    return "Activo";
  };

  // Named text buttons instead of a pair of twin icons behind a tooltip —
  // and "Suspender" reads as the destructive action it is, "Activar sin
  // cambiar fecha" as the quiet one. Shared by the desktop row and the
  // mobile card so the two action sets never drift apart.
  const renderNegocioActions = (negocio: NegocioSuspension) =>
    negocio.suspended ? (
      <>
        <Button
          variant="text"
          size="small"
          onClick={() => handleReactivar(negocio)}
          disabled={reactivating === negocio.id}
          sx={{ minWidth: "44px", minHeight: "44px" }}
        >
          {reactivating === negocio.id ? (
            <CircularProgress size={16} />
          ) : (
            "Reactivar"
          )}
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => handleActivar(negocio)}
          disabled={activating === negocio.id}
          sx={{ minWidth: "44px", minHeight: "44px", color: "text.secondary" }}
        >
          {activating === negocio.id ? (
            <CircularProgress size={16} />
          ) : (
            "Activar sin cambiar fecha"
          )}
        </Button>
      </>
    ) : (
      <>
        <Button
          variant="text"
          size="small"
          color="error"
          onClick={() => handleSuspender(negocio)}
          sx={{ minWidth: "44px", minHeight: "44px" }}
        >
          Suspender
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => handleManageDays(negocio)}
          disabled={managingDays === negocio.id}
          sx={{ minWidth: "44px", minHeight: "44px" }}
        >
          {managingDays === negocio.id ? (
            <CircularProgress size={16} />
          ) : (
            "Gestionar"
          )}
        </Button>
      </>
    );

  const breadcrumbs = [
    { label: "Configuración", path: "/configuracion" },
    { label: "Suspensiones", path: "/configuracion/suspensiones" },
  ];

  const runVerification = () => {
    SubscriptionService.checkAndProcessSuspensions()
      .then(() => {
        showMessage("Verificación de suspensiones ejecutada", "success");
        fetchNegocios();
      })
      .catch(() => {
        showMessage("Error al ejecutar verificación", "error");
      });
  };

  const verificacionButton = (
    <Button
      variant="contained"
      startIcon={<PlayArrow />}
      onClick={runVerification}
      size="small"
      fullWidth={isMobile}
    >
      Ejecutar Verificación
    </Button>
  );

  // The mockup's header only has room for the bare refresh icon — the
  // long-label "Ejecutar Verificación" button was overlapping the
  // two-line title on a phone. It moves to a full-width button in the
  // content instead, same pattern as `gastos`/`inventario`.
  const headerActions = (
    <Stack direction="row" spacing={1} alignItems="center">
      <Tooltip title="Actualizar datos">
        <IconButton onClick={fetchNegocios} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
      {!isMobile && verificacionButton}
    </Stack>
  );

  if (loadingContext || loading) {
    return (
      <PageContainer
        title="Gestión de Suspensiones"
        subtitle="Administra las suspensiones de negocios"
        breadcrumbs={breadcrumbs}
        headerActions={headerActions}
      >
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="200px"
        >
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Cargando...
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  if (!user || user.rol !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <PageContainer
      title="Gestión de Suspensiones"
      subtitle="Administra las suspensiones de negocios"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
    >
      {isMobile && <Box sx={{ mb: 3 }}>{verificacionButton}</Box>}

      {/* Estadísticas Generales — mismo StatStrip que usa el resto del
          sistema para estas cuatro cifras, en vez de cuatro Card con
          ícono decorativo (el mockup no dibuja ninguno). */}
      {stats && (
        <StatStrip
          variant="card"
          stats={[
            { label: "Total Negocios", value: stats.total },
            {
              label: "Activos",
              value: stats.active,
              tone: "positive",
            },
            {
              label: "En Gracia",
              value: stats.expired,
              tone: "caution",
            },
            {
              label: "Suspendidos",
              value: stats.suspended,
              tone: "negative",
            },
          ]}
        />
      )}

      {/* Tabla de Negocios */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Estado de Negocios
          </Typography>

          {isMobile ? (
            <Stack spacing={1.5}>
              {negocios.map((negocio) => (
                <Box
                  key={negocio.id}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 3,
                    p: 2,
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={1}
                  >
                    <Typography variant="subtitle1" fontWeight={700}>
                      {negocio.nombre}
                    </Typography>
                    <Chip
                      label={getStatusText(negocio)}
                      color={getStatusColor(negocio)}
                      size="small"
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    color={getDaysRemainingColor(negocio.daysRemaining)}
                    sx={{ mt: 0.5 }}
                  >
                    {formatDaysRemaining(negocio.daysRemaining)} ·{" "}
                    {formatDate(negocio.limitTime)}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    sx={{ mt: 1 }}
                  >
                    {renderNegocioActions(negocio)}
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Negocio</TableCell>
                    <TableCell align="center">Estado</TableCell>
                    <TableCell align="center">Días Restantes</TableCell>
                    <TableCell>Vencimiento</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {negocios.map((negocio) => (
                    <TableRow key={negocio.id}>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {negocio.nombre}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={getStatusText(negocio)}
                          color={getStatusColor(negocio)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          color={getDaysRemainingColor(negocio.daysRemaining)}
                        >
                          {formatDaysRemaining(negocio.daysRemaining)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(negocio.limitTime)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                          flexWrap="wrap"
                        >
                          {renderNegocioActions(negocio)}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Reactivación */}
      <Dialog
        open={reactivateDialog.open}
        onClose={() =>
          setReactivateDialog({
            open: false,
            negocio: null,
            daysToAdd: 30,
            useSpecificDate: false,
            specificDate: "",
          })
        }
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          Reactivar Negocio
          {isMobile && (
            <IconButton
              onClick={() =>
                setReactivateDialog({
                  open: false,
                  negocio: null,
                  daysToAdd: 30,
                  useSpecificDate: false,
                  specificDate: "",
                })
              }
            >
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography>
              ¿Estás seguro de que quieres reactivar el negocio{" "}
              <strong>{reactivateDialog.negocio?.nombre}</strong>?
            </Typography>

            <FormControl fullWidth>
              <InputLabel>Método de reactivación</InputLabel>
              <Select
                value={reactivateDialog.useSpecificDate ? "date" : "days"}
                onChange={(e) =>
                  setReactivateDialog((prev) => ({
                    ...prev,
                    useSpecificDate: e.target.value === "date",
                  }))
                }
                label="Método de reactivación"
              >
                <MenuItem value="days">Agregar días</MenuItem>
                <MenuItem value="date">Fecha específica</MenuItem>
              </Select>
            </FormControl>

            {reactivateDialog.useSpecificDate ? (
              <TextField
                fullWidth
                label="Fecha de expiración"
                type="date"
                value={reactivateDialog.specificDate}
                onChange={(e) =>
                  setReactivateDialog((prev) => ({
                    ...prev,
                    specificDate: e.target.value,
                  }))
                }
                InputLabelProps={{ shrink: true }}
              />
            ) : (
              <FormControl fullWidth>
                <InputLabel>Días a agregar</InputLabel>
                <Select
                  value={reactivateDialog.daysToAdd}
                  onChange={(e) =>
                    setReactivateDialog((prev) => ({
                      ...prev,
                      daysToAdd: e.target.value as number,
                    }))
                  }
                  label="Días a agregar"
                >
                  <MenuItem value={7}>7 días</MenuItem>
                  <MenuItem value={15}>15 días</MenuItem>
                  <MenuItem value={30}>30 días</MenuItem>
                  <MenuItem value={60}>60 días</MenuItem>
                  <MenuItem value={90}>90 días</MenuItem>
                </Select>
              </FormControl>
            )}

            <Typography variant="body2" color="text.secondary">
              Nueva fecha de expiración:{" "}
              <strong>
                {reactivateDialog.useSpecificDate
                  ? reactivateDialog.specificDate
                    ? dayjs(reactivateDialog.specificDate).format("DD/MM/YYYY")
                    : "Seleccionar fecha"
                  : dayjs(reactivateDialog.negocio?.limitTime)
                      .add(reactivateDialog.daysToAdd, "day")
                      .format("DD/MM/YYYY")}
              </strong>
            </Typography>

            <Alert severity="info">
              Al reactivar el negocio, todos los usuarios podrán acceder al
              sistema nuevamente.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: isMobile ? "column-reverse" : "row",
            alignItems: "stretch",
          }}
        >
          <Button
            onClick={() =>
              setReactivateDialog({
                open: false,
                negocio: null,
                daysToAdd: 30,
                useSpecificDate: false,
                specificDate: "",
              })
            }
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : undefined }}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmReactivar}
            variant="contained"
            disabled={reactivating !== null}
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: isMobile ? 56 : undefined }}
          >
            {reactivating ? "Reactivando..." : "Reactivar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Gestión de Días/Fecha */}
      <Dialog
        open={manageDaysDialog.open}
        onClose={() =>
          setManageDaysDialog({
            open: false,
            negocio: null,
            daysToAdd: 30,
            useSpecificDate: false,
            specificDate: "",
          })
        }
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          Gestionar Suscripción
          {isMobile && (
            <IconButton
              onClick={() =>
                setManageDaysDialog({
                  open: false,
                  negocio: null,
                  daysToAdd: 30,
                  useSpecificDate: false,
                  specificDate: "",
                })
              }
            >
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography>
              Gestionar la suscripción del negocio{" "}
              <strong>{manageDaysDialog.negocio?.nombre}</strong>
            </Typography>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Fecha actual de expiración:{" "}
                <strong>
                  {manageDaysDialog.negocio?.limitTime
                    ? dayjs(manageDaysDialog.negocio.limitTime).format(
                        "DD/MM/YYYY",
                      )
                    : "-"}
                </strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Días restantes:{" "}
                <strong>{manageDaysDialog.negocio?.daysRemaining || 0}</strong>
              </Typography>
            </Box>

            <Divider />

            <FormControl fullWidth>
              <InputLabel>Método</InputLabel>
              <Select
                value={manageDaysDialog.useSpecificDate ? "date" : "days"}
                onChange={(e) =>
                  setManageDaysDialog((prev) => ({
                    ...prev,
                    useSpecificDate: e.target.value === "date",
                  }))
                }
                label="Método"
              >
                <MenuItem value="days">Agregar días</MenuItem>
                <MenuItem value="date">Establecer fecha específica</MenuItem>
              </Select>
            </FormControl>

            {manageDaysDialog.useSpecificDate ? (
              <TextField
                fullWidth
                label="Nueva fecha de expiración"
                type="date"
                value={manageDaysDialog.specificDate}
                onChange={(e) =>
                  setManageDaysDialog((prev) => ({
                    ...prev,
                    specificDate: e.target.value,
                  }))
                }
                InputLabelProps={{ shrink: true }}
              />
            ) : (
              <FormControl fullWidth>
                <InputLabel>Días a agregar</InputLabel>
                <Select
                  value={manageDaysDialog.daysToAdd}
                  onChange={(e) =>
                    setManageDaysDialog((prev) => ({
                      ...prev,
                      daysToAdd: e.target.value as number,
                    }))
                  }
                  label="Días a agregar"
                >
                  <MenuItem value={7}>7 días</MenuItem>
                  <MenuItem value={15}>15 días</MenuItem>
                  <MenuItem value={30}>30 días</MenuItem>
                  <MenuItem value={60}>60 días</MenuItem>
                  <MenuItem value={90}>90 días</MenuItem>
                  <MenuItem value={180}>6 meses</MenuItem>
                  <MenuItem value={365}>1 año</MenuItem>
                </Select>
              </FormControl>
            )}

            <Typography variant="body2" color="primary">
              Nueva fecha de expiración:{" "}
              <strong>
                {manageDaysDialog.useSpecificDate
                  ? manageDaysDialog.specificDate
                    ? dayjs(manageDaysDialog.specificDate).format("DD/MM/YYYY")
                    : "Seleccionar fecha"
                  : dayjs(manageDaysDialog.negocio?.limitTime)
                      .add(manageDaysDialog.daysToAdd, "day")
                      .format("DD/MM/YYYY")}
              </strong>
            </Typography>

            <Alert severity="info">
              Esta acción actualizará la fecha de expiración del negocio y lo
              mantendrá activo si estaba suspendido.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: isMobile ? "column-reverse" : "row",
            alignItems: "stretch",
          }}
        >
          <Button
            onClick={() =>
              setManageDaysDialog({
                open: false,
                negocio: null,
                daysToAdd: 30,
                useSpecificDate: false,
                specificDate: "",
              })
            }
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : undefined }}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmManageDays}
            variant="contained"
            disabled={managingDays !== null}
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: isMobile ? 56 : undefined }}
          >
            {managingDays ? "Actualizando..." : "Actualizar"}
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
