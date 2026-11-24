import { useState, useRef, useEffect, type DragEvent } from 'react';
import {
  Calculator, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Award, Camera, ImagePlus,
  FileUp, Loader2, Send, HelpCircle, BookOpen, Lightbulb,
  Maximize2, Minimize2, Check, FileText, Image as ImageIcon, Sparkle
} from 'lucide-react';
import { useApp } from '@/context/useApp';
import {
  fetchMathTeacherLesson,
  askMathTeacherDoubt,
  type MathTeacherLessonResponse,
  type MathTeacherDoubtResponse
} from '@/lib/geminiApi';
import { extractTextFromFile, renderPdfFirstPageAsBase64 } from '@/lib/extractText';
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
  ta: 'வணக்கம்! நான் உங்கள் கணித ஆசிரியர். உங்கள் கணித வினாவை கரும்பலகையில் படிப்படியாக எழுதி விளக்குகிறேன்.',
  hi: 'नमस्ते! मैं आपकी गणित अध्यापिका हूँ। आइए, गणित को बहुत ही आसान और रोचक तरीके से सीखते हैं!',
  te: 'నమస్కారం! నేను మీ గణిత ఉపాధ్యాయురాలిని. గణితాన్ని చాలా సులభంగా మరియు సరదాగా నేర్చుకుందాం!',
  ml: 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ ഗണിത അധ്യാപികയാണ്. നമുക്ക് കണക്ക് വളരെ ലളിതമായി മനസ്സിലാക്കാം!',
  kn: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಗಣಿತ ಶಿಕ್ಷಕಿ. ಬನ್ನಿ, ಗಣಿತವನ್ನು ಸುಲಭವಾಗಿ ಮತ್ತು ಸಂತೋಷದಿಂದ ಕಲಿಯೋಣ!',
  en: "Hello! I'm your AI Math Teacher. Upload your math syllabus or question, and I'll solve it step-by-step on the chalkboard."
};

