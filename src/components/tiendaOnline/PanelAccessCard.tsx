"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import {
  AlternateEmail,
  InfoOutlined,
  Lock,
  OpenInNew,
} from "@mui/icons-material";

import { ContentCard } from "@/components/ContentCard";
import { StatusPill } from "@/components/StatusPill";
import type { PillHue } from "@/components/StatusPill";
import { QAB_SSO_LINK_UI_TTL_SECONDS } from "@/constants/qabSso";
import {
  SUPPORT_PHONES,
  buildSupportWhatsAppUrl,
} from "@/constants/support";
import { useAppContext } from "@/context/AppContext";
import { selectQabSsoStoreIds } from "@/lib/qab/qabSsoClaims";
import {
  TiendaOnlineForbiddenError,
  TiendaOnlineSsoNotConfiguredError,
  TiendaOnlineSsoUserNotEmailError,
  postTiendaOnlineSsoLink,
} from "@/services/tiendaOnlineService";
import { shape, touch } from "@/theme/tokens";
import { formatQabSsoExpiry } from "@/utils/tiendaOnlineSsoCopy";

export interface PanelAccessCardProps {
  isMobile: boolean;
  /** The screen's own connectivity signal, from `useTiendaOnlineConfiguracion`. */
  online: boolean;
}

/**
 * The eight outcomes of the contract, as the eight states of this card. There is
 * no ninth: `opened` is `idle` plus one line, and `offline` is a modifier of
 * whichever primary button is on screen.
 *
 * `userNotEmail` was the eighth (F-023) and is reachable ONLY from the `catch` of
 * `mint()`. The card does NOT look at the session to anticipate it: that datum
 * is minted at login and is never re-read, so a check here would be a second
 * authority that can disagree with the server in both directions (ADR 0088).
 */
type IPanelAccessState =
  | "idle"
  | "minting"
  | "ready"
  | "expired"
  | "notConfigured"
  | "denied"
  | "error"
  | "userNotEmail";

const CARD_TITLE = "El panel de tu tienda online";
const CARD_SUBTITLE = "Fotos, descripciones, promociones y colores de tu marca.";

const OWNERSHIP_PARAGRAPH =
  "Cuadre de Caja manda el catálogo, los precios y las existencias. Lo que decide cómo se ve tu tienda se edita en el panel de la tienda online.";
const NO_NEW_PASSWORD_PARAGRAPH =
  "Entras con tu misma sesión de Cuadre de Caja: no hay ninguna contraseña nueva que crear ni recordar.";
const NO_STORES_NOTICE =
  "Todavía no tienes ningún local de tipo Tienda, así que el panel se va a abrir sin sucursales que editar.";
const OFFLINE_REASON =
  "Sin conexión: para entrar al panel hace falta internet.";
const OPENED_NOTICE =
  "Abrimos el panel en otra pestaña. Si el panel te dice que el enlace ya no sirve, pide otro desde aquí.";
const READY_NOTE = "Sirve una sola vez y se abre en otra pestaña.";

// F-023. The four blocks of the notice, transcribed from
// `.agents/designs/F-023.md` and not rewritten. The separator of
// «Configuración › Usuarios» is U+203A, copied from the design: a hand-typed
// «>» would break a criterion against otherwise correct code (E-016).
const USER_NOT_EMAIL_TITLE =
  "Para entrar al panel, tu usuario tiene que ser un correo.";
const USER_NOT_EMAIL_CAUSE =
  "Tu cuenta se creó con un nombre de usuario en vez de un correo, de cuando Cuadre de Caja todavía no lo pedía. No es un error tuyo: el panel de la tienda online identifica a cada persona por su correo.";
const USER_NOT_EMAIL_ACTION =
  "Cambia tu usuario por un correo tuyo en Configuración › Usuarios, o pídeselo a quien administre tu negocio. Al correo nuevo le llega un mensaje para confirmar el cambio.";
const USER_NOT_EMAIL_SESSION =
  "Cuando esté confirmado, cierra sesión y vuelve a entrar: Cuadre de Caja usa el usuario con el que abriste esta sesión, así que hasta entonces vas a seguir viendo este mensaje.";

