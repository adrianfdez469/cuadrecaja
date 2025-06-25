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
    },
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
    borderRadius: 8,
  },
  spacing: 8,
  components: {
    // Botones con estilo minimalista
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: "0.875rem",
          fontWeight: 500,
          textTransform: "none",
          boxShadow: "none",
          transition: "all 0.2s ease",
          "&:hover": {
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
          },
        },
      },
    },
    // Cards minimalistas
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          border: "1px solid #f1f5f9",
          transition: "all 0.2s ease",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
            transform: "translateY(-1px)",
          },
        },
      },
    },
    // AppBar limpia
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#1a202c",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          borderBottom: "1px solid #f1f5f9",
        },
      },
    },
    // Drawer minimalista
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          borderRight: "1px solid #f1f5f9",
          boxShadow: "2px 0 8px rgba(0, 0, 0, 0.08)",
        },
      },
    },
    // Tablas limpias
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: "#f8fafc",
            color: "#374151",
            fontWeight: 600,
            fontSize: "0.875rem",
            borderBottom: "1px solid #e2e8f0",
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
        },
      },
    },
    // TextFields limpios
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            backgroundColor: "#ffffff",
            "&:hover": {
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#cbd5e1",
              },
            },
            "&.Mui-focused": {
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#1976d2",
                borderWidth: "2px",
              },
            },
          },
        },
      },
    },
    // Chips minimalistas
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          fontSize: "0.75rem",
        },
        colorSuccess: {
          backgroundColor: "#dcfce7",
          color: "#166534",
        },
        colorError: {
          backgroundColor: "#fef2f2",
          color: "#dc2626",
        },
        colorWarning: {
          backgroundColor: "#fefce8",
          color: "#ca8a04",
        },
      },
    },
    // Paper limpio
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        elevation1: {
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
        },
        elevation2: {
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
        },
        elevation3: {
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
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
