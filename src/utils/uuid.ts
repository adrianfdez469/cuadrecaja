/**
 * Generates a v4 UUID. `crypto.randomUUID` only exists in secure contexts
 * (HTTPS or localhost); it is unavailable on a POS served over plain HTTP by IP,
 * hence the fallback.
 */
export const generateUUID = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};
