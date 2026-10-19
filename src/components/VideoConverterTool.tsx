import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, RefreshCw, Play, X, Plus, Archive, FileVideo } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import JSZip from 'jszip';
import { loadFFmpegCore } from '../lib/ffmpeg';
import { MAX_VIDEO_SIZE, MAX_VIDEO_SIZE_MB } from '../lib/constants';

interface FormatOption {
  value: string;
  label: string;
  mime: string;
  ext: string;
}

interface OutputEntry {
  name: string;
  blob: Blob;
  url: string;
  size: number;
  originalSize: number;
}

const inputFormats: FormatOption[] = [
  { value: 'mp4', label: 'MP4', mime: 'video/mp4', ext: '.mp4' },
  { value: 'webm', label: 'WebM', mime: 'video/webm', ext: '.webm' },
  { value: 'avi', label: 'AVI', mime: 'video/avi', ext: '.avi' },
  { value: 'mov', label: 'MOV', mime: 'video/quicktime', ext: '.mov' },
  { value: 'mkv', label: 'MKV', mime: 'video/x-matroska', ext: '.mkv' },
  { value: 'gif', label: 'GIF', mime: 'image/gif', ext: '.gif' },
];

const outputFormats: FormatOption[] = [
  { value: 'mp4', label: 'MP4 (H.264)', mime: 'video/mp4', ext: '.mp4' },
  { value: 'webm', label: 'WebM (VP9)', mime: 'video/webm', ext: '.webm' },
  { value: 'gif', label: 'Animated GIF', mime: 'image/gif', ext: '.gif' },
  { value: 'avi', label: 'AVI', mime: 'video/avi', ext: '.avi' },
  { value: 'mkv', label: 'MKV (H.264)', mime: 'video/x-matroska', ext: '.mkv' },
  { value: 'mov', label: 'MOV', mime: 'video/quicktime', ext: '.mov' },
];

const QUALITY_OPTIONS = [
  { value: 'high', label: 'Light (best quality)' },
  { value: 'medium', label: 'Balanced (recommended)' },
  { value: 'small', label: 'Strong (smallest size)' },
];

const RESOLUTION_OPTIONS = [
  { value: 'original', label: 'Original' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
];

const FPS_OPTIONS = [
  { value: 'original', label: 'Original' },
  { value: '60', label: '60 fps' },
  { value: '30', label: '30 fps' },
  { value: '24', label: '24 fps' },
];

const AUDIO_BITRATE_OPTIONS = ['128k', '192k', '256k'];
const TARGET_SIZES = [8, 10, 20, 25];

const X264_CRF: Record<string, number> = { high: 18, medium: 23, small: 28 };
const VP9_CRF: Record<string, number> = { high: 24, medium: 30, small: 40 };
const AVI_QV: Record<string, number> = { high: 2, medium: 5, small: 8 };

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function getDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const d = v.duration || 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    v.src = url;
  });
}

function getPreset() {
  if (typeof window === 'undefined') return { from: null, to: null };
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  const to = params.get('to');
  const validTo = outputFormats.some((f) => f.value === to);
  const validFrom = inputFormats.some((f) => f.value === from);
  return {
    from: from && validFrom ? from : null,
    to: to && validTo ? to : null,
  };
}

function getPresetSize() {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('size');
  const n = parseFloat(raw || '');
  return n > 0 && n <= 200 ? n : null;
}

