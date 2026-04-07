import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, MapPin, History, Sparkles, Volume2, VolumeX, ArrowLeft, Loader2, CameraIcon, Upload, Github, Instagram, Linkedin, Play, Pause, Share2, Clock, Info, X, Mic, Map, Box, HelpCircle, ChevronRight, Navigation, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { identifyLandmark, fetchLandmarkDetails, generateNarration, LandmarkInfo, TimelineEvent } from './services/gemini';

type AppState = 'idle' | 'capturing' | 'analyzing' | 'ar' | 'result' | 'history';

interface HistoryItem extends LandmarkInfo {
  image: string;
  timestamp: number;
}

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [landmarkInfo, setLandmarkInfo] = useState<LandmarkInfo | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedEra, setSelectedEra] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [isNarrating, setIsNarrating] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    (videoRef as any).current = node;
    if (node && stream) {
      node.srcObject = stream;
      node.onloadedmetadata = () => {
        node.play().catch(console.error);
      };
    }
  }, [stream]);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('lumina_tour_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    const hasSeenOnboarding = localStorage.getItem('lumina_onboarding_seen');
    if (!hasSeenOnboarding) {
      setOnboardingStep(0);
    }

    // Voice Recognition Setup
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (event: any) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
        handleVoiceCommand(command);
      };
    }
  }, []);

  const handleVoiceCommand = (command: string) => {
    console.log('Voice Command:', command);
    if (command.includes('take photo') || command.includes('capture')) {
      if (state === 'capturing') takePhoto();
    } else if (command.includes('go back') || command.includes('reset')) {
      reset();
    } else if (command.includes('history')) {
      setState('history');
    } else if (command.includes('open camera')) {
      startCamera();
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
    setIsListening(!isListening);
  };

  const saveToHistory = (item: HistoryItem) => {
    const newHistory = [item, ...history].slice(0, 20); // Keep last 20
    setHistory(newHistory);
    localStorage.setItem('lumina_tour_history', JSON.stringify(newHistory));
  };

  const startCamera = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(newStream);
      setState('capturing');
    } catch (err) {
      setError('Could not access camera. Please check permissions.');
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Image Preprocessing: Simple brightness/contrast enhancement
      ctx.filter = 'brightness(1.1) contrast(1.1)';
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(dataUrl);
      analyzePhoto(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCapturedImage(dataUrl);
        analyzePhoto(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzePhoto = async (image: string) => {
    setState('analyzing');
    setError(null);
    setLoadingMessage('Identifying landmark with high precision...');
    try {
      const base64 = image.split(',')[1];
      const result = await identifyLandmark(base64);
      
      if (!result.isLandmark) {
        if (result.confidence < 0.4 || result.type === 'unknown') {
          setError('No landmark or famous place identified. Please try uploading more pictures or a clearer shot of the location.');
        } else {
          setError(`This appears to be a ${result.type} (${result.name}), not a famous landmark or public place. Lumina Tour is designed for travel and tourism.`);
        }
        setState('idle');
        return;
      }

      setLoadingMessage(`Fetching precise details for ${result.name}...`);
      const details = await fetchLandmarkDetails(result.name);
      setLandmarkInfo(details);

      // Save to history
      saveToHistory({
        ...details,
        image,
        timestamp: Date.now()
      });

      setState('ar'); // Switch to AR view first
    } catch (err) {
      console.error(err);
      setError('No place found. Please ensure you are capturing a well-known landmark or public space.');
      setState('idle');
    }
  };

  const handleGenerateNarration = async () => {
    if (!landmarkInfo || isNarrating) return;
    setIsNarrating(true);
    try {
      const audioBase64 = await generateNarration(landmarkInfo.history);
      setAudioUrl(audioBase64);
      playAudio(audioBase64);
    } catch (err) {
      console.error(err);
      setError('Failed to generate narration.');
    } finally {
      setIsNarrating(false);
    }
  };

  const shareLandmark = async () => {
    if (!landmarkInfo) return;
    const shareData = {
      title: landmarkInfo.name,
      text: `Check out this landmark I found: ${landmarkInfo.name} in ${landmarkInfo.location}. ${landmarkInfo.description}`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert('Information copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const playAudio = async (base64Data: string, offset: number = 0) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;

      if (!audioBufferRef.current) {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert PCM to Float32
        const pcmData = new Int16Array(bytes.buffer);
        const float32Data = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          float32Data[i] = pcmData[i] / 32768.0;
        }

        const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
        audioBuffer.getChannelData(0).set(float32Data);
        audioBufferRef.current = audioBuffer;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(ctx.destination);
      
      source.onended = () => {
        if (ctx.currentTime - startTimeRef.current >= (audioBufferRef.current?.duration || 0)) {
          setIsPlaying(false);
          pauseOffsetRef.current = 0;
          startTimeRef.current = 0;
        }
      };

      source.start(0, offset);
      startTimeRef.current = ctx.currentTime - offset;
      audioSourceRef.current = source;
      setIsPlaying(true);
    } catch (err) {
      console.error("Error playing audio:", err);
    }
  };

  const toggleAudio = () => {
    if (isPlaying) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      if (audioContextRef.current) {
        pauseOffsetRef.current = audioContextRef.current.currentTime - startTimeRef.current;
      }
      setIsPlaying(false);
    } else if (audioUrl) {
      playAudio(audioUrl, pauseOffsetRef.current);
    }
  };

  const reset = () => {
    setState('idle');
    setCapturedImage(null);
    setLandmarkInfo(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setError(null);
    
    // Reset audio refs
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    audioBufferRef.current = null;
    pauseOffsetRef.current = 0;
    startTimeRef.current = 0;

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/20 overflow-x-hidden">
      <AnimatePresence>
        {onboardingStep !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white/10 border border-white/20 p-8 rounded-3xl max-w-sm w-full space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-pastel-green/20 rounded-2xl flex items-center justify-center mx-auto">
                {onboardingStep === 0 && <CameraIcon className="w-8 h-8 text-pastel-green" />}
                {onboardingStep === 1 && <Sparkles className="w-8 h-8 text-pastel-green" />}
                {onboardingStep === 2 && <Mic className="w-8 h-8 text-pastel-green" />}
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-display font-bold text-pastel-green">
                  {onboardingStep === 0 && "Capture Landmarks"}
                  {onboardingStep === 1 && "AR Insights"}
                  {onboardingStep === 2 && "Voice Control"}
                </h2>
                <p className="text-white/60">
                  {onboardingStep === 0 && "Point your camera at any landmark to identify it instantly."}
                  {onboardingStep === 1 && "See history and facts overlaid directly on your camera feed."}
                  {onboardingStep === 2 && "Say 'Take Photo' or 'Open Camera' to control the app hands-free."}
                </p>
              </div>
              <button 
                onClick={() => {
                  if (onboardingStep < 2) {
                    setOnboardingStep(onboardingStep + 1);
                  } else {
                    setOnboardingStep(null);
                    localStorage.setItem('lumina_onboarding_seen', 'true');
                  }
                }}
                className="w-full bg-pastel-green text-black py-4 rounded-xl font-bold flex items-center justify-center space-x-2"
              >
                <span>{onboardingStep === 2 ? "Get Started" : "Next"}</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col min-h-screen p-6 text-center relative"
          >
            <div className="flex-1 flex flex-col items-center justify-center space-y-8 py-12">
              <div className="space-y-4">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ 
                    duration: 0.8, 
                    type: "spring",
                    stiffness: 200,
                    damping: 15
                  }}
                  className="w-24 h-24 bg-pastel-green/10 rounded-full flex items-center justify-center mx-auto backdrop-blur-xl border border-pastel-green/20 relative group"
                >
                  <div className="absolute inset-0 bg-pastel-green/20 rounded-full blur-2xl group-hover:blur-3xl transition-all animate-pulse" />
                  <Sparkles className="w-12 h-12 text-pastel-green relative z-10" />
                </motion.div>
                <motion.h1 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-6xl font-display font-bold tracking-tighter text-pastel-green"
                >
                  Lumina Tour
                </motion.h1>
                <p className="text-white/60 text-lg max-w-xs mx-auto">
                  Explore the world's landmarks through the lens of AI.
                </p>
              </div>

              <div className="flex flex-col w-full max-w-xs space-y-4">
                <button 
                  onClick={startCamera}
                  className="flex items-center justify-center space-x-3 bg-pastel-green text-black py-4 px-6 rounded-2xl font-semibold text-lg hover:bg-pastel-green-dark transition-all active:scale-95 shadow-[0_0_20px_rgba(167,243,208,0.3)]"
                >
                  <CameraIcon className="w-6 h-6" />
                  <span>Open Camera</span>
                </button>
                
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center justify-center space-x-3 bg-white/5 border border-white/10 py-4 px-2 rounded-2xl font-semibold text-sm hover:bg-white/10 transition-all cursor-pointer active:scale-95">
                    <Upload className="w-5 h-5" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button 
                    onClick={() => setState('history')}
                    className="flex items-center justify-center space-x-3 bg-white/5 border border-white/10 py-4 px-2 rounded-2xl font-semibold text-sm hover:bg-white/10 transition-all active:scale-95"
                  >
                    <Clock className="w-5 h-5" />
                    <span>History</span>
                  </button>
                </div>
              </div>

              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20 max-w-xs"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <footer className="flex flex-col items-center space-y-4 py-8 mt-auto">
              <div className="flex items-center space-x-6">
                <a href="https://github.com/Krish-x90" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-pastel-green transition-colors">
                  <Github className="w-5 h-5" />
                </a>
                <a href="https://www.instagram.com/sarodekrish" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-pastel-green transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://www.linkedin.com/in/krish-sarode-70392b356/" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-pastel-green transition-colors">
                  <Linkedin className="w-5 h-5" />
                </a>
              </div>
              <p className="text-white/20 text-xs font-medium tracking-widest uppercase">
                All rights reserved to Krish Sarode
              </p>
            </footer>
          </motion.div>
        )}

        {state === 'capturing' && (
          <motion.div 
            key="capturing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative min-h-screen bg-black"
          >
            <video 
              ref={setVideoRef} 
              autoPlay 
              playsInline 
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

            {/* Scanning Line Animation */}
            <motion.div 
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[2px] bg-pastel-green shadow-[0_0_15px_rgba(167,243,208,0.8)] z-10 pointer-events-none"
            />
            
            <div className="absolute inset-0 border-[2px] border-pastel-green/10 pointer-events-none" />

            <div className="absolute top-8 left-6 right-6 flex justify-between items-center">
              <button onClick={reset} className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={toggleVoice}
                className={`p-3 backdrop-blur-md rounded-full border transition-all ${isListening ? 'bg-red-500/20 border-red-500/40 text-red-500' : 'bg-black/40 border-white/10 text-white'}`}
              >
                <Mic className={`w-6 h-6 ${isListening ? 'animate-pulse' : ''}`} />
              </button>
            </div>

            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center">
              <button 
                onClick={takePhoto}
                className="w-20 h-20 bg-white rounded-full border-4 border-white/30 flex items-center justify-center active:scale-90 transition-transform"
              >
                <div className="w-16 h-16 bg-white rounded-full border-2 border-black/10" />
              </button>
            </div>
          </motion.div>
        )}

        {state === 'analyzing' && (
          <motion.div 
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-screen p-6 space-y-8"
          >
            <div className="relative">
              <div className="w-64 h-64 rounded-3xl overflow-hidden border-2 border-white/20">
                <img src={capturedImage!} alt="Analyzing" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-3xl">
                <Loader2 className="w-12 h-12 animate-spin text-white" />
              </div>
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] z-10"
              />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-display font-semibold text-pastel-green">Analyzing Scene</h2>
              <p className="text-white/60 animate-pulse">{loadingMessage}</p>
            </div>
          </motion.div>
        )}

        {state === 'ar' && landmarkInfo && (
          <motion.div 
            key="ar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative min-h-screen bg-black"
          >
            <video 
              ref={setVideoRef} 
              autoPlay 
              playsInline 
              muted
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
            
            {/* AR Scanning Effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <motion.div 
                animate={{ 
                  top: ['-10%', '110%'],
                  opacity: [0, 1, 1, 0]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  ease: "linear" 
                }}
                className="absolute left-0 right-0 h-1 bg-pastel-green shadow-[0_0_20px_rgba(167,243,208,0.8)]"
              />
              <div className="absolute inset-0 border-[20px] border-pastel-green/5" />
              <div className="absolute top-10 left-10 w-10 h-10 border-t-2 border-l-2 border-pastel-green/40" />
              <div className="absolute top-10 right-10 w-10 h-10 border-t-2 border-r-2 border-pastel-green/40" />
              <div className="absolute bottom-10 left-10 w-10 h-10 border-b-2 border-l-2 border-pastel-green/40" />
              <div className="absolute bottom-10 right-10 w-10 h-10 border-b-2 border-r-2 border-pastel-green/40" />
            </div>

            <div className="absolute inset-0 flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                className="bg-black/80 backdrop-blur-2xl border border-pastel-green/30 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-[0_0_50px_rgba(167,243,208,0.15)] relative"
              >
                <div className="absolute -top-3 -left-3 bg-pastel-green text-black text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                  Live Analysis
                </div>
                
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-display font-bold text-pastel-green tracking-tight">{landmarkInfo.name}</h2>
                    <div className="flex items-center space-x-2 text-white/60 text-xs">
                      <MapPin className="w-3 h-3 text-pastel-green/60" />
                      <span>{landmarkInfo.location}</span>
                    </div>
                  </div>
                  <button onClick={reset} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-sm text-white/80 leading-relaxed font-medium">
                  {landmarkInfo.description}
                </p>
                
                <div className="flex space-x-3 pt-2">
                  <motion.button 
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    onClick={() => setState('result')}
                    className="flex-1 bg-pastel-green text-black py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 hover:bg-pastel-green-dark transition-colors active:scale-95 shadow-[0_0_20px_rgba(167,243,208,0.3)]"
                  >
                    <Info className="w-4 h-4" />
                    <span>Learn More</span>
                  </motion.button>
                  <button 
                    onClick={audioUrl ? toggleAudio : handleGenerateNarration}
                    disabled={isNarrating}
                    className="bg-pastel-green text-black p-3 rounded-xl hover:bg-pastel-green-dark transition-colors active:scale-95 disabled:opacity-50"
                  >
                    {isNarrating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : audioUrl ? (
                      <Play className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <button 
                    onClick={shareLandmark}
                    className="bg-white/10 p-3 rounded-xl border border-white/10 hover:bg-white/20 transition-colors"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {state === 'result' && landmarkInfo && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-black"
          >
            <div className="relative h-[40vh]">
              <img src={capturedImage!} alt={landmarkInfo.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute top-8 left-6 right-6 flex justify-between">
                <button 
                  onClick={() => setState('ar')} 
                  className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={shareLandmark}
                  className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10"
                >
                  <Share2 className="w-6 h-6" />
                </button>
              </div>
              
              <div className="absolute bottom-6 left-6 right-6">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center space-x-2 text-pastel-green/60 text-sm mb-2"
                >
                  <MapPin className="w-4 h-4" />
                  <span>{landmarkInfo.location}</span>
                </motion.div>
                <h1 className="text-4xl font-display font-bold text-pastel-green">{landmarkInfo.name}</h1>
              </div>
            </div>

            <div className="p-6 space-y-8 pb-32">
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-3 gap-3"
              >
                <a 
                  href={landmarkInfo.mapUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center space-y-2 bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-pastel-green/10 hover:border-pastel-green/30 transition-all group"
                >
                  <Map className="w-6 h-6 text-pastel-green group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Maps</span>
                </a>
                <a 
                  href={landmarkInfo.threeDMapUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center space-y-2 bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-pastel-green/10 hover:border-pastel-green/30 transition-all group"
                >
                  <Box className="w-6 h-6 text-pastel-green group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">3D View</span>
                </a>
                <a 
                  href={landmarkInfo.streetViewUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center space-y-2 bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-pastel-green/10 hover:border-pastel-green/30 transition-all group"
                >
                  <Navigation className="w-6 h-6 text-pastel-green group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Street</span>
                </a>
              </motion.section>

              {landmarkInfo.timeline && landmarkInfo.timeline.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center space-x-2 text-pastel-green/40 uppercase tracking-widest text-xs font-bold">
                    <History className="w-4 h-4" />
                    <span>Interactive Timeline</span>
                  </div>
                  
                  <div className="relative space-y-4">
                    <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-pastel-green/20" />
                    <motion.div 
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: {
                            staggerChildren: 0.15
                          }
                        }
                      }}
                      className="space-y-4"
                    >
                      {landmarkInfo.timeline.map((event, i) => (
                        <motion.div 
                          key={i}
                          variants={{
                            hidden: { opacity: 0, x: -20 },
                            visible: { opacity: 1, x: 0 }
                          }}
                          className="relative pl-10"
                        >
                          <button 
                            onClick={() => setSelectedEra(selectedEra === i ? null : i)}
                            className={`w-full text-left p-4 rounded-2xl border transition-all duration-500 ${
                              selectedEra === i 
                              ? 'bg-pastel-green/10 border-pastel-green/40 shadow-[0_0_20px_rgba(167,243,208,0.1)]' 
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className={`absolute left-3 top-6 w-2.5 h-2.5 rounded-full border-2 border-black transition-colors duration-500 ${
                              selectedEra === i ? 'bg-pastel-green' : 'bg-white/20'
                            }`} />
                            <h3 className={`font-bold transition-colors duration-500 ${selectedEra === i ? 'text-pastel-green' : 'text-white/80'}`}>
                              {event.era}
                            </h3>
                            <AnimatePresence>
                              {selectedEra === i && (
                                <motion.p 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="text-sm text-white/60 mt-2 leading-relaxed overflow-hidden"
                                >
                                  {event.details}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                </section>
              )}

              <section className="space-y-4">
                <div className="flex items-center space-x-2 text-pastel-green/40 uppercase tracking-widest text-xs font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Fun Facts</span>
                </div>
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.1
                      }
                    }
                  }}
                  className="grid grid-cols-1 gap-3"
                >
                  {landmarkInfo.funFacts.map((fact, i) => (
                    <motion.div 
                      key={i}
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      className="bg-pastel-green/5 border border-pastel-green/10 p-4 rounded-xl text-white/70 hover:bg-pastel-green/10 transition-colors"
                    >
                      {fact}
                    </motion.div>
                  ))}
                </motion.div>
              </section>

              <footer className="flex flex-col items-center space-y-4 pt-12 border-t border-white/5">
                <div className="flex items-center space-x-6">
                  <a href="https://github.com/Krish-x90" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-pastel-green transition-colors">
                    <Github className="w-5 h-5" />
                  </a>
                  <a href="https://www.instagram.com/sarodekrish" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-pastel-green transition-colors">
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a href="https://www.linkedin.com/in/krish-sarode-70392b356/" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-pastel-green transition-colors">
                    <Linkedin className="w-5 h-5" />
                  </a>
                </div>
                <p className="text-white/20 text-xs font-medium tracking-widest uppercase">
                  All rights reserved to Krish Sarode
                </p>
              </footer>
            </div>

            <div className="fixed bottom-8 left-6 right-6">
              <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl flex items-center justify-between shadow-2xl">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-pastel-green rounded-2xl flex items-center justify-center text-black">
                    {isNarrating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Volume2 className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Audio Guide</p>
                    <p className="text-xs text-white/40">
                      {isNarrating ? 'Generating...' : isPlaying ? 'Playing Narration' : audioUrl ? 'Ready to play' : 'Tap to narrate'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={audioUrl ? toggleAudio : handleGenerateNarration}
                  disabled={isNarrating}
                  className="w-12 h-12 bg-pastel-green text-black rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-[0_0_15px_rgba(167,243,208,0.4)] disabled:opacity-50"
                >
                  {isNarrating ? <Loader2 className="w-6 h-6 animate-spin" /> : isPlaying ? <Pause className="w-6 h-6" /> : audioUrl ? <Play className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {state === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="min-h-screen bg-black p-6 space-y-8"
          >
            <div className="flex items-center justify-between">
              <button onClick={() => setState('idle')} className="p-3 bg-white/5 rounded-full">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-display font-bold text-pastel-green">Tour History</h2>
              <div className="w-12" />
            </div>

            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/40 space-y-4">
                <Clock className="w-16 h-16 opacity-20" />
                <p>No landmarks visited yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {history.map((item, i) => (
                  <motion.button
                    key={item.timestamp}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => {
                      setLandmarkInfo(item);
                      setCapturedImage(item.image);
                      setState('result');
                    }}
                    className="flex items-center space-x-4 bg-white/5 border border-white/10 p-3 rounded-2xl text-left hover:bg-white/10 transition-all"
                  >
                    <img src={item.image} className="w-20 h-20 rounded-xl object-cover" alt={item.name} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate">{item.name}</h3>
                      <p className="text-xs text-white/40 truncate">{item.location}</p>
                      <p className="text-[10px] text-pastel-green/40 mt-1">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
