export function startOfNextDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}