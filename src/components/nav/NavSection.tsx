"use client";

import type { ReactNode } from "react";
import { ButtonBase, Collapse, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

interface NavSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * A collapsible group of nav rows.
 *
 * This was a MUI `Accordion`, which is a Paper: it brought its own background,
 * its own border, its own elevation and its own margins, so four groups in a
 * drawer read as four stacked cards. A drawer is already a surface — the
 * groups inside it need a heading, not a container each.
 */
export function NavSection({
  title,
  expanded,
  onToggle,
  children,
}: NavSectionProps) {
  return (
    <>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={expanded}
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          gap: 1.5,
          minHeight: 52,
          px: 2.5,
          color: "text.disabled",
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </Typography>
        <ExpandMoreIcon
          sx={{
            fontSize: 18,
            transition: "transform 0.2s ease",
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        />
      </ButtonBase>
      <Collapse in={expanded} unmountOnExit>
        {children}
      </Collapse>
    </>
  );
}
