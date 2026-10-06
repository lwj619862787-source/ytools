import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.6';

const CORE_BASE_URLS = [
  `https://unpkg.zhimg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
];

async function pickFastestBaseURL(): Promise<string> {
  try {
    return await Promise.any(
      CORE_BASE_URLS.map(async (baseURL) => {
        const res = await fetch(`${baseURL}/ffmpeg-core.js`, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return baseURL;
      }),
    );
  } catch {
    return CORE_BASE_URLS[0];
  }
}

export async function loadFFmpegCore(ffmpeg: FFmpeg): Promise<void> {
  const baseURL = await pickFastestBaseURL();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
}
