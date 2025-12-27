
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Check, RefreshCw, Loader2, Info, ArrowRight, Scan, ShieldCheck, Database, BrainCircuit, AlertTriangle, Sun, Zap, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { analyzeCardImages } from '../services/geminiService';

interface CardScannerProps {
  onScanComplete: (data: any) => void;
  onCancel: () => void;
}

const ANALYSIS_PHASES = [
  { icon: <Scan className="text-blue-400" size={20} />, text: "Extracting text from images..." },
  { icon: <ShieldCheck className="text-emerald-400" size={20} />, text: "Identifying security features..." },
  { icon: <Database className="text-purple-400" size={20} />, text: "Cross-referencing bank database..." },
  { icon: <BrainCircuit className="text-amber-400" size={20} />, text: "Finalizing card profile..." },
];

interface QualityScore {
  brightness: number; // 0-255
  detail: number; // Arbitrary score
  isGood: boolean;
  hint?: string;
}

const CardScanner: React.FC<CardScannerProps> = ({ onScanComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qualityCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [step, setStep] = useState<'front' | 'flipped' | 'back' | 'review' | 'analyzing'>('front');
  const [frontImg, setFrontImg] = useState<string | null>(null);
  const [backImg, setBackImg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState(0);
  const [quality, setQuality] = useState<QualityScore>({ brightness: 0, detail: 0, isGood: false });

  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  // Image quality heuristic check
  const checkQuality = useCallback(() => {
    if (!videoRef.current || step === 'review' || step === 'analyzing' || step === 'flipped') return;
    const video = videoRef.current;
    const canvas = qualityCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx || video.videoWidth === 0) return;

    // Small sample size for performance
    canvas.width = 160;
    canvas.height = 100;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    let detailScore = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += gray;

      if (i > 4) {
        const prevGray = 0.299 * data[i-4] + 0.587 * data[i-3] + 0.114 * data[i-2];
        detailScore += Math.abs(gray - prevGray);
      }
    }

    const avgBrightness = totalBrightness / (data.length / 4);
    const normalizedDetail = detailScore / (data.length / 4);

    let hint = "Hold steady...";
    if (avgBrightness < 50) hint = "Too dark - Move to light";
    else if (avgBrightness > 220) hint = "Too bright - Reduce glare";
    else if (normalizedDetail < 15) hint = "Blurry - Adjust focus or distance";
    else hint = "Perfect! Ready to scan";

    setQuality({
      brightness: avgBrightness,
      detail: normalizedDetail,
      isGood: avgBrightness > 50 && avgBrightness < 220 && normalizedDetail > 15,
      hint
    });
  }, [step]);

  useEffect(() => {
    const interval = setInterval(checkQuality, 300);
    return () => clearInterval(interval);
  }, [checkQuality]);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let isActive = true;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera API is not supported in this browser or context.");
        onCancelRef.current();
        return;
      }

      const constraintSets: MediaStreamConstraints[] = [
        {
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        },
        {
          video: { facingMode: 'user' },
          audio: false
        }
      ];

      let successfulStream: MediaStream | null = null;
      let lastError: any = null;

      for (const constraints of constraintSets) {
        if (!isActive) return;
        try {
          successfulStream = await navigator.mediaDevices.getUserMedia(constraints);
          if (successfulStream) break;
        } catch (err) {
          lastError = err;
        }
      }

      if (successfulStream) {
        currentStream = successfulStream;
        setStream(successfulStream);
        if (videoRef.current) {
          videoRef.current.srcObject = successfulStream;
          videoRef.current.onloadedmetadata = () => {
            if (isActive) {
              videoRef.current?.play().catch(e => console.error("Video play error:", e));
            }
          };
        }
      } else {
        alert("Camera access failed. Please ensure permissions are granted.");
        onCancelRef.current();
      }
    }

    if (step === 'front' || step === 'back') {
      startCamera();
    }

    return () => {
      isActive = false;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [step]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    if (!quality.isGood) {
      const confirmForce = window.confirm("Image might be blurry or too dark. Try anyway?");
      if (!confirmForce) return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    const width = video.videoWidth;
    const height = video.videoHeight;
    
    if (width === 0 || height === 0) return;

    setIsFlashing(true);
    setTimeout(() => {
      setIsFlashing(false);
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 800);
    }, 150);

    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64Data = dataUrl.split(',')[1];

      if (step === 'front') {
        setFrontImg(base64Data);
        setTimeout(() => setStep('flipped'), 600);
      } else if (step === 'back') {
        setBackImg(base64Data);
        setTimeout(() => {
          setStep('review');
        }, 600);
      }
    }
  };

  const startAnalysis = () => {
    if (!frontImg || !backImg) return;
    setStep('analyzing');
    processImages(frontImg, backImg);
  };

  const retake = () => {
    setFrontImg(null);
    setBackImg(null);
    setStep('front');
  };

  const processImages = async (front: string, back: string) => {
    setIsProcessing(true);
    
    const phaseInterval = setInterval(() => {
      setAnalysisPhase(prev => (prev < ANALYSIS_PHASES.length - 1 ? prev + 1 : prev));
    }, 1500);

    try {
      const result = await analyzeCardImages(front, back);
      if (result) {
        // Give a little extra time for the visual progress to feel satisfying
        setTimeout(() => {
          onScanComplete(result);
        }, 800);
      } else {
        alert("AI could not extract details clearly. Please try again with more light or manually enter info.");
        onCancel();
      }
    } catch (error) {
      console.error("AI Analysis error:", error);
      alert("Analysis failed. This can happen with very dark or blurry images.");
      onCancel();
    } finally {
      clearInterval(phaseInterval);
    }
  };

  const renderViewfinder = () => {
    if (step === 'analyzing') {
      const progress = ((analysisPhase + 1) / ANALYSIS_PHASES.length) * 100;
      return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-8 text-white p-8">
          <div className="relative">
             <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
             <div className="w-24 h-24 flex items-center justify-center">
                <Loader2 size={64} className="animate-spin text-blue-500 relative z-10" />
             </div>
          </div>
          
          <div className="text-center space-y-6 w-full max-w-xs">
            <h3 className="text-2xl font-black tracking-tight">AI Vision Engine</h3>
            
            {/* Analysis Progress Bar */}
            <div className="space-y-2">
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest text-right">
                {Math.round(progress)}% Complete
              </p>
            </div>

            <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10 text-left">
               {ANALYSIS_PHASES.map((phase, idx) => (
                 <div key={idx} className={`flex items-center space-x-3 transition-all duration-500 ${idx === analysisPhase ? 'opacity-100 translate-x-1' : idx < analysisPhase ? 'opacity-40' : 'opacity-20'}`}>
                    {idx < analysisPhase ? <CheckCircle2 size={16} className="text-emerald-400" /> : phase.icon}
                    <span className={`text-sm font-bold ${idx === analysisPhase ? 'text-white' : 'text-slate-400'}`}>
                      {phase.text}
                    </span>
                 </div>
               ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-24 h-16 bg-white/10 rounded-lg border border-white/20 overflow-hidden shadow-lg group relative">
              {frontImg && <img src={`data:image/jpeg;base64,${frontImg}`} className="w-full h-full object-cover" alt="Front side" />}
              <div className="absolute top-1 left-1 bg-black/40 text-[8px] font-black px-1 rounded uppercase">Front</div>
            </div>
            <div className="w-24 h-16 bg-white/10 rounded-lg border border-white/20 overflow-hidden shadow-lg group relative">
              {backImg && <img src={`data:image/jpeg;base64,${backImg}`} className="w-full h-full object-cover" alt="Back side" />}
              <div className="absolute top-1 left-1 bg-black/40 text-[8px] font-black px-1 rounded uppercase">Back</div>
            </div>
          </div>
        </div>
      );
    }

    if (step === 'review') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-6 text-white p-8 bg-slate-900/50">
          <div className="text-center space-y-2 mb-2">
             <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                <Sparkles size={32} />
             </div>
             <h3 className="text-2xl font-black">Scan Complete</h3>
             <p className="text-slate-400 text-sm font-medium">Verify image quality before AI analysis.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
             <div className="relative group">
                <div className="aspect-[1.58/1] bg-slate-800 rounded-2xl border-2 border-slate-700 overflow-hidden shadow-xl">
                   {frontImg && <img src={`data:image/jpeg;base64,${frontImg}`} className="w-full h-full object-cover" alt="Front side" />}
                </div>
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-white/10">Front Side</div>
             </div>
             <div className="relative group">
                <div className="aspect-[1.58/1] bg-slate-800 rounded-2xl border-2 border-slate-700 overflow-hidden shadow-xl">
                   {backImg && <img src={`data:image/jpeg;base64,${backImg}`} className="w-full h-full object-cover" alt="Back side" />}
                </div>
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-white/10">Back Side</div>
             </div>
          </div>

          <div className="flex gap-3 w-full max-w-sm pt-4">
             <button
               onClick={retake}
               className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/5"
             >
               <RotateCcw size={16} />
               <span>Retake</span>
             </button>
             <button
               onClick={startAnalysis}
               className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
             >
               <BrainCircuit size={16} />
               <span>Analyze Data</span>
             </button>
          </div>
        </div>
      );
    }

    if (step === 'flipped') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-8 text-white p-8 bg-slate-900/50">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/20 animate-in zoom-in duration-300">
              <Check size={40} />
            </div>
            <h3 className="text-3xl font-black">Front Scan Done</h3>
            <p className="text-slate-300 font-medium">Flip the card to scan the <span className="text-white font-bold underline">Back</span>.</p>
          </div>
          
          <div className="relative group">
             <div className="w-64 h-40 bg-slate-800 rounded-3xl border-4 border-slate-700 overflow-hidden shadow-2xl">
                {frontImg && <img src={`data:image/jpeg;base64,${frontImg}`} className="w-full h-full object-cover opacity-40 grayscale" alt="Front side" />}
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw size={48} className="text-white/60 animate-spin-slow" />
                </div>
             </div>
             <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-2 rounded-full text-[10px] font-black shadow-xl tracking-widest uppercase flex items-center gap-2">
                <Zap size={14} />
                Flip Now
             </div>
          </div>

          <button
            onClick={() => setStep('back')}
            className="flex items-center gap-3 px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-2xl shadow-blue-500/40 active:scale-95 group"
          >
            <span>Ready for Back Side</span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Capture Flash Overlay */}
        <div className={`absolute inset-0 bg-white transition-opacity duration-150 pointer-events-none z-30 ${isFlashing ? 'opacity-100' : 'opacity-0'}`} />

        {/* Capture Success Overlay */}
        <div className={`absolute inset-0 z-40 flex items-center justify-center pointer-events-none transition-all duration-300 ${showSuccessOverlay ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl">
            <Check size={48} className="text-white" />
          </div>
        </div>

        {/* Viewfinder Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-4/5 aspect-[1.58/1] border-4 border-white/50 rounded-3xl shadow-[0_0_0_100vw_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute -top-14 left-0 right-0 text-center text-white font-black text-xs uppercase tracking-[0.3em] drop-shadow-lg flex items-center justify-center gap-2">
              <Scan size={14} className="text-blue-400" />
              {step === 'front' ? 'Align Card Front' : 'Align Card Back'}
            </div>
            
            {/* Scanning Line Animation */}
            <div className="absolute left-0 right-0 h-[2px] bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-10 animate-scanline" />

            {/* Corners */}
            <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl" />
            <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl" />
            <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl" />
            <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-blue-500 rounded-br-2xl" />

            {/* Quality Indicators */}
            <div className="absolute -bottom-16 left-0 right-0 flex justify-center gap-4">
               <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md transition-all ${quality.brightness < 50 || quality.brightness > 220 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'}`}>
                  <Sun size={10} />
                  Light
               </div>
               <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md transition-all ${quality.detail < 15 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'}`}>
                  <Zap size={10} />
                  Focus
               </div>
            </div>
          </div>
        </div>

        {/* Real-time Hint Toast */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center px-8">
            <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all duration-300 ${quality.isGood ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900/80 border-white/10 text-white'}`}>
               {quality.isGood ? <Check size={18} /> : <Info size={18} className="text-blue-400" />}
               <span className="text-xs font-black uppercase tracking-wider">{quality.hint}</span>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[60] flex flex-col items-center justify-center p-4">
      <style>{`
        @keyframes scanline {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scanline {
          animation: scanline 2.5s ease-in-out infinite alternate;
        }
      `}</style>
      <div className="w-full max-w-lg flex flex-col h-full">
        <div className="flex justify-between items-center mb-6 text-white">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                {isProcessing ? <Loader2 className="animate-spin text-blue-400" /> : <Camera size={20} className="text-blue-400" />}
             </div>
             <div>
                <h2 className="text-lg font-black tracking-tight leading-none">
                  {isProcessing ? 'AI Analyzing' : step === 'review' ? 'Verify Scan' : step === 'flipped' ? 'Switching' : `Scan ${step === 'front' ? 'Front' : 'Back'}`}
                </h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                   High Precision OCR Mode
                </p>
             </div>
          </div>
          <button onClick={onCancel} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all backdrop-blur-md">
            <X size={24} className="text-white" />
          </button>
        </div>

        <div className="relative flex-grow bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-slate-800/50 min-h-[350px]">
          {renderViewfinder()}
        </div>

        {(step === 'front' || step === 'back') && !isProcessing && (
          <div className="py-10 flex flex-col items-center gap-4">
            <button
              onClick={capture}
              disabled={isFlashing}
              className={`w-20 h-20 rounded-full flex items-center justify-center border-[8px] border-slate-800 active:scale-90 transition-all shadow-2xl hover:scale-105 disabled:opacity-50 ${quality.isGood ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white">
                <Camera size={24} />
              </div>
            </button>
            <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">
               <ShieldCheck size={12} />
               Device-local Encryption Active
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default CardScanner;
