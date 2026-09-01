"use client";

import { useAppContext } from "@/context/AppContext";
import {
  CircularProgress,
  Typography,
  Box,
  Button,
  Container,
  Paper,
  Avatar,
  Alert,
} from "@mui/material";
import {
  Storefront,
  Inventory,
  AccountBalanceWallet,
  Receipt,
  BarChart,
  Settings,
  Person,
  Store,
  Summarize,
  Security,
  Backup,
  WorkspacePremium,
} from "@mui/icons-material";
import { useMessageContext } from "@/context/MessageContext";
import { useRouter } from "next/navigation";
import { TipoLocal } from "@/schemas/tienda";
import { excludeOnWarehouse } from "@/utils/excludeOnWarehouse";
import { usePermisos } from "@/utils/permisos_front";
import { SectionLabel } from "@/components/SectionLabel";
import { shape } from "@/theme/tokens";
import { QuickActionTile } from "./components/QuickActionTile";
import { ConfigRow } from "./components/ConfigRow";
import { PlanLimitsStrip } from "./components/PlanLimitsStrip";
import type { NegocioStats } from "./components/PlanLimitsStrip";
import SuspensionSummary from "@/components/SuspensionSummary";
import ConsolidatedAlertBanner from "@/components/ConsolidatedAlertBanner";
import AlertSummaryRows from "@/components/AlertSummaryRows";
import { useEffect, useState } from "react";
import { getNegocioStats } from "@/services/negocioServce";

