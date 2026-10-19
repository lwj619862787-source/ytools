export interface SeoFaq {
  q: string;
  a: string;
}

export interface SeoPage {
  slug: string;
  title: string;
  description: string;
  keywords: string;
  h1: string;
  intro: string;
  toolPath: '/video-converter' | '/extract-audio' | '/audio-converter';
  ctaLabel: string;
  from?: string;
  to?: string;
  steps: string[];
  faqs: SeoFaq[];
  related: { label: string; href: string }[];
}

export const seoPages: SeoPage[] = [
  {
    slug: 'mov-to-mp3',
    title: 'MOV to MP3 Converter - Free & Private Online | YTools',
    description:
      'Convert MOV (QuickTime) videos to MP3 audio for free. Extract the audio track from any .mov file right in your browser — nothing is uploaded to a server.',
    keywords: 'mov to mp3, convert mov to mp3, mov to mp3 converter, quicktime to mp3, mov a mp3, .mov to .mp3',
    h1: 'MOV to MP3 Converter',
    intro:
      'Turn any QuickTime MOV video into a high-quality MP3 audio file, completely free and 100% private. The conversion runs locally in your browser, so your file never leaves your device.',
    toolPath: '/extract-audio',
    ctaLabel: 'Convert MOV to MP3 Now',
    from: 'mov',
    to: 'mp3',
    steps: [
      'Upload your MOV file by clicking the button or dragging it into the drop zone.',
      'Click "Start Processing" to extract the audio track from your video.',
      'Download your MP3 file instantly — no sign-up, no watermark.',
    ],
    faqs: [
      {
        q: 'How do I convert MOV to MP3?',
        a: 'Click the button above, select your .mov file, and press "Start Processing". The tool extracts the audio track and saves it as an MP3 in seconds — entirely in your browser.',
      },
      {
        q: 'Is MOV to MP3 conversion really free?',
        a: 'Yes. There are no fees, file size caps, watermarks, or hidden charges. You can convert as many files as you like.',
      },
      {
        q: 'Are my MOV files uploaded to a server?',
        a: 'No. All processing happens locally using WebAssembly (FFmpeg). Your files never leave your device, keeping them completely private.',
      },
    ],
    related: [
      { label: 'MKV to MP3', href: '/mkv-to-mp3' },
      { label: 'WebM to MP3', href: '/webm-to-mp3' },
      { label: 'Extract Audio from Video', href: '/extract-audio-from-video' },
      { label: 'MOV to MP4', href: '/mov-to-mp4' },
      { label: 'Extract Audio Tool', href: '/extract-audio' },
    ],
  },
  {
    slug: 'webm-to-mp3',
    title: 'WebM to MP3 Converter - Free & Private Online | YTools',
    description:
      'Convert WebM videos to MP3 audio for free. Extract the audio track from any .webm file right in your browser — nothing is uploaded to a server.',
    keywords: 'webm to mp3, convert webm to mp3, webm audio extractor',
    h1: 'WebM to MP3 Converter',
    intro:
      'Convert any WebM video to a crisp MP3 audio file in seconds, free and fully private. Processing runs locally in your browser, so your file never leaves your device.',
    toolPath: '/extract-audio',
    ctaLabel: 'Convert WebM to MP3 Now',
    from: 'webm',
    to: 'mp3',
    steps: [
      'Upload your WebM file by clicking the button or dragging it into the drop zone.',
      'Click "Start Processing" to extract the audio track.',
      'Download your MP3 file instantly.',
    ],
    faqs: [
      {
        q: 'How do I extract audio from a WebM file?',
        a: 'Upload your .webm file, click "Start Processing", and the tool will extract the audio track and save it as an MP3 — all in your browser.',
      },
      {
        q: 'Is WebM to MP3 conversion free?',
        a: 'Yes, completely free with no watermarks, size limits, or hidden fees.',
      },
      {
        q: 'Will my file be uploaded?',
        a: 'No. Everything is processed locally on your device using WebAssembly. Your files stay private.',
      },
    ],
    related: [
      { label: 'MOV to MP3', href: '/mov-to-mp3' },
      { label: 'MKV to MP3', href: '/mkv-to-mp3' },
      { label: 'Extract Audio from Video', href: '/extract-audio-from-video' },
      { label: 'MKV to MP4', href: '/mkv-to-mp4' },
      { label: 'Extract Audio Tool', href: '/extract-audio' },
    ],
  },
  {
    slug: 'mkv-to-mp3',
    title: 'MKV to MP3 Converter - Free & Private Online | YTools',
    description:
      'Convert MKV videos to MP3 audio for free. Extract the audio track from any .mkv file right in your browser — nothing is uploaded to a server.',
    keywords: 'mkv to mp3, convert mkv to mp3, mkv audio extractor',
    h1: 'MKV to MP3 Converter',
    intro:
      'Extract high-quality MP3 audio from any MKV video, free and fully private. The conversion runs locally in your browser, so your file never leaves your device.',
    toolPath: '/extract-audio',
    ctaLabel: 'Convert MKV to MP3 Now',
    from: 'mkv',
    to: 'mp3',
    steps: [
      'Upload your MKV file by clicking the button or dragging it into the drop zone.',
      'Click "Start Processing" to extract the audio track.',
      'Download your MP3 file instantly.',
    ],
    faqs: [
      {
        q: 'How do I convert MKV to MP3?',
        a: 'Upload your .mkv file, click "Start Processing", and the tool extracts the audio track and saves it as an MP3 in seconds — entirely in your browser.',
      },
      {
        q: 'Is MKV to MP3 conversion free?',
        a: 'Yes, completely free with no watermarks, size limits, or hidden fees.',
      },
      {
        q: 'Are my MKV files uploaded to a server?',
        a: 'No. All processing happens locally on your device using WebAssembly. Your files stay private.',
      },
    ],
    related: [
      { label: 'MOV to MP3', href: '/mov-to-mp3' },
      { label: 'WebM to MP3', href: '/webm-to-mp3' },
      { label: 'Extract Audio from Video', href: '/extract-audio-from-video' },
      { label: 'MKV to MP4', href: '/mkv-to-mp4' },
      { label: 'Extract Audio Tool', href: '/extract-audio' },
    ],
  },
  {
    slug: 'extract-audio-from-video',
    title: 'Extract Audio from Video - Free Online Audio Extractor | YTools',
    description:
      'Extract audio from any video as MP3 for free. A free online audio extractor that works in your browser — nothing is uploaded to a server.',
    keywords: 'audio extractor, extract audio from video, get audio from video, video to mp3',
    h1: 'Extract Audio from Video',
    intro:
      'Rip the audio track from any video file and save it as a high-quality MP3 — free, fast, and 100% private. No uploads, no software to install, no sign-up required.',
    toolPath: '/extract-audio',
    ctaLabel: 'Extract Audio Now',
    to: 'mp3',
    steps: [
      'Upload any video file (MP4, MOV, MKV, WebM, AVI, and more).',
      'Click "Start Processing" to extract the audio track.',
      'Download your MP3 file instantly.',
    ],
    faqs: [
      {
        q: 'How do I extract audio from a video?',
        a: 'Upload your video file, click "Start Processing", and the tool extracts the audio track and saves it as an MP3. It works entirely in your browser.',
      },
      {
        q: 'What video formats are supported?',
        a: 'MP4, MOV, MKV, WebM, AVI, and most other common video formats are supported for audio extraction.',
      },
      {
        q: 'Is the audio extractor free to use?',
        a: 'Yes. It is completely free with no watermarks, size limits, or hidden fees.',
      },
    ],
    related: [
      { label: 'MOV to MP3', href: '/mov-to-mp3' },
      { label: 'MKV to MP3', href: '/mkv-to-mp3' },
      { label: 'WebM to MP3', href: '/webm-to-mp3' },
      { label: 'WAV to MP3', href: '/wav-to-mp3' },
      { label: 'Audio Converter', href: '/audio-converter' },
    ],
  },
  {
    slug: 'wav-to-mp3',
    title: 'WAV to MP3 Converter - Free & Private Online | YTools',
    description:
      'Convert WAV audio files to MP3 for free. Compress large .wav files into smaller MP3s right in your browser — nothing is uploaded to a server.',
    keywords: 'wav to mp3, wav to mp3 converter, convert wav to mp3',
    h1: 'WAV to MP3 Converter',
    intro:
      'Convert lossless WAV files to compact, widely-compatible MP3 audio in seconds — free and fully private. Processing runs locally in your browser, so your files never leave your device.',
    toolPath: '/audio-converter',
    ctaLabel: 'Convert WAV to MP3 Now',
    from: 'wav',
    to: 'mp3',
    steps: [
      'Upload your WAV file by clicking the button or dragging it into the drop zone.',
      'Select MP3 as the output format and click "Start Conversion".',
      'Download your MP3 file instantly.',
    ],
    faqs: [
      {
        q: 'How do I convert WAV to MP3?',
        a: 'Upload your .wav file, choose MP3 as the target format, and click "Start Conversion". The tool converts it in seconds — entirely in your browser.',
      },
      {
        q: 'Will I lose quality converting WAV to MP3?',
        a: 'MP3 is a lossy format, so some quality is sacrificed in exchange for a much smaller file size. WAV is lossless, while MP3 is optimized for sharing and compatibility.',
      },
      {
        q: 'Are my WAV files uploaded to a server?',
        a: 'No. All processing happens locally on your device using WebAssembly. Your files stay private.',
      },
    ],
    related: [
      { label: 'Audio Converter', href: '/audio-converter' },
      { label: 'Extract Audio from Video', href: '/extract-audio-from-video' },
      { label: 'MOV to MP3', href: '/mov-to-mp3' },
      { label: 'MKV to MP3', href: '/mkv-to-mp3' },
      { label: 'WebM to MP3', href: '/webm-to-mp3' },
    ],
  },
  {
    slug: 'mov-to-mp4',
    title: 'MOV to MP4 Converter - Free & Private Online | YTools',
    description:
      'Convert MOV (QuickTime) videos to MP4 for free. Convert .mov to .mp4 right in your browser — nothing is uploaded to a server.',
    keywords: 'mov to mp4, convert mov to mp4, quicktime to mp4',
    h1: 'MOV to MP4 Converter',
    intro:
      'Convert QuickTime MOV videos to universally-compatible MP4 files in seconds — free and 100% private. Processing runs locally in your browser, so your file never leaves your device.',
    toolPath: '/video-converter',
    ctaLabel: 'Convert MOV to MP4 Now',
    from: 'mov',
    to: 'mp4',
    steps: [
      'Upload your MOV file by clicking the button or dragging it into the drop zone.',
      'Select MP4 (H.264) as the output format and click "Start Conversion".',
      'Download your MP4 file instantly.',
    ],
    faqs: [
      {
        q: 'How do I convert MOV to MP4?',
        a: 'Upload your .mov file, choose MP4 as the target format, and click "Start Conversion". The tool converts it in seconds — entirely in your browser.',
      },
      {
        q: 'Is MOV to MP4 conversion free?',
        a: 'Yes, completely free with no watermarks, size limits, or hidden fees.',
      },
      {
        q: 'Are my MOV files uploaded to a server?',
        a: 'No. All processing happens locally on your device using WebAssembly. Your files stay private.',
      },
    ],
    related: [
      { label: 'MKV to MP4', href: '/mkv-to-mp4' },
      { label: 'MP4 to GIF', href: '/mp4-to-gif' },
      { label: 'Video Converter', href: '/video-converter' },
      { label: 'MOV to MP3', href: '/mov-to-mp3' },
      { label: 'MKV to MP3', href: '/mkv-to-mp3' },
    ],
  },
  {
    slug: 'mp4-to-gif',
    title: 'MP4 to GIF Converter - Free Online Animated GIF Maker | YTools',
    description:
      'Convert MP4 videos to animated GIFs for free. Turn .mp4 clips into .gif files right in your browser — nothing is uploaded to a server.',
    keywords: 'mp4 to gif, convert mp4 to gif, mp4 to animated gif, mp4转gif',
    h1: 'MP4 to GIF Converter',
    intro:
      'Turn any MP4 video into an animated GIF in seconds — free and 100% private. Processing runs locally in your browser, so your file never leaves your device.',
    toolPath: '/video-converter',
    ctaLabel: 'Convert MP4 to GIF Now',
    from: 'mp4',
    to: 'gif',
    steps: [
      'Upload your MP4 file by clicking the button or dragging it into the drop zone.',
      'Select "Animated GIF" as the output format and click "Start Conversion".',
      'Download your GIF file instantly.',
    ],
    faqs: [
      {
        q: 'How do I convert MP4 to GIF?',
        a: 'Upload your .mp4 file, choose "Animated GIF" as the target format, and click "Start Conversion". The tool converts it in seconds — entirely in your browser.',
      },
      {
        q: 'Is MP4 to GIF conversion free?',
        a: 'Yes, completely free with no watermarks, size limits, or hidden fees.',
      },
      {
        q: 'Why is my GIF lower quality than the original video?',
        a: 'GIF is an older format limited to 256 colors and no audio, so some quality loss is expected. It is optimized for short, looping clips shared on social media.',
      },
    ],
    related: [
      { label: 'MOV to MP4', href: '/mov-to-mp4' },
      { label: 'MKV to MP4', href: '/mkv-to-mp4' },
      { label: 'Video Converter', href: '/video-converter' },
      { label: 'Extract Audio from Video', href: '/extract-audio-from-video' },
      { label: 'MOV to MP3', href: '/mov-to-mp3' },
    ],
  },
  {
    slug: 'mkv-to-mp4',
    title: 'MKV to MP4 Converter - Free & Private Online | YTools',
    description:
      'Convert MKV videos to MP4 for free. Convert .mkv to .mp4 right in your browser — nothing is uploaded to a server.',
    keywords: 'mkv to mp4, mkv to mp4 converter, convert mkv to mp4, .mkv to mp4',
    h1: 'MKV to MP4 Converter',
    intro:
      'Convert MKV videos to widely-compatible MP4 files in seconds — free and 100% private. Processing runs locally in your browser, so your file never leaves your device.',
    toolPath: '/video-converter',
    ctaLabel: 'Convert MKV to MP4 Now',
    from: 'mkv',
    to: 'mp4',
    steps: [
      'Upload your MKV file by clicking the button or dragging it into the drop zone.',
      'Select MP4 (H.264) as the output format and click "Start Conversion".',
      'Download your MP4 file instantly.',
    ],
    faqs: [
      {
        q: 'How do I convert MKV to MP4?',
        a: 'Upload your .mkv file, choose MP4 as the target format, and click "Start Conversion". The tool converts it in seconds — entirely in your browser.',
      },
      {
        q: 'Is MKV to MP4 conversion free?',
        a: 'Yes, completely free with no watermarks, size limits, or hidden fees.',
      },
      {
        q: 'Why convert MKV to MP4?',
        a: 'MP4 offers broader compatibility than MKV across devices, editing software, and social media platforms. It also generally has better hardware-accelerated playback.',
      },
    ],
    related: [
      { label: 'MOV to MP4', href: '/mov-to-mp4' },
      { label: 'MP4 to GIF', href: '/mp4-to-gif' },
      { label: 'Video Converter', href: '/video-converter' },
      { label: 'MKV to MP3', href: '/mkv-to-mp3' },
      { label: 'WebM to MP3', href: '/webm-to-mp3' },
    ],
  },
];

export function getSeoPageBySlug(slug: string): SeoPage | undefined {
  return seoPages.find((p) => p.slug === slug);
}
