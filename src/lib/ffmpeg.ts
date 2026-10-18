import type { FFmpeg } from '@ffmpeg/ffmpeg';

const CORE_VERSION = '0.12.9';

const CORE_BASE_URLS = [
  `https://unpkg.zhimg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
];

export type LoadProgressCallback = (progress: number) => void;

async function fetchToBlobURL(
  url: string,
  mime: string,
  onProgress?: LoadProgressCallback,
): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) {
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(received / total);
  }
  return URL.createObjectURL(new Blob(chunks, { type: mime }));
}

export async function loadFFmpegCore(
  ffmpeg: FFmpeg,
  onProgress?: LoadProgressCallback,
): Promise<void> {
  let lastError: unknown;
  for (const baseURL of CORE_BASE_URLS) {
    try {
      const coreURL = await fetchToBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await fetchToBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        'application/wasm',
        onProgress,
      );
      await ffmpeg.load({ coreURL, wasmURL });
      onProgress?.(1);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
