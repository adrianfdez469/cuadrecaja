/**
 * Bill tallies are kept as a flat list in the order the cashier tapped
 * them, so undo is a single pop. Grouping happens only for display.
 */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumBills(bills: number[]): number {
  return round2(bills.reduce((sum, bill) => sum + bill, 0));
}

/**
 * Represents `amount` with the largest denominations first. Returns null
 * when the amount cannot be built exactly — the keypad falls back to an
 * empty tally in that case rather than showing a wrong breakdown.
 */
export function breakdownGreedy(
  amount: number,
  denominations: number[],
): number[] | null {
  if (amount < 0) return null;
  if (amount === 0) return [];

  // Filter on the cents step, not on the raw value: a denomination between
  // 0 and half a cent is positive but steps by zero, and the loop below
  // would never terminate.
  const sorted = denominations
    .filter((d) => Math.round(d * 100) > 0)
    .sort((a, b) => b - a);
  if (sorted.length === 0) return null;

  const bills: number[] = [];
  let remaining = Math.round(amount * 100);

  for (const denomination of sorted) {
    const step = Math.round(denomination * 100);
    while (remaining >= step) {
      bills.push(denomination);
      remaining -= step;
    }
  }

  return remaining === 0 ? bills : null;
}

export function tallyBills(
  bills: number[],
): Array<{ denomination: number; count: number }> {
  const counts = new Map<number, number>();
  for (const bill of bills) {
    counts.set(bill, (counts.get(bill) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => b - a)
    .map(([denomination, count]) => ({ denomination, count }));
}
