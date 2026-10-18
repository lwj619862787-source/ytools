import React, { useState, useRef } from 'react';
import { Upload, Download, X, ArrowUp, ArrowDown, RefreshCw, Play, Layers } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { loadFFmpegCore } from '../lib/ffmpeg';
import { MAX_VIDEO_SIZE, MAX_VIDEO_SIZE_MB } from '../lib/constants';

const outputFormats = [
  { value: 'mp4', label: 'MP4 (H.264)', mime: 'video/mp4', ext: '.mp4' },
  { value: 'webm', label: 'WebM (VP9)', mime: 'video/webm', ext: '.webm' },
  { value: 'mkv', label: 'MKV (H.264)', mime: 'video/x-matroska', ext: '.mkv' },
];

function buildMergeArgs(inputNames: string[], outputName: string, outputFormat: string): string[] {
  const args: string[] = [];
  inputNames.forEach((n) => args.push('-i', n));

  const n = inputNames.length;
  const streamInputs = inputNames.map((_, i) => `[${i}:v][${i}:a]`).join('');
  args.push('-filter_complex', `${streamInputs}concat=n=${n}:v=1:a=1[v][a]`);
  args.push('-map', '[v]', '-map', '[a]');

  if (outputFormat === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '8', '-c:a', 'libopus');
  } else {
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac');
    if (outputFormat === 'mp4') args.push('-movflags', 'faststart');
  }

  args.push('-y', outputName);
  return args;
}

