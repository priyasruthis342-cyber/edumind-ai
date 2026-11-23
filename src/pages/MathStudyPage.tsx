import { useState, useRef, useEffect, useCallback, type DragEvent } from 'react';
import {
  Calculator, Sparkles, Volume2, VolumeX, Play, Pause, RotateCcw,
  ArrowRight, ArrowLeft, CheckCircle2, Award, Camera, ImagePlus,
  FileUp, Loader2, Send, HelpCircle, BookOpen, GraduationCap, Lightbulb,
  Maximize2, Minimize2, Mic, MicOff, Download, ChevronDown, Check,
  Radio, FileText, Image as ImageIcon, Sparkle
} from 'lucide-react';
import { useApp } from '@/context/useApp';
import {
  fetchMathTeacherLesson,
  askMathTeacherDoubt,
  fetchSynthesizedSpeech,
  extractImageWithGemini,
  type MathTeacherLessonResponse,
  type MathTeacherDoubtResponse,
  type MathStep
} from '@/lib/geminiApi';
import { extractTextFromFile } from '@/lib/extractText';
import { cleanMathFormatting } from '@/lib/mathFormatter';
import { ErrorNotice } from '@/components/ui';

// Quick preset high-yield math problems for instant 1-click learning
const PRESET_MATH_QUESTIONS: Record<string, { label: string; question: string }[]> = {
  ta: [
    { label: 'இருபடிச் சமன்பாடு (Quadratic Equation)', question: 'Solve the quadratic equation: x² + 5x + 6 = 0 by factorization.' },
    { label: 'நிகழ்தகவு (Dice Sum ≥ 9)', question: 'Two fair dice are thrown. What is the probability that the sum of the scores is at least 9?' },
    { label: 'வகையீடு (Calculus Derivative)', question: 'Find the derivative dy/dx for y = 3x⁴ - 5x² + 7x - 9 at x = 2.' },
    { label: 'பித்தாகரஸ் தேற்றம் (Pythagoras)', question: 'In a right-angled triangle, hypotenuse c = 13 cm and side a = 5 cm. Find side b.' },
    { label: 'அணிகள் (Matrix Determinant)', question: 'Find the determinant and inverse of matrix A = [[2, 4], [1, 3]].' }
  ],
  en: [
    { label: 'Quadratic Equation (x² + 5x + 6 = 0)', question: 'Solve: x² + 5x + 6 = 0 by factorization.' },
    { label: 'Probability Sum (Two Fair Dice)', question: 'Two fair dice are thrown. What is the probability that the sum of the scores is at least 9?' },
    { label: 'Calculus Derivative (dy/dx at x = 2)', question: 'Evaluate derivative dy/dx of y = 3x⁴ - 5x² + 7x - 9 at x = 2.' },
    { label: 'Pythagoras Theorem (Hypotenuse = 13)', question: 'In a right triangle, hypotenuse c = 13 cm and side a = 5 cm. Calculate side b.' },
    { label: 'Matrix Determinant (2x2 Matrix)', question: 'Find determinant and inverse of 2x2 matrix A = [[2, 4], [1, 3]].' }
  ],
  hi: [
    { label: 'द्विघात समीकरण', question: 'हल करें: x² + 5x + 6 = 0 गुणनखण्ड विधि द्वारा।' },
    { label: 'प्रायिकता (दो पासे)', question: 'दो निष्पक्ष पासे फेंके जाते हैं। अंकों का योग कम से कम 9 होने की प्रायिकता क्या है?' },
    { label: 'अवकलन (Calculus)', question: 'y = 3x⁴ - 5x² + 7x - 9 का अवकलन dy/dx निकालें जब x = 2 हो।' }
  ]
};

const TEACHER_GREETINGS: Record<string, string> = {
  ta: 'வணக்கம்! நான் உங்கள் கணித ஆசிரியை. வாருங்கள், கணிதத்தை பயமில்லாமல் மிக எளிமையாக ஒன்றாக படிப்போம்!',
  hi: 'नमस्ते! मैं आपकी गणित अध्यापिका हूँ। आइए, गणित को बहुत ही आसान और रोचक तरीके से सीखते हैं!',
  te: 'నమస్కారం! నేను మీ గణిత ఉపాధ్యాయురాలిని. గణితాన్ని చాలా సులభంగా మరియు సరదాగా నేర్చుకుందాం!',
  ml: 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ ഗണിത അധ്യാപികയാണ്. നമുക്ക് കണക്ക് വളരെ ലളിതമായി മനസ്സിലാക്കാം!',
  kn: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಗಣಿತ ಶಿಕ್ಷಕಿ. ಬನ್ನಿ, ಗಣಿತವನ್ನು ಸುಲಭವಾಗಿ ಮತ್ತು ಸಂತೋಷದಿಂದ ಕಲಿಯೋಣ!',
  en: "Hello! I'll teach you Math today. Let's start with your syllabus..."
};

