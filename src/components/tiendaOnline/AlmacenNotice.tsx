"use client";

import { useRouter } from "next/navigation";
import { Warehouse } from "@mui/icons-material";

import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";

export interface AlmacenNoticeProps {
  /** The chosen local's name, or `null` for the «all of them are warehouses» case. */
  localNombre: string | null;
}

const LOCALES_ROUTE = "/configuracion/locales";
const ACTION_LABEL = "Ir a Locales";

/**
 * What a warehouse gets instead of the four cards.
 *
 * There is NO disabled switch, no greyed-out status card and no empty contact
 * fields: none of that exists in the DOM. Criterion 2 says «it does not offer
 * the switch», not «it offers it turned off», and a dead control with no
 * explanation produces exactly the question this avoids.
 */
export function AlmacenNotice({ localNombre }: Readonly<AlmacenNoticeProps>) {
  const router = useRouter();

  if (localNombre === null) {
    return (
      <EmptyState
        variant="empty"
        size="page"
        icon={<Warehouse sx={{ fontSize: "inherit" }} />}
        title="Ninguno de tus locales se puede publicar"
        description="Todos son almacenes. Los almacenes guardan y mueven existencias; los compradores no compran de un almacén."
        action={{
          label: ACTION_LABEL,
          onClick: () => router.push(LOCALES_ROUTE),
        }}
      />
    );
  }

  return (
    <ContentCard>
      <EmptyState
        variant="empty"
        size="compact"
        icon={<Warehouse sx={{ fontSize: "inherit" }} />}
        title="Un almacén no se publica en la tienda online"
        description={`Los almacenes guardan y mueven existencias; los compradores no compran de un almacén. Si «${localNombre}» sí vende al público, cámbiale el tipo a Tienda.`}
        action={{
          label: ACTION_LABEL,
          onClick: () => router.push(LOCALES_ROUTE),
        }}
      />
    </ContentCard>
  );
}

export default AlmacenNotice;
