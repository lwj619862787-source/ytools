export const prerender = false;

import type { APIRoute } from 'astro';

const RAPIDAPI_KEY = import.meta.env.RAPIDAPI_KEY;
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
      return json({ error: '请输入有效的 YouTube 视频链接' }, 400);
    }
    if (!RAPIDAPI_KEY) {
      return json({ error: '未配置 RAPIDAPI_KEY 环境变量' }, 500);
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
      return json({ error: `解析服务暂时不可用（${res.status}），请稍后重试` }, 502);
    }

    const data = await res.json();
    if (data?.error === true || !Array.isArray(data?.medias)) {
      return json({ error: '无法解析该链接，请确认为有效的 YouTube 视频地址' }, 422);
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
      return json({ error: '未找到可下载的视频地址' }, 422);
    }

    return json({
      success: true,
      title,
      thumbnail,
      video_url: videoUrl,
      quality: best?.quality || 'unknown',
    });
  } catch (err: any) {
    return json({ error: err?.message || '服务器内部错误' }, 500);
  }
};

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  const filename = url.searchParams.get('filename') || 'youtube-video';

  if (!target) {
    return json({ error: '缺少视频地址' }, 400);
  }

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; getallkit/1.0)' },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return json({ error: `下载失败（${upstream.status}）` }, 502);
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
    return json({ error: err?.message || '下载失败' }, 500);
  }
};
