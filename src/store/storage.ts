export function readStoredJson<T>(
  storage: Pick<Storage, "getItem">,
  key: string,
  fallback: T,
): T {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (_) {
    return fallback;
  }
}

export function readStoredArray(
  storage: Pick<Storage, "getItem">,
  key: string,
): unknown[] {
  const value = readStoredJson<unknown>(storage, key, []);
  return Array.isArray(value) ? value : [];
}

export function readStoredRecord(
  storage: Pick<Storage, "getItem">,
  key: string,
): Record<string, unknown> {
  const value = readStoredJson<unknown>(storage, key, {});
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
