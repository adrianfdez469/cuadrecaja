import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
}

/** A card of related ticket settings, with an optional uppercase eyebrow title. */
export function TicketSection({ title, children }: Props) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        p: 2,
      }}
    >
      {title && (
        <Typography
          variant="overline"
          color="text.disabled"
          sx={{ display: "block", mb: 0.5 }}
        >
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
}
