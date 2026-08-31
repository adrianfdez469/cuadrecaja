"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";

import { LANDING_ACTIVATION_TTL_LABEL } from "@/constants/onboarding";

import { LandingButton } from "./LandingButton";

interface FormData {
  nombre: string;
  nombreNegocio: string;
  correo: string;
  telefono: string;
  referido: string;
}

const INITIAL_FORM: FormData = {
  nombre: "",
  nombreNegocio: "",
  correo: "",
  telefono: "",
  referido: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The anchor the promoter link scrolls to once it has filled the code in. */
export const TRIAL_FORM_ID = "landing-contact-form";

/**
 * The one thing the page is asking for.
 *
 * Everything about the submission is unchanged from the page this replaces —
 * same endpoint, same payload, same rules — because it is the only part of the
 * landing that has a consequence. What changed is around it: the form used to
 * sit on a dark card fighting the global input styles with eleven `!important`
 * overrides, which is why it carried its own autofill handling.
 *
 * `numeroLocales` is still sent as `1`: the API expects the field and the form
 * stopped asking for it long ago.
 */
export function TrialForm() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [incluirProductosPrueba, setIncluirProductosPrueba] = useState<
    boolean | null
  >(null);

  // A promoter's link lands here with their code. Fill it in and take the
  // visitor to the form, rather than dropping them at the top of the page with
  // no sign the code was picked up.
  useEffect(() => {
    const refCode = searchParams.get("ref")?.trim().toUpperCase();
    if (!refCode) return;

    setFormData((prev) => ({ ...prev, referido: refCode }));

    const scrollToForm = () => {
      const el = document.getElementById(TRIAL_FORM_ID);
      if (!el) return;
      const appBar = document.querySelector(".MuiAppBar-root");
      const reserve =
        appBar instanceof HTMLElement
          ? Math.ceil(appBar.getBoundingClientRect().height) + 16
          : 104;
      const top = el.getBoundingClientRect().top + window.scrollY - reserve;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };

    // The hero image and the plans both change the page height as they land,
    // so one scroll is not enough: re-run it as the layout settles.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(scrollToForm);
    });
    const early = setTimeout(scrollToForm, 280);
    const late = setTimeout(scrollToForm, 600);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(early);
      clearTimeout(late);
    };
  }, [searchParams]);

  const handleInputChange =
    (field: keyof FormData) => (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const isValid = (): boolean => {
    if (!formData.nombre.trim()) return false;
    if (!formData.nombreNegocio.trim()) return false;
    if (!EMAIL_PATTERN.test(formData.correo.trim())) return false;
    if (incluirProductosPrueba === null) return false;
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isValid()) {
      setSubmitStatus("error");
      setErrorMessage(
        incluirProductosPrueba === null
          ? "Indica si deseas incluir productos de ejemplo en tu tienda Principal."
          : "Por favor, completa nombre, nombre del negocio y un correo válido.",
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    const telefono = formData.telefono.trim();
    const payload = {
      nombre: formData.nombre.trim(),
      nombreNegocio: formData.nombreNegocio.trim(),
      correo: formData.correo.trim(),
      telefono: telefono ? telefono.replace(/\s/g, "") : "",
      numeroLocales: 1,
      referido: formData.referido.trim().toUpperCase(),
      incluirProductosPrueba: incluirProductosPrueba as boolean,
    };

    try {
      const response = await fetch("/api/contact-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (response.ok) {
        setSubmitStatus("success");
        setFormData(INITIAL_FORM);
        setIncluirProductosPrueba(null);
      } else {
        setSubmitStatus("error");
        setErrorMessage(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : "No se pudo enviar el formulario. Intenta de nuevo.",
        );
      }
    } catch (error) {
      console.error("[landing] contact form submit failed", error);
      setSubmitStatus("error");
      setErrorMessage(
        "Hubo un error al enviar tu información. Por favor, intenta nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box id={TRIAL_FORM_ID}>
      <Typography
        component="h2"
        sx={{
          fontSize: { xs: "1.625rem", md: "2.125rem" },
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-0.025em",
        }}
      >
        Empieza tu prueba gratuita
      </Typography>
      <Typography
        sx={{
          mt: 1.25,
          mb: 3.5,
          fontSize: { xs: "1rem", md: "1.1875rem" },
          lineHeight: 1.55,
          color: "text.secondary",
        }}
      >
        Completa el formulario y recibirás un enlace de activación en tu correo.
      </Typography>

      {submitStatus === "success" && (
        <Alert severity="success" sx={{ mb: 3 }}>
          ¡Listo! Revisa tu correo electrónico: te llegará un enlace de
          activación válido por {LANDING_ACTIVATION_TTL_LABEL} desde{" "}
          <strong>adrianfdez469@gmail.com</strong> (correo personal del
          desarrollador). Si no lo ves, revisa la carpeta de spam.
        </Alert>
      )}

      {submitStatus === "error" && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2.75,
        }}
      >
        <TextField
          label="Nombre completo"
          value={formData.nombre}
          onChange={handleInputChange("nombre")}
          required
          fullWidth
        />
        <TextField
          label="Nombre del negocio"
          value={formData.nombreNegocio}
          onChange={handleInputChange("nombreNegocio")}
          required
          fullWidth
        />
        <TextField
          label="Correo electrónico"
          type="email"
          value={formData.correo}
          onChange={handleInputChange("correo")}
          required
          fullWidth
        />
        <TextField
          label="Teléfono (opcional)"
          value={formData.telefono}
          onChange={handleInputChange("telefono")}
          fullWidth
        />
        <TextField
          label="Código de referido (opcional)"
          value={formData.referido}
          onChange={handleInputChange("referido")}
          placeholder="PRM-XXXX"
          fullWidth
          sx={{ gridColumn: "1 / -1" }}
        />

        <FormControl
          component="fieldset"
          required
          sx={{ gridColumn: "1 / -1" }}
        >
          <FormLabel
            component="legend"
            sx={{
              mb: 1,
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "text.primary",
              "&.Mui-focused": { color: "text.primary" },
            }}
          >
            ¿Incluir productos de ejemplo en tu tienda Principal?
          </FormLabel>
          <RadioGroup
            value={
              incluirProductosPrueba === null
                ? ""
                : incluirProductosPrueba
                  ? "yes"
                  : "no"
            }
            onChange={(event) =>
              setIncluirProductosPrueba(event.target.value === "yes")
            }
          >
            <FormControlLabel
              value="yes"
              control={<Radio />}
              label="Sí, incluir 12 productos de ejemplo con stock y precios"
            />
            <FormControlLabel
              value="no"
              control={<Radio />}
              label="No, empezar con inventario vacío"
            />
          </RadioGroup>
        </FormControl>

        <LandingButton
          type="submit"
          disabled={isSubmitting || incluirProductosPrueba === null}
          startIcon={
            isSubmitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : undefined
          }
          sx={{ gridColumn: "1 / -1" }}
        >
          {isSubmitting ? "Enviando..." : "Probar gratis"}
        </LandingButton>
      </Box>

      <Typography
        sx={{
          mt: 1.75,
          fontSize: "0.8125rem",
          lineHeight: 1.55,
          color: "text.disabled",
        }}
      >
        Tu información está segura. No compartimos datos con terceros. El enlace
        de activación vale {LANDING_ACTIVATION_TTL_LABEL}.
      </Typography>
    </Box>
  );
}
