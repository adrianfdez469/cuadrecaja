export type Currency = 'CUP' // extensible: | 'USD' | 'EUR'

export const DENOMINACIONES: Record<Currency, number[]> = {
  CUP: [1000, 200, 100, 50, 20, 10, 5, 3, 1],
}

export const DEFAULT_CURRENCY: Currency = 'CUP'
