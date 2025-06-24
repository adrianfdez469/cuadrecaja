import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
      light: "#42a5f5",
      dark: "#1565c0",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#dc004e",
      light: "#ff5983",
      dark: "#9a0036",
      contrastText: "#ffffff",
    },
    success: {
      main: "#2e7d32",
      light: "#4caf50",
      dark: "#1b5e20",
      contrastText: "#ffffff",
    },
    warning: {
      main: "#ed6c02",
      light: "#ff9800",
      dark: "#e65100",
      contrastText: "#ffffff",
    },
    error: {
      main: "#d32f2f",
      light: "#ef5350",
      dark: "#c62828",
      contrastText: "#ffffff",
    },
    info: {
      main: "#0288d1",
      light: "#03a9f4",
      dark: "#01579b",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },
    text: {
      primary: "#1a202c",
      secondary: "#718096",
    },
    // Colores personalizados para el negocio
    custom: {
      cashGreen: "#10b981",
      stockAlert: "#f59e0b",
      offline: "#ef4444",
      online: "#22c55e",
      categoryHeader: "#4f46e5",
      lightGray: "#f7fafc",
      borderGray: "#e2e8f0",
    } as any,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: "2.5rem",
      fontWeight: 700,
      lineHeight: 1.2,
      color: "#1a202c",
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 600,
      lineHeight: 1.3,
      color: "#1a202c",
    },
    h3: {
      fontSize: "1.75rem",
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#1a202c",
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#1a202c",
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 600,
      lineHeight: 1.5,
      color: "#1a202c",
    },
    h6: {
      fontSize: "1.125rem",
      fontWeight: 600,
      lineHeight: 1.5,
      color: "#1a202c",
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.6,
      color: "#374151",
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.6,
      color: "#6b7280",
    },
    caption: {
      fontSize: "0.75rem",
      lineHeight: 1.5,
      color: "#9ca3af",
    },
    button: {
      textTransform: "none" as const,
      fontWeight: 600,
      fontSize: "0.875rem",
    },
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  components: {
    // Botones mejorados
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: "10px 24px",
          fontSize: "0.875rem",
          fontWeight: 600,
          textTransform: "none",
          boxShadow: "none",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)",
          },
        },
        containedSecondary: {
          background: "linear-gradient(135deg, #dc004e 0%, #9a0036 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #9a0036 0%, #880e4f 100%)",
          },
        },
        containedSuccess: {
          background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #1b5e20 0%, #0d5016 100%)",
          },
        },
      },
    },
    // Cards mejoradas
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
          border: "1px solid #e2e8f0",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            boxShadow: "0 8px 25px rgba(0, 0, 0, 0.12)",
            transform: "translateY(-2px)",
          },
        },
      },
    },
    // Drawer mejorado
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          borderRight: "1px solid #e2e8f0",
          boxShadow: "4px 0 12px rgba(0, 0, 0, 0.08)",
        },
      },
    },
    // AppBar mejorada
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#1a202c",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          borderBottom: "1px solid #e2e8f0",
        },
      },
    },
    // Tablas mejoradas
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: "#f8fafc",
            color: "#374151",
            fontWeight: 600,
            fontSize: "0.875rem",
            textTransform: "uppercase",
            letterSpacing: "0.025em",
            borderBottom: "2px solid #e2e8f0",
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: "#f8fafc",
            transition: "background-color 0.15s ease",
          },
          "&:last-child td": {
            borderBottom: 0,
          },
        },
      },
    },
    // TextFields mejorados
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "#ffffff",
            transition: "all 0.2s ease",
            "&:hover": {
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            },
            "&.Mui-focused": {
              boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.12)",
            },
          },
        },
      },
    },
    // Chips mejorados
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          fontSize: "0.75rem",
        },
        colorSuccess: {
          backgroundColor: "#dcfce7",
          color: "#166534",
          border: "1px solid #bbf7d0",
        },
        colorError: {
          backgroundColor: "#fef2f2",
          color: "#dc2626",
          border: "1px solid #fecaca",
        },
        colorWarning: {
          backgroundColor: "#fefce8",
          color: "#ca8a04",
          border: "1px solid #fde68a",
        },
      },
    },
  },
});

// Extend theme type for custom colors
declare module "@mui/material/styles" {
  interface Palette {
    custom: {
      cashGreen: string;
      stockAlert: string;
      offline: string;
      online: string;
      categoryHeader: string;
      lightGray: string;
      borderGray: string;
    };
  }

  interface PaletteOptions {
    custom?: {
      cashGreen?: string;
      stockAlert?: string;
      offline?: string;
      online?: string;
      categoryHeader?: string;
      lightGray?: string;
      borderGray?: string;
    };
  }
}

export default theme;
