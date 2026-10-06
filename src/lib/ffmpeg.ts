import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.9';

const CORE_BASE_URLS = [
  `https://unpkg.zhimg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
];

async function rankBaseURLs(): Promise<string[]> {
  const results = await Promise.allSettled(
    CORE_BASE_URLS.map(async (baseURL) => {
      const start = Date.now();
      const res = await fetch(`${baseURL}/ffmpeg-core.js`, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { baseURL, time: Date.now() - start };
    }),
  );

  const ranked = results
    .filter((r): r is PromiseFulfilledResult<{ baseURL: string; time: number }> => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => a.time - b.time)
    .map((r) => r.baseURL);

  const failed = CORE_BASE_URLS.filter((u) => !ranked.includes(u));
  return [...ranked, ...failed];
}

export async function loadFFmpegCore(ffmpeg: FFmpeg): Promise<void> {
  const baseURLs = await rankBaseURLs();
  let lastError: unknown;
  for (const baseURL of baseURLs) {
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
