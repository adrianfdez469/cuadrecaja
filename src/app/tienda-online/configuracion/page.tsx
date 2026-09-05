"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppDialog } from "@/components/AppDialog";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { AlmacenNotice } from "@/components/tiendaOnline/AlmacenNotice";
import { BrandQuestionDialog } from "@/components/tiendaOnline/BrandQuestionDialog";
import { LocalSelector } from "@/components/tiendaOnline/LocalSelector";
import { PublicDataCard } from "@/components/tiendaOnline/PublicDataCard";
import { PublicationStatusCard } from "@/components/tiendaOnline/PublicationStatusCard";
import { SAVE_BAR_HEIGHT, SaveBar } from "@/components/tiendaOnline/SaveBar";
import { ScheduleCard } from "@/components/tiendaOnline/ScheduleCard";
import { StoreAddressCard } from "@/components/tiendaOnline/StoreAddressCard";
import { TiendaOnlineConfiguracionTabs } from "@/components/tiendaOnline/TiendaOnlineConfiguracionTabs";
import type { ITiendaOnlineTab } from "@/components/tiendaOnline/TiendaOnlineConfiguracionTabs";
import { TiendaOnlineDeniedScreen } from "@/components/tiendaOnline/TiendaOnlineDeniedScreen";
import { TiendaOnlineProductosTab } from "@/components/tiendaOnline/TiendaOnlineProductosTab";
import { UnpublishDialog } from "@/components/tiendaOnline/UnpublishDialog";
import {
  TIENDA_ONLINE_LABELS,
  TIENDA_ONLINE_OFFLINE_DESCRIPTION,
  TIENDA_ONLINE_PERMISOS,
  TIENDA_ONLINE_TAB_QUERY_KEY,
  TIENDA_ONLINE_TABS,
} from "@/constants/tiendaOnline";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { useTiendaOnlineAccess } from "@/hooks/useTiendaOnlineAccess";
import { useTiendaOnlineConfiguracion } from "@/hooks/useTiendaOnlineConfiguracion";
import { useTiendaOnlineProductos } from "@/hooks/useTiendaOnlineProductos";
import { collectOpeningHoursIssues } from "@/schemas/qabOpeningHours";
import { TipoLocal } from "@/schemas/tienda";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";
import { TiendaOnlineOpeningHoursRejected } from "@/services/tiendaOnlineService";
import {
  draftFromLocal,
  draftToUpdate,
  hasNoContactAtAll,
} from "@/utils/tiendaOnlineDraft";
import type { ITiendaOnlineDraft } from "@/utils/tiendaOnlineDraft";

const SUBTITLE = "Cómo se ve y cómo opera tu negocio en la tienda online.";
const INVENTARIO_ROUTE = "/inventario";

/** An unknown or absent `?tab=` falls into Locales, which is the old behaviour. */
function readTab(raw: string | null): ITiendaOnlineTab {
  return raw === TIENDA_ONLINE_TABS.productos
    ? TIENDA_ONLINE_TABS.productos
    : TIENDA_ONLINE_TABS.locales;
}

function pickInitialLocal(
  locales: ITiendaOnlineLocal[],
  localActualId: string | undefined,
): string {
  const current = locales.find((local) => local.id === localActualId);
  if (current) return current.id;
  const firstTienda = locales.find((local) => local.tipo === TipoLocal.TIENDA);
  return firstTienda?.id ?? locales[0]?.id ?? "";
}

/**
 * The online-store configuration of one local.
 *
 * The frame is F-004's and is not touched: `maxWidth="md"`, the title, the
 * subtitle, the breadcrumbs and the denied state. What this feature replaces is
 * the body of the card.
 */
