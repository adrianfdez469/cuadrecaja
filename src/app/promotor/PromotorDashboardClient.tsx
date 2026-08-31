"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Check,
  ContentCopy,
  Facebook,
  Instagram,
  WhatsApp,
} from "@mui/icons-material";
import { PageContainer } from "@/components/PageContainer";
import { StatStrip } from "@/components/StatStrip";
import type { IPromoterDashboardData } from "@/lib/referrals/promoterDashboard";
import { REFERRAL_STATUS } from "@/constants/referrals";

type IPromoterReferralRow = IPromoterDashboardData["referrals"][number];

const COPY_FEEDBACK_MS = 2200;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} USD`;
}

function getReferralStatusColor(
  status: string,
): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case REFERRAL_STATUS.liquidatedManually:
      return "success";
    case REFERRAL_STATUS.liquidationPending:
      return "warning";
    case REFERRAL_STATUS.rejectedFraud:
      return "error";
    case REFERRAL_STATUS.qualified:
      return "info";
    default:
      return "default";
  }
}

export default function PromotorDashboardClient({
  data,
}: {
  data: IPromoterDashboardData;
}) {
  const [referralLandingUrl, setReferralLandingUrl] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [socialHint, setSocialHint] = useState<"instagram" | null>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const code = encodeURIComponent(data.promoter.promoCode);
    setReferralLandingUrl(`${window.location.origin}/?ref=${code}`);
  }, [data.promoter.promoCode]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const scheduleCopyReset = () => {
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => {
      setCopied(null);
      setSocialHint(null);
      copyResetRef.current = null;
    }, COPY_FEEDBACK_MS);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(data.promoter.promoCode);
    setCopied("code");
    scheduleCopyReset();
  };

  const copyReferralLink = async () => {
    if (!referralLandingUrl) return;
    await navigator.clipboard.writeText(referralLandingUrl);
    setCopied("link");
    scheduleCopyReset();
  };

  const shareText =
    "Te comparto Cuadre de Caja, un sistema simple para ventas e inventario de tu negocio.";
  const shareFullText = `${shareText} ${referralLandingUrl}`;
  const encodedLink = encodeURIComponent(referralLandingUrl);
  const encodedShareText = encodeURIComponent(shareFullText);
  const encodedQuote = encodeURIComponent(shareText);

  const handleShareWhatsapp = () => {
    if (!referralLandingUrl) return;
    window.open(
      `https://wa.me/?text=${encodedShareText}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleShareFacebook = () => {
    if (!referralLandingUrl) return;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}&quote=${encodedQuote}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleShareInstagram = async () => {
    if (!referralLandingUrl) return;
    await navigator.clipboard.writeText(shareFullText);
    setSocialHint("instagram");
    scheduleCopyReset();
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  };

  const referralsNormales = data.referrals.filter(
    (r) => r.status !== REFERRAL_STATUS.rejectedFraud,
  );
  const referralsFraude = data.referrals.filter(
    (r) => r.status === REFERRAL_STATUS.rejectedFraud,
  );

  const renderReferralMobileCard = (r: IPromoterReferralRow) => (
    <Paper
      key={r.id}
      elevation={0}
      sx={{
        p: 1.5,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography fontWeight={700}>{r.businessName}</Typography>
      <Box
        sx={{ mt: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}
      >
        <Typography variant="caption" color="text.secondary">
          Estado
        </Typography>
        <Box sx={{ textAlign: "right" }}>
          <Chip
            label={r.statusLabel}
            size="small"
            variant="filled"
            color={getReferralStatusColor(r.status)}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Alta
        </Typography>
        <Typography variant="caption" sx={{ textAlign: "right" }}>
          {formatDate(r.createdAt)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          1er pago
        </Typography>
        <Typography variant="caption" sx={{ textAlign: "right" }}>
          {formatDate(r.firstPaidAt)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Plan
        </Typography>
        <Typography variant="caption" sx={{ textAlign: "right" }}>
          {r.planNombre ?? "—"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Desc. negocio
        </Typography>
        <Typography variant="caption" sx={{ textAlign: "right" }}>
          {formatMoney(r.discountSnapshot)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Tu recompensa
        </Typography>
        <Typography variant="caption" sx={{ textAlign: "right" }}>
          {formatMoney(r.rewardSnapshot)}
        </Typography>
      </Box>
      {r.status === REFERRAL_STATUS.rejectedFraud && (
        <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: "0.75rem" }}>
          No aplica recompensa por detección de fraude. El negocio se creó con
          normalidad.
        </Alert>
      )}
    </Paper>
  );

  const renderReferralTableRow = (r: IPromoterReferralRow) => (
    <TableRow
      key={r.id}
      sx={{
        "&:hover": { bgcolor: "semantic.surface.sunken" },
        "& td": { borderColor: "divider" },
      }}
    >
      <TableCell>
        <Typography fontWeight={600}>{r.businessName}</Typography>
        {r.status === REFERRAL_STATUS.rejectedFraud && (
          <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: "0.75rem" }}>
            No aplica recompensa por detección de fraude. El negocio se creó con
            normalidad.
          </Alert>
        )}
      </TableCell>
      <TableCell>
        <Chip
          label={r.statusLabel}
          size="small"
          variant="filled"
          color={getReferralStatusColor(r.status)}
        />
      </TableCell>
      <TableCell>{formatDate(r.createdAt)}</TableCell>
      <TableCell>{formatDate(r.firstPaidAt)}</TableCell>
      <TableCell>{r.planNombre ?? "—"}</TableCell>
      <TableCell align="right">{formatMoney(r.discountSnapshot)}</TableCell>
      <TableCell align="right">{formatMoney(r.rewardSnapshot)}</TableCell>
    </TableRow>
  );

  const kpiStats = [
    {
      label: "Pendientes de pago",
      value: data.stats.capturados,
      severity: "default",
    },
    {
      label: "Calificados",
      value: data.stats.calificados,
      severity: "info" as const,
    },
    {
      label: "Pend. liquidación",
      value: data.stats.pendientesLiquidacion,
      severity: "warning" as const,
    },
    {
      label: "Liquidados",
      value: data.stats.liquidados,
      severity: "success" as const,
    },
    {
      label: "Fraude",
      value: data.stats.rechazadosFraude,
      severity: "error" as const,
    },
    {
      label: "Cancelados",
      value: data.stats.cancelados,
      severity: "default",
    },
  ];

  const breadcrumbs = [{ label: "Panel de promotor" }];

  return (
    <PageContainer breadcrumbs={breadcrumbs} title="Panel de promotor">
      <Stack spacing={3}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              {data.promoter.fullName} · {data.promoter.email}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              await fetch("/api/promoters/logout", { method: "POST" });
              window.location.href = "/promotor/acceso";
            }}
          >
            Cerrar sesión
          </Button>
        </Box>

        <Card sx={{ p: 2 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Tu código de promoción
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Typography
                  component="code"
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: "primary.main",
                    letterSpacing: 1,
                  }}
                >
                  {data.promoter.promoCode}
                </Typography>
                <Tooltip
                  title={
                    copied === "code"
                      ? "Copiado al portapapeles"
                      : "Copiar código"
                  }
                >
                  <IconButton
                    onClick={copyCode}
                    size="small"
                    sx={{
                      color:
                        copied === "code"
                          ? "semantic.hue.positive.main"
                          : "primary.main",
                      bgcolor:
                        copied === "code"
                          ? "semantic.hue.positive.surface"
                          : "transparent",
                      transition: "color 0.2s ease, background-color 0.2s ease",
                      minHeight: "44px",
                      minWidth: "44px",
                      "&:hover": {
                        bgcolor:
                          copied === "code"
                            ? "semantic.hue.positive.surface"
                            : "semantic.surface.sunken",
                      },
                    }}
                    aria-label="Copiar código de promoción"
                  >
                    {copied === "code" ? (
                      <Check fontSize="small" />
                    ) : (
                      <ContentCopy fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
                {copied === "code" && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      color: "semantic.hue.positive.main",
                      fontWeight: 600,
                    }}
                  >
                    Copiado
                  </Typography>
                )}
              </Box>
            </Box>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Enlace de invitación (landing)
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Typography
                  component="code"
                  sx={{
                    fontFamily: "monospace",
                    fontSize: { xs: "0.85rem", sm: "1rem" },
                    fontWeight: 600,
                    color: "primary.main",
                    letterSpacing: 0.2,
                    wordBreak: "break-all",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {referralLandingUrl || "…"}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                  <Tooltip
                    title={
                      copied === "link"
                        ? "Copiado al portapapeles"
                        : "Copiar enlace"
                    }
                  >
                    <span>
                      <IconButton
                        onClick={copyReferralLink}
                        size="small"
                        disabled={!referralLandingUrl}
                        sx={{
                          color:
                            copied === "link"
                              ? "semantic.hue.positive.main"
                              : "primary.main",
                          bgcolor:
                            copied === "link"
                              ? "semantic.hue.positive.surface"
                              : "transparent",
                          transition:
                            "color 0.2s ease, background-color 0.2s ease",
                          minHeight: "44px",
                          minWidth: "44px",
                          "&:hover": {
                            bgcolor:
                              copied === "link"
                                ? "semantic.hue.positive.surface"
                                : "semantic.surface.sunken",
                          },
                        }}
                        aria-label="Copiar enlace de invitación"
                      >
                        {copied === "link" ? (
                          <Check fontSize="small" />
                        ) : (
                          <ContentCopy fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Compartir por WhatsApp">
                    <span>
                      <IconButton
                        onClick={handleShareWhatsapp}
                        size="small"
                        disabled={!referralLandingUrl}
                        sx={{
                          color: "#25D366",
                          minHeight: "44px",
                          minWidth: "44px",
                          "&:hover": { bgcolor: "semantic.surface.sunken" },
                        }}
                        aria-label="Compartir enlace por WhatsApp"
                      >
                        <WhatsApp fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Compartir por Facebook">
                    <span>
                      <IconButton
                        onClick={handleShareFacebook}
                        size="small"
                        disabled={!referralLandingUrl}
                        sx={{
                          color: "#1877F2",
                          minHeight: "44px",
                          minWidth: "44px",
                          "&:hover": { bgcolor: "semantic.surface.sunken" },
                        }}
                        aria-label="Compartir enlace por Facebook"
                      >
                        <Facebook fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Compartir por Instagram (copia mensaje + link)">
                    <span>
                      <IconButton
                        onClick={handleShareInstagram}
                        size="small"
                        disabled={!referralLandingUrl}
                        sx={{
                          color: "#E4405F",
                          minHeight: "44px",
                          minWidth: "44px",
                          "&:hover": { bgcolor: "semantic.surface.sunken" },
                        }}
                        aria-label="Compartir enlace por Instagram"
                      >
                        <Instagram fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
                {copied === "link" && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      color: "semantic.hue.positive.main",
                      fontWeight: 600,
                    }}
                  >
                    Copiado
                  </Typography>
                )}
                {socialHint === "instagram" && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 500 }}
                  >
                    Texto copiado para Instagram
                  </Typography>
                )}
              </Box>
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 1, color: "text.secondary" }}
              >
                Quien abra el enlace llegará a la página principal con el campo
                de referido rellenado al activar su prueba gratuita. También
                puedes compartir solo el código para que lo introduzcan al darse
                de alta.
              </Typography>
            </Box>
          </Stack>
        </Card>

        <Box>
          <StatStrip stats={kpiStats} />
        </Box>

        <Card>
          <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Negocios referidos
            </Typography>
          </Box>

          <Box sx={{ display: { xs: "block", sm: "none" }, p: 2 }}>
            {data.referrals.length === 0 ? (
              <Typography
                sx={{ color: "text.secondary", py: 2, textAlign: "center" }}
              >
                Aún no hay negocios registrados con tu código.
              </Typography>
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontWeight: 600 }}
                  >
                    Referidos
                  </Typography>
                  {referralsNormales.length === 0 ? (
                    <Typography
                      sx={{
                        color: "text.secondary",
                        py: 1,
                        fontSize: "0.875rem",
                      }}
                    >
                      {referralsFraude.length > 0
                        ? "No hay referidos en esta categoría; los registros actuales están solo en la sección de fraude."
                        : "Ningún referido en esta categoría."}
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      {referralsNormales.map((r) =>
                        renderReferralMobileCard(r),
                      )}
                    </Stack>
                  )}
                </Box>
                {referralsFraude.length > 0 ? (
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        color: "semantic.hue.negative.main",
                        mb: 1,
                        fontWeight: 600,
                      }}
                    >
                      Marcados como fraude
                    </Typography>
                    <Stack spacing={1.5}>
                      {referralsFraude.map((r) => renderReferralMobileCard(r))}
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            )}
          </Box>

          <TableContainer
            sx={{
              display: { xs: "none", sm: "block" },
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "semantic.surface.sunken" }}>
                  <TableCell sx={{ fontWeight: 600 }}>Negocio</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Alta</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>1er pago</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Desc. negocio
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Tu recompensa
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.referrals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      sx={{
                        color: "text.secondary",
                        py: 4,
                        textAlign: "center",
                      }}
                    >
                      Aún no hay negocios registrados con tu código.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {referralsNormales.length > 0 && (
                      <>
                        <TableRow sx={{ bgcolor: "semantic.surface.sunken" }}>
                          <TableCell colSpan={7} sx={{ fontWeight: 600 }}>
                            Referidos
                          </TableCell>
                        </TableRow>
                        {referralsNormales.map((r) =>
                          renderReferralTableRow(r),
                        )}
                      </>
                    )}
                    {referralsNormales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ textAlign: "center" }}>
                          {referralsFraude.length > 0
                            ? "No hay referidos en esta categoría; los registros actuales están solo en la sección de fraude."
                            : "Ningún referido en esta categoría."}
                        </TableCell>
                      </TableRow>
                    )}
                    {referralsFraude.length > 0 && (
                      <>
                        <TableRow
                          sx={{ bgcolor: "semantic.hue.negative.surface" }}
                        >
                          <TableCell
                            colSpan={7}
                            sx={{
                              fontWeight: 600,
                              color: "semantic.hue.negative.main",
                            }}
                          >
                            Marcados como fraude
                          </TableCell>
                        </TableRow>
                        {referralsFraude.map((r) => renderReferralTableRow(r))}
                      </>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Stack>
    </PageContainer>
  );
}