const MINT_LABEL = "Pedir el enlace de entrada";
const MINTING_LABEL = "Pidiendo el enlace al servidor…";
const OPEN_LABEL = "Abrir el panel";
const MINT_AGAIN_LABEL = "Pedir otro enlace";
const SUPPORT_LABEL = "Escribir a soporte";
const RELOAD_LABEL = "Volver a cargar la pantalla";
const RETRY_LABEL = "Volver a intentarlo";

/** The floor F-004 and F-005 fixed for a primary button of this module. */
const PRIMARY_BUTTON_MIN_HEIGHT = 48;

const MS_PER_SECOND = 1000;
/** How often the countdown is recomputed. It never subtracts: it re-measures. */
const COUNTDOWN_TICK_MS = 250;

const [PRIMARY_SUPPORT_PHONE] = SUPPORT_PHONES;

/** The states that put a primary (contained) button on screen. */
const STATES_WITH_PRIMARY: IPanelAccessState[] = [
  "idle",
  "minting",
  "ready",
  "expired",
];

interface StateNoticeProps {
  hue: PillHue;
  icon?: ReactNode;
  children: ReactNode;
}

/** The tinted block that REPLACES the button. Same shape for the three of them. */
function StateNotice({ hue, icon, children }: Readonly<StateNoticeProps>) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: `${shape.radius.md}px`,
        bgcolor: `semantic.hue.${hue}.surface`,
        color: `semantic.hue.${hue}.main`,
      }}
    >
      <Stack direction="row" spacing={1}>
        {icon}
        <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
          {children}
        </Stack>
      </Stack>
    </Box>
  );
}

/**
 * The way into the QAB panel, in two taps.
 *
 * TWO taps and not one because `window.open` after an `await` is blocked by many
 * browsers — the user gesture is gone by then — and because every outcome that
 * is not a `200` would otherwise have already opened a blank tab it has to close
 * again. Asking first and opening afterwards keeps `window.open` inside its own
 * click, which is the pattern the rest of this repository already uses.
 *
 * The resolved URL is a live credential for less than a minute: it is never
 * painted, never linked, never copied and never persisted. It lives in this
 * component's state and is dropped the moment it is opened or expires.
 */
