export function requiredElement<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id) as T | null;
  if (!element) throw new Error(`Missing DOM element: #${id}`);
  return element;
}
