import { useState, useRef, useEffect, useCallback, type DragEvent } from 'react';
import {
  Calculator, Sparkles, Volume2, VolumeX, Play, Pause, RotateCcw,
  ArrowRight, ArrowLeft, CheckCircle2, Award, Camera, ImagePlus,
  FileUp, Loader2, Send, HelpCircle, BookOpen, GraduationCap, Lightbulb,
  Maximize2
} from 'lucide-react';
import { useApp } from '@/context/useApp';
import { LanguageSelect } from '@/components/LanguageSelect';
import {
  fetchMathTeacherLesson,
  fetchSynthesizedSpeech,
  extractImageWithGemini,
  type MathTeacherLessonResponse,
  type MathStep
} from '@/lib/geminiApi';
import { cleanMathFormatting } from '@/lib/mathFormatter';
import { ErrorNotice } from '@/components/ui';

// Quick preset high-yield math problems for instant 1-click learning
const PRESET_MATH_QUESTIONS: Record<string, { label: string; question: string }[]> = {
  ta: [
    { label: 'இருபடிச் சமன்பாடு', question: 'Solve the quadratic equation: 2x² + 5x - 3 = 0' },
    { label: 'பித்தாகரஸ் தேற்றம்', question: 'In a right-angled triangle, hypotenuse c = 13 cm and one side a = 5 cm. Find the other side b.' },
    { label: 'அணிகள் (Matrices)', question: 'Find the determinant and inverse of matrix A = [[2, 4], [1, 3]].' },
    { label: 'வகையீடு (Calculus)', question: 'Find the derivative dy/dx for y = 3x⁴ - 5x² + 7x - 9 at x = 2.' },
    { label: 'நிகழ்தகவு (Probability)', question: 'Two unbiased dice are rolled. Find the probability of getting a sum greater than 8.' }
  ],
  hi: [
    { label: 'द्विघात समीकरण', question: 'हल करें: 2x² + 5x - 3 = 0' },
    { label: 'पाइथागोरस प्रमेय', question: 'समकोण त्रिभुज में कर्ण c = 13 cm और एक भुजा a = 5 cm है। दूसरी भुजा b ज्ञात कीजिए।' },
    { label: 'मैट्रिक्स (आव्यूह)', question: 'आव्यूह A = [[2, 4], [1, 3]] का सारणिक (determinant) ज्ञात करें।' },
    { label: 'अवकलन (Calculus)', question: 'y = 3x⁴ - 5x² + 7 का अवकलन dy/dx निकालें।' }
  ],
  en: [
    { label: 'Quadratic Equation', question: 'Solve: 2x² + 5x - 3 = 0 using quadratic formula.' },
    { label: 'Pythagoras Theorem', question: 'In a right triangle, hypotenuse c = 13 cm and side a = 5 cm. Calculate side b.' },
    { label: 'Matrix Determinant', question: 'Find determinant and inverse of 2x2 matrix A = [[2, 4], [1, 3]].' },
    { label: 'Calculus Derivative', question: 'Evaluate derivative dy/dx of y = 3x⁴ - 5x² + 7x - 9 at x = 2.' },
    { label: 'Probability Sum', question: 'Two fair dice are thrown. What is the probability that the sum of the scores is at least 9?' }
  ]
};

const TEACHER_GREETINGS: Record<string, string> = {
  ta: 'வணக்கம்! நான் உங்கள் கணித ஆசிரியை. வாருங்கள், கணிதத்தை பயமில்லாமல் மிக எளிமையாக ஒன்றாக படிப்போம்!',
  hi: 'नमस्ते! मैं आपकी गणित अध्यापिका हूँ। आइए, गणित को बहुत ही आसान और रोचक तरीके से सीखते हैं!',
  te: 'నమస్కారం! నేను మీ గణిత ఉపాధ్యాయురాలిని. గణితాన్ని చాలా సులభంగా మరియు సరదాగా నేర్చుకుందాం!',
  ml: 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ ഗണിത അധ്യാപികയാണ്. നമുക്ക് കണക്ക് വളരെ ലളിതമായി മനസ്സിലാക്കാം!',
  kn: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಗಣಿತ ಶಿಕ್ಷಕಿ. ಬನ್ನಿ, ಗಣಿತವನ್ನು ಸುಲಭವಾಗಿ ಮತ್ತು ಸಂತೋಷದಿಂದ ಕಲಿಯೋಣ!',
  en: 'Hello! I am your AI Math Teacher. Let us make mathematics simple, fun, and easy to score 100% in exams!'
};

