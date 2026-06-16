import { API_BASE } from "../config.ts";

export type IfcConversionJob = {
  id: string;
  name: string;
  source_filename: string;
  source_path: string;
  source_size_bytes: number;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  created_at: string;
  updated_at: string;
  fragment_id: string | null;
  fragment_name: string | null;
  fragment_size_bytes: number | null;
  manifest_filename: string | null;
  error: string | null;
  source_url: string;
  artifact_url: string | null;
  manifest_url: string;
  fragment_download_url: string | null;
};

export type LargeIfcConversionResult = {
  job: IfcConversionJob;
  artifactBuffer: ArrayBuffer;
  artifactName: string;
  sourceFileName: string;
  sourceDownloadUrl: string;
  artifactDownloadUrl: string;
  manifest: Record<string, unknown>;
};

export type LargeIfcConversionOptions = {
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
  onProgress?: (progress: number) => void;
  pollIntervalMs?: number;
};

export async function convertLargeIfc(file: File, options: LargeIfcConversionOptions = {}): Promise<LargeIfcConversionResult> {
  const uploadForm = new FormData();
  uploadForm.set("name", file.name);
  uploadForm.set("file", file, file.name);

  options.onStatus?.(`Загрузка ${file.name} на сервер`);
  const response = await fetch(`${API_BASE}/ifc-conversion-jobs`, {
    method: "POST",
    body: uploadForm,
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  let job = (await response.json()) as IfcConversionJob;
  options.onProgress?.(job.progress);
  options.onStatus?.(statusLabel(job));

  const pollIntervalMs = options.pollIntervalMs ?? 750;
  while (job.status === "queued" || job.status === "running") {
    await sleep(pollIntervalMs, options.signal);
    const pollResponse = await fetch(`${API_BASE}/ifc-conversion-jobs/${job.id}`, { signal: options.signal });
    if (!pollResponse.ok) {
      throw new Error(await readError(pollResponse));
    }
    job = (await pollResponse.json()) as IfcConversionJob;
    options.onProgress?.(job.progress);
    options.onStatus?.(statusLabel(job));
  }

  if (job.status !== "completed" || !job.artifact_url || !job.fragment_download_url) {
    throw new Error(job.error ?? "Серверная конвертация IFC не завершилась успешно");
  }

  const [artifactResponse, manifestResponse] = await Promise.all([
    fetch(job.artifact_url, { signal: options.signal }),
    fetch(job.manifest_url, { signal: options.signal }),
  ]);
  if (!artifactResponse.ok) {
    throw new Error(await readError(artifactResponse));
  }
  if (!manifestResponse.ok) {
    throw new Error(await readError(manifestResponse));
  }

  return {
    job,
    artifactBuffer: await artifactResponse.arrayBuffer(),
    artifactName: `${job.source_filename}.frag`,
    sourceFileName: job.source_filename,
    sourceDownloadUrl: job.source_url,
    artifactDownloadUrl: job.artifact_url,
    manifest: (await manifestResponse.json()) as Record<string, unknown>,
  };
}

function statusLabel(job: IfcConversionJob) {
  if (job.status === "queued") return "Ожидание очереди на сервере";
  if (job.status === "running") return "Сервер конвертирует IFC в FRAG";
  if (job.status === "completed") return "Серверная конвертация завершена";
  return job.error ? `Ошибка конвертации: ${job.error}` : "Ошибка конвертации IFC";
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    }
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

async function readError(response: Response) {
  try {
    const text = await response.text();
    return text || `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
