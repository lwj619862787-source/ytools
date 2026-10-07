export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

const RAPIDAPI_HOST = 'auto-download-all-in-one.p.rapidapi.com';

const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  m3u8: 'application/vnd.apple.mpegurl',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return json({ error: 'Please enter a valid YouTube video link' }, 400);
    }
    const RAPIDAPI_KEY = env.RAPIDAPI_KEY as string | undefined;
    if (!RAPIDAPI_KEY) {
      return json({ error: 'RAPIDAPI_KEY is not configured' }, 500);
    }

    const res = await fetch(`https://${RAPIDAPI_HOST}/v1/social/autolink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      return json({ error: `Parse service is temporarily unavailable (${res.status}). Please try again later` }, 502);
    }

    const data = await res.json();
    if (data?.error === true || !Array.isArray(data?.medias)) {
      return json({ error: 'Could not parse this link. Please make sure it is a valid YouTube video URL' }, 422);
    }

    const videos = data.medias.filter(
      (m: any) => m?.type === 'video' && m?.url
    );

    const seen = new Set<string>();
    const formats: { url: string; extension: string; quality: string; label: string }[] = [];
    for (const m of videos) {
      const url = String(m.url);
      if (seen.has(url)) continue;
      seen.add(url);
      let extension = String(m.extension || '').toLowerCase();
      if (!extension && /\.m3u8($|\?)/i.test(url)) extension = 'm3u8';
      if (!extension) extension = 'mp4';
      const quality = String(m.quality || '');
      formats.push({
        url,
        extension,
        quality,
        label: quality || extension.toUpperCase(),
      });
    }

    if (formats.length === 0 && data.url) {
      formats.push({ url: String(data.url), extension: 'mp4', quality: '', label: 'MP4' });
    }

    if (formats.length === 0) {
      return json({ error: 'No downloadable video URL found' }, 422);
    }

    const best =
      formats.find((f) => f.extension === 'mp4' && f.quality.includes('hd_no_watermark')) ||
      formats.find((f) => f.extension === 'mp4' && f.quality.includes('no_watermark')) ||
      formats.find((f) => f.extension === 'mp4') ||
      formats[0];

    const title = data.title || 'youtube-video';
    const thumbnail = data.thumbnail || data.cover || '';

    return json({
      success: true,
      title,
      thumbnail,
      formats,
      video_url: best.url,
      quality: best.quality || 'unknown',
      extension: best.extension,
    });
  } catch (err: any) {
    return json({ error: err?.message || 'Internal server error' }, 500);
  }
};

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  const filename = url.searchParams.get('filename') || 'youtube-video';

  if (!target) {
    return json({ error: 'Missing video URL' }, 400);
  }

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; getallkit/1.0)' },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return json({ error: `Download failed (${upstream.status})` }, 502);
    }

    const ext = (url.searchParams.get('ext') || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';

    const cleanName = filename.replace(/\.\w+$/i, '').replace(/[^\w\u4e00-\u9fa5.-]+/g, '_');
    const disposition = `attachment; filename="video.${ext}"; filename*=UTF-8''${encodeURIComponent(cleanName || 'youtube-video')}.${ext}`;

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || MIME_MAP[ext] || 'application/octet-stream',
        'Content-Disposition': disposition,
      },
    });
  } catch (err: any) {
    return json({ error: err?.message || 'Download failed' }, 500);
  }
};
