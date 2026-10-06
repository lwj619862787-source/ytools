import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.6';

const CHINA_CORE_BASE_URLS = [
  `https://unpkg.zhimg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
];

const GLOBAL_CORE_BASE_URLS = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
];

async function detectCoreBaseUrls(): Promise<string[]> {
  try {
    const res = await fetch('/api/location');
    if (res.ok) {
      const { country } = (await res.json()) as { country?: string };
      if (country === 'CN') {
        return [...CHINA_CORE_BASE_URLS, ...GLOBAL_CORE_BASE_URLS];
      }
    }
  } catch {
    // Ignore detection failures and fall back to global mirrors.
  }
  return GLOBAL_CORE_BASE_URLS;
}

export async function loadFFmpegCore(ffmpeg: FFmpeg): Promise<void> {
  const baseURLs = await detectCoreBaseUrls();
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