export function MathStudyPage() {
  const { language, t } = useApp();
  const [inputQuestion, setInputQuestion] = useState('');
  const [activeLesson, setActiveLesson] = useState<MathTeacherLessonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lesson teaching state: false = preview on blackboard & ready prompt, true = walkthrough started
  const [isTeachingStarted, setIsTeachingStarted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Audio voice state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // File upload refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState('');

  // Fallback greeting based on language
  const currentGreeting = activeLesson?.greeting || TEACHER_GREETINGS[language] || TEACHER_GREETINGS.en;
  const presets = PRESET_MATH_QUESTIONS[language] || PRESET_MATH_QUESTIONS.en;

  // Cleanup audio object URLs
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  // Handle Voice Audio Playback
  const handleToggleVoice = async () => {
    if (!activeLesson) return;

    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      return;
    }

    if (audioUrl && audioRef.current) {
      void audioRef.current.play();
      setIsPlayingAudio(true);
      return;
    }

    // Synthesize teacher voice
    setLoadingAudio(true);
    try {
      const speechText = activeLesson.spoken_audio_script || activeLesson.teacher_dialogue || activeLesson.greeting;
      const audioBlob = await fetchSynthesizedSpeech(speechText, language, 'story');
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);

      await audio.play();
      setIsPlayingAudio(true);
    } catch (err) {
      console.warn('Speech synthesis playback note:', err);
      // Browser Web Speech API Fallback
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(activeLesson.spoken_audio_script || activeLesson.teacher_dialogue);
        utter.lang = language === 'ta' ? 'ta-IN' : language === 'hi' ? 'hi-IN' : 'en-US';
        utter.onend = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utter);
        setIsPlayingAudio(true);
      }
    } finally {
      setLoadingAudio(false);
    }
  };

  // Process math question with Gemini AI Teacher
  const handleSolveMath = async (textToSolve?: string, base64Image?: string) => {
    const questionText = textToSolve || inputQuestion.trim();
    if (!questionText && !base64Image) {
      setError('Please type a math problem or take a photo of your math question.');
      return;
    }

    setLoading(true);
    setError(null);
    setIsTeachingStarted(false);
    setCurrentStepIndex(0);

    // Stop existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
    setAudioUrl(null);

    try {
      const lesson = await fetchMathTeacherLesson(questionText, language, base64Image);
      setActiveLesson(lesson);
      // Automatically scroll down to the chalkboard on mobile
      setTimeout(() => {
        const boardEl = document.getElementById('math-chalkboard');
        if (boardEl) boardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      console.error('Math solving error:', err);
      setError(err instanceof Error ? err.message : 'Could not process math question. Please check your connection.');
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  // Image File Upload & Vision OCR
  const handleImageFile = async (file: File) => {
    setLoading(true);
    setUploadStatus('Scanning math handwriting and equations with Gemini Vision...');
    setError(null);

    try {
      const extractedMath = await extractImageWithGemini(file);
      const cleanMath = cleanMathFormatting(extractedMath);
      setInputQuestion(cleanMath);
      await handleSolveMath(cleanMath);
    } catch (err) {
      console.warn('Vision OCR fallback to base64 direct submit:', err);
      // Read base64 directly
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        await handleSolveMath('Solve the math problem shown in this image with step-by-step presentation.', base64);
      };
      reader.readAsDataURL(file);
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-16">
      {/* ── Top Hero: Welcoming AI Teacher Girl ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-teal-950 to-stone-950 p-5 sm:p-8 text-white shadow-xl border border-teal-800/40">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-center gap-6 sm:gap-8">
          {/* AI Teacher Girl Mascot Image */}
          <div className="relative shrink-0 group">
            <div className="relative h-44 w-32 sm:h-52 sm:w-40 rounded-3xl overflow-hidden bg-gradient-to-t from-teal-900/80 to-transparent p-1 shadow-2xl ring-4 ring-amber-400/80 transition-transform duration-300 group-hover:scale-105">
              <img
                src="/teacher-girl.jpg"
                alt="AI Math Teacher Girl"
                className="h-full w-full object-cover object-top rounded-2xl"
              />
            </div>
            <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-ink shadow-md border border-amber-300">
              ⭐ AI Math Teacher
            </span>
          </div>

          {/* Teacher Speech Bubble & Introduction */}
          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-800/70 border border-teal-400/40 px-3.5 py-1 text-xs font-bold text-teal-200">
              <GraduationCap className="h-4 w-4 text-amber-300" />
              EDU Mind Interactive Math Classroom
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              Mathematical Study <span className="text-amber-400">with AI Teacher</span>
            </h1>

            {/* Speech bubble */}
            <div className="relative rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-sm sm:text-base leading-relaxed text-teal-50 shadow-inner">
              <p className="font-medium italic">
                "{currentGreeting}"
              </p>
            </div>

            <p className="text-xs sm:text-sm text-stone-300 font-normal">
              Scan any math question, textbook equation, or syllabus topic. Your AI Teacher writes the full step-by-step solution, core formulas, and exam marking tips on the blackboard!
            </p>
          </div>
        </div>
      </section>

      {/* ── Math Question Input & Scanner Section ── */}
      <section className="card p-5 sm:p-7 space-y-5 bg-white/95 border-2 border-stone-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-800 font-bold">
              <Calculator className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-ink text-base sm:text-lg">Enter or Scan Math Problem</h2>
              <p className="text-xs text-stone-500">Solve algebra, trigonometry, calculus, geometry, or probability with exam steps</p>
            </div>
          </div>
          <LanguageSelect />
        </div>

        {/* Input Textarea */}
        <div className="space-y-2">
          <textarea
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            rows={3}
            placeholder={
              language === 'ta'
                ? 'கணக்கு கேள்வி அல்லது சமன்பாட்டை தட்டச்சு செய்யவும் (எ.கா: Solve: 2x² + 5x - 3 = 0)...'
                : language === 'hi'
                ? 'गणित का प्रश्न या समीकरण यहाँ टाइप करें (उदा: 2x² + 5x - 3 = 0)...'
                : 'Type your math problem or formula here (e.g., Solve: 2x² + 5x - 3 = 0 or integrate x sin(x) dx)...'
            }
            className="input font-mono text-sm sm:text-base leading-relaxed resize-y min-h-24"
          />
        </div>

        {/* Scan & Upload Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={loading}
            className="btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5"
          >
            <ImagePlus className="h-4 w-4 text-teal-700" />
            Choose Photo
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading}
            className="btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5"
          >
            <Camera className="h-4 w-4 text-teal-700" />
            Take Photo
          </button>

          <button
            type="button"
            onClick={() => documentInputRef.current?.click()}
            disabled={loading}
            className="btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5"
          >
            <FileUp className="h-4 w-4 text-teal-700" />
            Upload Math PDF
          </button>

          <button
            type="button"
            onClick={() => handleSolveMath()}
            disabled={loading || !inputQuestion.trim()}
            className="btn-primary ml-auto text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2 bg-gradient-to-r from-teal-600 via-indigo-600 to-purple-600 text-white font-bold shadow-md shadow-indigo-600/30 active:scale-95 transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-300" />}
            {loading ? 'Teacher is solving...' : 'Ask Teacher to Teach & Solve'}
          </button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageFile(file);
            e.target.value = '';
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageFile(file);
            e.target.value = '';
          }}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageFile(file);
            e.target.value = '';
          }}
        />

        {/* Upload/Scanning Status */}
        {loading && uploadStatus && (
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 p-3 text-xs text-teal-900 font-semibold animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
            {uploadStatus}
          </div>
        )}

        {/* Preset Sample Math Problems */}
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
            ⚡ Quick Practice Questions (Click to Solve):
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputQuestion(p.question);
                  void handleSolveMath(p.question);
                }}
                className="rounded-xl border border-stone-200/90 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-teal-500 hover:bg-teal-50/50 hover:text-teal-900 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorNotice message={error} />}
      </section>

      {/* ── Active Math Blackboard / Chalkboard ── */}
      {activeLesson && (
        <section id="math-chalkboard" className="space-y-6 animate-fade-up">
          {/* Blackboard Container with wooden bezel */}
          <div className="relative rounded-3xl border-8 sm:border-12 border-amber-900 bg-emerald-950 p-4 sm:p-8 text-stone-100 shadow-2xl ring-4 ring-black/40">
            {/* Wooden Chalk Shelf Effect */}
            <div className="absolute top-2 right-4 flex items-center gap-2">
              <span className="h-3 w-8 rounded-sm bg-white/90 shadow-xs" title="White Chalk" />
              <span className="h-3 w-8 rounded-sm bg-amber-300 shadow-xs" title="Yellow Chalk" />
              <span className="h-3 w-8 rounded-sm bg-cyan-300 shadow-xs" title="Cyan Chalk" />
            </div>

            {/* Blackboard Title */}
            <div className="border-b-2 border-dashed border-emerald-800 pb-3 mb-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                  📐 CLASSROOM BLACKBOARD · {activeLesson.detected_topic}
                </span>
                <span className="text-xs font-mono text-stone-400">
                  Step {currentStepIndex + 1} of {activeLesson.board_content.steps.length}
                </span>
              </div>
            </div>

            {/* 1. User's Question at the top of the board */}
            <div className="mb-6 rounded-2xl bg-black/40 border border-emerald-700/50 p-4 font-mono">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block mb-1">
                📌 QUESTION:
              </span>
              <p className="text-sm sm:text-base font-semibold text-white whitespace-pre-wrap leading-relaxed">
                {activeLesson.board_content.question}
              </p>
            </div>

            {/* 2. Core Formula & Given Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {activeLesson.board_content.core_formula && (
                <div className="rounded-2xl bg-amber-950/40 border border-amber-600/50 p-3.5 font-mono">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block mb-1">
                    📐 CORE FORMULA:
                  </span>
                  <p className="text-sm font-extrabold text-amber-200">
                    {activeLesson.board_content.core_formula}
                  </p>
                </div>
              )}

              {activeLesson.board_content.given_data && (
                <div className="rounded-2xl bg-cyan-950/40 border border-cyan-600/50 p-3.5 font-mono">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 block mb-1">
                    📋 GIVEN PARAMETERS:
                  </span>
                  <p className="text-sm font-semibold text-cyan-200">
                    {activeLesson.board_content.given_data}
                  </p>
                </div>
              )}
            </div>

            {/* ── Ready to Start Pause Gate ── */}
            {!isTeachingStarted ? (
              <div className="my-8 rounded-3xl border-2 border-amber-400 bg-amber-950/70 p-6 text-center space-y-4 backdrop-blur-md shadow-xl animate-pulse">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-ink font-black text-2xl shadow-lg">
                  ❓
                </span>
                <div className="space-y-1">
                  <h3 className="font-display text-xl sm:text-2xl font-black text-amber-200">
                    {activeLesson.ready_prompt || 'Shall we start the lesson?'}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-300">
                    The question and core formulas are prepared on the board. Tap below to have your AI Teacher explain step-by-step!
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTeachingStarted(true);
                      void handleToggleVoice();
                    }}
                    className="btn-primary py-3.5 px-8 text-sm sm:text-base font-extrabold flex items-center gap-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-ink shadow-lg shadow-emerald-500/30 rounded-2xl cursor-pointer"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    {language === 'ta' ? 'ஆம், பாடத்தை தொடங்கலாம்!' : language === 'hi' ? 'हाँ, पाठ शुरू करें!' : 'Yes, Start the Lesson!'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTeachingStarted(true)}
                    className="rounded-2xl border border-stone-400/80 bg-stone-900/80 px-5 py-3 text-xs sm:text-sm font-semibold text-stone-200 hover:bg-stone-800 transition-colors"
                  >
                    View All Steps Directly
                  </button>
                </div>
              </div>
            ) : (
              /* ── Interactive Step-by-Step Lesson & Marking Tips ── */
              <div className="space-y-6">
                {/* Steps Accordion / Carousel */}
                <div className="space-y-4">
                  {activeLesson.board_content.steps.map((step, sIdx) => {
                    const isCurrent = sIdx === currentStepIndex;
                    return (
                      <div
                        key={sIdx}
                        className={`rounded-2xl p-4 sm:p-5 transition-all font-mono ${
                          isCurrent
                            ? 'bg-emerald-900/70 border-2 border-teal-400 shadow-lg'
                            : 'bg-black/30 border border-emerald-800/40 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-800/50">
                          <span className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-ink text-xs font-black">
                              {step.step_number}
                            </span>
                            {step.title}
                          </span>
                          <span className="text-[10px] font-semibold bg-emerald-950 text-teal-300 px-2 py-0.5 rounded-full border border-teal-700">
                            Step {sIdx + 1}
                          </span>
                        </div>

                        {/* Calculation work in chalk */}
                        <div className="py-1 text-sm sm:text-base font-bold text-white whitespace-pre-wrap leading-relaxed pl-8">
                          {step.work}
                        </div>

                        {/* Exam Step-Wise Marking Tip */}
                        {step.marking_tip && (
                          <div className="mt-3 ml-8 rounded-xl bg-amber-950/60 border border-amber-500/60 p-2.5 text-xs text-amber-200 font-sans flex items-start gap-2">
                            <Award className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                            <div>
                              <strong className="text-amber-300">Exam Marking Tip: </strong>
                              <span>{step.marking_tip}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3. Final Answer Box */}
                {activeLesson.board_content.final_answer && (
                  <div className="rounded-2xl border-3 border-emerald-400 bg-emerald-900/60 p-5 text-center font-mono shadow-xl space-y-1">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-300 block">
                      🎯 FINAL ANSWER:
                    </span>
                    <p className="text-lg sm:text-2xl font-black text-white">
                      {activeLesson.board_content.final_answer}
                    </p>
                  </div>
                )}

                {/* 4. Presentation Tip for Full Marks */}
                {activeLesson.board_content.exam_presentation_tip && (
                  <div className="rounded-2xl border border-teal-500/60 bg-teal-950/50 p-4 text-xs sm:text-sm text-teal-100 flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 shrink-0 text-amber-300 mt-0.5" />
                    <div>
                      <strong className="text-amber-300 block mb-0.5">Presentation Tip for 100% Marks:</strong>
                      <span>{activeLesson.board_content.exam_presentation_tip}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── AI Teacher Girl Interactive Spoken Walkthrough Bar ── */}
          <div className="card p-5 sm:p-7 bg-gradient-to-r from-teal-50 via-white to-indigo-50 border-2 border-teal-300/80 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden shrink-0 ring-2 ring-teal-500 shadow-md">
                <img src="/teacher-girl.jpg" alt="AI Teacher" className="h-full w-full object-cover object-top" />
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h4 className="font-extrabold text-ink text-base sm:text-lg">AI Teacher Spoken Walkthrough</h4>
                  <span className="rounded-full bg-teal-100 text-teal-900 px-2 py-0.5 text-[10px] font-bold">
                    Natural Spoken Voice
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed italic">
                  "{activeLesson.teacher_dialogue}"
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  disabled={loadingAudio}
                  className={`btn-primary py-3 px-5 text-xs sm:text-sm font-bold flex items-center gap-2 ${
                    isPlayingAudio ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-700 hover:bg-teal-800'
                  }`}
                >
                  {loadingAudio ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isPlayingAudio ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                  {isPlayingAudio ? 'Pause Voice' : 'Listen Teacher'}
                </button>
              </div>
            </div>

            {/* Navigation buttons for next/prev steps */}
            {isTeachingStarted && (
              <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentStepIndex === 0}
                  className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Previous Step
                </button>

                <div className="text-xs font-bold text-stone-600">
                  Step {currentStepIndex + 1} of {activeLesson.board_content.steps.length}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentStepIndex((prev) =>
                      Math.min(activeLesson.board_content.steps.length - 1, prev + 1)
                    )
                  }
                  disabled={currentStepIndex === activeLesson.board_content.steps.length - 1}
                  className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                >
                  Next Step <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