const HomePage = () => {
  const { loadingContext, user } = useAppContext();
  const router = useRouter();
  const { verificarPermiso } = usePermisos();
  const { showMessage } = useMessageContext();
  const [loadingNegocioStats, setLoadingNegocioStats] = useState(true);
  const [negocioStats, setNegocioStats] = useState<NegocioStats>();
  const [generatingBackup, setGeneratingBackup] = useState(false);

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const handleGenerateBackup = async () => {
    try {
      setGeneratingBackup(true);
      showMessage("Generando backup de la base de datos...", "info");

      const response = await fetch("/api/backup/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al generar backup");
      }

      showMessage("Backup generado exitosamente", "success");
    } catch (error) {
      console.error("Error al generar backup:", error);
      showMessage(
        `Error al generar backup: ${error instanceof Error ? error.message : "Error desconocido"}`,
        "error",
      );
    } finally {
      setGeneratingBackup(false);
    }
  };

  useEffect(() => {
    const fetchNegocioStats = async () => {
      setLoadingNegocioStats(true);
      try {
        const stats = await getNegocioStats();
        setNegocioStats(stats);
      } catch (error) {
        console.error("Error al cargar estadisticas del negocio:", error);
      } finally {
        setLoadingNegocioStats(false);
      }
    };
    fetchNegocioStats();
  }, [user?.negocio?.id]);

  if (loadingContext) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size="3rem" />
        <Typography variant="body1" color="text.secondary">
          Cargando panel de control...
        </Typography>
      </Box>
    );
  }

  if (user.locales.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            textAlign: "center",
            backgroundColor: "background.paper",
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Avatar
            sx={{
              width: 80,
              height: 80,
              mx: "auto",
              mb: 3,
              bgcolor: "primary.main",
            }}
          >
            <Store fontSize="large" />
          </Avatar>

          <Typography variant="h4" gutterBottom color="text.primary">
            ¡Bienvenido a Cuadre de Caja!
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 3, maxWidth: 500, mx: "auto" }}
          >
            Para comenzar a usar el sistema, necesitas tener al menos un local
            asociada a tu usuario. Contacta al administrador para que configure
            tu acceso.
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Estado:</strong> Usuario sin locales asociadas
            </Typography>
          </Alert>

          <Button
            variant="contained"
            size="large"
            startIcon={<Settings />}
            onClick={() => handleNavigate("/configuracion")}
            sx={{ minWidth: 200 }}
          >
            Ir a Configuración
          </Button>
        </Paper>
      </Container>
    );
  }

  // if (!user.tieaActual) {
  if (!user.localActual) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Selecciona un local desde el menú de usuario para continuar
        </Alert>
      </Container>
    );
  }

  const quickActions = [
    {
      title: "Punto de Venta",
      description: "Realizar ventas y gestionar transacciones",
      icon: <Storefront fontSize="large" />,
      color: "primary" as const,
      path: "/pos",
      permission: "operaciones.pos-venta.acceder",
    },
    {
      title: "Inventario",
      description: "Gestionar productos, stock y precios",
      icon: <Inventory fontSize="large" />,
      color: "success" as const,
      path: "/inventario",
      permission: "operaciones.inventario.acceder",
    },
    {
      title: "Ventas",
      description: "Revisar historial de ventas",
      icon: <Receipt fontSize="large" />,
      // Not `secondary`: that is now the charge bar's ink, and the direction
      // spends it on exactly one thing. A category tint would be the second.
      color: "info" as const,
      path: "/ventas",
      permission: "operaciones.ventas.acceder",
    },
    {
      title: "Cierre de Caja",
      description: "Cerrar período y generar reportes",
      icon: <AccountBalanceWallet fontSize="large" />,
      color: "warning" as const,
      path: "/cierre",
      permission: "operaciones.cierre.acceder",
    },
    {
      title: "Resumen Cierres",
      description: "Ver historial de cierres",
      icon: <Summarize fontSize="large" />,
      color: "default" as const,
      path: "/resumen_cierre",
      permission: "recuperaciones.resumencierres.acceder",
    },
  ];

  const configOptions = [
    {
      title: "Categorías",
      icon: <BarChart />,
      path: "/configuracion/categorias",
      permission: "configuracion.categorias.acceder",
    },
    {
      title: "Locales",
      icon: <Store />,
      path: "/configuracion/locales",
      permission: "configuracion.locales.acceder",
    },
    {
      title: "Usuarios",
      icon: <Person />,
      path: "/configuracion/usuarios",
      permission: "configuracion.usuarios.acceder",
    },
    {
      title: "Roles",
      icon: <Security />,
      path: "/configuracion/roles",
      permission: "configuracion.roles.acceder",
    },
    {
      title: "Planes",
      icon: <WorkspacePremium />,
      path: "/configuracion/planes-admin",
      permission: "SUPER_ADMIN_ONLY",
    },
  ];

  const getQuickAction = (localType: string) => {
    return quickActions.filter((item) => {
      if (
        //user.permisos.includes(item.permission)
        verificarPermiso(item.permission) ||
        user.rol === "SUPER_ADMIN"
      ) {
        if (localType === TipoLocal.ALMACEN) {
          return !excludeOnWarehouse.includes(item.path);
        }
        return true;
      }
    });
  };

  // Punto de Venta is the hero when the user can actually reach it; otherwise
  // the row is just the tiles the permissions left behind.
  const visibleActions = getQuickAction(user.localActual.tipo);
  const heroAction = visibleActions.find((a) => a.path === "/pos");
  // Resumen Cierres is a lookup, not an operation: on desktop the design pulls
  // it out of the grid into a single inline row so the four tiles above stay a
  // clean row of four. On a phone the tiles are already a list, so it just
  // joins the end of it.
  const standardActions = visibleActions.filter(
    (a) => a.path !== "/pos" && a.path !== "/resumen_cierre",
  );
  const resumenAction = visibleActions.find(
    (a) => a.path === "/resumen_cierre",
  );

  const getConfigOptions = () => {
    return configOptions.filter((item) => {
      if (item.permission === "SUPER_ADMIN_ONLY")
        return user.rol === "SUPER_ADMIN";
      if (
        //user.permisos.includes(item.permission)
        verificarPermiso(item.permission) ||
        user.rol === "SUPER_ADMIN"
      ) {
        return true;
      }
    });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {/* Header mejorado */}
      <Box sx={{ mb: 4 }}>
        <Box
          display="flex"
          flexDirection={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "flex-start" }}
          gap={{ xs: 3, md: 0 }}
          mb={2}
        >
          <Box>
            {/* Which business and store you are looking at, as one quiet line.
                It was a filled violet panel on the right — the loudest thing on
                the screen for a fact you only need to confirm. */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 0.75 }}
            >
              {[user.negocio?.nombre, user.localActual?.nombre]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
            <Typography
              variant="h1"
              sx={{ fontSize: { xs: "1.625rem", md: "2.125rem" } }}
            >
              Bienvenido, {user.nombre || user.usuario}
            </Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 2,
              width: { xs: "100%", md: "auto" },
            }}
          >
            {/* Botón de Backup - Solo SUPER_ADMIN */}
            {user.rol === "SUPER_ADMIN" && (
              // A maintenance action, not the point of the screen: it stops
              // being a filled orange button competing with the title next to
              // it and becomes the same quiet outlined control as everywhere
              // else. Nothing about a backup is a warning.
              <Button
                variant="outlined"
                color="inherit"
                startIcon={
                  generatingBackup ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <Backup />
                  )
                }
                onClick={handleGenerateBackup}
                disabled={generatingBackup}
                sx={{
                  height: "fit-content",
                  alignSelf: { xs: "stretch", md: "center" },
                  px: 2,
                  color: "text.secondary",
                  borderColor: "divider",
                  "@media (hover: hover)": {
                    "&:hover": {
                      borderColor: "semantic.surface.borderStrong",
                      color: "text.primary",
                    },
                  },
                }}
              >
                {generatingBackup ? "Generando Backup..." : "Generar Backup BD"}
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Consolidated alert banner: only shows if there's something urgent */}
      <ConsolidatedAlertBanner tiendaId={user.localActual?.id} />

      {/* Acciones rápidas */}
      <Box sx={{ mb: 5 }}>
        <SectionLabel>Operación</SectionLabel>

        {/* Punto de Venta is the one action this screen exists to launch, so it
            is the only one that gets colour and the widest column. The four
            tiles used to be five equally-loud gradients, which ranked nothing. */}
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              md: heroAction ? "1.45fr 1fr 1fr 1fr" : "repeat(4, 1fr)",
            },
          }}
        >
          {heroAction && (
            <QuickActionTile
              variant="hero"
              title={heroAction.title}
              description={heroAction.description}
              icon={heroAction.icon}
              onClick={() => handleNavigate(heroAction.path)}
            />
          )}
          {standardActions.map((action) => (
            <QuickActionTile
              key={action.path}
              title={action.title}
              description={action.description}
              icon={action.icon}
              onClick={() => handleNavigate(action.path)}
              trailing={
                action.path === "/inventario" &&
                !loadingNegocioStats &&
                negocioStats ? (
                  <Box
                    sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}
                  >
                    <Typography
                      sx={{
                        fontSize: "1.1875rem",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {negocioStats.productos.actual}
                    </Typography>
                    <Typography
                      sx={{ fontSize: "0.8125rem", color: "text.secondary" }}
                    >
                      productos
                    </Typography>
                  </Box>
                ) : undefined
              }
            />
          ))}
          {resumenAction && (
            <Box sx={{ display: { xs: "block", md: "none" } }}>
              <QuickActionTile
                title={resumenAction.title}
                description={resumenAction.description}
                icon={resumenAction.icon}
                onClick={() => handleNavigate(resumenAction.path)}
              />
            </Box>
          )}
        </Box>

        {resumenAction && (
          <Box sx={{ display: { xs: "none", md: "block" }, mt: 1.5 }}>
            <ConfigRow
              title={resumenAction.title}
              icon={resumenAction.icon}
              onClick={() => handleNavigate(resumenAction.path)}
            />
          </Box>
        )}
      </Box>

      {/* Suscripción */}
      <Box sx={{ mb: 5 }}>
        <SectionLabel>Suscripción</SectionLabel>
        {/* The limits close the panel: they describe the plan above them, and
            the expiry is the one figure in the line that can go bad. */}
        {user.rol === "SUPER_ADMIN" ? (
          <SuspensionSummary
            footer={
              <PlanLimitsStrip
                stats={negocioStats}
                loading={loadingNegocioStats}
              />
            }
          />
        ) : (
          <Box
            sx={{
              bgcolor: "semantic.surface.raised",
              border: "1px solid",
              borderColor: "semantic.surface.border",
              borderRadius: `${shape.radius.md}px`,
            }}
          >
            <PlanLimitsStrip
              stats={negocioStats}
              loading={loadingNegocioStats}
            />
          </Box>
        )}
      </Box>

      {/* Summary rows: Vencidos and Notificaciones (clickable, compact) */}
      <Box sx={{ mb: 5 }}>
        <AlertSummaryRows tiendaId={user.localActual?.id} />
      </Box>

      {/* Configuración */}
      <Box>
        {getConfigOptions().length > 0 && (
          <>
            <SectionLabel>Configuración del Sistema</SectionLabel>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "1fr 1fr",
                  md: "repeat(5, minmax(0, 1fr))",
                },
              }}
            >
              {getConfigOptions().map((option) => (
                <ConfigRow
                  key={option.path}
                  title={option.title}
                  icon={option.icon}
                  onClick={() => handleNavigate(option.path)}
                />
              ))}
            </Box>
          </>
        )}
      </Box>
    </Container>
  );
};

export default HomePage;
