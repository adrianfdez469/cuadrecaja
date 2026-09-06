"use client";

import type { ReactNode } from "react";
import { List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import {
  Block,
  CancelOutlined,
  CheckCircleOutline,
  DoneAll,
  HelpOutline,
  Inventory2Outlined,
  LocalShippingOutlined,
} from "@mui/icons-material";

import { ActionSheet } from "@/components/ActionSheet";
import { AppDialog } from "@/components/AppDialog";
import {
  TIENDA_ONLINE_ORDER_COPY,
  orderStatusPresentation,
} from "@/components/tiendaOnline/orderPresentation";
import type { IQabOrderStatusReportable } from "@/lib/qab/qabOrderStatusClient";
import { touch } from "@/theme/tokens";

/**
 * The icons of the six destinations.
 *
 * They live HERE and not in `orderPresentation.ts`: that file is a `.ts` on
 * purpose so a test can import its ten pure functions, and JSX would turn it
 * into a `.tsx` and take all of them out of the suite (E-015).
 *
 * Typed against the six reportable values, so a misspelled key and a missing one
 * both fail the build.
 */
const TARGET_ICONS: Record<IQabOrderStatusReportable, ReactNode> = {
  CONFIRMED: <CheckCircleOutline />,
  READY: <Inventory2Outlined />,
  IN_TRANSIT: <LocalShippingOutlined />,
  DELIVERED: <DoneAll />,
  CANCELLED: <CancelOutlined />,
  REJECTED_BY_STORE: <Block />,
};

/** For the case the map cannot have: a destination outside the six. */
const FALLBACK_ICON = <HelpOutline />;

/** The hue F-011 gave a decision somebody will have to answer for. */
const DANGER_HUE = "negative";

function targetIcon(target: IQabOrderStatusReportable): ReactNode {
  return TARGET_ICONS[target] ?? FALLBACK_ICON;
}

function isDangerTarget(target: IQabOrderStatusReportable): boolean {
  // The same hue F-011 assigned the status, not a second list of "severe"
  // destinations kept by hand (E-014).
  return orderStatusPresentation(target).hue === DANGER_HUE;
}

export interface PedidoStatusPickerProps {
  open: boolean;
  /** Exactly what `offerOrderStatusTransitions` returned. Never filtered again. */
  targets: IQabOrderStatusReportable[];
  /** The page's ONE `down("sm")`, passed down. No second media query here. */
  isCompact: boolean;
  onClose: () => void;
  onSelect: (target: IQabOrderStatusReportable) => void;
}

/**
 * Where the manager picks the destination: a bottom sheet under the thumb on a
 * phone, a small dialog on a desktop. Two real components and not one dressed
 * up — a `Drawer` rising across 1440 px to offer four rows is not a menu, and
 * `AppDialog` goes full-screen under 600 px, which would chain two full screens.
 *
 * It closes BEFORE the request leaves, in both branches.
 */
export function PedidoStatusPicker({
  open,
  targets,
  isCompact,
  onClose,
  onSelect,
}: Readonly<PedidoStatusPickerProps>) {
  if (isCompact) {
    return (
      <ActionSheet
        open={open}
        onClose={onClose}
        title={TIENDA_ONLINE_ORDER_COPY.cambiarEstadoTitulo}
        // `ActionSheet` already calls `onClose()` before `onClick()`.
        items={targets.map((target) => ({
          key: target,
          icon: targetIcon(target),
          label: orderStatusPresentation(target).label,
          danger: isDangerTarget(target),
          onClick: () => onSelect(target),
        }))}
      />
    );
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={TIENDA_ONLINE_ORDER_COPY.cambiarEstadoTitulo}
      maxWidth="xs"
      // No `confirm`: this is a list of options, not a form to submit.
      cancelLabel={TIENDA_ONLINE_ORDER_COPY.volver}
    >
      <List disablePadding>
        {targets.map((target) => {
          const danger = isDangerTarget(target);
          return (
            <ListItemButton
              key={target}
              onClick={() => {
                onClose();
                onSelect(target);
              }}
              sx={{ minHeight: touch.row, px: 2, gap: 1.75 }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  color: danger ? "semantic.hue.negative.main" : "semantic.text.secondary",
                }}
              >
                {targetIcon(target)}
              </ListItemIcon>
              <ListItemText
                slotProps={{
                  primary: {
                    sx: {
                      fontWeight: 600,
                      color: danger
                        ? "semantic.hue.negative.main"
                        : "semantic.text.primary",
                    },
                  },
                }}
              >
                {orderStatusPresentation(target).label}
              </ListItemText>
            </ListItemButton>
          );
        })}
      </List>
    </AppDialog>
  );
}

export default PedidoStatusPicker;
