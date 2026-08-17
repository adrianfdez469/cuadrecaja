"use client";

import { ReactNode } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { Inbox, SearchOff } from "@mui/icons-material";

/**
 * Which kind of nothing this is.
 *
 * The app had 63 hand-written empty states and none of them drew this
 * distinction, so "you haven't added any products yet" and "your filter matched
 * nothing" looked identical. They call for opposite actions: one invites the
 * user to create something, the other to undo a filter.
 */
export type EmptyStateVariant = "empty" | "no-results";

export type EmptyStateProps = {
  variant?: EmptyStateVariant;
  /** One short line. Say what is missing, not that something failed. */
  title: string;
  /** Optional second line: what the user can do about it. */
  description?: string;
  /** Overrides the variant's default icon. */
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** `compact` fits inside a card or a table body; `page` owns the viewport. */
  size?: "compact" | "page";
};

const DEFAULT_ICON: Record<EmptyStateVariant, ReactNode> = {
  empty: <Inbox sx={{ fontSize: "inherit" }} />,
  "no-results": <SearchOff sx={{ fontSize: "inherit" }} />,
};

export function EmptyState({
  variant = "empty",
  title,
  description,
  icon,
  action,
  size = "compact",
}: EmptyStateProps) {
  const isPage = size === "page";

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{
        textAlign: "center",
        py: isPage ? 10 : 6,
        px: 3,
        width: "100%",
      }}
    >
      <Box
        aria-hidden
        sx={{
          fontSize: isPage ? 56 : 40,
          lineHeight: 1,
          color: "text.disabled",
          display: "flex",
        }}
      >
        {icon ?? DEFAULT_ICON[variant]}
      </Box>

      <Typography variant={isPage ? "h6" : "subtitle1"} fontWeight={600}>
        {title}
      </Typography>

      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 420 }}
        >
          {description}
        </Typography>
      )}

      {action && (
        <Button
          variant={variant === "empty" ? "contained" : "text"}
          onClick={action.onClick}
          sx={{ mt: 0.5 }}
        >
          {action.label}
        </Button>
      )}
    </Stack>
  );
}

export default EmptyState;
