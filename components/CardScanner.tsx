
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Check, RefreshCw, Loader2, Info, ArrowRight, Scan, ShieldCheck, Database, BrainCircuit, AlertTriangle, Sun, Zap, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { analyzeCardImages } from '../services/geminiService';
import { UI_STRINGS } from '../locales/en';

interface CardScannerProps {
  onScanComplete: (data: any) => void;
  onCancel: () => void;
}

const ANALYSIS_PHASES = [
  { icon: <Scan className="text-blue-400" size={20} />, text: UI_STRINGS.scanner.extracting_text },
  { icon: <ShieldCheck className="text-emerald-400" size={20} />, text: UI_STRINGS.scanner.identifying_security },
  { icon: <Database className="text-purple-400" size={20} />, text: UI_STRINGS.scanner.referencing_db },
  { icon: <BrainCircuit className="text-amber-400" size={20} />, text: UI_STRINGS.scanner.finalizing_profile },
];

interface QualityScore {
  brightness: number;
  detail: number;
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

  const checkQuality = useCallback(() => {
    if (!videoRef.current || step === 'review' || step === 'analyzing' || step === 'flipped') return;
    const video = videoRef.current;
    const canvas = qualityCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx || video.videoWidth === 0) return;

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

    let hint = UI_STRINGS.scanner.hold_steady;
    if (avgBrightness < 50) hint = UI_STRINGS.scanner.dark_hint;
    else if (avgBrightness > 220) hint = UI_STRINGS.scanner.bright_hint;
    else if (normalizedDetail < 15) hint = UI_STRINGS.scanner.blurry_hint;
    else hint = UI_STRINGS.scanner.perfect_hint;

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
        { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        { video: { facingMode: 'user' }, audio: false }
      ];

      let successfulStream: MediaStream | null = null;
      for (const constraints of constraintSets) {
        if (!isActive) return;
        try {
          successfulStream = await navigator.mediaDevices.getUserMedia(constraints);
          if (successfulStream) break;
        } catch (err) {}
      }

      if (successfulStream) {
        currentStream = successfulStream;
        setStream(successfulStream);
        if (videoRef.current) {
          videoRef.current.srcObject = successfulStream;
          videoRef.current.onloadedmetadata = () => {
            if (isActive) videoRef.current?.play().catch(() => {});
          };
        }
      } else {
        alert("Camera access failed. Please ensure permissions are granted.");
        onCancelRef.current();
      }
    }