export function PanelAccessCard({
  isMobile,
  online,
}: Readonly<PanelAccessCardProps>) {
  const { user } = useAppContext();

  const [state, setState] = useState<IPanelAccessState>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QAB_SSO_LINK_UI_TTL_SECONDS);
  const [justOpened, setJustOpened] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);

  // The signal comes from the SESSION's locals, never from the ones this screen
  // loaded: `GET /api/tienda-online/configuracion` answers with the locals of the
  // BUSINESS, and the token carries the locals of the USER (ADR 0067). And it is
  // the server's own function, not a hand-written copy of its two conditions
  // (E-014).
  const businessId = user?.negocio?.id;
  const withoutStores =
    Boolean(businessId) &&
    selectQabSsoStoreIds(user?.locales, businessId).length === 0;

  // The countdown is measured against an INSTANT, never by subtracting one per
  // tick: a backgrounded tab throttles its timers, and a subtracting counter
  // would keep offering a link that died minutes ago.
  useEffect(() => {
    if (state !== "ready" || expiresAt === null) return undefined;

    const tick = () => {
      const left = (expiresAt - Date.now()) / MS_PER_SECOND;
      if (left <= 0) {
        setUrl(null);
        setExpiresAt(null);
        setSecondsLeft(0);
        setState("expired");
        return;
      }
      setSecondsLeft(left);
    };

    tick();
    const timer = window.setInterval(tick, COUNTDOWN_TICK_MS);
    return () => window.clearInterval(timer);
  }, [state, expiresAt]);

  // Two taps in the same spot, not a hunt: the button that appears takes the
  // focus the one that disappeared was holding.
  useEffect(() => {
    if (state === "ready") openButtonRef.current?.focus();
  }, [state]);

  const mint = async () => {
    setJustOpened(false);
    setState("minting");
    try {
      const link = await postTiendaOnlineSsoLink();
      setUrl(link.url);
      setExpiresAt(Date.now() + QAB_SSO_LINK_UI_TTL_SECONDS * MS_PER_SECOND);
      setSecondsLeft(QAB_SSO_LINK_UI_TTL_SECONDS);
      setState("ready");
    } catch (error) {
      // FOUR branches, in this order and without a fifth. The four 403s are
      // counted alike on purpose: the body is the same for all of them, and the
      // axios interceptor destroys it before it gets here anyway (E-009).
      if (error instanceof TiendaOnlineForbiddenError) {
        setState("denied");
        return;
      }
      if (error instanceof TiendaOnlineSsoNotConfiguredError) {
        setState("notConfigured");
        return;
      }
      if (error instanceof TiendaOnlineSsoUserNotEmailError) {
        setState("userNotEmail");
        return;
      }
      setState("error");
    }
  };

  const handleOpen = () => {
    // BOTH flags, and neither is optional: `noopener` closes reverse tabnabbing
    // on a tab that is holding a full credential, `noreferrer` keeps our origin
    // out of QAB's `Referer`. They do not imply each other.
    window.open(url, "_blank", "noopener,noreferrer");
    setUrl(null);
    setExpiresAt(null);
    setState("idle");
    setJustOpened(true);
  };

  const handleSupport = () => {
    window.open(
      buildSupportWhatsAppUrl(
        PRIMARY_SUPPORT_PHONE.whatsapp,
        "tiendaOnlinePanelNotLinked",
      ),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const primaryDisabled = !online;
  // Wrapped in a plain Box, so from `sm` up the button keeps its natural width
  // and sits to the left instead of stretching with the column.
  const primarySx = { minHeight: PRIMARY_BUTTON_MIN_HEIGHT };
  const secondarySx = { minHeight: touch.min };

  const offlineReason =
    !online && STATES_WITH_PRIMARY.includes(state) ? (
      <Typography variant="caption" sx={{ color: "semantic.hue.caution.main" }}>
        {OFFLINE_REASON}
      </Typography>
    ) : null;

  const renderAction = () => {
    if (state === "notConfigured") {
      return (
        <StateNotice
          hue="caution"
          icon={<InfoOutlined fontSize="small" sx={{ mt: 0.25 }} />}
        >
          <Typography variant="body2">
            <b>El panel todavía no está enlazado con Cuadre de Caja.</b>
          </Typography>
          <Typography variant="body2">
            Falta un dato de configuración que ponemos nosotros, no tú: tu
            negocio y tus datos están bien. Avísale al equipo de Cuadre de Caja y
            lo dejamos listo.
          </Typography>
          <Box>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleSupport}
              sx={secondarySx}
            >
              {SUPPORT_LABEL}
            </Button>
          </Box>
        </StateNotice>
      );
    }

    if (state === "denied") {
      return (
        <StateNotice
          hue="neutral"
          icon={<Lock fontSize="small" sx={{ mt: 0.25 }} />}
        >
          <Typography variant="body2">
            <b>Ahora mismo no se puede entrar al panel.</b>
          </Typography>
          <Typography variant="body2">
            Puede ser que te hayan quitado el permiso de esta sección, o que la
            tienda online se haya desactivado para el negocio. Desde aquí no se
            puede saber cuál de las dos. Tu sesión sigue activa: no hace falta
            que vuelvas a entrar.
          </Typography>
          <Box>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => window.location.reload()}
              sx={secondarySx}
            >
              {RELOAD_LABEL}
            </Button>
          </Box>
        </StateNotice>
      );
    }

    if (state === "userNotEmail") {
      // No control inside the block, and that is the design's decision, not an
      // oversight: a retry with this same session gets the same answer, and any
      // link out of here throws away the unsaved draft of the form above.
      return (
        <StateNotice
          hue="info"
          icon={<AlternateEmail fontSize="small" sx={{ mt: 0.25 }} />}
        >
          <Typography variant="body2">
            <b>{USER_NOT_EMAIL_TITLE}</b>
          </Typography>
          <Typography variant="body2">{USER_NOT_EMAIL_CAUSE}</Typography>
          <Typography variant="body2">{USER_NOT_EMAIL_ACTION}</Typography>
          <Typography variant="body2">{USER_NOT_EMAIL_SESSION}</Typography>
        </StateNotice>
      );
    }

    if (state === "error") {
      return (
        <StateNotice hue="negative">
          <Typography variant="body2">
            <b>No se pudo pedir el enlace.</b>
          </Typography>
          <Typography variant="body2">
            Puede ser un problema momentáneo. Vuelve a intentarlo en un momento.
          </Typography>
          <Box>
            <Button
              variant="text"
              color="inherit"
              onClick={() => void mint()}
              sx={secondarySx}
            >
              {RETRY_LABEL}
            </Button>
          </Box>
        </StateNotice>
      );
    }

    if (state === "ready") {
      return (
        <Stack spacing={1}>
          <Box>
            <StatusPill label="Enlace listo" hue="positive" />
          </Box>
          <Box>
            <Button
              ref={openButtonRef}
              variant="contained"
              startIcon={<OpenInNew />}
              onClick={handleOpen}
              disabled={primaryDisabled}
              fullWidth={isMobile}
              sx={primarySx}
            >
              {OPEN_LABEL}
            </Button>
          </Box>
          {/* Out of the live region's announcement: a number that changes every
              second turns a screen reader into a metronome. */}
          <Typography
            variant="caption"
            aria-hidden="true"
            sx={{ color: "semantic.text.secondary" }}
          >
            {formatQabSsoExpiry(secondsLeft)}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "semantic.text.secondary" }}
          >
            {READY_NOTE}
          </Typography>
          {offlineReason}
        </Stack>
      );
    }

    if (state === "expired") {
      return (
        <Stack spacing={1}>
          <Typography
            variant="body2"
            sx={{ color: "semantic.hue.caution.main" }}
          >
            El enlace caducó.
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "semantic.text.secondary" }}
          >
            Los enlaces de entrada duran menos de un minuto para que nadie los
            pueda reusar.
          </Typography>
          <Box>
            <Button
              variant="contained"
              onClick={() => void mint()}
              disabled={primaryDisabled}
              fullWidth={isMobile}
              sx={primarySx}
            >
              {MINT_AGAIN_LABEL}
            </Button>
          </Box>
          {offlineReason}
        </Stack>
      );
    }

    // `idle` and `minting`: the same button, in the same place.
    return (
      <Stack spacing={1}>
        <Box>
          <Button
            variant="contained"
            onClick={() => void mint()}
            loading={state === "minting"}
            disabled={primaryDisabled}
            fullWidth={isMobile}
            sx={primarySx}
          >
            {MINT_LABEL}
          </Button>
        </Box>
        {state === "minting" && (
          <Typography
            variant="caption"
            sx={{ color: "semantic.text.secondary" }}
          >
            {MINTING_LABEL}
          </Typography>
        )}
        {state === "idle" && justOpened && (
          <Typography
            variant="caption"
            sx={{ color: "semantic.text.secondary" }}
          >
            {OPENED_NOTICE}
          </Typography>
        )}
        {offlineReason}
      </Stack>
    );
  };

  return (
    <ContentCard title={CARD_TITLE} subtitle={CARD_SUBTITLE} spaceButton>
      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
          {OWNERSHIP_PARAGRAPH}
        </Typography>
        <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
          {NO_NEW_PASSWORD_PARAGRAPH}
        </Typography>

        {withoutStores && (
          <Typography
            variant="caption"
            sx={{ color: "semantic.hue.caution.main" }}
          >
            {NO_STORES_NOTICE}
          </Typography>
        )}

        {/* The action zone, and the whole of it: the button and the block that
            replaces it. A change of state is announced without having to go
            looking for it. */}
        <Box aria-live="polite">{renderAction()}</Box>
      </Stack>
    </ContentCard>
  );
}

export default PanelAccessCard;
