export async function readModelIdsWithGeometry(model: { getItemsIdsWithGeometry: () => Promise<Iterable<number> | number[]> }, signal?: AbortSignal) {
  assertNotAborted(signal);
  const ids = [...(await model.getItemsIdsWithGeometry())] as number[];
  assertNotAborted(signal);
  return ids;
}

export async function readModelItems<TModel extends { getItemsData: (ids: number[], options: unknown) => Promise<unknown[]> }>(
  model: TModel,
  ids: number[],
  options: unknown,
  signal?: AbortSignal,
  chunkSize = 500,
  readOptions: { timeoutMs?: number; timeoutMessage?: string } = {},
) {
  const chunks: Array<{ ids: number[]; items: unknown[] }> = [];

  for (let index = 0; index < ids.length; index += chunkSize) {
    assertNotAborted(signal);
    const chunk = ids.slice(index, index + chunkSize);
    const items = await withTimeout(
      model.getItemsData(chunk, options),
      readOptions.timeoutMs,
      readOptions.timeoutMessage ?? "Не удалось прочитать свойства модели вовремя",
    );
    chunks.push({ ids: chunk, items });
    assertNotAborted(signal);
  }

  return chunks;
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Операция отменена", "AbortError");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined, message: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