    if (step === 'front' || step === 'back') startCamera();
    return () => {
      isActive = false;
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
    };
  }, [step]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (!quality.isGood) {
      if (!window.confirm("Image might be blurry or too dark. Try anyway?")) return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (video.videoWidth === 0) return;

    setIsFlashing(true);
    setTimeout(() => {
      setIsFlashing(false);
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 800);
    }, 150);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      if (step === 'front') {
        setFrontImg(base64Data);
        setTimeout(() => setStep('flipped'), 600);
      } else if (step === 'back') {
        setBackImg(base64Data);
        setTimeout(() => setStep('review'), 600);
      }
    }
  };

  const startAnalysis = () => {
    if (!frontImg || !backImg) return;
    setStep('analyzing');
    processImages(frontImg, backImg);
  };

  const processImages = async (front: string, back: string) => {
    setIsProcessing(true);
    const phaseInterval = setInterval(() => {
      setAnalysisPhase(prev => (prev < ANALYSIS_PHASES.length - 1 ? prev + 1 : prev));
    }, 1500);

    try {
      const result = await analyzeCardImages(front, back);
      if (result) {
        setTimeout(() => onScanComplete(result), 800);
      } else {
        alert("AI could not extract details clearly. Please try again or manually enter info.");
        onCancel();
      }
    } catch (error) {
      alert("Analysis failed.");
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
          <Loader2 size={64} className="animate-spin text-blue-500 relative z-10" />
          <div className="text-center space-y-6 w-full max-w-xs">
            <h3 className="text-2xl font-black tracking-tight">{UI_STRINGS.scanner.analyzing_title}</h3>
            <div className="space-y-2">
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest text-right">{Math.round(progress)}% Complete</p>
            </div>
            <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10 text-left text-left">
               {ANALYSIS_PHASES.map((phase, idx) => (
                 <div key={idx} className={`flex items-center space-x-3 transition-all duration-500 ${idx === analysisPhase ? 'opacity-100 translate-x-1' : idx < analysisPhase ? 'opacity-40' : 'opacity-20'}`}>
                    {idx < analysisPhase ? <CheckCircle2 size={16} className="text-emerald-400" /> : phase.icon}
                    <span className={`text-sm font-bold ${idx === analysisPhase ? 'text-white' : 'text-slate-400'}`}>{phase.text}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>
      );
    }

    if (step === 'review') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-6 text-white p-8 bg-slate-900/50">
          <h3 className="text-2xl font-black">{UI_STRINGS.scanner.scan_complete_title}</h3>
          <p className="text-slate-400 text-sm font-medium">{UI_STRINGS.scanner.scan_complete_subtitle}</p>
          <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
             <div className="aspect-[1.58/1] bg-slate-800 rounded-2xl border-2 border-slate-700 overflow-hidden shadow-xl">
                {frontImg && <img src={`data:image/jpeg;base64,${frontImg}`} className="w-full h-full object-cover" />}
             </div>
             <div className="aspect-[1.58/1] bg-slate-800 rounded-2xl border-2 border-slate-700 overflow-hidden shadow-xl">
                {backImg && <img src={`data:image/jpeg;base64,${backImg}`} className="w-full h-full object-cover" />}
             </div>
          </div>
          <div className="flex gap-3 w-full max-w-sm pt-4">
             <button onClick={() => setStep('front')} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest">{UI_STRINGS.common.retry}</button>
             <button onClick={startAnalysis} className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest">{UI_STRINGS.scanner.analyze_btn}</button>
          </div>
        </div>
      );
    }

    if (step === 'flipped') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-8 text-white p-8 bg-slate-900/50">
          <h3 className="text-3xl font-black">Front Scan Done</h3>
          <p className="text-slate-300 font-medium text-center">Flip the card to scan the <span className="text-white font-bold underline">Back</span>.</p>
          <button onClick={() => setStep('back')} className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-2xl shadow-blue-500/40 active:scale-95">{UI_STRINGS.scanner.ready_back_btn}</button>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full overflow-hidden bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className={`absolute inset-0 bg-white transition-opacity duration-150 pointer-events-none z-30 ${isFlashing ? 'opacity-100' : 'opacity-0'}`} />
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-4/5 aspect-[1.58/1] border-4 border-white/50 rounded-3xl shadow-[0_0_0_100vw_rgba(0,0,0,0.8)] relative">
            <div className="absolute -top-14 left-0 right-0 text-center text-white font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2">
              {step === 'front' ? UI_STRINGS.scanner.align_front : UI_STRINGS.scanner.align_back}
            </div>
            <div className="absolute -bottom-16 left-0 right-0 flex justify-center gap-4">
               <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${quality.brightness < 50 || quality.brightness > 220 ? 'text-rose-400 border border-rose-500/50' : 'text-emerald-400 border border-emerald-500/50'}`}>{UI_STRINGS.scanner.light_hint}</div>
               <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${quality.detail < 15 ? 'text-rose-400 border border-rose-500/50' : 'text-emerald-400 border border-emerald-500/50'}`}>{UI_STRINGS.scanner.focus_hint}</div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-10 left-0 right-0 flex justify-center px-8 text-left">
            <div className={`px-6 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all ${quality.isGood ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900/80 border-white/10 text-white'}`}>
               <span className="text-xs font-black uppercase tracking-wider">{quality.hint}</span>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[60] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg flex flex-col h-full text-left">
        <div className="flex justify-between items-center mb-6 text-white">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><Camera size={20} className="text-blue-400" /></div>
             <h2 className="text-lg font-black tracking-tight leading-none">AI Visual Capture</h2>
          </div>
          <button onClick={onCancel} className="p-3 bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
        </div>
        <div className="relative flex-grow bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-slate-800/50 min-h-[350px]">
          {renderViewfinder()}
        </div>
        {(step === 'front' || step === 'back') && !isProcessing && (
          <div className="py-10 flex flex-col items-center gap-4">
            <button onClick={capture} className={`w-20 h-20 rounded-full flex items-center justify-center border-[8px] border-slate-800 active:scale-90 transition-all ${quality.isGood ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <Camera size={24} className="text-white" />
            </button>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default CardScanner;
