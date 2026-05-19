/**
 * Returns an array with unique elements by a given field.
 * By default keeps the first occurrence.
 * @param arr - Source array
 * @param field - Field name to deduplicate by
 * @param replace - Optional function (current, candidate) => boolean.
 *                  Return true to swap current for candidate, false to keep current.
 */
export function uniqueBy<T>(
  arr: T[],
  field: keyof T,
  replace?: (current: T, candidate: T) => boolean
): T[] {
  const map = new Map<T[keyof T], T>();

  for (const item of arr) {
    const key = item[field];
    if (!map.has(key)) {
      map.set(key, item);
    } else if (replace && replace(map.get(key)!, item)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}
