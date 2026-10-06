import React, { useState } from 'react';

interface VideoResult {
  title: string;
  thumbnail: string;
  video_url: string;
  quality: string;
  error?: string;
}

function sanitizeName(name: string) {
  return (name || 'youtube-video').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 100) || 'youtube-video';
}

export default function YoutubeVideoDownloaderTool() {
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
      setProgress(`解析中 ${i + 1}/${links.length}...`);
      try {
        const req = await fetch('/api/youtube-downloader', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: links[i] }),
        });
        const data = await req.json();
        if (data.error) {
          out.push({ title: links[i], thumbnail: '', video_url: '', quality: '', error: data.error });
        } else {
          out.push({ title: data.title, thumbnail: data.thumbnail, video_url: data.video_url, quality: data.quality });
        }
      } catch (e) {
        out.push({ title: links[i], thumbnail: '', video_url: '', quality: '', error: '请求失败，请检查网络' });
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

  const validResults = results.filter(r => r.video_url);
  const allSelected = validResults.length > 0 && validResults.every(r => selected.has(r.video_url));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(validResults.map(r => r.video_url)));
  };

  const proxyUrl = (r: VideoResult) =>
    `/api/youtube-downloader?url=${encodeURIComponent(r.video_url)}&filename=${encodeURIComponent(r.title)}`;

  const downloadZip = async () => {
    const chosen = validResults.filter(r => selected.has(r.video_url));
    if (chosen.length === 0 || zipping) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (let i = 0; i < chosen.length; i++) {
        const r = chosen[i];
        setProgress(`打包中 ${i + 1}/${chosen.length}...`);
        const resp = await fetch(proxyUrl(r));
        if (!resp.ok) continue;
        const blob = await resp.blob();
        zip.file(`${sanitizeName(r.title)}.mp4`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'youtube-videos.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert('打包失败，请重试');
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
          placeholder={'每行一个 YouTube 链接，支持批量下载\n例如：\nhttps://www.youtube.com/watch?v=...\nhttps://youtu.be/...'}
          className="w-full bg-base-900 border border-black/10 dark:border-white/10 rounded-xl p-3 text-text-main resize-y"
        />
        <p className="text-xs text-text-muted mt-2">{links.length > 0 ? `已输入 ${links.length} 个链接` : '每行一个链接'}</p>
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={parseAll}
          disabled={loading || links.length === 0}
          className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl font-bold transition-colors"
        >
          {loading ? progress || '解析中...' : `解析全部（${links.length}）`}
        </button>
      </div>

      {(loading || zipping) && progress && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm mb-4">{progress}</div>
      )}

      {validResults.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4" />
            全选（{selected.size}/{validResults.length}）
          </label>
          <button
            onClick={downloadZip}
            disabled={zipping || selected.size === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
          >
            {zipping ? '打包中...' : `打包 ZIP（${selected.size}）`}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {results.map((r, i) => (
          <div key={i} className="flex items-start gap-3 bg-base-900/50 border border-black/10 dark:border-white/10 rounded-xl p-3">
            {r.video_url && (
              <input type="checkbox" checked={selected.has(r.video_url)} onChange={() => toggle(r.video_url)} className="w-4 h-4 mt-1 shrink-0" />
            )}
            {r.thumbnail ? (
              <img src={r.thumbnail} alt="" className="w-20 h-12 object-cover rounded-lg shrink-0" />
            ) : (
              <div className="w-20 h-12 rounded-lg bg-base-800 flex items-center justify-center shrink-0 text-xs text-text-muted">无图</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-text-main text-sm font-medium truncate">{r.title}</p>
              {r.error ? (
                <p className="text-red-500 text-xs mt-1">{r.error}</p>
              ) : (
                <p className="text-text-muted text-xs mt-1">{r.quality}</p>
              )}
            </div>
            {r.video_url ? (
              <a
                href={proxyUrl(r)}
                download
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-sm shrink-0 transition-colors"
              >
                下载
              </a>
            ) : (
              <span className="px-3 py-2 text-xs text-red-500 shrink-0">失败</span>
            )}
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && (
        <p className="text-center text-text-muted text-sm py-6">粘贴链接后点击「解析全部」，即可批量下载。</p>
      )}
    </div>
  );
}