export function MathStudyPage() {
  const { language: globalLanguage, setLanguage } = useApp();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(globalLanguage || 'en');
  const [inputQuestion, setInputQuestion] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<MathTeacherLessonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lesson teaching state
  const [isTeachingStarted, setIsTeachingStarted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Teacher chalkboard status / bubble message
  const [teacherBubbleText, setTeacherBubbleText] = useState(
    TEACHER_GREETINGS[selectedLanguage] || TEACHER_GREETINGS.en
  );

  // Doubt solving state (Text-only: NO voice/mic, NO speech)
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

  // Handle file selection (safely stores file and converts images to base64 immediately)
  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    const isImg = file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif|heic|heif)$/i.test(file.name);
    if (isImg) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedBase64(null);
    }
  };

  // Main Solve / Analyze Handler
  const handleAnalyzeSyllabus = async (overrideText?: string, base64Override?: string) => {
    const questionText = overrideText !== undefined ? overrideText : inputQuestion.trim();
    let base64ToSend = base64Override || selectedBase64;

    if (!questionText && !base64ToSend && !selectedFile) {
      setError(
        selectedLanguage === 'ta'
          ? 'கணித வினா / பாடத்திட்டம் புகைப்படம் அல்லது PDF-ஐ பதிவேற்றவும் அல்லது வினாவை தட்டச்சு செய்யவும்.'
          : 'Please upload a Maths syllabus/question PDF or photo, or type a math problem.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setIsTeachingStarted(false);
    setCurrentStepIndex(0);
    setActiveDoubt(null);

    try {
      let textToSend = questionText;

      // If a PDF file was selected, extract its text AND render first page to high-res base64 image
      if (selectedFile && (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf'))) {
        setUploadStatus(
          selectedLanguage === 'ta'
            ? 'கணித PDF ஆவணத்திலிருந்து பாடங்களை வாசிக்கிறது...'
            : 'Reading and analyzing mathematics PDF syllabus...'
        );
        try {
          const res = await extractTextFromFile(selectedFile, (s) => setUploadStatus(s));
          if (res.text && res.text.trim()) {
            textToSend = res.text.trim();
          }
        } catch (pdfErr) {
          console.warn('PDF text extraction note:', pdfErr);
        }

        // Render page 1 as high-resolution image for Gemini Vision multimodal analysis
        try {
          const pdfPageBase64 = await renderPdfFirstPageAsBase64(selectedFile);
          if (pdfPageBase64) {
            base64ToSend = pdfPageBase64;
          }
        } catch (e) {
          console.warn('PDF visual rendering note:', e);
        }
      } else if (selectedFile && (selectedFile.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif|heic|heif)$/i.test(selectedFile.name)) && !base64ToSend) {
        setUploadStatus(
          selectedLanguage === 'ta'
            ? 'கணிதப் புகைப்படத்தைப் படிக்கிறது...'
            : 'Reading math photo...'
        );
        const reader = new FileReader();
        base64ToSend = await new Promise<string>((res) => {
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
      }

      // Strict validation: never send empty payload or guess a fake question
      if (!textToSend.trim() && !base64ToSend) {
        throw new Error(
          selectedLanguage === 'ta'
            ? 'பதிவேற்றிய PDF அல்லது புகைப்படத்திலிருந்து கணக்கை வாசிக்க முடியவில்லை. தயவுசெய்து தெளிவான புகைப்படம் அல்லது PDF-ஐ பதிவேற்றவும் அல்லது வினாவை தட்டச்சு செய்யவும்.'
            : 'Could not detect or read any mathematical problem from the uploaded file. Please upload a clearer image/PDF or type your problem.'
        );
      }

      setUploadStatus(
        selectedLanguage === 'ta'
          ? 'AI ஆசிரியர் கரும்பலகையில் படிப்படியாக தீர்வு எழுதுகிறார்...'
          : 'AI Math Teacher solving problem step-by-step on chalkboard...'
      );

      const lesson = await fetchMathTeacherLesson(
        textToSend,
        selectedLanguage,
        base64ToSend || undefined
      );

      setActiveLesson(lesson);

      const readyGreeting = lesson.ready_prompt || lesson.greeting ||
        (selectedLanguage === 'ta'
          ? 'கரும்பலகையில் வினாவும், ஃபார்முலாவும், படிமுறை தீர்வுகளும் தெளிவாக எழுதப்பட்டுள்ளது!'
          : 'I have written the complete problem, governing formula, and hand-written step-by-step proof on the chalkboard!');

      setTeacherBubbleText(readyGreeting);

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
  };

  // Step Navigation
  const handleGoToStep = (index: number) => {
    const steps = activeLesson?.board_content?.steps || [];
    if (index < 0 || index >= steps.length) return;
    setCurrentStepIndex(index);
  };

  // Doubt Solving Handler (Text only: NO audio/speech)
  const handleAskDoubt = async (customDoubt?: string) => {
    const doubtToSolve = (customDoubt || userDoubtInput).trim();
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
      handleFileSelected(e.dataTransfer.files[0]);
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

  const isTamilMode = selectedLanguage === 'ta';

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">

      {/* ─────────────────────────────────────────────────────────────
          1. HERO BANNER
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
                <span>{isTamilMode ? 'AI ஆசிரியருடன் கணிதப் படிப்பு' : 'Mathematical Study with'}</span>
                <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-pink-600 bg-clip-text text-transparent">
                  {isTamilMode ? 'EDU Mind AI' : 'AI Teacher'}
                </span>
              </h1>
              <p className="text-base sm:text-lg font-serif italic text-purple-900/80 font-medium mt-1">
                {isTamilMode ? 'பதிவேற்றுங்கள். படியுங்கள். எளிமையாகப் புரிந்து கொள்ளுங்கள்.' : 'Upload. Learn. Understand.'}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 font-sans">
                {isTamilMode
                  ? 'உங்கள் கணிதப் பாடத்திட்டம் அல்லது வினாவை பதிவேற்றி AI-யுடன் படிக்கத் தொடங்குங்கள்!'
                  : 'Upload your Maths syllabus and start learning with AI!'}
              </p>
            </div>
          </div>

          {/* Right Sparkle Badge */}
          <div className="hidden lg:flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-purple-200/80 rounded-2xl px-5 py-3 text-purple-900 shadow-sm shrink-0">
            <Sparkle className="h-4 w-4 text-amber-500 fill-amber-400 animate-spin-slow" />
            <span className="text-sm font-bold">
              {isTamilMode ? 'கணிதத்தை சுலபமாக படிப்போம்! ✨' : "Let's Learn Math Together! ✨"}
            </span>
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
            <h3 className="font-bold text-slate-800 text-sm">
              {isTamilMode ? 'மொழியைத் தேர்ந்தெடுங்கள்' : 'Choose Language'}
            </h3>
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
              <option value="en">English</option>
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
              <h3 className="font-bold text-slate-800 text-sm">
                {isTamilMode ? 'கணித வினா / PDF பதிவேற்றவும்' : 'Upload Maths Syllabus / Photo'}
              </h3>
            </div>
            {selectedFile && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" /> {isTamilMode ? 'தயார்' : 'Ready'}
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
                {selectedFile ? selectedFile.name : (isTamilMode ? 'பதிவேற்ற தட்டவும் / இழுத்து விடவும்' : 'Click to Upload or Drag & Drop')}
              </p>
              <p className="text-[11px] text-slate-500">
                {isTamilMode ? 'கணித PDF அல்லது புகைப்படம்' : 'Only Maths PDF / Image Allowed'}
              </p>
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
              <Camera className="h-3 w-3" /> {isTamilMode ? 'படம் எடுக்க' : 'Take Photo'}
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
              <ImagePlus className="h-3 w-3" /> {isTamilMode ? 'கோப்பைத் தேர்ந்தெடுக்க' : 'Browse File'}
            </button>
          </div>

          {/* Hidden inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelected(e.target.files[0]);
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
                handleFileSelected(e.target.files[0]);
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
            <h3 className="font-bold text-slate-800 text-sm">
              {isTamilMode ? 'AI மூலம் பகுப்பாய்வு' : 'Analyze with AI'}
            </h3>
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
                <span>{isTamilMode ? 'கணக்கை தீர்க்கிறது...' : 'Solving Math...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{isTamilMode ? '✨ இப்போது தீர்க்க ➔' : '✨ Analyze Now ➔'}</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1">
            <span>⚡</span> {isTamilMode ? 'கரும்பலகையில் துல்லியமான படிமுறை தீர்வு...' : 'High-speed step derivation on chalkboard...'}
          </p>
        </div>
      </div>

      {/* Selected file indicator badge */}
      {selectedFile && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{isTamilMode ? 'தேர்ந்தெடுக்கப்பட்ட கோப்பு:' : 'Selected File:'} <strong className="font-mono">{selectedFile.name}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setSelectedBase64(null);
            }}
            className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
          >
            {isTamilMode ? 'கோப்பை நீக்குக' : 'Clear File'}
          </button>
        </div>
      )}

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
          retryLabel={isTamilMode ? 'மீண்டும் முயற்சிக்க' : 'Try Solving Again'}
          onRetry={() => void handleAnalyzeSyllabus()}
        />
      )}

      {/* Quick math preset topics */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="font-bold text-slate-500 shrink-0 flex items-center gap-1">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> {isTamilMode ? 'மாதிரிகள்:' : 'Presets:'}
        </span>
        {presets.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setInputQuestion(preset.question);
              setSelectedFile(null);
              setSelectedBase64(null);
              void handleAnalyzeSyllabus(preset.question);
            }}
            className="py-1 px-3 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300 font-medium whitespace-nowrap transition-colors cursor-pointer"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. LEARNING VIEW ARENA — Chalkboard Arena
      ───────────────────────────────────────────────────────────── */}
      <div id="chalkboard-arena" className="w-full max-w-5xl mx-auto space-y-6">

        {/* ────── TOP AI TEACHER BANNER & WRITTEN GUIDANCE ────── */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-purple-200/90 shadow-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              👩‍🏫
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                  {isTamilMode ? 'AI கணித ஆசிரியர்' : 'AI Math Teacher'}
                </h3>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>{isTamilMode ? 'இணைப்பில்' : 'Online'}</span>
                </span>
              </div>
              <p className="text-xs text-purple-700 font-medium mt-0.5">
                {isTamilMode ? 'கரும்பலகை படிமுறை தீர்வு' : 'Chalkboard Written Step-by-Step Derivation'}
              </p>
            </div>
          </div>

          {/* Teacher Guidance Bubble (Written on board - No voice/TTS) */}
          <div className="relative flex-1 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-3.5 text-xs sm:text-sm font-medium text-purple-950 leading-relaxed shadow-inner w-full">
            <div className="flex items-start gap-2">
              <BookOpen className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
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
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isTamilMode ? 'படிநிலைகளை காண்க' : 'View Steps'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-purple-100/70 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => handleGoToStep(Math.max(0, currentStepIndex - 1))}
                    disabled={currentStepIndex <= 0}
                    className="p-1.5 rounded-xl text-purple-700 hover:bg-white disabled:opacity-30 cursor-pointer"
                    title={isTamilMode ? 'முந்தைய படி' : 'Previous Step'}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 font-mono font-bold text-xs text-purple-900">
                    {isTamilMode ? 'படி' : 'Step'} {currentStepIndex + 1} / {(activeLesson.board_content?.steps || []).length}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleGoToStep(Math.min((activeLesson.board_content?.steps || []).length - 1, currentStepIndex + 1))}
                    disabled={currentStepIndex >= (activeLesson.board_content?.steps || []).length - 1}
                    className="p-1.5 rounded-xl text-purple-700 hover:bg-white disabled:opacity-30 cursor-pointer"
                    title={isTamilMode ? 'அடுத்த படி' : 'Next Step'}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ────── TWO-PART CLASSROOM CHALKBOARD ARENA ────── */}
        <div
          ref={chalkboardRef}
          className={`relative overflow-hidden rounded-3xl bg-[#143224] text-white shadow-2xl transition-all ${
            isFullscreen
              ? 'fixed inset-0 z-50 rounded-none p-6 md:p-10 flex flex-col justify-between overflow-y-auto'
              : 'border-[14px] sm:border-[18px] border-[#844b20] p-6 sm:p-8 min-h-[580px]'
          }`}
          style={{
            boxShadow: 'inset 0 0 50px rgba(0,0,0,0.6), 0 20px 30px rgba(0,0,0,0.35)',
            backgroundImage: 'radial-gradient(circle at 50% 50%, #1e4533 0%, #10291e 100%)'
          }}
        >
          {/* Top-Right Fullscreen Toggle */}
          <div className="absolute top-3 right-3 z-20">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-black/40 hover:bg-black/70 text-emerald-300 hover:text-white border border-emerald-700/50 cursor-pointer transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Chalkboard'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

          {!activeLesson ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center min-h-[460px] space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border-2 border-dashed border-amber-400/60 flex items-center justify-center text-amber-300 text-3xl shadow-inner">
                📐
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-amber-300 tracking-wide">
                  {isTamilMode ? 'கரும்பலகை தயார்' : 'Chalkboard Ready'}
                </h3>
                <p className="text-xs sm:text-sm font-sans text-emerald-100/90 leading-relaxed">
                  {isTamilMode
                    ? 'படி 2-ல் உங்கள் கணிதப் பாடத்திட்டம் அல்லது வினாவை பதிவேற்றிவிட்டு "இப்போது தீர்க்க" பொத்தானை அழுத்தவும். உங்கள் AI ஆசிரியர் இங்கு முழு கணக்கையும் படிப்படியாக எழுதி விளக்குவார்!'
                    : 'Upload your Maths syllabus or question in Step 2 above and click "Analyze Now". Your AI Teacher will solve and write the step-by-step solution here!'}
                </p>
              </div>

              {/* Chalk decorative guides */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg pt-2 text-left">
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50">
                  <span className="text-amber-400 font-bold font-serif text-xs block">
                    {isTamilMode ? '1. மொழி' : '1. Language'}
                  </span>
                  <span className="text-[11px] text-slate-200">
                    {isTamilMode ? 'தமிழ்' : 'English, தமிழ் & more'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50">
                  <span className="text-amber-400 font-bold font-serif text-xs block">
                    {isTamilMode ? '2. பதிவேற்றம்' : '2. Upload'}
                  </span>
                  <span className="text-[11px] text-slate-200">
                    {isTamilMode ? 'PDF அல்லது புகைப்படம்' : 'PDF, Photo or Presets'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50">
                  <span className="text-amber-400 font-bold font-serif text-xs block">
                    {isTamilMode ? '3. தீர்வு' : '3. Step-by-Step'}
                  </span>
                  <span className="text-[11px] text-slate-200">
                    {isTamilMode ? 'முழு படிமுறை விளக்கம்' : 'Full Derivation on Board'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2 text-xs font-mono text-amber-300/80">
                <Sparkles className="h-4 w-4" />
                <span>{isTamilMode ? 'உங்கள் கணித கணக்கிற்கு தயார்' : 'Ready for your math syllabus'}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Chalkboard Topic Header in Bright Yellow Chalk */}
              <div className="text-center border-b border-emerald-800/60 pb-4">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-serif tracking-wide drop-shadow-md">
                  {isTamilMode
                    ? (!activeLesson.detected_topic || /Mathematical/i.test(activeLesson.detected_topic) ? 'கணிதத் தீர்வு மற்றும் படிமுறை விளக்கம்' : activeLesson.detected_topic)
                    : (activeLesson.detected_topic || 'Mathematics Lesson')}
                </h2>
                <div className="h-0.5 w-32 bg-amber-300/60 mx-auto mt-1 rounded-full"></div>
              </div>

              {/* Two-Part Split Chalkboard Arena */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* PART 1 (Left Side / 5 Columns): Question Statement, Given Data, Formula & Target Answer */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-amber-400/40 pb-2">
                    <span className="text-xs font-bold font-serif uppercase tracking-wider text-amber-300">
                      {isTamilMode ? 'பகுதி 1: கணக்கு, விவரங்கள் & ஃபார்முலா' : 'Part 1: Problem & Target Answer'}
                    </span>
                  </div>

                  {/* Question Statement Box */}
                  <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 font-mono text-emerald-100 shadow-inner">
                    <span className="text-amber-300 font-bold block text-xs sm:text-sm font-sans uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-amber-400" />
                      {isTamilMode ? 'முழுக் கணக்கு / வினா:' : 'Full Mathematical Problem / Question:'}
                    </span>
                    <p className="text-sm sm:text-base font-semibold leading-relaxed whitespace-pre-wrap">
                      {activeLesson.board_content?.question || inputQuestion}
                    </p>
                  </div>

                  {/* Given Data Box */}
                  {activeLesson.board_content?.given_data && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-xs sm:text-sm font-mono text-emerald-200">
                      <span className="text-amber-300 font-bold block font-sans text-xs mb-1">
                        {isTamilMode ? 'கொடுக்கப்பட்ட விவரங்கள்:' : 'Given Data:'}
                      </span>
                      <p className="whitespace-pre-wrap leading-relaxed">{activeLesson.board_content.given_data}</p>
                    </div>
                  )}

                  {/* Governing Formula Box - Strictly labeled Formula / ஃபார்முலா, NO archaic 'சூத்திரம்' */}
                  {activeLesson.board_content?.core_formula && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-amber-400/50 text-xs sm:text-sm font-mono text-amber-100">
                      <span className="text-amber-300 font-bold block font-sans text-xs mb-1 flex items-center gap-1">
                        <Calculator className="h-3.5 w-3.5 text-amber-400" />
                        {isTamilMode ? 'ஃபார்முலா / சமன்பாடு:' : 'Governing Formula:'}
                      </span>
                      <p className="whitespace-pre-wrap font-bold leading-relaxed">{activeLesson.board_content.core_formula}</p>
                    </div>
                  )}

                  {/* Target Answer / Result to be Proven Box (Gold Framed) */}
                  {(activeLesson.board_content?.target_answer || activeLesson.board_content?.final_answer) && (
                    <div className="p-4 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-950/40 text-amber-200 text-center shadow-lg space-y-1">
                      <span className="text-xs font-serif font-extrabold uppercase tracking-wider text-amber-300 block">
                        🎯 {isTamilMode ? 'இலக்கு விடை / நிரூபிக்க வேண்டியது:' : 'Target Answer / Result to Prove:'}
                      </span>
                      <p className="text-base sm:text-lg font-mono font-black text-white">
                        {activeLesson.board_content.target_answer || activeLesson.board_content.final_answer}
                      </p>
                      <p className="text-[11px] font-sans text-emerald-200/80 pt-1">
                        {isTamilMode
                          ? 'வலது பக்கத்தில் இந்த விடைக்கான முழு படிமுறை தீர்வு எழுதப்பட்டுள்ளது.'
                          : 'See the complete step proof written on the right side.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* PART 2 (Right Side / 7 Columns): Hand-Written Style Step Proof + Detailed "How It Came" Explanation */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-400/40 pb-2">
                    <span className="text-xs font-bold font-serif uppercase tracking-wider text-amber-300">
                      {isTamilMode ? 'பகுதி 2: கரும்பலகை படிமுறை தீர்வு & நிரூபணம்' : 'Part 2: Hand-Written Step Proof & Derivation'}
                    </span>
                    <span className="text-[11px] text-emerald-300 font-mono">
                      {activeLesson.board_content?.steps?.length || 0} {isTamilMode ? 'படிகள்' : 'Steps'}
                    </span>
                  </div>

                  {/* Step-by-Step Chalk Working */}
                  <div className="space-y-4">
                    {activeLesson.board_content?.steps?.map((step, idx) => {
                      const isActive = isTeachingStarted && currentStepIndex === idx;
                      let rawTitle = (step.title || '').trim();
                      while (/^(?:Step\s*\d+\s*:?|படி\s*\d+\s*:?)\s*/i.test(rawTitle)) {
                        rawTitle = rawTitle.replace(/^(?:Step\s*\d+\s*:?|படி\s*\d+\s*:?)\s*/i, '').trim();
                      }
                      if (isTamilMode) {
                        if (/problem statement|given data/i.test(rawTitle)) rawTitle = 'கொடுக்கப்பட்ட விவரங்கள் அறிதல்';
                        else if (/governing formula|identify.*formula/i.test(rawTitle)) rawTitle = 'உரிய ஃபார்முலாவை எழுதுதல்';
                        else if (/algebraic simplification|simplification/i.test(rawTitle)) rawTitle = 'இயற்கணித சுருக்குதல்';
                        else if (/final verified|final answer/i.test(rawTitle)) rawTitle = 'இறுதி விடை சரிபார்த்தல்';
                        else if (/substitut/i.test(rawTitle)) rawTitle = 'மதிப்புகளை பிரதியிடுதல்';
                      }
                      const displayTitle = isTamilMode
                        ? `படி ${step.step_number || idx + 1}: ${rawTitle || 'படிநிலை தீர்வு'}`
                        : `Step ${step.step_number || idx + 1}: ${rawTitle || 'Mathematical Working'}`;

                      const displayMarking = isTamilMode
                        ? (step.marking_tip || '1 மதிப்பெண்').replace(/\bMarks?\b/gi, 'மதிப்பெண்கள்').replace(/\b1 மதிப்பெண்கள்\b/g, '1 மதிப்பெண்')
                        : step.marking_tip;

                      return (
                        <div
                          key={idx}
                          onClick={() => handleGoToStep(idx)}
                          className={`p-4 rounded-2xl transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-900/90 border-2 border-amber-400 shadow-xl translate-x-1'
                              : 'bg-emerald-950/50 border border-emerald-800/60 hover:bg-emerald-900/40'
                          }`}
                        >
                          <div className="space-y-2.5">
                            {/* Step Title Header */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-serif font-bold text-amber-300 text-sm sm:text-base underline decoration-amber-400/50">
                                {displayTitle}
                              </span>
                              {displayMarking && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-amber-200/90 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-700/50">
                                  <Award className="h-3 w-3 text-amber-400 shrink-0" />
                                  {displayMarking}
                                </span>
                              )}
                            </div>

                            {/* Pure Handwritten Chalk Working (Equations) */}
                            <div className="p-3 rounded-xl bg-black/40 border border-emerald-700/60 font-mono text-xs sm:text-sm font-bold text-white whitespace-pre-wrap leading-relaxed shadow-inner">
                              {step.work}
                            </div>

                            {/* Written Explanation: "இது எப்படி வந்தது" (How this step came about) */}
                            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-700/50 text-xs sm:text-sm text-emerald-100 leading-relaxed font-sans space-y-1">
                              <span className="text-amber-300 font-bold block text-xs flex items-center gap-1.5">
                                <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                {isTamilMode ? '💡 இது எப்படி வந்தது (விளக்கம்):' : '💡 How this step was derived:'}
                              </span>
                              <p className="text-emerald-100/95 font-medium leading-relaxed">
                                {step.how_it_came || (isTamilMode
                                  ? 'மேற்கண்ட சமன்பாட்டில் மாறிகளின் மதிப்புகளை ஃபார்முலாவில் பிரதியிட்டு சுருக்கும் போது இந்த படிநிலை பெறப்படுகிறது.'
                                  : 'Substitute known values and simplify algebraically to arrive at this intermediate step.')}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Final Verified Answer Box (Chalk Box) */}
                  {activeLesson.board_content?.final_answer && (
                    <div className="pt-2">
                      <div className="p-4 rounded-2xl border-2 border-emerald-400 bg-emerald-950/90 shadow-xl text-center">
                        <p className="text-xs font-serif font-extrabold text-amber-300 tracking-wider">
                          {isTamilMode ? '✅ நிரூபிக்கப்பட்டது / இறுதி விடை:' : '✅ FINAL VERIFIED ANSWER (Q.E.D.):'}
                        </p>
                        <p className="text-lg sm:text-xl font-mono font-extrabold text-white mt-1">
                          {activeLesson.board_content.final_answer}
                        </p>
                        {activeLesson.board_content.exam_presentation_tip && (
                          <p className="text-xs font-sans text-amber-200/90 pt-1.5">
                            💡 {isTamilMode && /[a-zA-Z]{3,}/.test(activeLesson.board_content.exam_presentation_tip)
                              ? 'இறுதி விடையை கட்டமிட்டு, சமன் குறிகளை நேராக வரிசைப்படுத்துங்கள்.'
                              : activeLesson.board_content.exam_presentation_tip}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Ready Confirmation Gate (When teaching hasn't started yet) */}
              {!isTeachingStarted && (
                <div className="mt-4 p-4 rounded-2xl bg-amber-950/70 border border-amber-500/80 text-center space-y-3">
                  <p className="text-sm sm:text-base font-bold text-amber-200">
                    ✨ {activeLesson.ready_prompt || (isTamilMode ? 'கரும்பலகையில் தீர்வு தயார்! படிநிலைகளை பார்க்கலாமா?' : 'Solution written on board! Shall we view the steps?')}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleStartTeaching}
                      className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md cursor-pointer active:scale-95 transition-transform"
                    >
                      🚀 {isTamilMode ? 'ஆம், படிநிலைகளை காட்டு' : 'Yes, Show Step Derivation!'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ────── INTERACTIVE DOUBT RESOLUTION (TEXT-ONLY: NO VOICE/MIC) ────── */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-purple-200 shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-purple-600" />
              <h4 className="font-extrabold text-slate-800 text-sm sm:text-base">
                {isTamilMode ? 'ஆசிரியையிடம் சந்தேகம் கேளுங்கள்' : 'Ask Teacher a Doubt (Text)'}
              </h4>
            </div>
            <span className="text-xs text-slate-500">
              {isTamilMode ? 'எழுத்து மூலம் தட்டச்சு செய்து கேளுங்கள்' : 'Type your question below'}
            </span>
          </div>

          {/* Doubt Input Row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={userDoubtInput}
              onChange={(e) => setUserDoubtInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskDoubt()}
              placeholder={
                isTamilMode
                  ? 'எ.கா: படி 2 எப்படி வந்தது, மறுபடியும் விளக்குங்கள்...'
                  : 'e.g. How was Step 2 derived? Please explain in simpler words...'
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
              <span>{isTamilMode ? 'கேள்வி கேள்' : 'Ask'}</span>
            </button>
          </div>

          {/* Active Doubt Resolution Box */}
          {activeDoubt && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950 space-y-2 animate-in fade-in">
              <p className="font-bold flex items-center gap-1.5 text-amber-800">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                {isTamilMode ? 'ஆசிரியையின் எளிய விளக்கம்:' : "Teacher's Simpler Explanation:"}
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
