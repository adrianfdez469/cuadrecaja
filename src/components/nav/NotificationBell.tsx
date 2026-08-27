"use client";

import { useEffect, useState } from "react";
import { Badge, IconButton, Tooltip } from "@mui/material";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { NotificationApiService } from "@/services/notificationApiService";
import { touch } from "@/theme";

interface NotificationBellProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Unread notifications, in the top bar.
 *
 * The count was only ever visible once you had already scrolled to the widget
 * on the dashboard — which is the one place you no longer are when something
 * needs your attention. The redesign puts the bell next to the account, where
 * every other product puts it.
 *
 * The fetch fails silently on purpose: this is an ambient indicator, and a
 * store that has lost its connection has better things to tell the cashier
 * than that it could not count its notifications.
 */
export function NotificationBell({ onClick, disabled }: NotificationBellProps) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    NotificationApiService.getActiveNotifications()
      .then((data) => {
        if (cancelled) return;
        setUnread(data.filter((n) => !n.yaLeida).length);
      })
      .catch(() => {
        if (!cancelled) setUnread(0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (unread === 0) return null;

  return (
    <Tooltip title="Notificaciones">
      <IconButton
        onClick={disabled ? undefined : onClick}
        aria-label={`${unread} notificaciones sin leer`}
        sx={{ width: touch.min, height: touch.min, color: "text.secondary" }}
      >
        <Badge
          badgeContent={unread}
          color="error"
          sx={{
            "& .MuiBadge-badge": {
              fontSize: "0.625rem",
              fontWeight: 700,
              minWidth: 16,
              height: 16,
            },
          }}
        >
          <NotificationsNoneIcon sx={{ fontSize: 21 }} />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
