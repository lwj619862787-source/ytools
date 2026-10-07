export const prerender = false;

import type { APIRoute } from 'astro';

const UA = 'Mozilla/5.0 (compatible; getallkit/1.0)';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resolveUrl(base: string, ref: string): string {
  return new URL(ref, base).toString();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function seqToIv(seq: number): Uint8Array {
  const iv = new Uint8Array(16);
  const dv = new DataView(iv.buffer);
  dv.setUint32(8, Math.floor(seq / 0x100000000));
  dv.setUint32(12, seq >>> 0);
  return iv;
}

interface KeyInfo {
  uri: string;
  iv?: Uint8Array;
}

interface MediaPlaylist {
  url: string;
  segments: string[];
  key?: KeyInfo;
  mediaSequence: number;
}

function parseKey(line: string): KeyInfo | null {
  const method = /METHOD=([^,]+)/i.exec(line)?.[1];
  if (!method || method.toUpperCase() !== 'AES-128') return null;
  const uri = /URI="([^"]+)"/i.exec(line)?.[1];
  if (!uri) return null;
  const ivHex = /IV=0x([0-9a-fA-F]+)/i.exec(line)?.[1];
  return { uri, iv: ivHex ? hexToBytes(ivHex) : undefined };
}

async function parseMediaPlaylist(url: string): Promise<MediaPlaylist> {
  const text = await fetchText(url);
  const lines = text.split(/\r?\n/);
  const segments: string[] = [];
  let key: KeyInfo | undefined;
  let mediaSequence = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-KEY')) {
      const k = parseKey(line);
      if (k) key = { uri: resolveUrl(url, k.uri), iv: k.iv };
    } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
      mediaSequence = Number(/:\s*(\d+)/.exec(line)?.[1] || 0);
    } else if (!line.startsWith('#')) {
      segments.push(resolveUrl(url, line));
    }
  }

  return { url, segments, key, mediaSequence };
}

async function parsePlaylist(url: string): Promise<MediaPlaylist> {
  const text = await fetchText(url);
  const lines = text.split(/\r?\n/);
  const variants: { uri: string; bandwidth: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const bandwidth = Number(/BANDWIDTH=(\d+)/i.exec(line)?.[1] || 0);
      const next = lines[i + 1]?.trim();
      if (next && !next.startsWith('#')) {
        variants.push({ uri: resolveUrl(url, next), bandwidth });
      }
    }
  }

  if (variants.length > 0) {
    variants.sort((a, b) => b.bandwidth - a.bandwidth);
    return parseMediaPlaylist(variants[0].uri);
  }

  return parseMediaPlaylist(url);
}

function removePkcs7(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  const pad = data[data.length - 1];
  if (pad > 0 && pad <= 16 && pad <= data.length) {
    let ok = true;
    for (let i = data.length - pad; i < data.length; i++) {
      if (data[i] !== pad) {
        ok = false;
        break;
      }
    }
    if (ok) return data.slice(0, data.length - pad);
  }
  return data;
}

async function decrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, data);
  return removePkcs7(new Uint8Array(plain));
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  const filename = url.searchParams.get('filename') || 'video';

  if (!target) {
    return json({ error: 'Missing m3u8 URL' }, 400);
  }

  try {
    const media = await parsePlaylist(target);

    let keyBytes: Uint8Array | null = null;
    if (media.key) {
      try {
        const keyRes = await fetch(media.key.uri, { headers: { 'User-Agent': UA }, redirect: 'follow' });
        if (keyRes.ok) keyBytes = new Uint8Array(await keyRes.arrayBuffer());
      } catch {
        keyBytes = null;
      }
    }

    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (index >= media.segments.length) {
          controller.close();
          return;
        }
        const segIndex = index++;
        try {
          const res = await fetch(media.segments[segIndex], { headers: { 'User-Agent': UA }, redirect: 'follow' });
          if (!res.ok) throw new Error(`Segment HTTP ${res.status}`);
          let data = new Uint8Array(await res.arrayBuffer());
          if (keyBytes) {
            const iv = media.key?.iv ?? seqToIv(media.mediaSequence + segIndex);
            data = await decrypt(data, keyBytes, iv);
          }
          controller.enqueue(data);
        } catch (err: any) {
          controller.error(err);
        }
      },
    });

    const cleanName = filename.replace(/\.\w+$/i, '').replace(/[^\w\u4e00-\u9fa5.-]+/g, '_');
    const disposition = `attachment; filename="video.ts"; filename*=UTF-8''${encodeURIComponent(cleanName || 'video')}.ts`;

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp2t',
        'Content-Disposition': disposition,
      },
    });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to process m3u8' }, 500);
  }
};
