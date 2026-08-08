# POS QuantityDialog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the button-ladder quantity picker in the POS "add to cart" dialog with a directly-editable quantity field plus a minimal, step-size-driven stepper.

**Architecture:** Extract pure quantity parsing/clamping/step logic into a testable utils module, build a new `QuantityStepper` presentational component on top of it (reusing the existing `SelectableTextField` pattern), and refactor `QuantityDialog` to orchestrate the new pieces while leaving its existing stock-validation math (`getMaxQuantity`/`getMaxForDisplay`) untouched.

**Tech Stack:** Next.js 15 / React 19 / TypeScript / MUI v6 / Zustand. Tests: Vitest (`src/__tests__/*.test.ts`) — this project has no component-testing library (no React Testing Library in `devDependencies`), so only pure-function logic gets automated tests; UI components are verified manually in the browser per project convention.

## Global Constraints

- `QuantityDialogProps` (`productoTienda`, `onClose`, `onConfirm`, `onAddToCart?`, `maxDisponibleOverride?`) must not change — `ProductModal.tsx` and `page.tsx` callers are not touched.
- Existing stock-validation math (`getInitialMaxQuantity`, `getMaxQuantity`, `getMaxForDisplay`, and the `addToCart` calls inside `handleConfirmQuantity`/`handlePayAll`) must be carried over unchanged in logic — only the quantity *input* mechanism changes.
- Tapping a step-size chip changes only the active step for the ± buttons; it never changes the current quantity value.
- Clamping an out-of-range typed value on commit is silent — no error toast/snackbar.
- Zero-stock state (`maxForDisplay <= 0`) shows the text "Sin stock disponible" in place of the availability line, and the stepper shows a static disabled "0" box with no chips/± buttons.
- "Venta Rápida" button gets a caption underneath reading exactly: "Agrega y pasa directo a cobrar".
- New "use max" control label reads exactly: "Usar máximo".
- All new identifiers/comments in English; no Spanish identifiers introduced (existing Spanish names like `productoTienda`, `existencia` are preserved as-is since they're pre-existing).
- Imports use the `@/` alias; no `any` types.
- No automated component tests are being added (no test framework for that exists in this repo) — do not install new test dependencies as part of this plan.

---

### Task 1: Quantity input pure utilities

**Files:**
- Create: `src/app/pos/utils/quantityInput.ts`
- Test: `src/__tests__/quantityInput.test.ts`

**Interfaces:**
- Produces (consumed by Task 2):
  - `parseQuantityText(text: string, allowDecimal: boolean): number | null`
  - `clampQuantity(value: number, min: number, max: number, allowDecimal: boolean): number`
  - `resolveCommittedQuantity(text: string, previousValue: number, min: number, max: number, allowDecimal: boolean): number`
  - `interface QuantityStepChip { value: number; label: string }`
  - `getStepChips(allowDecimal: boolean, showBulkChip10: boolean, showBulkChip50: boolean, showBulkChip100: boolean): QuantityStepChip[]`
  - `getDefaultStep(allowDecimal: boolean): number`

- [ ] **Step 1: Write the failing test file**

Create `src/__tests__/quantityInput.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  parseQuantityText,
  clampQuantity,
  resolveCommittedQuantity,
  getStepChips,
  getDefaultStep,
} from "@/app/pos/utils/quantityInput";

describe("parseQuantityText", () => {
  it("parses a plain integer", () => {
    expect(parseQuantityText("37", false)).toBe(37);
  });

  it("parses a decimal when allowed", () => {
    expect(parseQuantityText("2.35", true)).toBe(2.35);
  });

  it("strips the decimal point when decimals are not allowed", () => {
    expect(parseQuantityText("2.35", false)).toBe(235);
  });

  it("strips non-digit characters", () => {
    expect(parseQuantityText("1a2b3", false)).toBe(123);
  });

  it("returns null for an empty string", () => {
    expect(parseQuantityText("", true)).toBeNull();
  });

  it("returns null for a lone decimal point", () => {
    expect(parseQuantityText(".", true)).toBeNull();
  });
});

describe("clampQuantity", () => {
  it("rounds to 2 decimals when decimals are allowed", () => {
    expect(clampQuantity(2.3456, 0.01, 100, true)).toBe(2.35);
  });

  it("rounds to the nearest integer when decimals are not allowed", () => {
    expect(clampQuantity(4.6, 1, 100, false)).toBe(5);
  });

  it("clamps down to max", () => {
    expect(clampQuantity(500, 1, 86, false)).toBe(86);
  });

  it("clamps up to min", () => {
    expect(clampQuantity(0, 1, 86, false)).toBe(1);
  });
});

describe("resolveCommittedQuantity", () => {
  it("commits a valid in-range value", () => {
    expect(resolveCommittedQuantity("37", 1, 1, 86, false)).toBe(37);
  });

  it("clamps an out-of-range value to max", () => {
    expect(resolveCommittedQuantity("999", 1, 1, 86, false)).toBe(86);
  });

  it("reverts to the previous value on empty input", () => {
    expect(resolveCommittedQuantity("", 5, 1, 86, false)).toBe(5);
  });

  it("reverts to the previous value on an unparsable value", () => {
    expect(resolveCommittedQuantity(".", 5, 0.01, 86, true)).toBe(5);
  });
});

describe("getStepChips", () => {
  it("returns the fixed decimal chip set for decimal-allowed products", () => {
    expect(getStepChips(true, false, false, false)).toEqual([
      { value: 0.01, label: "0.01" },
      { value: 0.1, label: "0.1" },
      { value: 0.5, label: "0.5" },
      { value: 1, label: "1" },
    ]);
  });

  it("returns only the 1 chip when no bulk thresholds are met", () => {
    expect(getStepChips(false, false, false, false)).toEqual([
      { value: 1, label: "1" },
    ]);
  });

  it("adds bulk chips as thresholds are met", () => {
    expect(getStepChips(false, true, false, false)).toEqual([
      { value: 1, label: "1" },
      { value: 10, label: "10" },
    ]);
    expect(getStepChips(false, true, true, true)).toEqual([
      { value: 1, label: "1" },
      { value: 10, label: "10" },
      { value: 50, label: "50" },
      { value: 100, label: "100" },
    ]);
  });
});

describe("getDefaultStep", () => {
  it("defaults to 0.1 for decimal-allowed products", () => {
    expect(getDefaultStep(true)).toBe(0.1);
  });

  it("defaults to 1 for integer products", () => {
    expect(getDefaultStep(false)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/quantityInput.test.ts`
Expected: FAIL — `Cannot find module '@/app/pos/utils/quantityInput'` (the module doesn't exist yet).

- [ ] **Step 3: Implement the utilities**

Create `src/app/pos/utils/quantityInput.ts`:

```ts
export interface QuantityStepChip {
  value: number;
  label: string;
}

export function parseQuantityText(
  text: string,
  allowDecimal: boolean,
): number | null {
  const cleaned = allowDecimal
    ? text.replace(/[^0-9.]/g, "")
    : text.replace(/[^0-9]/g, "");

  if (cleaned === "" || cleaned === ".") return null;

  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

export function clampQuantity(
  value: number,
  min: number,
  max: number,
  allowDecimal: boolean,
): number {
  const rounded = allowDecimal
    ? Math.round(value * 100) / 100
    : Math.round(value);

  return Math.min(Math.max(rounded, min), max);
}

export function resolveCommittedQuantity(
  text: string,
  previousValue: number,
  min: number,
  max: number,
  allowDecimal: boolean,
): number {
  const parsed = parseQuantityText(text, allowDecimal);
  if (parsed === null) return previousValue;
  return clampQuantity(parsed, min, max, allowDecimal);
}

export function getStepChips(
  allowDecimal: boolean,
  showBulkChip10: boolean,
  showBulkChip50: boolean,
  showBulkChip100: boolean,
): QuantityStepChip[] {
  if (allowDecimal) {
    return [
      { value: 0.01, label: "0.01" },
      { value: 0.1, label: "0.1" },
      { value: 0.5, label: "0.5" },
      { value: 1, label: "1" },
    ];
  }

  const chips: QuantityStepChip[] = [{ value: 1, label: "1" }];
  if (showBulkChip10) chips.push({ value: 10, label: "10" });
  if (showBulkChip50) chips.push({ value: 50, label: "50" });
  if (showBulkChip100) chips.push({ value: 100, label: "100" });
  return chips;
}

export function getDefaultStep(allowDecimal: boolean): number {
  return allowDecimal ? 0.1 : 1;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/quantityInput.test.ts`
Expected: PASS — all 17 test cases green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: no errors on the two new files.

- [ ] **Step 6: Commit**

```bash
git add src/app/pos/utils/quantityInput.ts src/__tests__/quantityInput.test.ts
git commit -m "feat(pos): add pure quantity parsing/clamping utilities"
```

---

### Task 2: `QuantityStepper` component

**Files:**
- Create: `src/app/pos/components/QuantityStepper.tsx`

**Interfaces:**
- Consumes (from Task 1): `clampQuantity`, `resolveCommittedQuantity`, `getStepChips`, `getDefaultStep`, `QuantityStepChip` from `@/app/pos/utils/quantityInput`. Also consumes `SelectableTextField` from `@/components/SelectableTextField` (existing project component — wraps MUI `TextField`, selects all text on focus).
- Produces (consumed by Task 3):
  ```ts
  interface QuantityStepperProps {
    value: number;
    onChange: (next: number) => void;
    min: number;
    max: number;
    allowDecimal: boolean;
    showBulkChip10: boolean;
    showBulkChip50: boolean;
    showBulkChip100: boolean;
    disabled: boolean;
  }
  export const QuantityStepper: React.FC<QuantityStepperProps>;
  ```

- [ ] **Step 1: Create the component**

Create `src/app/pos/components/QuantityStepper.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Box, Button, Chip, Typography, useTheme } from "@mui/material";
import { SelectableTextField } from "@/components/SelectableTextField";
import {
  clampQuantity,
  getDefaultStep,
  getStepChips,
  resolveCommittedQuantity,
} from "@/app/pos/utils/quantityInput";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  allowDecimal: boolean;
  showBulkChip10: boolean;
  showBulkChip50: boolean;
  showBulkChip100: boolean;
  disabled: boolean;
}

export const QuantityStepper = ({
  value,
  onChange,
  min,
  max,
  allowDecimal,
  showBulkChip10,
  showBulkChip50,
  showBulkChip100,
  disabled,
}: QuantityStepperProps) => {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [activeStep, setActiveStep] = useState(getDefaultStep(allowDecimal));

  const chips = getStepChips(
    allowDecimal,
    showBulkChip10,
    showBulkChip50,
    showBulkChip100,
  );

  const startEditing = () => {
    if (disabled) return;
    setDraftText(String(value));
    setEditing(true);
  };

  const commitEditing = () => {
    const next = resolveCommittedQuantity(
      draftText,
      value,
      min,
      max,
      allowDecimal,
    );
    onChange(next);
    setEditing(false);
  };

  const handleDraftChange = (text: string) => {
    const cleaned = allowDecimal
      ? text.replace(/[^0-9.]/g, "")
      : text.replace(/[^0-9]/g, "");
    setDraftText(cleaned);
  };

  const step = (delta: number) => {
    onChange(clampQuantity(value + delta, min, max, allowDecimal));
  };

  const boxSx = {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 2,
    height: { xs: 72, sm: 88 },
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  };

  if (disabled) {
    return (
      <Box sx={boxSx}>
        <Typography
          sx={{ fontSize: { xs: "2rem", sm: "2.5rem" }, fontWeight: 700 }}
          color="text.disabled"
        >
          0
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap={1.5}
      width="100%"
    >
      <Box display="flex" alignItems="center" gap={1.5} width="100%">
        <Button
          variant="contained"
          onClick={() => step(-activeStep)}
          disabled={value - activeStep < min}
        >
          −{activeStep}
        </Button>

        <Box onClick={startEditing} sx={{ ...boxSx, flex: 1, cursor: "text" }}>
          {editing ? (
            <SelectableTextField
              autoFocus
              value={draftText}
              onChange={(e) => handleDraftChange(e.target.value)}
              onBlur={commitEditing}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              inputProps={{
                inputMode: allowDecimal ? "decimal" : "numeric",
                style: {
                  textAlign: "center",
                  fontSize: "2rem",
                  fontWeight: 700,
                },
              }}
              variant="standard"
              sx={{ width: "100%" }}
            />
          ) : (
            <Typography
              sx={{
                fontSize: { xs: "2rem", sm: "2.5rem" },
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </Typography>
          )}
        </Box>

        <Button
          variant="contained"
          onClick={() => step(activeStep)}
          disabled={value + activeStep > max}
        >
          +{activeStep}
        </Button>
      </Box>

      <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center">
        {chips.map((chip) => (
          <Chip
            key={chip.value}
            label={chip.label}
            color={chip.value === activeStep ? "primary" : "default"}
            variant={chip.value === activeStep ? "filled" : "outlined"}
            onClick={() => setActiveStep(chip.value)}
          />
        ))}
      </Box>
    </Box>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file. (If `SelectableTextField`'s exported prop types differ from plain MUI `TextFieldProps`, fix the mismatch here before proceeding — do not silence with `any`.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors on the new file.

- [ ] **Step 4: Commit**

```bash
git add src/app/pos/components/QuantityStepper.tsx
git commit -m "feat(pos): add QuantityStepper component"
```

---

### Task 3: Refactor `QuantityDialog` to use the new stepper

**Files:**
- Create: `src/app/pos/components/ProductAvatarPlaceholder.tsx`
- Modify: `src/app/pos/components/QuantityDialog.tsx` (full rewrite of the file's JSX and quantity-mutation functions; the stock-math functions and `handleConfirmQuantity`/`handlePayAll` are carried over unchanged)

**Interfaces:**
- Consumes (from Task 2): `QuantityStepper` and its props from `./QuantityStepper`.
- No new interfaces produced — `QuantityDialogProps` is unchanged, so `ProductModal.tsx` and `page.tsx` require no edits.

- [ ] **Step 1: Create the avatar placeholder component**

Create `src/app/pos/components/ProductAvatarPlaceholder.tsx`:

```tsx
import { Box } from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";

export const ProductAvatarPlaceholder = () => {
  return (
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: 2,
        bgcolor: "action.hover",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.disabled",
      }}
    >
      <ImageOutlinedIcon fontSize="medium" />
    </Box>
  );
};
```

- [ ] **Step 2: Replace `QuantityDialog.tsx`**

Replace the full contents of `src/app/pos/components/QuantityDialog.tsx` with:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Button, Dialog, Typography } from "@mui/material";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { useCartStore } from "@/store/cartStore";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";
import { QuantityStepper } from "./QuantityStepper";
import { ProductAvatarPlaceholder } from "./ProductAvatarPlaceholder";

interface QuantityDialogProps {
  productoTienda: IProductoTiendaV2 | null;
  onClose: () => void;
  onConfirm: () => void;
  onAddToCart?: () => void; // Nueva prop para callback después de agregar al carrito
  maxDisponibleOverride?: number; // Máximo disponible calculado externamente (considera stock del padre para fracciones)
}

export const QuantityDialog = ({
  productoTienda,
  onClose,
  onConfirm,
  onAddToCart,
  maxDisponibleOverride,
}: QuantityDialogProps) => {
  const [quantity, setQuantity] = useState(1);
  const { addToCart, items } = useCartStore();
  const { tasasVigentes, monedaBase } = useAppContext();
  const [isDecimalInput, setIsDecimalInput] = useState(false);

  const getInitialMaxQuantity = useCallback((): number => {
    if (!productoTienda) return 0;

    const cartQuantity =
      items.find((item) => item.id === productoTienda.id)?.quantity || 0;

    if (
      typeof maxDisponibleOverride === "number" &&
      maxDisponibleOverride >= 0
    ) {
      return Math.max(0, maxDisponibleOverride - cartQuantity);
    }

    const unidadesPorFraccion = productoTienda.producto?.unidadesPorFraccion;
    const existencia = productoTienda.existencia || 0;

    if (unidadesPorFraccion && unidadesPorFraccion > 0) {
      return Math.max(0, unidadesPorFraccion - 1 - cartQuantity);
    } else {
      return Math.max(0, existencia - cartQuantity);
    }
  }, [productoTienda, items, maxDisponibleOverride]);

  useEffect(() => {
    setIsDecimalInput(productoTienda?.producto?.permiteDecimal || false);

    const maxDisponible = getInitialMaxQuantity();
    const minValue = productoTienda?.producto?.permiteDecimal ? 0.1 : 1;
    setQuantity(maxDisponible >= minValue ? minValue : 0);
  }, [productoTienda, getInitialMaxQuantity]);

  const getMaxQuantity = useCallback(
    (decrementForPrecision: number = 0): number => {
      if (!productoTienda) return 0;

      const cartQuantity =
        items.find((item) => item.id === productoTienda.id)?.quantity || 0;

      if (
        typeof maxDisponibleOverride === "number" &&
        maxDisponibleOverride >= 0
      ) {
        return Math.max(
          0,
          maxDisponibleOverride - cartQuantity - decrementForPrecision,
        );
      }

      const unidadesPorFraccion = productoTienda.producto?.unidadesPorFraccion;
      const existencia = productoTienda.existencia || 0;

      if (unidadesPorFraccion && unidadesPorFraccion > 0) {
        return Math.max(
          0,
          unidadesPorFraccion - 1 - cartQuantity - decrementForPrecision,
        );
      } else {
        return Math.max(0, existencia - cartQuantity - decrementForPrecision);
      }
    },
    [productoTienda, items, maxDisponibleOverride],
  );

  const getMaxForDisplay = useCallback((): number => {
    if (!productoTienda) return 0;

    const cartQuantity =
      items.find((item) => item.id === productoTienda.id)?.quantity || 0;

    if (
      typeof maxDisponibleOverride === "number" &&
      maxDisponibleOverride >= 0
    ) {
      return Math.max(0, maxDisponibleOverride - cartQuantity);
    }

    const unidadesPorFraccion = productoTienda.producto?.unidadesPorFraccion;
    const existencia = productoTienda.existencia || 0;

    if (unidadesPorFraccion && unidadesPorFraccion > 0) {
      return Math.max(0, unidadesPorFraccion - 1 - cartQuantity);
    } else {
      return Math.max(0, existencia - cartQuantity);
    }
  }, [productoTienda, items, maxDisponibleOverride]);

  const handleConfirmQuantity = () => {
    const maxDisponible = getMaxForDisplay();
    if (
      !productoTienda ||
      quantity <= 0 ||
      quantity > maxDisponible ||
      maxDisponible <= 0
    ) {
      return;
    }

    addToCart(
      {
        id: productoTienda.id,
        name: productoTienda.producto.nombre,
        price: productoTienda.precio,
        productoTiendaId: productoTienda.id,
        fechaVencimiento: productoTienda.fechaVencimiento ?? null,
        monedaPrecioCode: productoTienda.monedaPrecioCode ?? null,
        priceBase: convertToBase(
          productoTienda.precio,
          productoTienda.monedaPrecioCode ?? monedaBase,
          tasasVigentes,
          monedaBase,
        ),
      },
      quantity,
    );
    onClose();
    if (onAddToCart) {
      onAddToCart();
    }
  };

  const handlePayAll = () => {
    const maxDisponible = getMaxForDisplay();
    if (
      !productoTienda ||
      quantity <= 0 ||
      quantity > maxDisponible ||
      maxDisponible <= 0
    ) {
      return;
    }

    addToCart(
      {
        id: productoTienda.id,
        name: productoTienda.producto.nombre,
        price: productoTienda.precio,
        productoTiendaId: productoTienda.id,
        fechaVencimiento: productoTienda.fechaVencimiento ?? null,
        monedaPrecioCode: productoTienda.monedaPrecioCode ?? null,
        priceBase: convertToBase(
          productoTienda.precio,
          productoTienda.monedaPrecioCode ?? monedaBase,
          tasasVigentes,
          monedaBase,
        ),
      },
      quantity,
    );
    onConfirm();
    if (onAddToCart) {
      onAddToCart();
    }
  };

  const maxForDisplay = getMaxForDisplay();
  const hasStock = maxForDisplay > 0;
  const minQuantity = isDecimalInput ? 0.01 : 1;
  const stockReferenceValue = productoTienda
    ? Math.max(
        productoTienda.existencia || 0,
        productoTienda.producto?.unidadesPorFraccion || 0,
      )
    : 0;

  return (
    <Dialog open={Boolean(productoTienda)} onClose={onClose}>
      {productoTienda && (
        <Box
          p={3}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap={1}
        >
          <ProductAvatarPlaceholder />

          <Typography variant="h6" textAlign="center">
            {productoTienda.producto.nombre}
          </Typography>

          <Box sx={{ textAlign: "center", width: "100%", px: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 0.25 }}
            >
              Precio
            </Typography>
            <MultiCurrencyAmount
              amount={convertToBase(
                productoTienda.precio,
                productoTienda.monedaPrecioCode ?? monedaBase,
                tasasVigentes,
                monedaBase,
              )}
              align="center"
              sx={{ width: "100%" }}
            />
          </Box>

          {hasStock ? (
            <Typography variant="body2" color="text.secondary">
              {productoTienda.producto.unidadesPorFraccion
                ? `Stock: ${Math.max(0, productoTienda.existencia || 0)} | Máx. por venta: ${maxForDisplay}`
                : `Disponibles: ${maxForDisplay}`}
            </Typography>
          ) : (
            <Typography variant="body2" color="error.main">
              Sin stock disponible
            </Typography>
          )}

          {hasStock && (
            <Button
              size="small"
              onClick={() => setQuantity(maxForDisplay)}
              sx={{ minHeight: 0, py: 0 }}
            >
              Usar máximo
            </Button>
          )}

          <Box sx={{ width: "100%", mt: 1 }}>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={minQuantity}
              max={maxForDisplay}
              allowDecimal={isDecimalInput}
              showBulkChip10={stockReferenceValue >= 10}
              showBulkChip50={stockReferenceValue >= 50}
              showBulkChip100={stockReferenceValue >= 100}
              disabled={!hasStock}
            />
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={handleConfirmQuantity}
            disabled={
              quantity <= 0 ||
              quantity > getMaxQuantity() ||
              maxForDisplay <= 0
            }
            sx={{ mt: 2 }}
          >
            Agregar al Carrito
          </Button>

          <Box sx={{ width: "100%", mt: 2 }}>
            <Button
              variant="contained"
              color="success"
              fullWidth
              onClick={handlePayAll}
              disabled={
                quantity <= 0 ||
                quantity > getMaxQuantity() ||
                maxForDisplay <= 0
              }
            >
              Venta Rápida
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              textAlign="center"
              sx={{ mt: 0.5 }}
            >
              Agrega y pasa directo a cobrar
            </Typography>
          </Box>
        </Box>
      )}
    </Dialog>
  );
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Run the full automated test suite**

Run: `npm run test`
Expected: PASS — the pre-existing tests (`currency`, `eltoque`, `negocioConfigAccess`, `health`) and the new `quantityInput` tests all pass; nothing in this refactor touches their subject matter.

- [ ] **Step 6: Manual verification in the browser**

Run: `npm run dev`, open the POS view, and for a store with real product data exercise:

1. Tap a normal (non-fraction, integer) product with stock ≥ 100 → confirm the "1/10/50/100" chips all appear, tapping a chip changes only what ± does (not the current quantity), ±100 respects the max, typing a number directly into the box and blurring commits it clamped to available stock.
2. Tap a decimal/fraction product (`permiteDecimal`/`unidadesPorFraccion` set) → confirm chips are "0.01/0.1/0.5/1", typing e.g. `2.357` commits as `2.36` (rounded to 2 decimals) and clamped to `Máx. por venta`.
3. Tap a product whose stock is between 10 and 50 → confirm only the "1" and "10" chips render (no "50"/"100").
4. Tap a product with zero available stock → confirm "Sin stock disponible" replaces the availability line, the quantity box shows a disabled "0", no chips/± buttons render, and both CTA buttons stay disabled.
5. Tap "Usar máximo" → confirm quantity jumps to the displayed max and the "+" step button becomes disabled at that value.
6. Type an out-of-range value (e.g. more than available) into the box and blur → confirm it silently clamps to the max with no error toast.
7. Type nothing (clear the field) and blur → confirm it reverts to the last valid quantity instead of committing 0.
8. Confirm "Agregar al Carrito" adds the item and closes the dialog, and "Venta Rápida" (with its new caption visible) adds the item and proceeds to checkout — same as before the refactor.

- [ ] **Step 7: Commit**

```bash
git add src/app/pos/components/ProductAvatarPlaceholder.tsx src/app/pos/components/QuantityDialog.tsx
git commit -m "refactor(pos): replace QuantityDialog button ladder with QuantityStepper"
```
