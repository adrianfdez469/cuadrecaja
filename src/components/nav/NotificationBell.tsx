"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, IconButton, Tooltip, Box } from "@mui/material";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { NotificationApiService } from "@/services/notificationApiService";
import { touch } from "@/theme";
import { NotificationPanel } from "./NotificationPanel";

interface NotificationBellProps {
  disabled?: boolean;
}

/**
 * Bell icon showing unread notification count (44px, circular).
 *
 * The count was only ever visible once you had already scrolled to the widget
 * on the dashboard — which is the one place you no longer are when something
 * needs your attention. The redesign puts the bell next to the account, where
 * every other product puts it.
 *
 * The fetch fails silently on purpose: this is an ambient indicator, and a
 * store that has lost its connection has better things to tell the cashier
 * than that it could not count its notifications.
 *
 * Clicking opens a floating panel with recent active notifications and the
 * option to navigate to the full management page.
 */
export function NotificationBell({ disabled }: NotificationBellProps) {
  const [unread, setUnread] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

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
    <>
      <Tooltip title="Notificaciones">
        <Box
          sx={{
            position: "relative",
            display: "inline-flex",
          }}
        >
          <IconButton
            ref={bellRef}
            onClick={() => (disabled ? undefined : setPanelOpen(!panelOpen))}
            aria-label={`${unread} notificaciones sin leer`}
            sx={{
              width: touch.min,
              height: touch.min,
              color: "text.secondary",
              backgroundColor: panelOpen ? "action.hover" : "transparent",
              borderRadius: "50%",
              transition: "background-color 0.2s",
            }}
          >
            <Badge
              badgeContent={unread}
              color="primary"
              sx={{
                "& .MuiBadge-badge": {
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  padding: "0 3px",
                  border: "2px solid",
                  borderColor: "background.paper",
                },
              }}
            >
              <NotificationsNoneIcon sx={{ fontSize: 21 }} />
            </Badge>
          </IconButton>
        </Box>
      </Tooltip>

      <NotificationPanel
        open={panelOpen}
        anchorEl={bellRef.current}
        onClose={() => setPanelOpen(false)}
      />
    </>
  );
}