function TiendaOnlineConfiguracionScreen() {
  const access = useTiendaOnlineAccess(
    TIENDA_ONLINE_PERMISOS.configuracionAcceder,
  );
  const theme = useTheme();
  // THE breakpoint of this screen, declared once and passed down. There is no
  // second threshold in this feature.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAppContext();
  const { showMessage } = useMessageContext();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = readTab(searchParams.get(TIENDA_ONLINE_TAB_QUERY_KEY));

  const { status, locales, online, reload, save } = useTiendaOnlineConfiguracion(
    access === "allowed",
  );

  // The tab is a MODE of this screen, not a destination: `replace`, so «back»
  // still leaves the screen instead of walking through the tabs. It lives in the
  // URL because a tab that only exists in React state cannot be opened directly.
  const goToTab = (next: ITiendaOnlineTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === TIENDA_ONLINE_TABS.locales) {
      params.delete(TIENDA_ONLINE_TAB_QUERY_KEY);
    } else {
      params.set(TIENDA_ONLINE_TAB_QUERY_KEY, next);
    }
    const query = params.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname);
  };

  // The listing is only fetched once the tab has actually been opened: a
  // merchant who never leaves Locales never pays for it. And the hook lives
  // HERE, not in the tab body, so the filter and the loaded pages survive a
  // round trip through the other tab.
  const [productosTabOpened, setProductosTabOpened] = useState(false);
  useEffect(() => {
    if (tab === TIENDA_ONLINE_TABS.productos) setProductosTabOpened(true);
  }, [tab]);
  const productos = useTiendaOnlineProductos(
    access === "allowed" && productosTabOpened,
  );

  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<ITiendaOnlineDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [editingReason, setEditingReason] = useState(false);
  const [pendingLocalId, setPendingLocalId] = useState<string | null>(null);
  const [pendingTab, setPendingTab] = useState<ITiendaOnlineTab | null>(null);
  const [focusFirstIssueNonce, setFocusFirstIssueNonce] = useState(0);
  const scheduleRef = useRef<HTMLDivElement | null>(null);

  const selected = locales.find((local) => local.id === selectedId) ?? null;

  useEffect(() => {
    if (status !== "ready" || locales.length === 0) return;
    setSelectedId((current) =>
      locales.some((local) => local.id === current)
        ? current
        : pickInitialLocal(locales, user?.localActual?.id),
    );
  }, [status, locales, user?.localActual?.id]);

  // The draft is re-seeded whenever the selected local changes identity, never
  // while it is being edited: `dirty` is the difference between the two.
  useEffect(() => {
    setDraft(selected === null ? null : draftFromLocal(selected));
  }, [selected]);

  const issues = useMemo(
    () =>
      draft?.horarios == null
        ? []
        : collectOpeningHoursIssues(draft.horarios),
    [draft?.horarios],
  );

  const dirty = useMemo(() => {
    if (selected === null || draft === null) return false;
    return (
      JSON.stringify(draft) !== JSON.stringify(draftFromLocal(selected))
    );
  }, [draft, selected]);

  const setField = (field: keyof ITiendaOnlineDraft, value: string) => {
    setDraft((current) =>
      current === null ? current : { ...current, [field]: value },
    );
  };

  const persist = async (next: ITiendaOnlineDraft) => {
    if (selected === null) return;
    setSaving(true);
    try {
      const local = await save(selected.id, draftToUpdate(next));
      setDraft(draftFromLocal(local));
      showMessage(
        local.publicarEnTienda
          ? "Guardado. Los cambios llegan a tu tienda online en unos minutos."
          : "Guardado. Como el local no está publicado, todavía no se envió nada a la tienda online.",
        "success",
      );
    } catch (error) {
      if (error instanceof TiendaOnlineOpeningHoursRejected) {
        showMessage(
          "El horario no lo acepta la tienda online. Revisa las franjas señaladas.",
          "error",
        );
      } else {
        showMessage("No se pudo guardar. Vuelve a intentarlo.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (draft === null) return;
    if (issues.length > 0) {
      // Nothing is sent, and pressing takes the merchant to the first problem:
      // the button is never disabled without a reason beside it.
      setFocusFirstIssueNonce((current) => current + 1);
      return;
    }
    void persist(draft);
  };

  const handleRequestPublish = () => {
    if (draft === null || selected === null) return;
    // Already published at least once: the brand question was answered and
    // `storefrontId` never moves again, so publish straight away. The signal is
    // `firstPublishPending` (no STORE event of this local ever carried
    // `publishToStore: true`), NOT `slugQab`: QAB owns that column and this
    // feature never writes it. And NOT "no event was ever emitted" either -
    // every applied PATCH emits, so saving the contact data with the switch off
    // would consume the question (ADR 0035).
    if (!selected.firstPublishPending) {
      void persist({ ...draft, publicarEnTienda: true });
      return;
    }
    setBrandOpen(true);
  };

  const handleSelect = (tiendaId: string) => {
    if (dirty) {
      setPendingLocalId(tiendaId);
      return;
    }
    setSelectedId(tiendaId);
  };

  // Switching tabs with a draft in flight would lose it exactly as switching
  // local does, and until this feature there was no second tab to lose it to.
  const handleTabChange = (next: ITiendaOnlineTab) => {
    if (next === tab) return;
    if (dirty && tab === TIENDA_ONLINE_TABS.locales) {
      setPendingTab(next);
      return;
    }
    goToTab(next);
  };

  if (access === "denied" || status === "forbidden") {
    return <TiendaOnlineDeniedScreen />;
  }

  const publishableLocales = locales.filter((local) => local.publishable);
  const allWarehouses = locales.length > 0 && publishableLocales.length === 0;
  // The signal of "nothing is published yet" is the WHOLE business's, read from
  // the locals this page already loads — never derived from the product page on
  // screen, which would give a per-page answer to a per-business question.
  const algunLocalPublicado = publishableLocales.some(
    (local) => local.publicarEnTienda,
  );
  const enLocales = tab === TIENDA_ONLINE_TABS.locales;

  return (
    <PageContainer
      // `md`, unlike Pedidos: F-005 puts a settings form here and the reading
      // measure matters. Deliberate, and the only structural difference between
      // the two screens of this module.
      maxWidth="md"
      title={TIENDA_ONLINE_LABELS.configuracion}
      subtitle={SUBTITLE}
      breadcrumbs={[
        { label: "Inicio", href: "/home" },
        // No href: `/tienda-online` is not a route.
        { label: TIENDA_ONLINE_LABELS.section },
        { label: "Configuración" },
      ]}
      // The one thing F-006 adds to the frame. `headerActions` and
      // `titleAdornment` stay unused, for the reasons F-005 gave.
      tabs={
        <TiendaOnlineConfiguracionTabs value={tab} onChange={handleTabChange} />
      }
      // A bar that covers the last field is worse than not having one.
      contentProps={dirty ? { sx: { pb: `${SAVE_BAR_HEIGHT}px` } } : undefined}
    >
      {!enLocales && (
        <TiendaOnlineProductosTab
          productos={productos}
          isMobile={isMobile}
          algunLocalPublicado={algunLocalPublicado}
          onGoToLocales={() => handleTabChange(TIENDA_ONLINE_TABS.locales)}
          onGoToInventario={() => router.push(INVENTARIO_ROUTE)}
        />
      )}

      {enLocales && (access === "loading" || status === "loading") && (
        <LoadingState variant="text" count={6} />
      )}

      {enLocales && status === "error" && (
        <ErrorState
          kind="error"
          title="No se pudo cargar la configuración"
          description="Vuelve a intentarlo en un momento."
          onRetry={reload}
        />
      )}

      {enLocales && status === "offline" && (
        <ErrorState
          kind="offline"
          title="Sin conexión"
          description={TIENDA_ONLINE_OFFLINE_DESCRIPTION}
          onRetry={reload}
        />
      )}

      {enLocales && status === "ready" && locales.length === 0 && (
        <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
          Este negocio todavía no tiene locales.
        </Typography>
      )}

      {enLocales && status === "ready" && allWarehouses && (
        <AlmacenNotice localNombre={null} />
      )}

      {enLocales &&
        status === "ready" &&
        !allWarehouses &&
        selected !== null &&
        draft !== null && (
        <Stack>
          <Box sx={{ mb: 2 }}>
            <LocalSelector
              locales={locales}
              selectedId={selectedId}
              isMobile={isMobile}
              onSelect={handleSelect}
            />
          </Box>

          {selected.tipo === TipoLocal.ALMACEN ? (
            <AlmacenNotice localNombre={selected.nombre} />
          ) : (
            <>
              <PublicationStatusCard
                local={selected}
                publicarEnTienda={draft.publicarEnTienda}
                onRequestPublish={handleRequestPublish}
                onRequestUnpublish={() => {
                  setEditingReason(false);
                  setUnpublishOpen(true);
                }}
                onEditReason={() => {
                  setEditingReason(true);
                  setUnpublishOpen(true);
                }}
                onReviewSchedule={() =>
                  scheduleRef.current?.scrollIntoView({ block: "start" })
                }
              />

              <StoreAddressCard
                local={selected}
                slug={draft.slug}
                isMobile={isMobile}
                online={online}
                onSlugChange={(next) => setField("slug", next)}
              />

              <PublicDataCard
                local={selected}
                draft={draft}
                isMobile={isMobile}
                onFieldChange={setField}
              />

              <Box ref={scheduleRef}>
                <ScheduleCard
                  value={draft.horarios}
                  issues={issues}
                  storedIssues={selected.horariosIssues}
                  isMobile={isMobile}
                  focusFirstIssueNonce={focusFirstIssueNonce}
                  onChange={(next) =>
                    setDraft((current) =>
                      current === null
                        ? current
                        : { ...current, horarios: next },
                    )
                  }
                />
              </Box>

              {dirty && (
                <SaveBar
                  issueCount={issues.length}
                  saving={saving}
                  online={online}
                  isMobile={isMobile}
                  onDiscard={() => setDraft(draftFromLocal(selected))}
                  onSave={handleSave}
                />
              )}

              <BrandQuestionDialog
                open={brandOpen}
                showNoContactWarning={hasNoContactAtAll(draft)}
                onClose={() => setBrandOpen(false)}
                onPublish={() => {
                  setBrandOpen(false);
                  void persist({ ...draft, publicarEnTienda: true });
                }}
              />

              <UnpublishDialog
                open={unpublishOpen}
                localNombre={selected.nombre}
                editingReason={editingReason}
                reason={draft.motivoDespublicacion}
                onReasonChange={(next) =>
                  setField("motivoDespublicacion", next)
                }
                onClose={() => setUnpublishOpen(false)}
                onConfirm={() => {
                  setUnpublishOpen(false);
                  void persist({ ...draft, publicarEnTienda: false });
                }}
              />
            </>
          )}

          {/* ONE dialog for the two ways a draft can be lost: changing local
              (F-005) and, since F-006, changing tab. Same title, same buttons,
              a second variant of the body. */}
          <AppDialog
            open={pendingLocalId !== null || pendingTab !== null}
            onClose={() => {
              setPendingLocalId(null);
              setPendingTab(null);
            }}
            title={`Tienes cambios sin guardar en «${selected.nombre}»`}
            cancelLabel="Seguir editando"
            confirm={{
              label: "Descartar y cambiar",
              onClick: () => {
                if (pendingLocalId !== null) setSelectedId(pendingLocalId);
                if (pendingTab !== null) goToTab(pendingTab);
                setPendingLocalId(null);
                setPendingTab(null);
              },
            }}
          >
            <Typography variant="body2">
              {pendingTab !== null
                ? "Si cambias de pestaña ahora, se pierden."
                : "Si cambias de local ahora, se pierden."}
            </Typography>
          </AppDialog>
        </Stack>
      )}
    </PageContainer>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary above it, and the tab lives in the
 * query string on purpose: a tab that only exists in React state cannot be
 * opened by URL, and the responsive verification renders this route inside an
 * iframe where there is nothing to click before measuring.
 */
export default function TiendaOnlineConfiguracionPage() {
  return (
    <Suspense fallback={<LoadingState variant="text" count={3} />}>
      <TiendaOnlineConfiguracionScreen />
    </Suspense>
  );
}
