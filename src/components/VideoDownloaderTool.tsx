import React, { useState } from 'react';

interface VideoFormat {
  url: string;
  extension: string;
  quality: string;
  label: string;
}

interface VideoResult {
  title: string;
  thumbnail: string;
  formats: VideoFormat[];
  error?: string;
}

function sanitizeName(name: string) {
  return (name || 'video').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 100) || 'video';
}

export default function VideoDownloaderTool() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [results, setResults] = useState<VideoResult[]>([]);
  const [progress, setProgress] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const links = input.split('\n').map(s => s.trim()).filter(Boolean);

  const parseAll = async () => {
    if (links.length === 0 || loading) return;
    setLoading(true);
    setResults([]);
    setSelected(new Set());
    const out: VideoResult[] = [];
    for (let i = 0; i < links.length; i++) {
      setProgress(`Parsing ${i + 1}/${links.length}...`);
      try {
        const req = await fetch('/api/youtube-downloader', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: links[i] }),
        });
        const data = await req.json();
        if (data.error) {
          out.push({ title: links[i], thumbnail: '', formats: [], error: data.error });
        } else {
          out.push({ title: data.title, thumbnail: data.thumbnail, formats: data.formats || [] });
        }
      } catch (e) {
          out.push({ title: links[i], thumbnail: '', formats: [], error: 'Request failed. Please check your network' });
      }
      setResults([...out]);
    }
    setProgress('');
    setLoading(false);
  };

  const toggle = (url: string) => {
    const next = new Set(selected);
    if (next.has(url)) next.delete(url); else next.add(url);
    setSelected(next);
  };

  const allFormats = results.flatMap(r =>
    r.formats.map(f => ({ ...f, title: r.title }))
  );
  const validFormats = allFormats.filter(f => f.url);
  const allSelected = validFormats.length > 0 && validFormats.every(f => selected.has(f.url));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(validFormats.map(f => f.url)));
  };

  const fileExt = (ext: string) => (ext === 'm3u8' ? 'ts' : ext || 'mp4');

  const downloadHref = (f: VideoFormat, title: string) => {
    if (f.extension === 'm3u8') {
      return `/api/hls?url=${encodeURIComponent(f.url)}&filename=${encodeURIComponent(title)}`;
    }
    return `/api/youtube-downloader?url=${encodeURIComponent(f.url)}&filename=${encodeURIComponent(title)}&ext=${encodeURIComponent(f.extension)}`;
  };

  const downloadZip = async () => {
    const chosen = validFormats.filter(f => selected.has(f.url));
    if (chosen.length === 0 || zipping) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (let i = 0; i < chosen.length; i++) {
        const f = chosen[i];
        setProgress(`Zipping ${i + 1}/${chosen.length}...`);
        const resp = await fetch(downloadHref(f, f.title));
        if (!resp.ok) continue;
        const blob = await resp.blob();
        const ext = fileExt(f.extension);
        const base = sanitizeName(f.title);
        const suffix = f.quality ? '-' + sanitizeName(f.quality) : '';
        let name = `${base}${suffix}.${ext}`;
        let n = 1;
        while (usedNames.has(name)) name = `${base}${suffix}-${n++}.${ext}`;
        usedNames.add(name);
        zip.file(name, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'videos.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert('Failed to create ZIP. Please try again');
    }
    setZipping(false);
    setProgress('');
  };

  return (
    <div className="max-w-2xl mx-auto glass-panel p-6 rounded-2xl">
      <div className="mb-4">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={4}
          placeholder={'One video link per line, supports batch download\nSupports YouTube, TikTok, Instagram, Facebook and more\nExamples:\nhttps://www.youtube.com/watch?v=...\nhttps://www.tiktok.com/@user/video/...'}
          className="w-full bg-base-900 border border-black/10 dark:border-white/10 rounded-xl p-3 text-text-main resize-y"
        />
        <p className="text-xs text-amber-500/90 mt-2 font-medium">
          Make sure you have the right to download this content. Copyrighted content is protected — download only videos you own or are authorized to use.
        </p>
        <p className="text-xs text-text-muted mt-1">{links.length > 0 ? `${links.length} link(s) entered` : 'One link per line'}</p>
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={parseAll}
          disabled={loading || links.length === 0}
          className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl font-bold transition-colors"
        >
          {loading ? progress || 'Parsing...' : `Parse All (${links.length})`}
        </button>
      </div>

      {(loading || zipping) && progress && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm mb-4">{progress}</div>
      )}

      {validFormats.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4" />
             Select All ({selected.size}/{validFormats.length})
          </label>
          <button
            onClick={downloadZip}
            disabled={zipping || selected.size === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
          >
            {zipping ? 'Zipping...' : `Download ZIP (${selected.size})`}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {results.map((r, i) => (
          <div key={i} className="bg-base-900/50 border border-black/10 dark:border-white/10 rounded-xl p-3">
            <div className="flex items-start gap-3">
              {r.thumbnail ? (
                <img src={r.thumbnail} alt="" className="w-20 h-12 object-cover rounded-lg shrink-0" />
              ) : (
                <div className="w-20 h-12 rounded-lg bg-base-800 flex items-center justify-center shrink-0 text-xs text-text-muted">No image</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-text-main text-sm font-medium truncate">{r.title}</p>
                {r.error ? (
                  <p className="text-red-500 text-xs mt-1">{r.error}</p>
                ) : (
                  <p className="text-text-muted text-xs mt-1">{r.formats.length} format(s) available</p>
                )}
              </div>
            </div>

            {!r.error && r.formats.length > 0 && (
              <div className="mt-3 space-y-2">
                {r.formats.map((f, j) => (
                  <div key={j} className="flex items-center gap-3 pl-2">
                    <input type="checkbox" checked={selected.has(f.url)} onChange={() => toggle(f.url)} className="w-4 h-4 shrink-0" />
                    <span className="text-xs text-text-muted truncate flex-1">{f.label}</span>
                    <a
                      href={downloadHref(f, r.title)}
                      download
                      className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-xs shrink-0 transition-colors"
                    >
                      Download .{fileExt(f.extension)}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && (
        <p className="text-center text-text-muted text-sm py-6">Paste links and click "Parse All" to download in bulk.</p>
      )}
    </div>
  );
}