export function MathStudyPage() {
  const { language: globalLanguage, setLanguage, t } = useApp();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(globalLanguage || 'en');
  const [inputQuestion, setInputQuestion] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeLesson, setActiveLesson] = useState<MathTeacherLessonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lesson teaching state
  const [isTeachingStarted, setIsTeachingStarted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Dynamic Teacher Speech Bubble Message
  const [teacherBubbleText, setTeacherBubbleText] = useState(
    TEACHER_GREETINGS[selectedLanguage] || TEACHER_GREETINGS.en
  );

  // Voice Audio Playback state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(45);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Interactive Live Microphone Voice (Two-Way Conversation)
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Doubt solving state
  const [userDoubtInput, setUserDoubtInput] = useState('');
  const [activeDoubt, setActiveDoubt] = useState<MathTeacherDoubtResponse | null>(null);
  const [askingDoubt, setAskingDoubt] = useState(false);

  // File upload refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Fullscreen chalkboard state
  const chalkboardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Presets
  const presets = PRESET_MATH_QUESTIONS[selectedLanguage] || PRESET_MATH_QUESTIONS.en;

  // Sync with global language changes
  useEffect(() => {
    if (globalLanguage) {
      setSelectedLanguage(globalLanguage);
      setTeacherBubbleText(TEACHER_GREETINGS[globalLanguage] || TEACHER_GREETINGS.en);
    }
  }, [globalLanguage]);

  // Cleanup audio URLs
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [audioUrl]);

  // Audio timer progression
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        if (audioRef.current) {
          setAudioCurrentTime(Math.floor(audioRef.current.currentTime));
          if (audioRef.current.duration) {
            setAudioDuration(Math.floor(audioRef.current.duration));
          }
        } else {
          setAudioCurrentTime((prev) => (prev >= audioDuration ? 0 : prev + 1));
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlayingAudio, audioDuration]);

  // Initialize Speech Recognition for Live Two-Way Voice
  const startVoiceListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice microphone recognition is supported in Chrome, Edge, and Android browsers. You can also type your doubt below.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage === 'ta' ? 'ta-IN' : selectedLanguage === 'hi' ? 'hi-IN' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechTranscript('');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setSpeechTranscript(transcriptText);

        // If the user says "start" or "yes" or "ஆரம்பிக்கலாம்" during ready prompt
        const clean = transcriptText.toLowerCase();
        if (!isTeachingStarted && (clean.includes('start') || clean.includes('yes') || clean.includes('சரி') || clean.includes('ஆரம்பிக்கலாம்') || clean.includes('shuru'))) {
          handleStartTeaching();
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('Speech recognition init note:', e);
      setIsListening(false);
    }
  }, [selectedLanguage, isTeachingStarted]);

  const stopVoiceListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
  }, []);

  // Speak teacher dialogue using Web Speech API or synthesized audio
  const speakTeacherText = useCallback(async (textToSpeak: string) => {
    if (!textToSpeak) return;

    // Clean text to avoid speech stuttering on LaTeX or code tokens
    const sanitizedSpeech = textToSpeak
      .replace(/\\\(|\\\)|\\\[|\\\]|\$+/g, ' ')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[\{\}\^_\*\#\`\<\>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    setTeacherBubbleText(textToSpeak);

    // Stop existing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    try {
      setLoadingAudio(true);
      const audioBlob = await fetchSynthesizedSpeech(sanitizedSpeech, selectedLanguage, 'story');
      const url = URL.createObjectURL(audioBlob);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.muted = isMuted;
      audio.onended = () => {
        setIsPlayingAudio(false);
        // When teacher finishes speaking, prompt for doubts
        if (isTeachingStarted) {
          setTeacherBubbleText(
            selectedLanguage === 'ta'
              ? 'ஏதாவது சந்தேகம் இருக்கா? கேளுங்க. நான் ஈஸியா சொல்லித்தரேன்!'
              : 'Do you have any doubts? Ask me if you do, and we will solve it together!'
          );
        }
      };
      audio.onerror = () => setIsPlayingAudio(false);

      await audio.play();
      setIsPlayingAudio(true);
    } catch {
      // Fallback: Web Speech API with Female voice
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(sanitizedSpeech);
        utter.lang = selectedLanguage === 'ta' ? 'ta-IN' : selectedLanguage === 'hi' ? 'hi-IN' : 'en-US';
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = utter.lang.split('-')[0];
        const femaleVoice = voices.find(v =>
          v.lang.startsWith(langPrefix) && (
            v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('pallavi') ||
            v.name.toLowerCase().includes('zira') ||
            v.name.toLowerCase().includes('jenny') ||
            v.name.toLowerCase().includes('natural') ||
            v.name.toLowerCase().includes('samantha')
          )
        ) || voices.find(v => v.lang.startsWith(langPrefix));
        if (femaleVoice) utter.voice = femaleVoice;
        utter.rate = 0.95;
        utter.onend = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utter);
        setIsPlayingAudio(true);
      }
    } finally {
      setLoadingAudio(false);
    }
  }, [selectedLanguage, audioUrl, isMuted, isTeachingStarted]);

  // Main Solve / Analyze Handler
  const handleAnalyzeSyllabus = async (overrideText?: string, base64Override?: string) => {
    const questionText = overrideText || inputQuestion.trim();
    if (!questionText && !base64Override && !selectedFile) {
      setError('Please upload a Maths syllabus/question PDF or photo, or type a math problem.');
      return;
    }

    setLoading(true);
    setError(null);
    setIsTeachingStarted(false);
    setCurrentStepIndex(0);
    setActiveDoubt(null);

    // Stop playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }

    try {
      let textToSend = questionText;
      let base64ImageToSend = base64Override;

      // If a file was selected but not extracted yet
      if (selectedFile && !base64Override) {
        setUploadStatus('Reading and analyzing mathematics syllabus...');
        if (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) {
          const res = await extractTextFromFile(selectedFile, (s) => setUploadStatus(s));
          if (res.text && res.text.trim()) {
            textToSend = res.text.trim();
          }
        } else if (selectedFile.type.startsWith('image/')) {
          try {
            const extracted = await extractImageWithGemini(selectedFile);
            if (extracted && extracted.trim()) {
              textToSend = extracted.trim();
            }
          } catch {
            // Read base64
            const reader = new FileReader();
            base64ImageToSend = await new Promise<string>((res) => {
              reader.onload = () => res(reader.result as string);
              reader.readAsDataURL(selectedFile);
            });
          }
        }
      }

      setUploadStatus('AI Math Teacher solving problem on blackboard...');
      const lesson = await fetchMathTeacherLesson(
        textToSend || 'Solve: x² + 5x + 6 = 0',
        selectedLanguage,
        base64ImageToSend
      );

      setActiveLesson(lesson);

      // AI Teacher greeting and ready pause gate
      const readyGreeting = lesson.ready_prompt || lesson.greeting ||
        (selectedLanguage === 'ta'
          ? 'வணக்கம்! நான் உங்கள் கணித ஆசிரியை. கரும்பலகையில கேள்வியும் ஃபார்முலாவும் எழுதியாச்சு. பாடத்தை ஆரம்பிக்கலாமா?'
          : 'Hello! I have written the question, formula, and steps on the chalkboard! Shall we start?');

      setTeacherBubbleText(readyGreeting);

      // Auto-speak the greeting
      void speakTeacherText(readyGreeting);

      // Smooth scroll to blackboard
      setTimeout(() => {
        const boardEl = document.getElementById('chalkboard-arena');
        if (boardEl) boardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);

    } catch (err) {
      console.error('Math analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Could not process math question. Please check your connection.');
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  // Start Teaching Walkthrough (Confirmation Gate)
  const handleStartTeaching = () => {
    setIsTeachingStarted(true);
    setCurrentStepIndex(0);

    const steps = activeLesson?.board_content?.steps || [];
    const firstStep = steps[0];

    const introSpeech = firstStep
      ? `${firstStep.title}. ${firstStep.work}. ${firstStep.marking_tip}`
      : (activeLesson?.teacher_dialogue || 'Let us begin our math lesson!');

    void speakTeacherText(introSpeech);
  };

  // Step Navigation
  const handleGoToStep = (index: number) => {
    const steps = activeLesson?.board_content?.steps || [];
    if (index < 0 || index >= steps.length) return;

    setCurrentStepIndex(index);
    const target = steps[index];
    const stepSpeech = `${target.title}. ${target.work}. ${target.marking_tip}`;
    void speakTeacherText(stepSpeech);
  };

  // Two-Way Interactive Doubt Solving Handler
  const handleAskDoubt = async (customDoubt?: string) => {
    const doubtToSolve = customDoubt || speechTranscript || userDoubtInput.trim();
    if (!doubtToSolve) return;

    setAskingDoubt(true);
    try {
      const currentStep = (currentStepIndex || 0) + 1;
      const resp = await askMathTeacherDoubt(
        activeLesson?.board_content?.question || inputQuestion,
        doubtToSolve,
        currentStep,
        selectedLanguage
      );

      setActiveDoubt(resp);
      setUserDoubtInput('');
      setSpeechTranscript('');

      const replySpeech = `${resp.teacher_reply} ${resp.understanding_check}`;
      void speakTeacherText(replySpeech);
    } catch (err) {
      console.warn('Doubt handling note:', err);
    } finally {
      setAskingDoubt(false);
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setInputQuestion(`Math Problem File: ${file.name}`);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!chalkboardRef.current) return;
    if (!document.fullscreenElement) {
      void chalkboardRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">

      {/* ─────────────────────────────────────────────────────────────
          1. HERO BANNER — Matches media_1795443569554_585389cd.jpg
      ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-100 via-indigo-50 to-purple-100 border border-blue-200/60 p-6 sm:p-8 shadow-sm">
        {/* Floating math background symbols */}
        <div className="absolute top-3 left-1/4 text-4xl font-serif text-indigo-300/40 select-none pointer-events-none">π</div>
        <div className="absolute bottom-4 left-1/3 text-3xl font-serif text-purple-300/40 select-none pointer-events-none">∑</div>
        <div className="absolute top-6 right-1/4 text-3xl font-serif text-blue-300/40 select-none pointer-events-none">√x</div>
        <div className="absolute bottom-2 right-1/3 text-4xl font-serif text-indigo-300/30 select-none pointer-events-none">∫</div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 sm:gap-6">
            {/* Cute Schoolgirl AI Teacher Character Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-indigo-300/70 shadow-md bg-white">
                <img
                  src="/teacher-girl.jpg"
                  alt="AI Math Teacher"
                  className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-300"
                />
              </div>
              <span className="absolute -bottom-2 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
                <span className="text-indigo-600 font-serif">π</span>
                <span>Mathematical Study with</span>
                <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-pink-600 bg-clip-text text-transparent">
                  AI Teacher
                </span>
              </h1>
              <p className="text-base sm:text-lg font-serif italic text-purple-900/80 font-medium mt-1">
                Upload. Learn. Understand.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 font-sans">
                Upload your Maths syllabus and start learning with AI!
              </p>
            </div>
          </div>

          {/* Right Sparkle Badge */}
          <div className="hidden lg:flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-purple-200/80 rounded-2xl px-5 py-3 text-purple-900 shadow-sm shrink-0">
            <Sparkle className="h-4 w-4 text-amber-500 fill-amber-400 animate-spin-slow" />
            <span className="text-sm font-bold">Let&apos;s Learn Math Together! ✨</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. STEP-BY-STEP SETUP CONTROLS CARD — 3 Columns
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-indigo-100/90 shadow-md p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

        {/* Column 1: Choose Language */}
        <div className="flex flex-col justify-between space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/70">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Choose Language</h3>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedLanguage('en');
                  setLanguage('en');
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedLanguage === 'en'
                    ? 'bg-purple-700 text-white shadow-md'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>🌐 English</span>
                {selectedLanguage === 'en' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedLanguage('ta');
                  setLanguage('ta');
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedLanguage === 'ta'
                    ? 'bg-purple-700 text-white shadow-md'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>அ தமிழ்</span>
                {selectedLanguage === 'ta' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
              </button>
            </div>

            {/* Other Languages Dropdown */}
            <select
              value={selectedLanguage}
              onChange={(e) => {
                const lang = e.target.value;
                setSelectedLanguage(lang);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setLanguage(lang as any);
              }}
              className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="en">English (Default)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="ml">മലയാളം (Malayalam)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
            </select>
          </div>
        </div>

        {/* Column 2: Upload Maths Syllabus (PDF or Photo) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col justify-between p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/70'
              : selectedFile
              ? 'border-emerald-400 bg-emerald-50/50'
              : 'border-slate-300 hover:border-indigo-400 bg-slate-50/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Upload Maths Syllabus</h3>
            </div>
            {selectedFile && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" /> Ready
              </span>
            )}
          </div>

          <div className="py-2 flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              {selectedFile ? (
                selectedFile.name.endsWith('.pdf') ? (
                  <FileText className="h-5 w-5 text-purple-700" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-indigo-700" />
                )
              ) : (
                <FileUp className="h-5 w-5" />
              )}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-800 truncate max-w-[170px]">
                {selectedFile ? selectedFile.name : 'Click to Upload or Drag & Drop'}
              </p>
              <p className="text-[11px] text-slate-500">Only Maths PDF / Image Allowed</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-200/60">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              className="text-[11px] font-semibold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Camera className="h-3 w-3" /> Take Photo
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="text-[11px] font-semibold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ImagePlus className="h-3 w-3" /> Browse File
            </button>
          </div>

          {/* Hidden inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                setSelectedFile(file);
                setInputQuestion(`Uploaded Math File: ${file.name}`);
              }
            }}
            accept=".pdf,image/*,.txt"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                setSelectedFile(file);
                setInputQuestion(`Camera Photo: ${file.name}`);
              }
            }}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
        </div>

        {/* Column 3: Analyze with AI Button */}
        <div className="flex flex-col justify-between space-y-3 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-purple-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
              3
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Analyze with AI</h3>
          </div>

          <button
            type="button"
            onClick={() => handleAnalyzeSyllabus()}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-75"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Solving Math...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>✨ Analyze Now ➔</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1">
            <span>⚡</span> It will only take a few seconds...
          </p>
        </div>
      </div>

      {/* Upload progress & error notice */}
      {uploadStatus && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center gap-3 text-xs font-semibold text-indigo-900 animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {error && (
        <ErrorNotice
          message={error}
          retryLabel="Try Solving Again"
          onRetry={() => void handleAnalyzeSyllabus()}
        />
      )}

      {/* Quick math preset topics */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="font-bold text-slate-500 shrink-0 flex items-center gap-1">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Presets:
        </span>
        {presets.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setInputQuestion(preset.question);
              setSelectedFile(null);
              void handleAnalyzeSyllabus(preset.question);
            }}
            className="py-1 px-3 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300 font-medium whitespace-nowrap transition-colors cursor-pointer"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. LEARNING VIEW ARENA — AI Teacher (Left) + Blackboard (Right)
      ───────────────────────────────────────────────────────────── */}
      <div id="chalkboard-arena" className="w-full max-w-5xl mx-auto space-y-6">

        {/* ────── TOP AI TEACHER VOICE BANNER & GREETING ────── */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-purple-200/90 shadow-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              👩‍🏫
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">AI Math Teacher</h3>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Online</span>
                </span>
              </div>
              <p className="text-xs text-purple-700 font-medium mt-0.5">
                {selectedLanguage === 'ta' ? 'இயல்பான பேச்சுத் தமிழில் கற்பித்தல்' : 'Conversational Step-by-Step Spoken Walkthrough'}
              </p>
            </div>
          </div>

          {/* Teacher Speech Bubble */}
          <div className="relative flex-1 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-3.5 text-xs sm:text-sm font-medium text-purple-950 leading-relaxed shadow-inner w-full">
            <div className="flex items-start gap-2">
              <Volume2 className="h-4 w-4 text-purple-600 shrink-0 mt-0.5 animate-pulse" />
              <p className="line-clamp-3 sm:line-clamp-none">{teacherBubbleText}</p>
            </div>
          </div>

          {/* Start / Step Control Quick Action */}
          {activeLesson && (
            <div className="shrink-0 flex items-center gap-2">
              {!isTeachingStarted ? (
                <button
                  type="button"
                  onClick={handleStartTeaching}
                  className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer active:scale-95 transition-transform flex items-center gap-1.5"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>{selectedLanguage === 'ta' ? 'பாடத்தை தொடங்கு' : 'Start Lesson'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-purple-100/70 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => handleGoToStep(Math.max(0, currentStepIndex - 1))}
                    disabled={currentStepIndex <= 0}
                    className="p-1.5 rounded-xl text-purple-700 hover:bg-white disabled:opacity-30 cursor-pointer"
                    title="Previous Step"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 font-mono font-bold text-xs text-purple-900">
                    Step {currentStepIndex + 1} / {(activeLesson.board_content?.steps || []).length}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleGoToStep(Math.min((activeLesson.board_content?.steps || []).length - 1, currentStepIndex + 1))}
                    disabled={currentStepIndex >= (activeLesson.board_content?.steps || []).length - 1}
                    className="p-1.5 rounded-xl text-purple-700 hover:bg-white disabled:opacity-30 cursor-pointer"
                    title="Next Step"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
          <div
            ref={chalkboardRef}
            className={`relative overflow-hidden rounded-3xl bg-[#143224] text-white shadow-2xl transition-all ${
              isFullscreen
                ? 'fixed inset-0 z-50 rounded-none p-6 md:p-10 flex flex-col justify-between'
                : 'border-[14px] sm:border-[18px] border-[#844b20] p-6 sm:p-8 min-h-[580px]'
            }`}
            style={{
              boxShadow: 'inset 0 0 50px rgba(0,0,0,0.6), 0 20px 30px rgba(0,0,0,0.35)',
              backgroundImage: 'radial-gradient(circle at 50% 50%, #1e4533 0%, #10291e 100%)'
            }}
          >
            {/* Top Blackboard Chalk Details */}
            {!activeLesson ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center min-h-[460px] space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border-2 border-dashed border-amber-400/60 flex items-center justify-center text-amber-300 text-3xl shadow-inner">
                  📐
                </div>
                
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-amber-300 tracking-wide">
                    {selectedLanguage === 'ta' ? 'கரும்பலகை தயார்' : 'Chalkboard Ready'}
                  </h3>
                  <p className="text-xs sm:text-sm font-sans text-emerald-100/90 leading-relaxed">
                    {selectedLanguage === 'ta'
                      ? 'படி 2-ல் உங்கள் கணிதப் பாடத்திட்டம் அல்லது வினாத்தாளை பதிவேற்றிவிட்டு "Analyze Now" பொத்தானை அழுத்தவும். உங்கள் AI ஆசிரியை இங்கு முழு கணக்கையும் படிப்படியாக எழுதி விளக்குவார்!'
                      : 'Upload your Maths syllabus or question in Step 2 above and click "Analyze Now". Your AI Teacher will solve and write the step-by-step solution here!'}
                  </p>
                </div>

                {/* Chalk decorative guides */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg pt-2 text-left">
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50">
                    <span className="text-amber-400 font-bold font-serif text-xs block">1. Language</span>
                    <span className="text-[11px] text-slate-200">English, தமிழ் & more</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50">
                    <span className="text-amber-400 font-bold font-serif text-xs block">2. Upload</span>
                    <span className="text-[11px] text-slate-200">PDF, Photo or Presets</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50">
                    <span className="text-amber-400 font-bold font-serif text-xs block">3. Step-by-Step</span>
                    <span className="text-[11px] text-slate-200">Spoken voice + Board</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2 text-xs font-mono text-amber-300/80">
                  <Sparkles className="h-4 w-4" />
                  <span>Ready for your math syllabus</span>
                </div>
              </div>
            ) : (
              <div className="space-y-6">

                {/* Chalkboard Topic Header in Bright Yellow Chalk */}
                <div className="text-center border-b border-emerald-800/60 pb-4">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-serif tracking-wide drop-shadow-md">
                    {activeLesson.detected_topic || 'Mathematics Lesson'}
                  </h2>
                  <div className="h-0.5 w-32 bg-amber-300/60 mx-auto mt-1 rounded-full"></div>
                </div>

                {/* Complete Problem Statement Box */}
                <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-700/60 font-mono text-emerald-100">
                  <span className="text-amber-300 font-bold block text-xs sm:text-sm font-sans uppercase tracking-wider mb-1">
                    {selectedLanguage === 'ta' ? 'முழுக் கணக்கு / வினா (Question Statement):' : 'Full Mathematical Problem / Question:'}
                  </span>
                  <p className="text-sm sm:text-base font-semibold leading-relaxed whitespace-pre-wrap">
                    {activeLesson.board_content?.question || inputQuestion}
                  </p>
                </div>

                {/* Core Formula & Given Data Grid */}
                {(activeLesson.board_content?.given_data || activeLesson.board_content?.core_formula) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeLesson.board_content?.given_data && (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-xs sm:text-sm font-mono text-emerald-200">
                        <span className="text-amber-300 font-bold block font-sans text-xs">
                          {selectedLanguage === 'ta' ? 'கொடுக்கப்பட்ட விவரங்கள் (Given Data):' : 'Given Data:'}
                        </span>
                        <p className="mt-0.5 whitespace-pre-wrap">{activeLesson.board_content.given_data}</p>
                      </div>
                    )}
                    {activeLesson.board_content?.core_formula && (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-xs sm:text-sm font-mono text-emerald-200">
                        <span className="text-amber-300 font-bold block font-sans text-xs">
                          {selectedLanguage === 'ta' ? 'சூத்திரம் (Core Formula):' : 'Governing Formula:'}
                        </span>
                        <p className="mt-0.5 whitespace-pre-wrap">{activeLesson.board_content.core_formula}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step-by-Step Chalk Working */}
                <div className="space-y-4 pt-2">
                  {activeLesson.board_content?.steps?.map((step, idx) => {
                    const isActive = isTeachingStarted && currentStepIndex === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleGoToStep(idx)}
                        className={`p-3.5 rounded-xl transition-all cursor-pointer ${
                          isActive
                            ? 'bg-emerald-900/90 border-2 border-amber-400 shadow-md translate-x-1'
                            : 'hover:bg-emerald-900/40 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="font-serif font-bold text-amber-300 shrink-0 text-sm sm:text-base underline decoration-amber-400/50">
                            Step {step.step_number || idx + 1} :
                          </span>
                          <div className="space-y-1 flex-1">
                            <p className="text-xs sm:text-sm font-sans font-medium text-slate-100">
                              {step.title}
                            </p>
                            <p className="text-xs sm:text-sm font-mono font-bold text-white whitespace-pre-wrap">
                              {step.work}
                            </p>
                            {/* Exam Marking Tip */}
                            {step.marking_tip && (
                              <p className="text-[11px] font-sans font-medium text-amber-200/90 pt-1 flex items-center gap-1">
                                <Award className="h-3 w-3 text-amber-400 shrink-0" />
                                <span>{step.marking_tip}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Framed Final Answer Box (Chalk Box) */}
                {activeLesson.board_content?.final_answer && (
                  <div className="mt-6 flex justify-end">
                    <div className="inline-block p-4 rounded-2xl border-2 border-amber-400 bg-emerald-950/80 shadow-lg text-center min-w-[220px]">
                      <p className="text-xs font-serif font-bold text-amber-300 tracking-wider">
                        🎯 FINAL ANSWER:
                      </p>
                      <p className="text-lg sm:text-xl font-mono font-extrabold text-white mt-1">
                        {activeLesson.board_content.final_answer}
                      </p>
                    </div>
                  </div>
                )}

                {/* Ready Confirmation Gate (When teaching hasn't started yet) */}
                {!isTeachingStarted && (
                  <div className="mt-4 p-4 rounded-2xl bg-amber-950/70 border border-amber-500/80 text-center space-y-3 animate-bounce-slow">
                    <p className="text-sm sm:text-base font-bold text-amber-200">
                      ✨ {activeLesson.ready_prompt || 'பாடத்தை ஆரம்பிக்கலாமா? (Shall we start?)'}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleStartTeaching}
                        className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md cursor-pointer active:scale-95 transition-transform"
                      >
                        🚀 Yes, Start Lesson! (ஆரம்பிக்கலாம்)
                      </button>
                      <button
                        type="button"
                        onClick={() => startVoiceListening()}
                        className="py-2.5 px-4 rounded-xl bg-emerald-900 border border-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Mic className="h-3.5 w-3.5" />
                        <span>Say &ldquo;Yes&rdquo;</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Chalkboard Audio Controller Bar — Exact Match to Image */}
            <div className="mt-8 pt-4 border-t border-emerald-800/60 flex items-center justify-between gap-3 text-xs">
              {/* Play / Pause Button in Purple Circle */}
              <button
                type="button"
                onClick={() => {
                  if (isPlayingAudio && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlayingAudio(false);
                  } else if (audioUrl && audioRef.current) {
                    void audioRef.current.play();
                    setIsPlayingAudio(true);
                  } else {
                    const speech = activeLesson?.spoken_audio_script || activeLesson?.teacher_dialogue || teacherBubbleText;
                    void speakTeacherText(speech);
                  }
                }}
                disabled={loadingAudio}
                className="w-10 h-10 rounded-full bg-purple-700 hover:bg-purple-800 text-white flex items-center justify-center shadow-md cursor-pointer shrink-0 active:scale-90 transition-transform"
              >
                {loadingAudio ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPlayingAudio ? (
                  <Pause className="h-4 w-4 fill-white" />
                ) : (
                  <Play className="h-4 w-4 fill-white ml-0.5" />
                )}
              </button>

              {/* Time Tracker */}
              <span className="font-mono text-[11px] text-emerald-200 shrink-0">
                {String(Math.floor(audioCurrentTime / 60)).padStart(2, '0')}:
                {String(audioCurrentTime % 60).padStart(2, '0')} / 00:45
              </span>

              {/* Scrubber slider */}
              <div className="flex-1 max-w-md bg-emerald-950 h-2 rounded-full overflow-hidden relative cursor-pointer">
                <div
                  style={{ width: `${Math.min(100, (audioCurrentTime / (audioDuration || 45)) * 100)}%` }}
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-300"
                />
              </div>

              {/* Volume & Fullscreen Actions (Download Button Removed) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isMuted;
                    setIsMuted(next);
                    if (audioRef.current) audioRef.current.muted = next;
                  }}
                  className="p-1.5 text-emerald-300 hover:text-white cursor-pointer"
                  title="Toggle Mute"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 text-emerald-300 hover:text-white cursor-pointer"
                  title="Fullscreen Chalkboard"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

          </div>

        {/* ────── INTERACTIVE DOUBT RESOLUTION & MIC BAR (BELOW BLACKBOARD) ────── */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-purple-200 shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-purple-600" />
              <h4 className="font-extrabold text-slate-800 text-sm sm:text-base">
                {selectedLanguage === 'ta' ? 'ஆசிரியையிடம் சந்தேகம் கேளுங்கள் (Ask Doubt)' : 'Ask Teacher a Doubt / Question'}
              </h4>
            </div>
            <span className="text-xs text-slate-500">
              {selectedLanguage === 'ta' ? 'குரல் அல்லது எழுத்து மூலம்' : 'Voice or Text'}
            </span>
          </div>

          {/* Mic and Input Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Mic Button with Sound Waves */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isListening) {
                    stopVoiceListening();
                    if (speechTranscript) {
                      void handleAskDoubt(speechTranscript);
                    }
                  } else {
                    startVoiceListening();
                  }
                }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow transition-all active:scale-95 cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-rose-600 text-white ring-4 ring-rose-200 animate-pulse'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
                title={isListening ? 'Tap to submit doubt' : 'Tap to speak your doubt'}
              >
                <Mic className={`h-5 w-5 ${isListening ? 'animate-bounce' : ''}`} />
              </button>

              {/* Sound Wave preview */}
              <div className="flex items-center gap-1 h-6 px-2">
                {[0.4, 0.8, 0.3, 0.9, 0.5, 0.7, 0.4].map((height, i) => (
                  <div
                    key={i}
                    style={{
                      height: `${(isPlayingAudio || isListening ? height : 0.2) * 20}px`,
                      transition: 'height 0.2s ease-in-out'
                    }}
                    className={`w-1 rounded-full ${
                      isListening
                        ? 'bg-rose-500'
                        : isPlayingAudio
                        ? 'bg-purple-600 animate-pulse'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Doubt Input Text Field */}
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={userDoubtInput}
                onChange={(e) => setUserDoubtInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskDoubt()}
                placeholder={
                  selectedLanguage === 'ta'
                    ? 'எ.கா: படி 2 புரியல, மறுபடியும் எளிமையா சொல்லுங்க...'
                    : 'e.g. I did not understand Step 2, please explain more simply...'
                }
                className="flex-1 text-xs sm:text-sm py-2.5 px-4 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => handleAskDoubt()}
                disabled={askingDoubt || !userDoubtInput.trim()}
                className="py-2.5 px-5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow cursor-pointer flex items-center gap-1.5"
              >
                {askingDoubt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">Ask</span>
              </button>
            </div>
          </div>

          {/* Speech transcript preview */}
          {speechTranscript && (
            <div className="text-xs p-3 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 font-medium flex items-center justify-between">
              <span>🎙️ &ldquo;{speechTranscript}&rdquo;</span>
              <button
                type="button"
                onClick={() => handleAskDoubt(speechTranscript)}
                className="text-indigo-700 font-bold underline cursor-pointer ml-2"
              >
                Send Doubt
              </button>
            </div>
          )}

          {/* Active Doubt Resolution Box */}
          {activeDoubt && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950 space-y-2 animate-in fade-in">
              <p className="font-bold flex items-center gap-1.5 text-amber-800">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                {selectedLanguage === 'ta' ? 'ஆசிரியையின் எளிய விளக்கம்:' : "Teacher's Simpler Explanation:"}
              </p>
              <p className="leading-relaxed font-sans">{activeDoubt.teacher_reply}</p>
              {activeDoubt.simplified_step_explanation && (
                <p className="p-3 bg-white/90 rounded-xl font-mono text-xs text-slate-800 border border-amber-200/60 leading-relaxed whitespace-pre-wrap">
                  {activeDoubt.simplified_step_explanation}
                </p>
              )}
              <p className="font-semibold text-emerald-700 italic">
                {activeDoubt.understanding_check}
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