export default function VideoConverterTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [outputs, setOutputs] = useState<OutputEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadProgress, setLoadProgress] = useState(0);
  const [outputFormat, setOutputFormat] = useState(() => getPreset().to || 'mp4');
  const [hdrToSdr, setHdrToSdr] = useState(false);
  const [quality, setQuality] = useState('medium');
  const [resolution, setResolution] = useState('original');
  const [fps, setFps] = useState('original');
  const [audioBitrate, setAudioBitrate] = useState('192k');
  const [compressionMode, setCompressionMode] = useState<'quality' | 'target'>(() => (getPresetSize() ? 'target' : 'quality'));
  const [targetSize, setTargetSize] = useState<number | null>(() => getPresetSize());
  const [customTargetSize, setCustomTargetSize] = useState('');
  const [trimEnabled, setTrimEnabled] = useState(false);
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd, setTrimEnd] = useState('');
  const [remainingTime, setRemainingTime] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const presetFrom = getPreset().from;
  const isCompressPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/video-compress');

  const loadFFmpeg = async () => {
    if (isLoaded) return;
    setLoadingMsg('Loading video engine (first load may take a minute)...');
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on('progress', ({ progress, time }) => {
      setProgress(Math.round(progress * 100));
      const total = durationRef.current;
      if (total > 0 && time > 0) {
        setRemainingTime(formatDuration(total - time / 1_000_000));
      }
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
      return inputFormats.some((fmt) => fmt.ext === `.${(f.name.split('.').pop() || '').toLowerCase()}`) || f.type.startsWith('video/');
    });
    if (valid.length !== list.length) {
      alert(`Some files were skipped (over ${MAX_VIDEO_SIZE_MB}MB or unsupported format).`);
    }
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
      setOutputs([]);
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
    setOutputs([]);
  };

  const buildArgs = (inputName: string, outputName: string): string[] => {
    const args: string[] = [];
    if (trimEnabled) {
      if (trimStart) args.push('-ss', trimStart);
      if (trimEnd) args.push('-to', trimEnd);
    }
    args.push('-i', inputName);

    if (outputFormat === 'gif') {
      args.push('-vf', 'fps=10,scale=480:-1:flags=lanczos', '-loop', '0');
    } else {
      const vf: string[] = [];
      if (hdrToSdr) vf.push('scale=in_color_matrix=bt2020:out_color_matrix=bt709');
      if (resolution !== 'original') vf.push(`scale=-2:${resolution}`);
      if (fps !== 'original') vf.push(`fps=${fps}`);

      if (outputFormat === 'webm') {
        args.push('-c:v', 'libvpx-vp9', '-crf', String(VP9_CRF[quality]), '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '8');
        args.push('-c:a', 'libopus', '-b:a', audioBitrate);
        vf.push('format=yuv420p');
      } else if (outputFormat === 'avi') {
        args.push('-c:v', 'mpeg4', '-q:v', String(AVI_QV[quality]));
        args.push('-c:a', 'libmp3lame', '-b:a', audioBitrate);
      } else {
        if (compressionMode === 'target' && targetSize && outputFormat === 'mp4') {
          const durationSec = durationRef.current;
          const audioKbps = parseInt(audioBitrate, 10);
          const totalBits = targetSize * 8 * 1024 * 1024;
          const audioBits = durationSec > 0 ? audioKbps * 1000 * durationSec : 0;
          const videoBits = Math.max(totalBits - audioBits, totalBits * 0.85);
          const videoKbps = durationSec > 0 ? Math.round(videoBits / 1000 / durationSec) : 2000;
          args.push('-c:v', 'libx264', '-preset', 'medium', '-b:v', `${videoKbps}k`, '-maxrate', `${videoKbps}k`, '-bufsize', `${videoKbps * 2}k`);
        } else {
          args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', String(X264_CRF[quality]));
        }
        args.push('-c:a', 'aac', '-b:a', audioBitrate);
        vf.push('format=yuv420p');
        if (outputFormat === 'mp4') args.push('-movflags', 'faststart');
      }

      if (vf.length > 0) args.push('-vf', vf.join(','));
    }

    args.push('-y', outputName);
    return args;
  };

  const processFile = async (file: File): Promise<OutputEntry | null> => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) return null;

    const inputExt = file.name.split('.').pop() || 'mp4';
    const inputName = `input.${inputExt}`;
    const outputName = `output.${outputFormat}`;
    const baseName = file.name.replace(/\.[^/.]+$/, '');

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      await ffmpeg.exec(buildArgs(inputName, outputName));
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: outputFormats.find((f) => f.value === outputFormat)?.mime || 'video/mp4' });
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      return { name: `${baseName}.${outputFormat}`, blob, url: URL.createObjectURL(blob), size: blob.size, originalSize: file.size };
    } catch (err) {
      console.error('Processing error:', err);
      return null;
    }
  };

  const processBatch = async () => {
    if (files.length === 0 || !isLoaded) return;
    setIsProcessing(true);
    setOutputs([]);
    const results: OutputEntry[] = [];

    for (let i = 0; i < files.length; i++) {
      setCurrentIndex(i);
      setProgress(0);
      setRemainingTime(null);
      durationRef.current = await getDuration(files[i]);
      const result = await processFile(files[i]);
      if (result) results.push(result);
    }

    setOutputs(results);
    setCurrentIndex(-1);
    setProgress(0);
    setRemainingTime(null);
    setIsProcessing(false);
  };

  const downloadOne = (entry: OutputEntry) => {
    const link = document.createElement('a');
    link.href = entry.url;
    link.download = entry.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = async () => {
    if (outputs.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      outputs.forEach((o) => zip.file(o.name, o.blob));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'converted-files.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsZipping(false);
    }
  };

  const reset = () => {
    outputs.forEach((o) => URL.revokeObjectURL(o.url));
    setFiles([]);
    setOutputs([]);
    setProgress(0);
    setRemainingTime(null);
    setCurrentIndex(-1);
  };

  const acceptStr = inputFormats.map((f) => f.ext).join(',');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] -z-10"></div>

        <div className="flex items-center gap-3 mb-6">
          <FileVideo className="w-6 h-6 text-primary-500" />
          <h3 className="text-xl font-bold text-text-main">{isCompressPage ? 'Video Compressor' : 'Video Converter'}</h3>
        </div>

        {(presetFrom || outputFormat) && files.length === 0 && (
          <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl text-sm text-text-main flex items-center gap-2">
            <span className="font-bold">Preset:</span>
            <span className="uppercase">{presetFrom || 'any video'}</span>
            <span className="text-text-muted">→</span>
            <span className="uppercase">{outputFormat}</span>
          </div>
        )}

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
            <p className="text-sm text-text-muted mb-1">Supports MP4 / WebM / AVI / MOV / MKV / GIF (incl. iPhone HEVC/HDR)</p>
            <p className="text-xs text-text-muted">Multiple files supported — up to {MAX_VIDEO_SIZE_MB}MB each</p>
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
                <span className="text-sm font-medium text-text-main">{files.length} file{files.length > 1 ? 's' : ''}</span>
                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}
                  className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-400 transition-colors disabled:opacity-50">
                  <Plus className="w-4 h-4" /> Add more
                </button>
                <input type="file" accept={acceptStr} multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                {files.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-text-main truncate max-w-[300px]">{file.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
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

            {outputs.length === 0 && (
              <>
                <div className="bg-base-900/40 p-5 rounded-xl border border-white/5">
                  <label className="text-sm font-medium text-text-main mb-3 block">Convert to:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {outputFormats.map((fmt) => (
                      <button
                        key={fmt.value}
                        onClick={() => setOutputFormat(fmt.value)}
                        disabled={compressionMode === 'target' && fmt.value !== 'mp4'}
                        className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                          outputFormat === fmt.value
                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                            : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'
                        } ${compressionMode === 'target' && fmt.value !== 'mp4' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {outputFormat !== 'gif' && (
                  <div className="bg-base-900/40 p-5 rounded-xl border border-white/5 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-text-main mb-2 block">Compression method:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setCompressionMode('quality')}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${compressionMode === 'quality' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'}`}>
                          Quality
                        </button>
                        <button onClick={() => { setCompressionMode('target'); setOutputFormat('mp4'); if (!targetSize) setTargetSize(8); }}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${compressionMode === 'target' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'}`}>
                          Target size
                        </button>
                      </div>
                    </div>

                    {compressionMode === 'quality' ? (
                      <div>
                        <label className="text-sm font-medium text-text-main mb-2 block">Compression level:</label>
                        <div className="grid grid-cols-3 gap-2">
                          {QUALITY_OPTIONS.map((opt) => (
                            <button key={opt.value} onClick={() => setQuality(opt.value)}
                              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                quality === opt.value ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'
                              }`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-sm font-medium text-text-main mb-2 block">Target size:</label>
                        <div className="grid grid-cols-4 gap-2">
                          {TARGET_SIZES.map((size) => (
                            <button key={size} onClick={() => setTargetSize(size)}
                              className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${targetSize === size ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'}`}>
                              {size}MB
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <input
                            type="number"
                            min="1"
                            max="200"
                            placeholder="Custom MB"
                            value={customTargetSize}
                            onChange={(e) => setCustomTargetSize(e.target.value)}
                            className="w-full bg-base-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary-500"
                          />
                          <button onClick={() => { const v = parseFloat(customTargetSize); if (v > 0) setTargetSize(v); }}
                            className="shrink-0 px-4 py-2 bg-base-800 hover:bg-base-700 text-text-main rounded-lg text-sm font-medium transition-colors">
                            Set
                          </button>
                        </div>
                        <p className="text-xs text-text-muted mt-2">Approximate (±15%). Very long videos may look blurry at small target sizes.</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-text-main mb-2 block">Resolution:</label>
                      <div className="grid grid-cols-4 gap-2">
                        {RESOLUTION_OPTIONS.map((opt) => (
                          <button key={opt.value} onClick={() => setResolution(opt.value)}
                            className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                              resolution === opt.value ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'
                            }`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-text-main mb-2 block">Frame rate:</label>
                      <div className="grid grid-cols-4 gap-2">
                        {FPS_OPTIONS.map((opt) => (
                          <button key={opt.value} onClick={() => setFps(opt.value)}
                            className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                              fps === opt.value ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'
                            }`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-text-main mb-2 block">Audio bitrate:</label>
                      <div className="grid grid-cols-3 gap-2">
                        {AUDIO_BITRATE_OPTIONS.map((opt) => (
                          <button key={opt} onClick={() => setAudioBitrate(opt)}
                            className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                              audioBitrate === opt ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'
                            }`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
                  <input type="checkbox" checked={hdrToSdr} onChange={(e) => setHdrToSdr(e.target.checked)} className="w-4 h-4" />
                  Convert HDR to SDR (check if iPhone HDR video looks washed out)
                </label>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
                    <input type="checkbox" checked={trimEnabled} onChange={(e) => setTrimEnabled(e.target.checked)} className="w-4 h-4" />
                    Trim video (cut a segment)
                  </label>
                  {trimEnabled && (
                    <div className="flex items-center gap-2 pl-6">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Start (s)"
                        value={trimStart}
                        onChange={(e) => setTrimStart(e.target.value)}
                        className="w-full bg-base-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary-500"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="End (s)"
                        value={trimEnd}
                        onChange={(e) => setTrimEnd(e.target.value)}
                        className="w-full bg-base-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={processBatch}
                  disabled={isProcessing || !isLoaded}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 flex flex-col items-center justify-center gap-1 relative overflow-hidden"
                >
                  {isProcessing && (
                    <div className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {isProcessing ? (
                      <><RefreshCw className="w-5 h-5 animate-spin" /> {isCompressPage ? 'Compressing' : 'Converting'} {currentIndex + 1}/{files.length} · {progress}%{remainingTime ? ` · ${remainingTime} left` : ''}</>
                    ) : (
                      <><Play className="w-5 h-5" /> {isCompressPage ? 'Compress' : 'Convert'} {files.length} file{files.length > 1 ? 's' : ''}</>
                    )}
                  </span>
                </button>
              </>
            )}

            {outputs.length > 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
                  <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-green-400 mb-2">{isCompressPage ? 'Compression Complete!' : 'Conversion Complete!'}</h4>
                  <p className="text-sm text-text-muted mb-4">{outputs.length} file{outputs.length > 1 ? 's' : ''} processed to {outputFormat.toUpperCase()}.</p>
                  {(() => {
                    const totalOriginal = outputs.reduce((s, o) => s + o.originalSize, 0);
                    const totalNew = outputs.reduce((s, o) => s + o.size, 0);
                    const savedPct = totalOriginal > 0 ? Math.round((1 - totalNew / totalOriginal) * 100) : 0;
                    return (
                      <div className="mb-4 p-4 bg-green-500/10 rounded-xl text-left text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="text-text-muted">Original size</span>
                          <span className="text-text-main font-medium">{formatSize(totalOriginal)}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-text-muted">New size</span>
                          <span className="text-green-400 font-medium">{formatSize(totalNew)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Space saved</span>
                          <span className="text-green-400 font-bold">{savedPct > 0 ? `${savedPct}%` : '—'}</span>
                        </div>
                      </div>
                    );
                  })()}
                  {outputs.length > 1 && (
                    <button onClick={downloadAll} disabled={isZipping}
                      className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 mb-3">
                      <Archive className="w-5 h-5" /> {isZipping ? 'Preparing ZIP...' : `Download All (.zip)`}
                    </button>
                  )}
                </div>

                <div className="bg-base-900/40 rounded-xl border border-white/5 divide-y divide-white/5">
                  {outputs.map((o, i) => {
                    const saved = o.originalSize > 0 ? Math.round((1 - o.size / o.originalSize) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <span className="text-text-main truncate block max-w-[260px]">{o.name}</span>
                          <span className="text-xs text-text-muted">
                            {formatSize(o.originalSize)} → <span className="text-green-400">{formatSize(o.size)}</span>
                            {saved > 0 ? ` · ${saved}% smaller` : ''}
                          </span>
                        </div>
                        <button onClick={() => downloadOne(o)}
                          className="flex items-center gap-1.5 text-primary-500 hover:text-primary-400 transition-colors text-xs font-medium shrink-0">
                          <Download className="w-4 h-4" /> Download
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button onClick={reset}
                  className="w-full py-3 bg-base-800 hover:bg-base-700 text-text-main rounded-xl font-bold transition-colors text-sm">
                  {isCompressPage ? 'Compress' : 'Convert'} More Files
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
