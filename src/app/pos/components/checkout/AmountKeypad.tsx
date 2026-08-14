"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  Drawer,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import BackspaceOutlinedIcon from "@mui/icons-material/BackspaceOutlined";
import { BillPad } from "@/app/pos/components/checkout/BillPad";
import { breakdownGreedy, sumBills } from "@/app/pos/utils/billMath";

interface AmountKeypadProps {
  open: boolean;
  /** Currency code shown next to the amount. */
  currency: string;
  /** Active denominations for this currency; empty hides the bills tab. */
  denominations: number[];
  /** Amount the field currently holds. */
  value: number;
  /** e.g. "Efectivo CUP" */
  label: string;
  /** e.g. "Total 1.250,00" */
  pendingLabel: string;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

type KeypadTab = "keys" | "bills";

function AmountKeypadComponent({
  open,
  currency,
  denominations,
  value,
  label,
  pendingLabel,
  onClose,
  onConfirm,
}: AmountKeypadProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const minDenomination = useMemo(
    () => (denominations.length > 0 ? Math.min(...denominations) : 0.01),
    [denominations],
  );
  const allowsDecimals = minDenomination < 1;
  const hasBillsTab = denominations.length > 0;

  const [tab, setTab] = useState<KeypadTab>("keys");
  const [draft, setDraft] = useState("");
  const [bills, setBills] = useState<number[]>([]);
  // A fresh entry replaces the preloaded value instead of appending to it.
  const [pristine, setPristine] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTab("keys");
    setDraft(value > 0 ? String(value) : "");
    setBills([]);
    setPristine(true);
    // Deliberately only [open]: a `value` resync while the sheet is open
    // (e.g. usePaymentLines re-syncing the base line after a product is
    // added) must not wipe an in-progress draft. The preloaded value is
    // only meant to seed the draft at the moment the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The typed draft is never destroyed. An empty tally falls back to it, so
  // switching to Billetes with an amount the denominations cannot build
  // leaves the cashier's value intact instead of silently zeroing it.
  const usingBills = tab === "bills" && bills.length > 0;
  const amount = usingBills ? sumBills(bills) : Number(draft || 0);

  const handleTab = (next: KeypadTab) => {
    if (next === tab) return;
    if (next === "bills") {
      // Carry the typed amount over as a tally when it is representable.
      setBills(breakdownGreedy(Number(draft || 0), denominations) ?? []);
    } else if (bills.length > 0) {
      setDraft(String(sumBills(bills)));
      setPristine(true);
    }
    setTab(next);
  };

  const press = (key: string) => {
    setDraft((prev) => {
      const base = pristine ? "" : prev;
      if (key === ",") {
        return base.includes(".") ? base : `${base || "0"}.`;
      }
      return `${base}${key}`;
    });
    setPristine(false);
  };

  const backspace = () => {
    setDraft((prev) => (pristine ? "" : prev.slice(0, -1)));
    setPristine(false);
  };

  /*
    On desktop the field that opens this sheet cannot receive the physical
    keyboard: MUI's Dialog traps focus, so every keystroke lands on the
    dialog itself and used to be dropped. Listening here makes the physical
    keyboard drive the same draft the on-screen keys do — typing digits,
    Backspace to erase, Enter to confirm. Typing while the Billetes tab is
    open switches back to the keys tab, so a keystroke is never swallowed.
  */
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const { key } = event;
      const isDigit = key.length === 1 && key >= "0" && key <= "9";
      const isDecimalSeparator = key === "." || key === ",";

      if (key === "Enter") {
        event.preventDefault();
        onConfirm(amount);
        return;
      }
      if (!isDigit && !(isDecimalSeparator && allowsDecimals)) {
        if (key !== "Backspace") return;
      }
      event.preventDefault();

      // A keystroke while the Billetes tab is open returns to the keys tab
      // and starts a fresh amount — continuing a bill tally digit by digit
      // would mean nothing.
      if (tab !== "keys") {
        setTab("keys");
        setBills([]);
        setDraft("");
      }

      if (key === "Backspace") backspace();
      else press(isDecimalSeparator ? "," : key);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // `press`/`backspace`/`handleTab` are recreated every render and only
    // read state through setState updaters, so they are safe to leave out;
    // `amount` is what Enter must confirm and is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, amount, allowsDecimals, pristine, onConfirm]);

  const keys = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    allowsDecimals ? "," : "",
    "0",
    "backspace",
  ];

  const content = (
    <Stack
      gap={1.25}
      sx={{
        p: 2,
        pb: isDesktop ? 2 : "calc(16px + env(safe-area-inset-bottom))",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
      >
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {pendingLabel}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        sx={{ borderBottom: "2px solid", borderColor: "primary.main", pb: 0.5 }}
      >
        <Typography
          variant="h4"
          fontWeight={700}
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {usingBills
            ? sumBills(bills)
            : // Displayed with the es-ES decimal comma the rest of the app
              // uses; the draft itself stays a parseable dot-decimal string.
              (draft || "0").replace(".", ",")}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {currency}
        </Typography>
      </Stack>

      {hasBillsTab && (
        <Tabs
          value={tab}
          onChange={(_, next: KeypadTab) => handleTab(next)}
          variant="fullWidth"
        >
          <Tab value="keys" label="Teclado" sx={{ minHeight: 44 }} />
          <Tab value="bills" label="Billetes" sx={{ minHeight: 44 }} />
        </Tabs>
      )}

      {tab === "keys" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 0.75,
          }}
        >
          {keys.map((key, index) =>
            key === "" ? (
              <Box key={`empty-${index}`} />
            ) : (
              <Button
                key={key}
                variant="outlined"
                onClick={() => (key === "backspace" ? backspace() : press(key))}
                sx={{ minHeight: 48, fontSize: "1.1rem", fontWeight: 600 }}
              >
                {key === "backspace" ? <BackspaceOutlinedIcon /> : key}
              </Button>
            ),
          )}
        </Box>
      ) : (
        <BillPad
          denominations={denominations}
          bills={bills}
          onChange={setBills}
        />
      )}

      <Button
        variant="contained"
        color="success"
        onClick={() => onConfirm(amount)}
        sx={{ minHeight: 48, fontWeight: 700 }}
      >
        Listo
      </Button>
    </Stack>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        {content}
      </Dialog>
    );
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // The pinned cart sidebar and the mobile CartDrawer both sit at
      // theme.zIndex.drawer + 1, and MUI portals this Drawer straight to
      // document.body regardless of where it's mounted in the React tree —
      // without an explicit zIndex it defaults to theme.zIndex.drawer and
      // renders behind them.
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
      PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
    >
      {content}
    </Drawer>
  );
}

export const AmountKeypad = memo(AmountKeypadComponent);
