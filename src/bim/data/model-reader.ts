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
) {
  const chunks: Array<{ ids: number[]; items: unknown[] }> = [];

  for (let index = 0; index < ids.length; index += chunkSize) {
    assertNotAborted(signal);
    const chunk = ids.slice(index, index + chunkSize);
    const items = await model.getItemsData(chunk, options);
    chunks.push({ ids: chunk, items });
    assertNotAborted(signal);
  }

  return chunks;
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Операция отменена", "AbortError");
}
