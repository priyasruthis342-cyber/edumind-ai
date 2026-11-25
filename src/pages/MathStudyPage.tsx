import { useState, useRef, useEffect, type DragEvent } from 'react';
import {
  Calculator, Sparkles, Award, Camera, ImagePlus,
  FileUp, Loader2, BookOpen, Lightbulb,
  Check, FileText, Image as ImageIcon, Sparkle, X, CheckCircle2
} from 'lucide-react';
import { useApp } from '@/context/useApp';
import {
  solveMathQuestion,
  type MathSolveResponse
} from '@/lib/geminiApi';
import { extractTextFromFile, renderPdfFirstPageAsBase64 } from '@/lib/extractText';
import { ErrorNotice } from '@/components/ui';
import { MathWhiteboard } from '@/components/MathWhiteboard';

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

export function MathStudyPage() {
  const { language: globalLanguage, setLanguage } = useApp();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(globalLanguage || 'en');
  const [inputQuestion, setInputQuestion] = useState('');

  // Box 1: Question (Required)
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [questionBase64, setQuestionBase64] = useState<string | null>(null);
  const questionFileInputRef = useRef<HTMLInputElement>(null);
  const questionCameraInputRef = useRef<HTMLInputElement>(null);
  const [isQuestionDragging, setIsQuestionDragging] = useState(false);

  // Box 2: My Answer (Optional)
  const [studentAnswerFile, setStudentAnswerFile] = useState<File | null>(null);
  const [studentAnswerBase64, setStudentAnswerBase64] = useState<string | null>(null);
  const studentAnswerFileInputRef = useRef<HTMLInputElement>(null);
  const studentAnswerCameraInputRef = useRef<HTMLInputElement>(null);
  const [isAnswerDragging, setIsAnswerDragging] = useState(false);

  // AI Maths Teacher Lesson State
  const [whiteboardLesson, setWhiteboardLesson] = useState<MathSolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSimplerLoading, setIsSimplerLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Presets
  const presets = PRESET_MATH_QUESTIONS[selectedLanguage] || PRESET_MATH_QUESTIONS.en;
  const isTamilMode = selectedLanguage === 'ta';

  // Sync with global language changes
  useEffect(() => {
    if (globalLanguage) {
      setSelectedLanguage(globalLanguage);
    }
  }, [globalLanguage]);

  // Handle Box 1: Question file selection
  const handleQuestionFileSelected = async (file: File) => {
    setQuestionFile(file);
    setError(null);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setUploadStatus(isTamilMode ? 'PDF வினாவை தயார் செய்கிறது...' : 'Rendering PDF question...');
      try {
        const base64 = await renderPdfFirstPageAsBase64(file);
        if (base64) {
          setQuestionBase64(base64);
        } else {
          // If visual render fails, extract text
          const extracted = await extractTextFromFile(file, (s) => setUploadStatus(s), selectedLanguage);
          if (extracted.text) {
            setInputQuestion(extracted.text);
          }
        }
      } catch (e) {
        console.warn('PDF question load note:', e);
      } finally {
        setUploadStatus('');
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setQuestionBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Box 2: Student answer file selection
  const handleStudentAnswerFileSelected = (file: File) => {
    setStudentAnswerFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setStudentAnswerBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Main Solver: Calls /api/solve and opens the classroom whiteboard
  const handleSolveWithWhiteboard = async (isSimpler = false, overrideQuestion?: string) => {
    const qBase64 = questionBase64;
    const qText = overrideQuestion !== undefined ? overrideQuestion.trim() : inputQuestion.trim();

    if (!qBase64 && !qText && !questionFile) {
      setError(
        isTamilMode
          ? 'தயவுசெய்து ஒரு கணிதக் கேள்வியின் புகைப்படத்தை பதிவேற்றவும் (Box 1) அல்லது கேள்வியை தட்டச்சு செய்யவும்.'
          : 'Please upload an image of your maths question (Box 1) or type your question.'
      );
      return;
    }

    if (isSimpler) {
      setIsSimplerLoading(true);
    } else {
      setLoading(true);
      setWhiteboardLesson(null);
    }
    setError(null);

    try {
      setUploadStatus(
        isSimpler
          ? (isTamilMode ? 'கரும்பலகை அழிக்கப்பட்டு மிக எளிய விளக்கம் தயாராகிறது...' : 'Erasing board... preparing simpler explanation...')
          : (isTamilMode ? 'AI ஆசிரியை கணக்கை படித்து கரும்பலகைக்கு தயாராகிறார்...' : 'AI Teacher reading problem and preparing chalkboard lesson...')
      );

      const resp = await solveMathQuestion({
        image: qBase64 || undefined,
        studentAnswer: studentAnswerBase64 || undefined,
        isSimpler,
        questionText: qText || undefined,
        language: selectedLanguage
      });

      setWhiteboardLesson(resp);

      setTimeout(() => {
        const boardEl = document.getElementById('whiteboard-solution-area');
        if (boardEl) boardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);

    } catch (err: any) {
      console.error('solveMathQuestion error:', err);
      setError(err?.message || (isTamilMode ? 'கணக்கை தீர்க்க முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.' : 'Could not solve maths question. Please check connection.'));
    } finally {
      setLoading(false);
      setIsSimplerLoading(false);
      setUploadStatus('');
    }
  };

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">

      {/* ─────────────────────────────────────────────────────────────
          1. HERO BANNER WITH FEMALE TEACHER AVATAR
      ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-100 via-indigo-50 to-purple-100 border border-blue-200/60 p-6 sm:p-8 shadow-sm">
        {/* Floating math background symbols */}
        <div className="absolute top-3 left-1/4 text-4xl font-serif text-indigo-300/40 select-none pointer-events-none">π</div>
        <div className="absolute bottom-4 left-1/3 text-3xl font-serif text-purple-300/40 select-none pointer-events-none">∑</div>
        <div className="absolute top-6 right-1/4 text-3xl font-serif text-blue-300/40 select-none pointer-events-none">√x</div>
        <div className="absolute bottom-2 right-1/3 text-4xl font-serif text-indigo-300/30 select-none pointer-events-none">∫</div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 sm:gap-6">
            {/* Cute School Teacher Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-indigo-300/70 shadow-md bg-white">
                <img
                  src="/teacher-girl.jpg"
                  alt="AI Female Maths Teacher"
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
                <span>{isTamilMode ? 'AI ஆசிரியையுடன் நேரலை வகுப்பறை' : 'Live Classroom with'}</span>
                <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-pink-600 bg-clip-text text-transparent">
                  {isTamilMode ? 'கணித ஆசிரியை' : 'AI Maths Teacher'}
                </span>
              </h1>
              <p className="text-base sm:text-lg font-serif italic text-purple-900/80 font-medium mt-1">
                {isTamilMode ? 'கரும்பலகையில் படிப்படியாக எழுதி கற்பிக்கும் முறை' : 'Step-by-step whiteboard handwriting & live voice'}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 font-sans">
                {isTamilMode
                  ? 'கணித வினாவை பதிவேற்றுங்கள். ஆசிரியர் கரும்பலகையில் எழுதி, பேசி விளக்குவார்!'
                  : 'Upload your math question. The teacher will write on the board and teach live!'}
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
          2. LANGUAGE SELECTION BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {isTamilMode ? 'கற்பித்தல் மொழி:' : 'Teaching Language:'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSelectedLanguage('ta');
                setLanguage('ta');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedLanguage === 'ta'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>தமிழ்</span>
              {selectedLanguage === 'ta' && <Check className="h-3 w-3 stroke-[3]" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedLanguage('en');
                setLanguage('en');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedLanguage === 'en'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>English</span>
              {selectedLanguage === 'en' && <Check className="h-3 w-3 stroke-[3]" />}
            </button>
          </div>
        </div>

        {/* Dropdown for other Indian languages */}
        <div className="flex items-center gap-2">
          <select
            value={selectedLanguage}
            onChange={(e) => {
              const lang = e.target.value;
              setSelectedLanguage(lang);
              setLanguage(lang as any);
            }}
            className="text-xs font-semibold py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
          >
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="ml">മലയാളം (Malayalam)</option>
            <option value="kn">ಕನ್ನಡ (Kannada)</option>
          </select>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TWO DISTINCT UPLOAD BOXES (PROBLEM 2 REQUIREMENT)
          BOX 1: "Question (required)"
          BOX 2: "My answer (optional)"
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">

        {/* ────── BOX 1: QUESTION (REQUIRED) ────── */}
        <div
          onDragOver={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsQuestionDragging(true);
          }}
          onDragLeave={() => setIsQuestionDragging(false)}
          onDrop={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsQuestionDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              void handleQuestionFileSelected(e.dataTransfer.files[0]);
            }
          }}
          className={`flex flex-col justify-between p-5 rounded-3xl border-2 transition-all shadow-sm ${
            isQuestionDragging
              ? 'border-indigo-500 bg-indigo-50/70'
              : questionFile || questionBase64
              ? 'border-emerald-400 bg-emerald-50/40'
              : 'border-dashed border-indigo-200 hover:border-indigo-400 bg-white'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 shadow">
                1
              </span>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                  <span>{isTamilMode ? 'வினா / கணக்கு' : 'Question'}</span>
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    {isTamilMode ? 'கட்டாயம் (Required)' : '(Required)'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isTamilMode ? 'பாடப்புத்தகம் அல்லது வினாத்தாளின் புகைப்படம் / PDF' : 'Photo or PDF of question from textbook/syllabus'}
                </p>
              </div>
            </div>

            {(questionFile || questionBase64) && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isTamilMode ? 'தயார்' : 'Ready'}
              </span>
            )}
          </div>

          {/* Preview or Upload Target */}
          <div className="py-4">
            {questionBase64 ? (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-emerald-200 shadow-xs">
                {/* Small preview thumbnail with remove button */}
                <div className="relative group shrink-0">
                  <img
                    src={questionBase64}
                    alt="Question thumbnail preview"
                    className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-xl border-2 border-emerald-400 shadow-sm bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setQuestionFile(null);
                      setQuestionBase64(null);
                    }}
                    className="absolute -top-2 -right-2 h-6 w-6 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
                    title="Remove question image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="overflow-hidden flex-1 text-left">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {questionFile?.name || 'math-question.jpg'}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isTamilMode ? 'கேள்வி படம் தயாராக உள்ளது' : 'Question image attached'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {isTamilMode ? 'மாற்ற கீழே உள்ள பொத்தானை தட்டவும்' : 'Tap below to change image'}
                  </p>
                </div>
              </div>
            ) : (
              <div
                onClick={() => questionFileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 text-center rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-indigo-50/40 cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 shadow-xs">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-700">
                  {isTamilMode ? 'கேள்வி படத்தை பதிவேற்ற தட்டவும்' : 'Tap to choose question image or PDF'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isTamilMode ? 'அல்லது கோப்பை இங்கு இழுத்து விடவும்' : 'or drag and drop file here'}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons for Box 1: Take Photo / Browse */}
          <div className="flex items-center gap-2 pt-2 border-t border-indigo-100">
            <button
              type="button"
              onClick={() => questionCameraInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Camera className="h-3.5 w-3.5 text-indigo-700" />
              <span>{isTamilMode ? 'படம் எடுக்க' : 'Take Photo'}</span>
            </button>

            <button
              type="button"
              onClick={() => questionFileInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <ImagePlus className="h-3.5 w-3.5 text-indigo-700" />
              <span>{isTamilMode ? 'கோப்பைத் தேர்ந்தெடுக்க' : 'Browse File'}</span>
            </button>
          </div>

          {/* Optional Question Text Input / Override */}
          <div className="mt-3 pt-2">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder={
                isTamilMode
                  ? 'அல்லது கேள்வியை தட்டச்சு செய்யவும் (எ.கா: x² + 5x + 6 = 0)'
                  : 'Or type/paste question statement (e.g. x² + 5x + 6 = 0)'
              }
              className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Hidden Inputs for Box 1 */}
          <input
            type="file"
            ref={questionFileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                void handleQuestionFileSelected(e.target.files[0]);
              }
            }}
            accept="image/*,.pdf,.txt"
            className="hidden"
          />
          <input
            type="file"
            ref={questionCameraInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                void handleQuestionFileSelected(e.target.files[0]);
              }
            }}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
        </div>

        {/* ────── BOX 2: MY ANSWER (OPTIONAL) ────── */}
        <div
          onDragOver={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsAnswerDragging(true);
          }}
          onDragLeave={() => setIsAnswerDragging(false)}
          onDrop={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsAnswerDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleStudentAnswerFileSelected(e.dataTransfer.files[0]);
            }
          }}
          className={`flex flex-col justify-between p-5 rounded-3xl border-2 transition-all shadow-sm ${
            isAnswerDragging
              ? 'border-amber-500 bg-amber-50/70'
              : studentAnswerFile || studentAnswerBase64
              ? 'border-amber-400 bg-amber-50/40'
              : 'border-dashed border-amber-200 hover:border-amber-400 bg-white'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-amber-100">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-amber-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 shadow">
                2
              </span>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                  <span>{isTamilMode ? 'எனது விடை' : 'My Answer'}</span>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {isTamilMode ? 'விருப்பத்திற்கேற்ப (Optional)' : '(Optional)'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isTamilMode ? 'நோட்டில் நீங்கள் எழுதிய விடையின் புகைப்படம்' : 'Photo of your own handwritten solution'}
                </p>
              </div>
            </div>

            {(studentAnswerFile || studentAnswerBase64) && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isTamilMode ? 'இணைக்கப்பட்டது' : 'Attached'}
              </span>
            )}
          </div>

          {/* Preview or Upload Target */}
          <div className="py-4">
            {studentAnswerBase64 ? (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-amber-200 shadow-xs">
                {/* Small preview thumbnail with remove button */}
                <div className="relative group shrink-0">
                  <img
                    src={studentAnswerBase64}
                    alt="Student answer thumbnail preview"
                    className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-xl border-2 border-amber-400 shadow-sm bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setStudentAnswerFile(null);
                      setStudentAnswerBase64(null);
                    }}
                    className="absolute -top-2 -right-2 h-6 w-6 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
                    title="Remove answer image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="overflow-hidden flex-1 text-left">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {studentAnswerFile?.name || 'my-written-answer.jpg'}
                  </p>
                  <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isTamilMode ? 'மாணவரின் விடை படம் இணைக்கப்பட்டது' : 'Student answer attached'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {isTamilMode ? 'ஆசிரியை இதை சோதித்து தவறை விளக்குவார்' : 'Teacher will check and point out errors kindly'}
                  </p>
                </div>
              </div>
            ) : (
              <div
                onClick={() => studentAnswerFileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 text-center rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-amber-50/40 cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-2 shadow-xs text-xl">
                  ✍️
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-700">
                  {isTamilMode ? 'உங்கள் விடை படத்தை இணைக்க தட்டவும்' : 'Tap to attach your written answer'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isTamilMode ? '(விருப்பத்திற்கேற்ப - விடை சரியாக உள்ளதா என சரிபார்க்கலாம்)' : '(Optional - check if your steps are correct)'}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons for Box 2: Take Photo / Browse */}
          <div className="flex items-center gap-2 pt-2 border-t border-amber-100">
            <button
              type="button"
              onClick={() => studentAnswerCameraInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Camera className="h-3.5 w-3.5 text-amber-700" />
              <span>{isTamilMode ? 'படம் எடுக்க' : 'Take Photo'}</span>
            </button>

            <button
              type="button"
              onClick={() => studentAnswerFileInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <ImagePlus className="h-3.5 w-3.5 text-amber-700" />
              <span>{isTamilMode ? 'கோப்பைத் தேர்ந்தெடுக்க' : 'Browse File'}</span>
            </button>
          </div>

          <div className="mt-3 pt-2 text-[11px] text-slate-500 text-center">
            {isTamilMode
              ? '💡 நீங்கள் விடையை இணைத்தால், ஆசிரியர் எங்கு தவறு நடந்தது என்பதை அன்பாக சுட்டிக்காட்டுவார்.'
              : '💡 If you upload your answer, teacher checks where any mistake happened and shows the right way.'}
          </div>

          {/* Hidden Inputs for Box 2 */}
          <input
            type="file"
            ref={studentAnswerFileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleStudentAnswerFileSelected(e.target.files[0]);
              }
            }}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={studentAnswerCameraInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleStudentAnswerFileSelected(e.target.files[0]);
              }
            }}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MAIN TEACHER SOLVE ACTION BUTTON
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => handleSolveWithWhiteboard(false)}
          disabled={loading}
          className="w-full max-w-xl py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-base sm:text-lg shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-95 disabled:opacity-75"
        >
          {loading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>{isTamilMode ? 'ஆசிரியை கணக்கை படித்து தீர்க்கிறார்...' : 'Teacher reading & solving on whiteboard...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              <span>{isTamilMode ? '✨ கரும்பலகையில் தீர்த்து கற்பிக்க (Start Live Teaching) ➔' : '✨ Solve & Teach on Chalkboard ➔'}</span>
            </>
          )}
        </button>

        {uploadStatus && (
          <div className="flex items-center gap-2 text-xs font-bold text-teal-800 bg-teal-50 px-4 py-2 rounded-xl border border-teal-200 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
            <span>{uploadStatus}</span>
          </div>
        )}

        {error && (
          <div className="w-full max-w-xl">
            <ErrorNotice
              message={error}
              retryLabel={isTamilMode ? 'மீண்டும் முயற்சிக்க' : 'Try Again'}
              onRetry={() => void handleSolveWithWhiteboard(false)}
            />
          </div>
        )}
      </div>

      {/* Presets quick bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs pt-1">
        <span className="font-bold text-slate-500 shrink-0 flex items-center gap-1">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> {isTamilMode ? 'மாதிரி கணக்குகள்:' : 'Sample Problems:'}
        </span>
        {presets.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setInputQuestion(preset.question);
              setQuestionFile(null);
              setQuestionBase64(null);
              void handleSolveWithWhiteboard(false, preset.question);
            }}
            className="py-1 px-3 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300 font-medium whitespace-nowrap transition-colors cursor-pointer shadow-2xs"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. LIVE CLASSROOM WHITEBOARD SECTION
      ───────────────────────────────────────────────────────────── */}
      {whiteboardLesson && (
        <div id="whiteboard-solution-area" className="w-full pt-6">
          <MathWhiteboard
            lesson={whiteboardLesson}
            onNotUnderstood={() => handleSolveWithWhiteboard(true)}
            onUnderstood={() => {}}
            isSimplerLoading={isSimplerLoading}
            language={selectedLanguage}
          />
        </div>
      )}

    </div>
  );
}
