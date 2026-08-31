"use client";

import React, { useState, useEffect } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import { Warning, Error, ChevronRight } from "@mui/icons-material";
import { useAppContext } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import axiosClient from "@/lib/axiosClient";
import { SubscriptionService } from "@/services/subscriptionService";

interface ConsolidatedAlertBannerProps {
  tiendaId?: string;
}

/**
 * Consolidated alert banner for /home — shows ONLY if there's something urgent.
 *
 * Combines:
 * - Count of suspended/expired businesses (SUPER_ADMIN only)
 * - Count of EXPIRED products (not "por vencer", only vencidos)
 * - Subscription urgency (if applicable)
 *
 * Format: "{N} negocio(s) requiere(n) atención y hay {M} productos vencidos" + link "Revisar"
 */
export default function ConsolidatedAlertBanner({
  tiendaId,
}: ConsolidatedAlertBannerProps) {
  const { user } = useAppContext();
  const router = useRouter();

  const [suspensionCount, setSuspensionCount] = useState(0);
  const [vencidosCount, setVencidosCount] = useState(0);
  const [subscriptionUrgent, setSubscriptionUrgent] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load suspension count (SUPER_ADMIN only)
  useEffect(() => {
    if (user?.rol !== "SUPER_ADMIN") {
      setSuspensionCount(0);
    } else {
      SubscriptionService.getSubscriptionStats()
        .then((stats) => {
          // Count suspended + expired businesses
          setSuspensionCount((stats.suspended || 0) + (stats.expired || 0));
        })
        .catch(() => setSuspensionCount(0));
    }
  }, [user?.rol]);

  // Load expired products count
  useEffect(() => {
    if (!tiendaId) {
      setVencidosCount(0);
      return;
    }

    axiosClient
      .get<{ vencidos: Array<{ id: string }> }>(
        `/api/productos_tienda/expirando?tiendaId=${tiendaId}`,
      )
      .then((res) => {
        setVencidosCount(res.data.vencidos?.length || 0);
      })
      .catch(() => setVencidosCount(0))
      .finally(() => setLoading(false));
  }, [tiendaId]);

  // Load subscription urgency
  useEffect(() => {
    if (!user?.negocio?.id) {
      setSubscriptionUrgent(false);
      return;
    }

    SubscriptionService.getSubscriptionStatus(user.negocio.id)
      .then((status) => {
        // Only urgent if suspended, expired, or expires in ≤3 days
        setSubscriptionUrgent(
          status.isSuspended ||
            status.isExpired ||
            (status.daysRemaining <= 3 && status.daysRemaining > 0),
        );
      })
      .catch(() => setSubscriptionUrgent(false));
  }, [user?.negocio?.id]);

  // Don't render if nothing is urgent
  if (!suspensionCount && !vencidosCount && !subscriptionUrgent) {
    return null;
  }

  const handleRevisar = () => {
    if (vencidosCount > 0 && suspensionCount > 0) {
      // Both urgencies: go to inventory (vencidos) since that's the most actionable
      router.push("/inventario?filter=vencidos");
    } else if (vencidosCount > 0) {
      router.push("/inventario?filter=vencidos");
    } else if (suspensionCount > 0) {
      // Go to subscription/plans page for business suspension issues
      router.push("/configuracion/planes-admin");
    } else if (subscriptionUrgent) {
      router.push("/configuracion/planes");
    }
  };

  // Build the message
  const parts: string[] = [];
  if (suspensionCount > 0) {
    const businesses = suspensionCount === 1 ? "negocio" : "negocios";
    parts.push(`${suspensionCount} ${businesses} requiere(n) atención`);
  }
  if (vencidosCount > 0) {
    const products = vencidosCount === 1 ? "producto" : "productos";
    parts.push(`${vencidosCount} ${products} vencido(s)`);
  }

  const message =
    parts.length > 1 ? `${parts[0]} y hay ${parts[1]}` : `Hay ${parts[0]}`;

  // Determine severity: error if suspended businesses, otherwise warning
  const severity = suspensionCount > 0 ? "error" : "warning";
  const icon = severity === "error" ? <Error /> : <Warning />;

  return (
    <Box sx={{ mb: 3 }}>
      <Alert
        severity={severity}
        icon={icon}
        action={
          <Button
            size="small"
            onClick={handleRevisar}
            endIcon={<ChevronRight />}
            sx={{
              color: "inherit",
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            {loading ? <CircularProgress size={16} /> : "Revisar"}
          </Button>
        }
      >
        <AlertTitle sx={{ fontWeight: 600 }}>Acción requerida</AlertTitle>
        <Typography variant="body2">{message}</Typography>
      </Alert>
    </Box>
  );
}
