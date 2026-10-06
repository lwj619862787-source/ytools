export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

const RAPIDAPI_HOST = 'auto-download-all-in-one.p.rapidapi.com';

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
      (m: any) => m?.type === 'video' && m?.extension === 'mp4'
    );
    const best =
      videos.find((m: any) => String(m.quality || '').includes('hd_no_watermark')) ||
      videos.find((m: any) => String(m.quality || '').includes('no_watermark')) ||
      videos[0];

    const videoUrl = best?.url || data.url;
    const title = data.title || 'youtube-video';
    const thumbnail = data.thumbnail || data.cover || '';

    if (!videoUrl) {
      return json({ error: 'No downloadable video URL found' }, 422);
    }

    return json({
      success: true,
      title,
      thumbnail,
      video_url: videoUrl,
      quality: best?.quality || 'unknown',
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

    const cleanName = filename.replace(/\.mp4$/i, '').replace(/[^\w\u4e00-\u9fa5.-]+/g, '_');
    const disposition = `attachment; filename="video.mp4"; filename*=UTF-8''${encodeURIComponent(cleanName || 'youtube-video')}.mp4`;

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'video/mp4',
        'Content-Disposition': disposition,
      },
    });
  } catch (err: any) {
    return json({ error: err?.message || 'Download failed' }, 500);
  }
};
