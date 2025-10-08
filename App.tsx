
import React, { useState, useRef, useCallback } from 'react';
import { translateImageToText, summarizeText } from './services/geminiService';
import { CameraIcon, StopIcon, AlertIcon, SparklesIcon } from './components/Icons';
import { Spinner } from './components/Spinner';

type Status = 'IDLE' | 'STARTING' | 'TRANSLATING' | 'CAPTURING' | 'STOPPING' | 'ERROR';

const STATUS_MESSAGES: Record<Status, string> = {
  IDLE: 'Arahkan kamera ke bahasa isyarat untuk memulai.',
  STARTING: 'Menginisialisasi kamera...',
  CAPTURING: 'Menganalisa gerakan...',
  TRANSLATING: 'Menerjemahkan isyarat...',
  STOPPING: 'Menghentikan sesi...',
  ERROR: 'Terjadi kesalahan.',
};

const App: React.FC = () => {
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translatedPhrases, setTranslatedPhrases] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [status, setStatus] = useState<Status>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureInterval = useRef<number | null>(null);

  const stopTranslationSession = useCallback(() => {
    setStatus('STOPPING');
    if (captureInterval.current) {
      clearInterval(captureInterval.current);
      captureInterval.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsTranslating(false);
    setStatus('IDLE');
  }, []);

  const startTranslationSession = useCallback(async () => {
    if (!process.env.API_KEY) {
        setError("Kunci API Gemini tidak ditemukan. Harap atur variabel lingkungan API_KEY.");
        setStatus('ERROR');
        return;
    }
    
    setError(null);
    setTranslatedPhrases([]);
    setSummary(null);
    setIsTranslating(true);
    setStatus('STARTING');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.oncanplay = () => {
          if (videoRef.current) {
             videoRef.current.play();
          }

          captureInterval.current = window.setInterval(async () => {
            if (videoRef.current && canvasRef.current) {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const context = canvas.getContext('2d');
              if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const base64ImageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                
                setStatus('TRANSLATING');
                try {
                  const result = await translateImageToText(base64ImageData);
                  if (result) {
                    setTranslatedPhrases(prev => {
                      if (prev.length === 0 || prev[prev.length - 1].toLowerCase() !== result.toLowerCase()) {
                        return [...prev, result];
                      }
                      return prev;
                    });
                  }
                } catch (apiError) {
                  console.error('Gemini API Error:', apiError);
                  setError('Gagal menerjemahkan. Silakan coba lagi.');
                  stopTranslationSession();
                } finally {
                  setStatus('CAPTURING');
                }
              }
            }
          }, 6000); // Capture frame every 6 seconds
        };
      }
    } catch (err) {
      console.error('Camera Error:', err);
      let errorMessage = 'Gagal mengakses kamera.';
      if (err instanceof Error && err.name === 'NotAllowedError') {
          errorMessage = 'Izin kamera ditolak. Harap izinkan akses kamera di pengaturan browser Anda.';
      }
      setError(errorMessage);
      setStatus('ERROR');
      setIsTranslating(false);
    }
  }, [stopTranslationSession]);

  const handleToggleTranslation = () => {
    if (isTranslating) {
      stopTranslationSession();
    } else {
      startTranslationSession();
    }
  };

  const handleSummarize = async () => {
    if (translatedPhrases.length < 2) return;
    
    setIsSummarizing(true);
    setError(null);
    setSummary(null);
    try {
        const result = await summarizeText(translatedPhrases);
        setSummary(result);
    } catch (err) {
        setError("Gagal membuat kesimpulan. Silakan coba lagi.");
        console.error("Summarization Error:", err);
    } finally {
        setIsSummarizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <main className="w-full max-w-7xl mx-auto flex flex-col flex-1">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
            Tolopani<span className="text-sky-400">Sign</span>
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            Penerjemah Bahasa Isyarat Indonesia ke Teks
          </p>
        </header>

        {error && (
            <div className="bg-red-900 border border-red-600 text-red-100 px-4 py-3 rounded-lg relative mb-6 flex items-center shadow-lg">
                <AlertIcon className="w-6 h-6 mr-3"/>
                <div>
                    <strong className="font-bold">Error:</strong>
                    <span className="block sm:inline ml-2">{error}</span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
          {/* Camera Feed Section */}
          <div className="bg-slate-800/50 rounded-2xl shadow-2xl p-4 flex flex-col aspect-video border border-slate-700">
            <div className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${isTranslating ? 'opacity-100' : 'opacity-0'}`}
              />
              {!isTranslating && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <CameraIcon className="w-16 h-16 mb-4 opacity-30"/>
                    <p>Kamera tidak aktif</p>
                 </div>
              )}
               <div className={`absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-center text-sm transition-opacity duration-300 ${status !== 'IDLE' && status !== 'ERROR' ? 'opacity-100' : 'opacity-0'}`}>
                {STATUS_MESSAGES[status]}
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden"></canvas>

          {/* Translation Output Section */}
          <div className="bg-slate-800/50 rounded-2xl shadow-2xl p-6 flex flex-col border border-slate-700">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-sky-400">Hasil Terjemahan</h2>
                <button
                    onClick={handleSummarize}
                    disabled={translatedPhrases.length < 2 || isSummarizing}
                    className="flex items-center px-4 py-2 text-sm font-semibold bg-sky-600/50 text-sky-300 rounded-lg hover:bg-sky-600/80 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSummarizing ? <Spinner /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                    {isSummarizing ? 'Memproses...' : 'Simpulkan'}
                </button>
             </div>

            <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-y-auto h-64 lg:h-auto">
              {translatedPhrases.length > 0 ? (
                <div className="space-y-3">
                  {translatedPhrases.map((phrase, index) => (
                    <p key={index} className="text-lg animate-fade-in">{phrase}</p>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <p>Terjemahan akan muncul di sini...</p>
                </div>
              )}
            </div>
            {summary && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <h3 className="text-lg font-semibold text-sky-400 mb-2">Kesimpulan</h3>
                    <p className="text-xl text-white bg-slate-800 p-3 rounded-md animate-fade-in">{summary}</p>
                </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
            <button
              onClick={handleToggleTranslation}
              disabled={status === 'STARTING' || status === 'STOPPING'}
              className={`inline-flex items-center justify-center px-8 py-4 text-xl font-bold rounded-full transition-all duration-300 shadow-lg focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed ${
                isTranslating
                  ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500/50'
                  : 'bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-500/50'
              }`}
            >
              {isTranslating ? (
                <>
                  {status === 'STOPPING' ? <Spinner/> : <StopIcon className="w-7 h-7 mr-3" />}
                  {status === 'STOPPING' ? 'Menghentikan...' : 'Hentikan'}
                </>
              ) : (
                <>
                  {status === 'STARTING' ? <Spinner/> : <CameraIcon className="w-7 h-7 mr-3" />}
                  {status === 'STARTING' ? 'Memulai...' : 'Mulai Menerjemahkan'}
                </>
              )}
            </button>
        </div>
      </main>
      <footer className="w-full max-w-7xl mx-auto text-center mt-8 text-slate-500 text-sm">
        <p>Dibuat dengan ❤️ oleh Tim Tolopani</p>
      </footer>
    </div>
  );
};

export default App;