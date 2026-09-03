"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getNegociosQabSettings,
  provisionNegocioInQab,
  saveQabTokenManually,
  setTiendaOnlineHabilitada,
} from "@/services/qabNegocioService";
import type {
  INegocioQabSettingsItem,
  IQabAutoProvisioningUnavailableReason,
} from "@/schemas/qabNegocio";
import type { INegocioQabProvisioningResult } from "@/schemas/qabProvisioning";

export interface IUseNegociosQabSettings {
  /** Indexed by `negocioId`; the screen already has the names from `getNegocios()`. */
  settingsByNegocioId: Map<string, INegocioQabSettingsItem>;
  autoProvisioningAvailable: boolean;
  autoProvisioningUnavailableReason: IQabAutoProvisioningUnavailableReason | null;
  loading: boolean;
  /**
   * Extension over the interface contract: the design requires the screen to
   * tell "the QAB block could not be loaded" apart from "there is nothing to
   * show", and neither `loading` nor an empty map can express that.
   */
  loadError: boolean;
  reload: () => Promise<void>;
  toggleTiendaOnline: (negocioId: string, enabled: boolean) => Promise<void>;
  /** Propagates `QabProvisioningError` so the screen can tell the codes apart. */
  provision: (negocioId: string) => Promise<INegocioQabProvisioningResult>;
  saveTokenManually: (negocioId: string, token: string) => Promise<void>;
}

/**
 * All the state of the QAB block of `/configuracion/negocios`, and its four
 * operations.
 *
 * NO Zustand store, on purpose (interface contract): this state lives in one
 * superadministrator screen, nobody else shares it and it is not persisted - a
 * global store would be extra surface for something that guards a secret.
 *
 * Nothing here ever holds a credential: the pasted value lives in the dialog's
 * own local state and is handed straight to the service.
 */
export function useNegociosQabSettings(): IUseNegociosQabSettings {
  const [settingsByNegocioId, setSettingsByNegocioId] = useState<
    Map<string, INegocioQabSettingsItem>
  >(new Map());
  const [autoProvisioningAvailable, setAutoProvisioningAvailable] = useState(false);
  const [autoProvisioningUnavailableReason, setAutoProvisioningUnavailableReason] =
    useState<IQabAutoProvisioningUnavailableReason | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const applyItem = useCallback((item: INegocioQabSettingsItem) => {
    setSettingsByNegocioId((previous) => {
      const next = new Map(previous);
      next.set(item.negocioId, item);
      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getNegociosQabSettings();
      setSettingsByNegocioId(
        new Map(list.negocios.map((item) => [item.negocioId, item])),
      );
      setAutoProvisioningAvailable(list.autoProvisioningAvailable);
      setAutoProvisioningUnavailableReason(list.autoProvisioningUnavailableReason);
      setLoadError(false);
    } catch {
      // The failure is state, not a log line: the screen shows it and offers
      // `reload`. Nothing about the response is written anywhere.
      setSettingsByNegocioId(new Map());
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleTiendaOnline = useCallback(
    async (negocioId: string, enabled: boolean) => {
      const item = await setTiendaOnlineHabilitada(negocioId, enabled);
      applyItem(item);
    },
    [applyItem],
  );

  const provision = useCallback(
    async (negocioId: string) => {
      const result = await provisionNegocioInQab(negocioId);
      applyItem(result.settings);
      return result;
    },
    [applyItem],
  );

  const saveTokenManually = useCallback(
    async (negocioId: string, token: string) => {
      const item = await saveQabTokenManually(negocioId, token);
      applyItem(item);
    },
    [applyItem],
  );

  return {
    settingsByNegocioId,
    autoProvisioningAvailable,
    autoProvisioningUnavailableReason,
    loading,
    loadError,
    reload,
    toggleTiendaOnline,
    provision,
    saveTokenManually,
  };
}
