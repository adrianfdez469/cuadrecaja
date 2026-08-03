// El efectivo autocompletado se redondea SIEMPRE por exceso al siguiente
// entero (63.64 → 64). El Number(...toFixed(2)) evita que el ruido de punto
// flotante suba de más un total entero.
export function ceilCash(amount: number): number {
  return Math.ceil(Number(amount.toFixed(2)));
}

// Cuando se teclea un monto de transferencia, el efectivo se reduce para
// mantener el total pagado constante — nunca se suma aparte.
export function reduceCashForTransfer(
  cash: number,
  transfer: number,
  newTransfer: number,
): number {
  return Math.max(0, parseFloat((cash + transfer - newTransfer).toFixed(2)));
}
