import React, { useState, useRef, useEffect } from 'react';
import { Video, Upload, Download, RefreshCw, Play, Pause, Settings, Film, FileVideo } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface FormatOption {
  value: string;
  label: string;
  mime: string;
  ext: string;
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
  { value: 'mov', label: 'MOV', mime: 'video/quicktime', ext: '.mov' },
];

export default function VideoConverterTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [outputFormat, setOutputFormat] = useState('mp4');
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
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setIsLoaded(true);
      setLoadingMsg('');
    } catch (error) {
      console.error("FFmpeg load error", error);
      setLoadingMsg('Failed to load video engine. Check your network or try a different browser.');
    }
  };

  const handleFile = (file: File) => {
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

  const processVideo = async () => {
    if (!selectedFile || !ffmpegRef.current || !isLoaded) return;
    setIsProcessing(true);
    setProgress(0);

    const ffmpeg = ffmpegRef.current;
    const inputExt = selectedFile.name.split('.').pop() || 'mp4';
    const inputName = `input.${inputExt}`;
    const outputName = `output.${outputFormat}`;

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

      const args = ['-i', inputName];

      if (outputFormat === 'mp4') {
        args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-movflags', 'faststart');
      } else if (outputFormat === 'webm') {
        args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
      } else if (outputFormat === 'gif') {
        args.push('-vf', 'fps=10,scale=480:-1:flags=lanczos', '-loop', '0');
      } else if (outputFormat === 'avi') {
        args.push('-c:v', 'mpeg4', '-q:v', '5');
      } else if (outputFormat === 'mov') {
        args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22');
      }

      args.push('-y', outputName);
      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: outputFormats.find(f => f.value === outputFormat)?.mime || 'video/mp4' });
      setOutputUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Processing error:", err);
      alert("Conversion failed. The file may be unsupported or too large.");
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

  const acceptStr = inputFormats.map(f => f.ext).join(',');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] -z-10"></div>

        <div className="flex items-center gap-3 mb-6">
          <FileVideo className="w-6 h-6 text-primary-500" />
          <h3 className="text-xl font-bold text-text-main">Video Converter</h3>
        </div>

        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[300px] ${dragOver ? 'border-primary-500 bg-primary-500/10' : 'border-white/20 hover:border-primary-500/50 hover:bg-white/5'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-text-muted mb-4" />
            <p className="text-lg font-bold text-text-main mb-2">Click or Drop Video File</p>
            <p className="text-sm text-text-muted">Supported: MP4, WebM, AVI, MOV, MKV, GIF</p>
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
              <div className="bg-black/50 rounded-2xl overflow-hidden border border-white/5 flex items-center justify-center aspect-video relative">
                {previewUrl && (
                  <video src={previewUrl} controls className="max-w-full max-h-full object-contain" />
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
                      <p>{loadingMsg}</p>
                    </div>
                  )}

                  <div className="bg-base-900/40 p-5 rounded-xl border border-white/5">
                    <label className="text-sm font-medium text-text-main mb-3 block">Convert to:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {outputFormats.map(fmt => (
                        <button
                          key={fmt.value}
                          onClick={() => setOutputFormat(fmt.value)}
                          className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                            outputFormat === fmt.value
                              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                              : 'bg-base-800 text-text-muted hover:text-text-main hover:bg-base-700'
                          }`}
                          disabled={fmt.value === selectedFile?.name.split('.').pop()}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={processVideo}
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
                    <p className="text-sm text-text-muted mb-4">Your video has been converted to {outputFormat.toUpperCase()}.</p>
                    <button
                      onClick={handleDownload}
                      className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" /> Download .{outputFormat}
                    </button>
                    <button onClick={reset}
                      className="w-full mt-3 py-3 bg-base-800 hover:bg-base-700 text-text-main rounded-xl font-bold transition-colors text-sm">
                      Convert Another Video
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
