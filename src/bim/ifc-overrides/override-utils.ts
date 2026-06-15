export function parseOverrideValue(input: string) {
  const text = input.trim();
  if (!text) return null;
  if (text === "true") return true;
  if (text === "false") return false;
  const numeric = Number(text);
  if (Number.isFinite(numeric) && String(numeric) === text.replace(/\s+/g, " ")) return numeric;
  return text;
}
