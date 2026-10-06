import React, { useState, useRef, useEffect } from 'react';
import { Video, Upload, Download, RefreshCw, Play, Pause, Settings } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export default function ExtractAudioTool() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [outputUrl, setOutputUrl] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const ffmpegRef = useRef<FFmpeg | null>(null);

    const loadFFmpeg = async () => {
        if (isLoaded) return;
        setLoadingMsg('Downloading core dependencies (this may take a minute on first load)...');
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;
        
        ffmpeg.on('progress', ({ progress, time }) => {
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
            setLoadingMsg('Failed to load processing engine. Your browser might not support required features or you have a network issue.');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.type.startsWith('video/')) {
                setSelectedFile(file);
                setPreviewUrl(URL.createObjectURL(file));
                setOutputUrl(null);
                setProgress(0);
                if (!isLoaded) {
                    loadFFmpeg();
                }
            } else {
                alert("Please select a valid video file.");
            }
        }
    };

    

    const processVideo = async () => {
        if (!selectedFile || !ffmpegRef.current || !isLoaded) return;

        setIsProcessing(true);
        setProgress(0);
        
        const ffmpeg = ffmpegRef.current;
        const inputName = `input.${selectedFile.name.split('.').pop()}`;
        const outputName = `output.mp3`;

        try {
            await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));
            
            // Run command
            await ffmpeg.exec(['-i', inputName, '-q:a', '0', '-map', 'a', outputName]);
            
            const data = await ffmpeg.readFile(outputName);
            const blob = new Blob([data], { type: 'audio/mpeg' });
            setOutputUrl(URL.createObjectURL(blob));
        } catch (err) {
            console.error("Processing error:", err);
            alert("An error occurred during processing. The file may be unsupported or too large.");
        }
        
        setIsProcessing(false);
    };

    const handleDownload = () => {
        if (outputUrl && selectedFile) {
            const link = document.createElement('a');
            link.href = outputUrl;
            link.download = selectedFile.name.replace(/\.[^/.]+$/, '-audio.mp3');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const reset = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setOutputUrl(null);
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] -z-10"></div>
                
                <div className="flex items-center gap-3 mb-6">
                    <Video className="w-6 h-6 text-primary-500" />
                    <h3 className="text-xl font-bold text-text-main">Extract Audio (Video to MP3)</h3>
                </div>

                {!selectedFile ? (
                    <div 
                        className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center hover:bg-white/5 hover:border-primary-500/50 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[300px]"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="w-12 h-12 text-text-muted mb-4" />
                        <p className="text-lg font-bold text-text-main mb-2">Click to Upload VIDEO File</p>
                        <p className="text-sm text-text-muted">Maximum file size: 100MB (Processed securely in your browser)</p>
                        <input 
                            type="file" 
                            accept="video/*" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Preview */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider">Original File</h4>
                            <div className="bg-black/50 rounded-2xl overflow-hidden border border-white/5 flex items-center justify-center aspect-video relative">
                                {previewUrl && (
                                    <video 
                                        ref={videoRef}
                                        src={previewUrl} 
                                        controls 
                                        className="max-w-full max-h-full object-contain"
                                    />
                                )}
                            </div>
                            <div className="flex justify-between items-center px-2">
                                <span className="text-xs text-text-muted truncate max-w-[200px]">{selectedFile.name}</span>
                                <span className="text-xs text-text-muted">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>

                            <button 
                                onClick={reset}
                                className="w-full py-3 bg-base-800 hover:bg-base-700 text-text-main rounded-xl font-bold transition-colors text-sm flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" /> Choose Different File
                            </button>
                        </div>

                        {/* Controls & Output */}
                        <div className="space-y-6 flex flex-col justify-center">
                            {!outputUrl ? (
                                <div className="space-y-6">
                                    {loadingMsg && !isLoaded && (
                                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm flex items-start gap-3">
                                            <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
                                            <p>{loadingMsg}</p>
                                        </div>
                                    )}
                                    
                                    <div className="bg-base-900/40 p-4 rounded-xl border border-white/5"><p className="text-sm text-text-muted text-center">Click below to extract the audio track and save it as an MP3 file.</p></div>

                                    <button 
                                        onClick={processVideo}
                                        disabled={isProcessing || !isLoaded}
                                        className="w-full py-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 flex flex-col items-center justify-center gap-1 relative overflow-hidden"
                                    >
                                        {isProcessing && (
                                            <div 
                                                className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300"
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                        )}
                                        <span className="relative z-10 flex items-center gap-2">
                                            {isProcessing ? (
                                                <><RefreshCw className="w-5 h-5 animate-spin" /> Processing {progress}%</>
                                            ) : (
                                                <>Start Processing <Play className="w-5 h-5" /></>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-4">
                                        <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Download className="w-8 h-8" />
                                        </div>
                                        <h4 className="text-xl font-bold text-green-400 mb-2">Processing Complete!</h4>
                                        <p className="text-sm text-text-muted mb-6">Your file has been processed successfully.</p>
                                        
                                        <button 
                                            onClick={handleDownload}
                                            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                                        >
                                            <Download className="w-5 h-5" /> Download MP3
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
