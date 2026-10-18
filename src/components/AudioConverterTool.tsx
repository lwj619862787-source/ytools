import React, { useState, useRef } from 'react';
import { Music, Upload, Download, RefreshCw, Play } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { loadFFmpegCore } from '../lib/ffmpeg';
import { MAX_AUDIO_SIZE, MAX_AUDIO_SIZE_MB } from '../lib/constants';

interface FormatOption {
  value: string;
  label: string;
  mime: string;
  ext: string;
}

const inputFormats: FormatOption[] = [
  { value: 'mp3', label: 'MP3', mime: 'audio/mpeg', ext: '.mp3' },
  { value: 'wav', label: 'WAV', mime: 'audio/wav', ext: '.wav' },
  { value: 'm4a', label: 'AAC (M4A)', mime: 'audio/mp4', ext: '.m4a' },
  { value: 'aac', label: 'AAC', mime: 'audio/aac', ext: '.aac' },
  { value: 'ogg', label: 'OGG', mime: 'audio/ogg', ext: '.ogg' },
  { value: 'flac', label: 'FLAC', mime: 'audio/flac', ext: '.flac' },
  { value: 'opus', label: 'OPUS', mime: 'audio/ogg', ext: '.opus' },
];

const outputFormats: FormatOption[] = [
  { value: 'mp3', label: 'MP3', mime: 'audio/mpeg', ext: '.mp3' },
  { value: 'wav', label: 'WAV (Lossless)', mime: 'audio/wav', ext: '.wav' },
  { value: 'm4a', label: 'AAC (M4A)', mime: 'audio/mp4', ext: '.m4a' },
  { value: 'ogg', label: 'OGG (Vorbis)', mime: 'audio/ogg', ext: '.ogg' },
  { value: 'flac', label: 'FLAC (Lossless)', mime: 'audio/flac', ext: '.flac' },
  { value: 'opus', label: 'OPUS', mime: 'audio/ogg', ext: '.opus' },
];

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

export default function AudioConverterTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadProgress, setLoadProgress] = useState(0);
  const [outputFormat, setOutputFormat] = useState(() => getPreset().to || 'mp3');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const presetFrom = getPreset().from;

  const loadFFmpeg = async () => {
    if (isLoaded) return;
    setLoadingMsg('Loading audio engine (first load may take a minute)...');
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
      setLoadingMsg('Failed to load audio engine. Check your network or try a different browser.');
    }
  };

  const handleFile = (file: File) => {
    if (file.size > MAX_AUDIO_SIZE) {
      alert(`File is too large for in-browser processing (max ${MAX_AUDIO_SIZE_MB}MB).`);
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setOutputUrl(null);
    setProgress(0);
    if (!isLoaded) loadFFmpeg();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  };

  const processAudio = async () => {
    if (!selectedFile || !ffmpegRef.current || !isLoaded) return;
    setIsProcessing(true);
    setProgress(0);

    const ffmpeg = ffmpegRef.current;
    const inputExt = selectedFile.name.split('.').pop() || 'mp3';
    const inputName = `input.${inputExt}`;
    const outputName = `output.${outputFormat}`;

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

      const args = ['-i', inputName];

      if (outputFormat === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', '192k');
      } else if (outputFormat === 'wav') {
        args.push('-c:a', 'pcm_s16le');
      } else if (outputFormat === 'm4a') {
        args.push('-c:a', 'aac', '-b:a', '192k');
      } else if (outputFormat === 'ogg') {
        args.push('-c:a', 'libvorbis', '-q:a', '4');
      } else if (outputFormat === 'flac') {
        args.push('-c:a', 'flac');
      } else if (outputFormat === 'opus') {
        args.push('-c:a', 'libopus', '-b:a', '128k');
      }

      args.push('-y', outputName);
      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: outputFormats.find((f) => f.value === outputFormat)?.mime || 'audio/mpeg' });
      setOutputUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Processing error:', err);
      alert('Conversion failed. The file may be unsupported or too large.');
    }

    setIsProcessing(false);
  };

  const handleDownload = () => {
    if (!outputUrl || !selectedFile) return;
    const link = document.createElement('a');
    link.href = outputUrl;
    link.download = selectedFile.name.replace(/\.[^/.]+$/, '') + `.${outputFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setOutputUrl(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const acceptStr = inputFormats.map((f) => f.ext).join(',');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] -z-10"></div>

        <div className="flex items-center gap-3 mb-6">
          <Music className="w-6 h-6 text-primary-500" />
          <h3 className="text-xl font-bold text-text-main">Audio Converter</h3>
        </div>

        {(presetFrom || outputFormat) && (
          <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl text-sm text-text-main flex items-center gap-2">
            <span className="font-bold">Preset:</span>
            <span className="uppercase">{presetFrom || 'any audio'}</span>
            <span className="text-text-muted">→</span>
            <span className="uppercase">{outputFormat}</span>
          </div>
        )}

        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[300px] ${dragOver ? 'border-primary-500 bg-primary-500/10' : 'border-white/20 hover:border-primary-500/50 hover:bg-white/5'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-text-muted mb-4" />
            <p className="text-lg font-bold text-text-main mb-2">Click or Drop Audio File</p>
            <p className="text-sm text-text-muted">Supports MP3 / WAV / M4A / AAC / OGG / FLAC / OPUS</p>
            <input
              type="file"
              accept={acceptStr}
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider">Source</h4>
              <div className="bg-black/50 rounded-2xl overflow-hidden border border-white/5 flex items-center justify-center p-6 min-h-[180px]">
                {previewUrl && (
                  <audio src={previewUrl} controls className="w-full" />
                )}
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-xs text-text-muted truncate max-w-[200px]">{selectedFile.name}</span>
                <span className="text-xs text-text-muted">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <button onClick={reset}
                className="w-full py-3 bg-base-800 hover:bg-base-700 text-text-main rounded-xl font-bold transition-colors text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Choose Different File
              </button>
            </div>

            <div className="space-y-6 flex flex-col justify-center">
              {!outputUrl ? (
                <div className="space-y-6">
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

                  <div className="bg-base-900/40 p-5 rounded-xl border border-white/5">
                    <label className="text-sm font-medium text-text-main mb-3 block">Convert to:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {outputFormats.map((fmt) => (
                        <button
                          key={fmt.value}
                          onClick={() => setOutputFormat(fmt.value)}
                          className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                            outputFormat === fmt.value
                              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                              : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'
                          }`}
                          disabled={fmt.value === selectedFile?.name.split('.').pop()?.toLowerCase()}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={processAudio}
                    disabled={isProcessing || !isLoaded}
                    className="w-full py-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 flex flex-col items-center justify-center gap-1 relative overflow-hidden"
                  >
                    {isProcessing && (
                      <div className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      {isProcessing ? (
                        <><RefreshCw className="w-5 h-5 animate-spin" /> Converting {progress}%</>
                      ) : (
                        <><Play className="w-5 h-5" /> Start Conversion</>
                      )}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
                    <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Download className="w-8 h-8" />
                    </div>
                    <h4 className="text-xl font-bold text-green-400 mb-2">Conversion Complete!</h4>
                    <p className="text-sm text-text-muted mb-4">Your audio has been converted to {outputFormat.toUpperCase()}.</p>
                    <button
                      onClick={handleDownload}
                      className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" /> Download .{outputFormat}
                    </button>
                    <button onClick={reset}
                      className="w-full mt-3 py-3 bg-base-800 hover:bg-base-700 text-text-main rounded-xl font-bold transition-colors text-sm">
                      Convert Another Audio
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