export default function MergeVideoTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [outputFormat, setOutputFormat] = useState('mp4');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadProgress, setLoadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = async () => {
    if (isLoaded) return;
    setLoadingMsg('Loading video engine (first load may take a minute)...');
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on('progress', ({ progress }) => {
      setProgress(Math.round(progress * 100));
    });

    try {
      await loadFFmpegCore(ffmpeg, (p) => setLoadProgress(Math.round(p * 100)));
      setIsLoaded(true);
      setLoadingMsg('');
    } catch (error) {
      console.error('FFmpeg load error', error);
      setLoadingMsg('Failed to load video engine. Check your network or try a different browser.');
    }
  };

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const valid = list.filter((f) => {
      if (f.size > MAX_VIDEO_SIZE) return false;
      return f.type.startsWith('video/') || /\.(mp4|webm|avi|mov|mkv|m4v|ts)$/i.test(f.name);
    });
    if (valid.length !== list.length) {
      alert(`Some files were skipped (over ${MAX_VIDEO_SIZE_MB}MB or unsupported format).`);
    }
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
      setOutputUrl(null);
      if (!isLoaded) loadFFmpeg();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setOutputUrl(null);
  };

  const moveFile = (index: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setOutputUrl(null);
  };

  const merge = async () => {
    if (files.length < 2 || !ffmpegRef.current || !isLoaded) return;
    setIsProcessing(true);
    setProgress(0);
    setOutputUrl(null);

    const ffmpeg = ffmpegRef.current;
    const inputNames: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const ext = files[i].name.split('.').pop() || 'mp4';
        const name = `input${i}.${ext}`;
        await ffmpeg.writeFile(name, await fetchFile(files[i]));
        inputNames.push(name);
      }

      const mergedName = `merged.${outputFormat}`;
      await ffmpeg.exec(buildMergeArgs(inputNames, mergedName, outputFormat));

      const data = await ffmpeg.readFile(mergedName);
      const blob = new Blob([data], { type: outputFormats.find((f) => f.value === outputFormat)?.mime || 'video/mp4' });
      setOutputUrl(URL.createObjectURL(blob));
      setOutputName(mergedName);

      for (const n of inputNames) await ffmpeg.deleteFile(n);
      await ffmpeg.deleteFile(mergedName);
    } catch (err) {
      console.error('Merge error:', err);
      alert('Merge failed. Videos may have incompatible formats/resolutions, or may be too large.');
    }

    setIsProcessing(false);
  };

  const handleDownload = () => {
    if (!outputUrl) return;
    const link = document.createElement('a');
    link.href = outputUrl;
    link.download = outputName || 'merged.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFiles([]);
    setOutputUrl(null);
    setOutputName('');
    setProgress(0);
  };

  const acceptStr = '.mp4,.webm,.avi,.mov,.mkv,.m4v,.ts';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] -z-10"></div>

        <div className="flex items-center gap-3 mb-6">
          <Layers className="w-6 h-6 text-primary-500" />
          <h3 className="text-xl font-bold text-text-main">Merge Videos</h3>
        </div>

        {files.length === 0 ? (
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[300px] ${dragOver ? 'border-primary-500 bg-primary-500/10' : 'border-white/20 hover:border-primary-500/50 hover:bg-white/5'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-text-muted mb-4" />
            <p className="text-lg font-bold text-text-main mb-2">Click or Drop Video Files</p>
            <p className="text-sm text-text-muted mb-1">Combine multiple videos into a single file</p>
            <p className="text-xs text-text-muted">Order matters — files are joined in the order added (max {MAX_VIDEO_SIZE_MB}MB each)</p>
            <input
              type="file"
              accept={acceptStr}
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-base-900/40 rounded-xl border border-white/5 overflow-hidden">
              <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <span className="text-sm font-medium text-text-main">{files.length} video{files.length > 1 ? 's' : ''} (merged in this order)</span>
                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}
                  className="text-xs text-primary-500 hover:text-primary-400 transition-colors disabled:opacity-50">
                  + Add more
                </button>
                <input type="file" accept={acceptStr} multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                {files.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-text-muted w-5 shrink-0">{i + 1}.</span>
                      <span className="text-text-main truncate max-w-[260px]">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => moveFile(i, -1)} disabled={isProcessing || i === 0}
                        className="text-text-muted hover:text-text-main transition-colors disabled:opacity-30">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveFile(i, 1)} disabled={isProcessing || i === files.length - 1}
                        className="text-text-muted hover:text-text-main transition-colors disabled:opacity-30">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeFile(i)} disabled={isProcessing}
                        className="text-text-muted hover:text-red-400 transition-colors disabled:opacity-50">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {loadingMsg && !isLoaded && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm flex items-start gap-3">
                <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
                <div className="flex-1">
                  <p>{loadingMsg}</p>
                  {loadProgress > 0 && (
                    <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 transition-all" style={{ width: `${loadProgress}%` }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {!outputUrl && (
              <>
                <div className="bg-base-900/40 p-5 rounded-xl border border-white/5">
                  <label className="text-sm font-medium text-text-main mb-3 block">Output format:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {outputFormats.map((fmt) => (
                      <button
                        key={fmt.value}
                        onClick={() => setOutputFormat(fmt.value)}
                        className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                          outputFormat === fmt.value
                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                            : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={merge}
                  disabled={isProcessing || !isLoaded || files.length < 2}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 flex flex-col items-center justify-center gap-1 relative overflow-hidden"
                >
                  {isProcessing && (
                    <div className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {isProcessing ? (
                      <><RefreshCw className="w-5 h-5 animate-spin" /> Merging {progress}%</>
                    ) : (
                      <><Play className="w-5 h-5" /> Merge {files.length} Videos</>
                    )}
                  </span>
                </button>
              </>
            )}

            {outputUrl && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
                  <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-green-400 mb-2">Merge Complete!</h4>
                  <p className="text-sm text-text-muted mb-4">{files.length} videos combined into a single {outputFormat.toUpperCase()} file.</p>
                  <button
                    onClick={handleDownload}
                    className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" /> Download Merged Video
                  </button>
                  <button onClick={reset}
                    className="w-full mt-3 py-3 bg-base-800 hover:bg-base-700 text-text-main rounded-xl font-bold transition-colors text-sm">
                    Merge More Videos
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
