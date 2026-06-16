export function saveStoredJson(key: string, payload: unknown) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(payload));
}

export function loadStoredJson<T>(
  key: string,
  normalize: (raw: unknown) => T | null,
  warningLabel: string,
) {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return normalize(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn(`${warningLabel} parse failed`, error);
    return null;
  }
}

export function clearStoredJson(key: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key);
}
