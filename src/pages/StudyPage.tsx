import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Star, CheckCircle2, XCircle,
  BookOpen, Award, Eye, EyeOff, Loader2, AlertTriangle,
  Layers, FileText, Check, Globe, Volume2,
  Send, Bot, User, Copy, Code, Mic, Square,
  Terminal, Calculator, HelpCircle, Camera, ImagePlus, Paperclip, X
} from 'lucide-react';
import { MermaidDiagram } from '@/components/study/MermaidDiagram';
import { cleanMathFormatting } from '@/lib/mathFormatter';
import { getScan, setActiveSyllabus } from '@/lib/data';
import { fetchGroqStudyData, type GroqAIResponse } from '@/lib/groqApi';
import {
  fetchGeminiExamQA,
  fetchGeminiChat,
  type GeminiExamQAResponse,
  type QuestionSimple,
  type Question8Mark,
  type Question8MarkAnswer,
  type Question12Mark
} from '@/lib/geminiApi';
import type { Scan } from '@/types';

interface StudyPageProps {
  id: string;
}

type MarkFilter = 'all' | 'important' | '2' | '3' | '8' | '12';

interface ChatMessage {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  timestamp: string;
  imageUrl?: string;
  attachmentName?: string;
}

const MIC_LANGUAGES = [
  { code: 'en-IN', label: 'English', short: 'EN' },
  { code: 'ta-IN', label: 'தமிழ்', short: 'தமிழ்' },
  { code: 'hi-IN', label: 'हिन्दी', short: 'हिन्दी' },
  { code: 'ml-IN', label: 'മലയാളം', short: 'മലയാളം' },
  { code: 'te-IN', label: 'తెలుగు', short: 'తెలుగు' }
];

function renderInlineMarkup(rawText: string) {
  const cleaned = cleanMathFormatting(rawText);
  const chunks = cleaned.split(/(\*\*.*?\*\*|`.*?`)/g);
  return chunks.map((chunk, idx) => {
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
      return (
        <strong key={idx} className="font-bold text-ink">
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
      return (
        <code key={idx} className="rounded bg-teal-50 px-1 py-0.5 font-mono text-[11px] font-semibold text-teal-800 border border-teal-200/60">
          {chunk.slice(1, -1)}
        </code>
      );
    }
    return chunk;
  });
}

function renderFormattedChatMessage(text: string) {
  const sanitizedText = text ? cleanMathFormatting(text.replace(/\\n/g, '\n').replace(/\\"/g, '"')) : '';
  const parts = sanitizedText.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-2.5 font-sans">
      {parts.map((part, pIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-z0-9_-]+$/i.test(firstLine);
          const lang = hasLang ? firstLine.toLowerCase() : '';
          const codeContent = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          if (lang === 'mermaid' || codeContent.startsWith('graph ') || codeContent.startsWith('flowchart ')) {
            return (
              <MermaidDiagram key={pIdx} code={codeContent} />
            );
          }

          // Visual Tree Structure / ASCII Architecture Diagram support
          const isAsciiDiagram =
            lang === 'ascii' ||
            lang === 'tree' ||
            lang === 'diagram' ||
            (!['cpp', 'c', 'java', 'python', 'javascript', 'typescript', 'js', 'ts', 'html', 'css', 'sql', 'json'].includes(lang) &&
              (/(\/\s*\\|\\--|\|--|├──|└──|┌─|└─|-->|\+\-\-|\bBF:\b|\bLL Rotate\b|\bRR Rotate\b|\bLR Rotate\b|\bRL Rotate\b)/.test(codeContent)));

          if (isAsciiDiagram) {
            return (
              <div key={pIdx} className="my-2.5 rounded-2xl border-2 border-teal-400/80 bg-stone-900 p-3.5 text-stone-100 shadow-sm overflow-x-auto">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
                  <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-teal-400" />
                    Visual Tree Structure / ASCII Architecture Diagram
                  </span>
                  <span className="text-[9px] font-semibold bg-teal-950 text-teal-300 px-2 py-0.5 rounded-full border border-teal-800">
                    Structure View
                  </span>
                </div>
                <pre className="font-mono text-xs text-emerald-300 whitespace-pre leading-relaxed select-all">
                  {codeContent}
                </pre>
              </div>
            );
          }

          return (
            <div key={pIdx} className="rounded-xl bg-stone-900 border border-stone-800 p-3 my-2 text-stone-100 font-mono text-xs overflow-x-auto shadow-inner">
              {lang && (
                <div className="text-[10px] font-bold uppercase text-teal-400 mb-1.5 pb-1 border-b border-stone-800 flex items-center justify-between">
                  <span>{lang}</span>
                  <span className="text-[9px] text-stone-500">Program Code</span>
                </div>
              )}
              <pre className="text-emerald-300 whitespace-pre leading-relaxed">{codeContent}</pre>
            </div>
          );
        }

        const lines = part.split('\n');
        return (
          <div key={pIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;

              // Dedicated Problem-Solving: Final Answer Box
              if (/^(\*\*)?(Final Answer|Result|Solution):/i.test(trimmed)) {
                return (
                  <div key={lIdx} className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/90 p-3 my-2 shadow-xs text-emerald-950">
                    <div className="flex items-center gap-1.5 font-extrabold text-xs uppercase tracking-wider text-emerald-800 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Final Answer
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-emerald-950">
                      {renderInlineMarkup(trimmed.replace(/^(\*\*)?(Final Answer|Result|Solution):\s*(\*\*)?/i, ''))}
                    </div>
                  </div>
                );
              }

              // Dedicated Problem-Solving: Given Data Box
              if (/^(\*\*)?(Given Data|Given Parameters|Inputs):/i.test(trimmed)) {
                return (
                  <div key={lIdx} className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-2.5 my-1.5 text-indigo-950">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-800 block mb-1">
                      📋 Given Data
                    </span>
                    <div className="text-xs font-medium">
                      {renderInlineMarkup(trimmed.replace(/^(\*\*)?(Given Data|Given Parameters|Inputs):\s*(\*\*)?/i, ''))}
                    </div>
                  </div>
                );
              }

              // Dedicated Problem-Solving: Formula / Approach Box
              if (/^(\*\*)?(Formula \/ Approach|Formula|Core Formula|Approach):/i.test(trimmed)) {
                return (
                  <div key={lIdx} className="rounded-xl border border-teal-200 bg-teal-50/60 p-2.5 my-1.5 text-teal-950">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-800 block mb-1">
                      📐 Formula / Approach
                    </span>
                    <div className="text-xs font-semibold">
                      {renderInlineMarkup(trimmed.replace(/^(\*\*)?(Formula \/ Approach|Formula|Core Formula|Approach):\s*(\*\*)?/i, ''))}
                    </div>
                  </div>
                );
              }

              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="font-extrabold text-teal-900 text-xs sm:text-sm pt-2 pb-0.5 border-b border-teal-100">
                    {renderInlineMarkup(trimmed.replace(/^###\s*/, ''))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                return (
                  <h3 key={lIdx} className="font-extrabold text-ink text-sm sm:text-base pt-2.5 pb-1 border-b border-stone-200">
                    {renderInlineMarkup(trimmed.replace(/^#+\s*/, ''))}
                  </h3>
                );
              }
              if (trimmed.startsWith('> ')) {
                return (
                  <div key={lIdx} className="border-l-3 border-teal-600 bg-teal-50/70 rounded-r-xl p-2.5 my-1.5 text-stone-900 font-medium text-xs leading-relaxed">
                    {renderInlineMarkup(trimmed.replace(/^>\s*/, ''))}
                  </div>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-1.5 text-xs text-stone-700 pl-2">
                    <span className="text-teal-600 font-bold">•</span>
                    <span>{renderInlineMarkup(trimmed.replace(/^[-*]\s*/, ''))}</span>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="text-xs text-stone-800 leading-relaxed font-normal">
                  {renderInlineMarkup(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders 8-Mark University Exam standard answers:
 * Handles structured object answers ({ definition, architecture_structure, operations, program_code, program_output, advantages_disadvantages })
 * and parses raw string answers with unescaped newlines, definition boxes, code blocks, and bullet points.
 */
function render8MarkAnswer(
  ans: string | Question8MarkAnswer | any,
  language: 'en' | 'ta' = 'en',
  onCopy?: (code: string) => void
) {
  if (!ans) return null;

  // Case 1: Structured Object from Gemini backend
  if (typeof ans === 'object') {
    return (
      <div className="space-y-3.5 text-xs sm:text-sm">
        {/* 1. Definition Box */}
        {ans.definition && (
          <div className="rounded-2xl bg-teal-50/70 border border-teal-200 p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-teal-700" />
              1. {language === 'ta' ? 'வரையறை & அடிப்படைக் கோட்பாடு' : 'Definition & Core Concept'}
            </p>
            <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
              {ans.definition.replace(/\\n/g, '\n')}
            </div>
          </div>
        )}

        {/* 2. Architecture & Structure */}
        {ans.architecture_structure && (
          <div className="rounded-2xl bg-indigo-50/70 border border-indigo-200 p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-indigo-700" />
              2. {language === 'ta' ? 'கட்டமைப்பு விவரம் & நினைவக அமைப்பு' : 'Detailed Architecture & Memory Structure'}
            </p>
            <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
              {ans.architecture_structure.replace(/\\n/g, '\n')}
            </div>
          </div>
        )}

        {/* 3. Core Operations & Time Complexity */}
        {ans.operations && (
          <div className="rounded-2xl bg-purple-50/70 border border-purple-200 p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-purple-700" />
              3. {language === 'ta' ? 'செயல்முறைகள் & சிக்கல்தன்மை' : 'Core Operations & Big-O Time Complexity'}
            </p>
            <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
              {ans.operations.replace(/\\n/g, '\n')}
            </div>
          </div>
        )}

        {/* 4. Program Implementation Code */}
        {ans.program_code && (
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 text-emerald-300 font-mono text-xs overflow-x-auto shadow-inner space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800 text-stone-400">
              <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <Code className="h-4 w-4" />
                4. {language === 'ta' ? 'நிரல் குறியீடு (Clean Program Code)' : 'Clean Program Implementation'}
              </span>
              {onCopy && (
                <button
                  type="button"
                  onClick={() => onCopy(ans.program_code.replace(/\\n/g, '\n'))}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                  Copy Code
                </button>
              )}
            </div>
            <pre className="text-emerald-300 whitespace-pre leading-relaxed">{ans.program_code.replace(/\\n/g, '\n')}</pre>
          </div>
        )}

        {/* 5. Terminal Execution Output */}
        {ans.program_output && (
          <div className="rounded-2xl bg-stone-950 border border-stone-800 p-4 text-stone-300 font-mono text-xs overflow-x-auto space-y-2">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-4 w-4" />
              5. {language === 'ta' ? 'இயக்க வெளியீடு (Program Execution Output)' : 'Exact Terminal Output'}
            </span>
            <pre className="text-stone-200 whitespace-pre leading-relaxed">{ans.program_output.replace(/\\n/g, '\n')}</pre>
          </div>
        )}

        {/* 6. Advantages & Disadvantages */}
        {ans.advantages_disadvantages && (
          <div className="rounded-2xl bg-rose-50/70 border border-rose-200 p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-rose-700" />
              6. {language === 'ta' ? 'நன்மைகள் & வரம்புகள்' : 'Advantages, Disadvantages & University Summary'}
            </p>
            <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
              {ans.advantages_disadvantages.replace(/\\n/g, '\n')}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Case 2: String answer (Handles broken literal \n, unparsed code fences, and definition boxes)
  const cleanText = cleanMathFormatting(
    String(ans)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, '  ')
  );

  // Split out code blocks ```...```
  const segments = cleanText.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-xs sm:text-sm">
      {segments.map((seg, sIdx) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const lines = seg.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-z0-9_-]+$/i.test(firstLine);
          const lang = hasLang ? firstLine.toLowerCase() : '';
          const codeContent = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div key={sIdx} className="rounded-2xl bg-stone-900 border border-stone-800 p-4 text-emerald-300 font-mono text-xs overflow-x-auto shadow-inner space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-stone-800 text-stone-400">
                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Code className="h-3.5 w-3.5" />
                  {lang || 'Program Code'}
                </span>
                {onCopy && (
                  <button
                    type="button"
                    onClick={() => onCopy(codeContent)}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    Copy Code
                  </button>
                )}
              </div>
              <pre className="text-emerald-300 whitespace-pre leading-relaxed">{codeContent}</pre>
            </div>
          );
        }

        // Process markdown text lines
        const lines = seg.split('\n');
        return (
          <div key={sIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-0.5" />;

              // Highlighted Definition Box: [DEFINITION BOX: ...] or > **DEFINITION BOX:**
              if (/^\[DEFINITION BOX:|^>\s*\*\*DEFINITION BOX:/i.test(trimmed)) {
                const defContent = trimmed.replace(/^\[DEFINITION BOX:\s*|\]$|^>\s*\*\*DEFINITION BOX:\*\*\s*/i, '');
                return (
                  <div key={lIdx} className="rounded-2xl bg-teal-50 border-2 border-teal-300 p-4 shadow-xs my-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-teal-900 flex items-center gap-1.5 mb-1">
                      <FileText className="h-4 w-4 text-teal-700" />
                      {language === 'ta' ? 'வரையறைப் பெட்டி (Definition Box)' : 'University Definition Box'}
                    </p>
                    <p className="text-xs sm:text-sm font-semibold text-stone-900 leading-relaxed">
                      {renderInlineMarkup(defContent)}
                    </p>
                  </div>
                );
              }

              // Headings
              if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
                return (
                  <h4 key={lIdx} className="font-extrabold text-teal-950 text-sm pt-2 pb-0.5 border-b border-stone-200">
                    {renderInlineMarkup(trimmed.replace(/^#+\s*/, ''))}
                  </h4>
                );
              }

              // Bullet points
              if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2 text-stone-800">
                    <span className="text-teal-600 font-extrabold">•</span>
                    <span className="leading-relaxed font-medium">{renderInlineMarkup(trimmed.replace(/^([*-]|\d+\.)\s*/, ''))}</span>
                  </div>
                );
              }

              // Regular text paragraph
              return (
                <p key={lIdx} className="text-stone-800 leading-relaxed font-normal">
                  {renderInlineMarkup(trimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function StudyPage({ id }: StudyPageProps) {
  // ── Scan data (from localStorage) ────────────────────────────
  const [scan, setScan] = useState<Scan | null>(null);
  const [scanLoading, setScanLoading] = useState(true);

  // ── Gemini AI Data (Primary Exam Engine) ──────────────────────
  const [geminiData, setGeminiData] = useState<GeminiExamQAResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Groq AI Data (Practice Quiz Engine) ───────────────────────
  const [groqData, setGroqData] = useState<GroqAIResponse | null>(null);

  // ── UI Filters & On-Demand Answer Visibility ──────────────────
  const [selectedMark, setSelectedMark] = useState<MarkFilter>('important');
  const [language, setLanguage] = useState<'en' | 'ta'>('en');
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({});

  // Quiz states
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState(false);

  // ── Gemini AI Sidebar Chat Assistant State ────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'gemini',
      text: 'Hello! I am your EduMind AI Study Assistant. Ask me for custom definitions, 8-mark explanations, 12-mark essay breakdowns, clean code with output, or diagrams!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // ── AI Chat Image / Question File Attachment State ────────────
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const [chatAttachment, setChatAttachment] = useState<{
    file: File;
    previewUrl: string;
    base64: string;
    mimeType: string;
  } | null>(null);

  const handleChatFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const mimeType = file.type || 'image/jpeg';
    const previewUrl = URL.createObjectURL(file);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setChatAttachment({ file, previewUrl, base64, mimeType });
  };

  // ── Multi-Language Manual Voice Input (Microphone) ────────────
  const [micLang, setMicLang] = useState<string>('en-IN');
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);

  const startListening = (selectedLang?: string) => {
    if (typeof window === 'undefined') return;
    const targetLang = selectedLang || micLang;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech recognition is supported in Chrome, Edge, and Safari browsers. You can type your question in the input box.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_abortErr) {
          console.warn('Aborted previous recognition instance:', _abortErr);
        }
      }

      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = targetLang;
      isListeningRef.current = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        // If recording was stopped or cancelled, ignore any late arriving results
        if (!isListeningRef.current) return;
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        const text = fullTranscript.trim();
        if (text && isListeningRef.current) {
          setChatInput(text);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (err: any) => {
        console.warn('Speech recognition notice:', err);
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognition.onend = () => {
        // If user is still recording, keep continuous listening active
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch (_restartErr) {
            console.warn('Recognition restart note:', _restartErr);
            setIsListening(false);
            isListeningRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSelectMicLang = (langCode: string) => {
    setMicLang(langCode);
    if (isListeningRef.current) {
      stopListening();
      setTimeout(() => {
        startListening(langCode);
      }, 150);
    }
  };

  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, chatLoading]);

  const handleCopyText = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const toggleAnswer = (key: string) => {
    setExpandedAnswers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const allKeys: Record<string, boolean> = {};
    geminiData?.questions_2mark?.forEach((q) => { allKeys[`2_${q.id}`] = true; });
    geminiData?.questions_3mark?.forEach((q) => { allKeys[`3_${q.id}`] = true; });
    const q8List = geminiData?.questions_8mark || geminiData?.questions_5mark || [];
    q8List.forEach((q) => { allKeys[`8_${q.id}`] = true; });
    geminiData?.questions_12mark?.forEach((q) => { allKeys[`12_${q.id}`] = true; });
    setExpandedAnswers(allKeys);
  };

  const collapseAll = () => {
    setExpandedAnswers({});
  };

  const handleSendChat = async (customQuery?: string) => {
    // 1. Immediately abort and detach any active microphone input to prevent speech re-populating chatInput
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch (_e) {}
    }

    const currentAttachment = chatAttachment;
    const queryToSend = (customQuery || chatInput).trim();
    if (!queryToSend && !currentAttachment) return;
    if (chatLoading) return;

    // 2. Clear out the chat input box and attachment immediately
    setChatInput('');
    setChatAttachment(null);

    const effectiveText = queryToSend || (currentAttachment ? `Please examine this attached study image / handwritten question sheet (${currentAttachment.file.name}), solve the problem with step-by-step clarity, and explain the key concepts.` : '');

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: effectiveText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUrl: currentAttachment?.previewUrl,
      attachmentName: currentAttachment?.file.name,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);
    setChatError(null);

    // 3. Strict Chat Box Focus & Document Context Isolation:
    const isExplicitScanRequest = /summary|summarize|scanned|this pdf|this document|uploaded file|from notes|from scan|in this pdf|in this scan/i.test(effectiveText);
    const relevantContext = isExplicitScanRequest
      ? (scan?.raw_text || scan?.chapter_title || '')
      : '';

    try {
      const aiReply = await fetchGeminiChat(
        effectiveText,
        relevantContext,
        language,
        currentAttachment?.base64,
        currentAttachment?.mimeType
      );
      const newMsgId = 'gemini_' + Date.now();
      const geminiMsg: ChatMessage = {
        id: newMsgId,
        sender: 'gemini',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, geminiMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not reach Gemini AI.';
      setChatError(msg);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Step 1: Load scan from localStorage ──────────────────────
  useEffect(() => {
    async function loadScanData() {
      try {
        const data = await getScan(id);
        setScan(data);
        if (data && data.raw_text) {
          setActiveSyllabus({
            id: data.id,
            title: data.chapter_title || data.file_name,
            text: data.raw_text,
            fileName: data.file_name || data.chapter_title,
          });
        }
      } catch (err) {
        console.error('Failed to load scan:', err);
      } finally {
        setScanLoading(false);
      }
    }
    void loadScanData();
  }, [id]);

  // ── Step 2: Fetch Gemini Exam Q&A and Groq Quiz ──────────────
  const loadExamContent = useCallback(async (text: string, lang: 'en' | 'ta') => {
    setAiLoading(true);
    setAiError(null);
    let loadedContent = false;

    try {
      const geminiResult = await fetchGeminiExamQA(text, lang);
      if (geminiResult) {
        setGeminiData(geminiResult);
        loadedContent = true;
      }
    } catch (err) {
      console.warn('Gemini Exam Q&A fetch notice:', err);
    }

    try {
      const groqResult = await fetchGroqStudyData(text);
      if (groqResult) {
        setGroqData(groqResult);
        loadedContent = true;
      }
    } catch (err) {
      console.warn('AI quiz generation notice:', err);
    }

    if (!loadedContent) {
      setAiError('Could not process this document. Please ensure the uploaded material contains readable text.');
    }
    setAiLoading(false);
  }, []);

  useEffect(() => {
    if (scan && scan.raw_text) {
      void loadExamContent(scan.raw_text, language);
    }
  }, [scan, language, loadExamContent]);

  // ── Quiz Submission Handler ──────────────────────────────────
  const handleSelectAnswer = (qIndex: number, optIndex: number) => {
    if (submittedQuiz) return;
    setQuizAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  const handleSubmitQuiz = () => {
    setSubmittedQuiz(true);
  };

  const handleResetQuiz = () => {
    setQuizAnswers({});
    setSubmittedQuiz(false);
  };

  const calculateScore = () => {
    if (!groqData?.quiz) return 0;
    return groqData.quiz.reduce((score, item, idx) => {
      const selected = quizAnswers[idx];
      const correctIdx = ['A', 'B', 'C', 'D'].indexOf(item.answer);
      return selected === correctIdx ? score + 1 : score;
    }, 0);
  };

  if (scanLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-stone-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="text-sm font-medium">Loading your study material…</p>
      </div>
    );
  }

  const questions8List: Question8Mark[] = geminiData?.questions_8mark || (geminiData?.questions_5mark as any) || [];
  const questions2List: QuestionSimple[] = geminiData?.questions_2mark || [];
  const questions3List: QuestionSimple[] = geminiData?.questions_3mark || [];
  const questions12List: Question12Mark[] = geminiData?.questions_12mark || [];

  // Curate strict targeted count of 10 to 15 Important Questions across 12, 8, 3, and 2 marks
  interface CuratedQuestion {
    id: number;
    question: string;
    answer: string | Question8MarkAnswer | Question12Mark['answer'];
    markBadge: string;
    markType: '12' | '8' | '3' | '2';
    stars: number;
    priorityTag: string;
  }

  const importantQuestions: CuratedQuestion[] = (() => {
    const list: CuratedQuestion[] = [];

    // 1. 12-Mark Comprehensive Essay Questions (⭐⭐⭐ High-Scoring University Master Essay)
    questions12List.slice(0, 3).forEach((q) => {
      list.push({
        id: q.id,
        question: q.question,
        answer: q.answer,
        markBadge: '12 Marks Essay',
        markType: '12',
        stars: q.importance_stars || 3,
        priorityTag: q.priority_tag || '⭐⭐⭐ High Frequency University Master Essay (12/12)'
      });
    });

    // 2. 8-Mark Structured Questions (⭐⭐⭐ Core Part B University Question)
    questions8List.slice(0, 4).forEach((q) => {
      list.push({
        id: q.id,
        question: q.question,
        answer: q.answer,
        markBadge: '8 Marks Structured',
        markType: '8',
        stars: q.importance_stars || 3,
        priorityTag: q.priority_tag || '⭐⭐⭐ Core Part B University Question'
      });
    });

    // 3. 3-Mark Conceptual Bridge Questions (⭐⭐ Conceptual Bridge)
    questions3List.slice(0, 4).forEach((q) => {
      list.push({
        id: q.id,
        question: q.question,
        answer: q.answer,
        markBadge: '3 Marks Concept',
        markType: '3',
        stars: q.importance_stars || 2,
        priorityTag: q.priority_tag || '⭐⭐ Repeated Conceptual Question'
      });
    });

    // 4. 2-Mark Essential Definition Questions (⭐⭐ Essential Part A Definition)
    questions2List.slice(0, 5).forEach((q) => {
      list.push({
        id: q.id,
        question: q.question,
        answer: q.answer,
        markBadge: '2 Marks Definition',
        markType: '2',
        stars: q.importance_stars || 2,
        priorityTag: q.priority_tag || '⭐⭐ Essential Part A Definition'
      });
    });

    // Enforce target count of approximately 10 to 15 questions
    return list.slice(0, 15);
  })();

  return (
    <div className="space-y-8 animate-fade-up pb-16">

      {/* ── Top Header Banner ───────────────────────────────────── */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-700 via-indigo-800 to-purple-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 w-fit text-xs font-bold text-amber-300 backdrop-blur-md">
            <Sparkles className="h-4 w-4" />
            University Syllabus Analysis &amp; Exam Master
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`#/theory?scanId=${scan?.id || id}`}
              className="flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 px-3.5 py-1 text-xs font-bold text-white transition-all shadow-sm"
              title="Listen to Theory Audio"
            >
              <Volume2 className="h-3.5 w-3.5 text-amber-300" />
              {language === 'ta' ? 'குரல் பாடம்' : 'Audio Lesson'}
            </a>

            {/* Bilingual Language Switcher */}
            <div className="flex items-center gap-1 rounded-full bg-black/20 p-1 backdrop-blur-md border border-white/20">
              <button
                onClick={() => setLanguage('en')}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all flex items-center gap-1 ${
                  language === 'en'
                    ? 'bg-amber-400 text-ink shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('ta')}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all flex items-center gap-1 ${
                  language === 'ta'
                    ? 'bg-amber-400 text-ink shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Globe className="h-3.5 w-3.5" /> தமிழ்
              </button>
            </div>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {geminiData?.chapter_title || scan?.chapter_title || scan?.file_name || 'Chapter Study & Important Questions'}
        </h1>
        <p className="mt-2 text-sm text-teal-100">
          In-depth syllabus breakdown: curated Important Questions, 2-mark definitions, 8-mark structured analysis, and 12-mark university essays.
        </p>

        {geminiData?.summary && (
          <div className="mt-4 rounded-2xl bg-white/10 backdrop-blur-md px-5 py-3 text-sm text-teal-50 leading-relaxed border border-white/20">
            <span className="font-bold text-amber-300">📋 {language === 'ta' ? 'பாடச் சுருக்கம்:' : 'Chapter Summary:'} </span>
            {geminiData.summary}
          </div>
        )}
      </div>

      {/* ── Main Workspace Grid (Left: Questions & Quiz | Right: Sticky Sidebar AI Chat) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ═════════════════════════════════════════════════════════ */}
        {/* LEFT COLUMN: Question Bank & Important Questions (8 cols) */}
        {/* ═════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-8 space-y-8">

          {/* AI Loading State */}
          {aiLoading && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-teal-300 bg-teal-50 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
              <div className="text-center">
                <p className="font-bold text-teal-800">
                  {language === 'ta'
                    ? 'AI உங்கள் PDF பாடத்திட்டத்தை பகுப்பாய்வு செய்கிறது…'
                    : 'EduMind AI is analyzing your uploaded syllabus & notes…'}
                </p>
                <p className="text-xs text-teal-600 mt-1">
                  Deriving Important Questions, 2-mark, 3-mark, 8-mark, and 12-mark answers.
                </p>
              </div>
            </div>
          )}

          {/* Error Notification */}
          {aiError && !aiLoading && (
            <div className="flex items-start gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-sm text-rose-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">Could not load AI exam content</p>
                <p className="mt-1 text-xs">{aiError}</p>
              </div>
            </div>
          )}

          {/* ── Main Exam Questions Section (Organized by Marks) ─── */}
          {geminiData && !aiLoading && (
            <section className="space-y-6">

              {/* Filter Bar with Important Questions & Mark Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                    <Award className="h-6 w-6 text-amber-500" />
                    {language === 'ta' ? 'தேர்வு வினா வங்கி' : 'University Exam Question Bank'}
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Click <strong>View Answer</strong> on any question to reveal answers on-demand.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5 text-stone-600" />
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                  >
                    <EyeOff className="h-3.5 w-3.5 text-stone-600" />
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Navigation Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Important Questions Button */}
                <button
                  type="button"
                  onClick={() => setSelectedMark('important')}
                  className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-all border flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    selectedMark === 'important'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-600 text-white shadow-amber-500/20'
                      : 'bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  <Star className="h-4 w-4 fill-current" />
                  ⭐ {language === 'ta' ? 'முக்கிய வினாக்கள்' : 'Important Questions'}
                </button>

                {/* 2. All Questions */}
                <button
                  type="button"
                  onClick={() => setSelectedMark('all')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border cursor-pointer ${
                    selectedMark === 'all'
                      ? 'bg-teal-700 border-teal-700 text-white shadow-sm'
                      : 'bg-white border-stone-200 text-stone-700 hover:border-teal-400'
                  }`}
                >
                  All Questions
                </button>

                {/* 3. 2 Marks */}
                <button
                  type="button"
                  onClick={() => setSelectedMark('2')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border cursor-pointer ${
                    selectedMark === '2'
                      ? 'bg-teal-700 border-teal-700 text-white shadow-sm'
                      : 'bg-white border-stone-200 text-stone-700 hover:border-teal-400'
                  }`}
                >
                  2 Marks ({questions2List.length})
                </button>

                {/* 4. 3 Marks */}
                <button
                  type="button"
                  onClick={() => setSelectedMark('3')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border cursor-pointer ${
                    selectedMark === '3'
                      ? 'bg-teal-700 border-teal-700 text-white shadow-sm'
                      : 'bg-white border-stone-200 text-stone-700 hover:border-teal-400'
                  }`}
                >
                  3 Marks ({questions3List.length})
                </button>

                {/* 5. 8 Marks */}
                <button
                  type="button"
                  onClick={() => setSelectedMark('8')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border cursor-pointer ${
                    selectedMark === '8'
                      ? 'bg-indigo-700 border-indigo-700 text-white shadow-sm'
                      : 'bg-white border-stone-200 text-indigo-900 hover:border-indigo-400'
                  }`}
                >
                  8 Marks ({questions8List.length})
                </button>

                {/* 6. 12 Marks */}
                <button
                  type="button"
                  onClick={() => setSelectedMark('12')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border cursor-pointer ${
                    selectedMark === '12'
                      ? 'bg-purple-700 border-purple-700 text-white shadow-sm'
                      : 'bg-white border-stone-200 text-purple-900 hover:border-purple-400'
                  }`}
                >
                  ⭐ 12 Marks ({questions12List.length})
                </button>
              </div>

              {/* ═════════════════════════════════════════════════ */}
              {/* VIEW MODE: IMPORTANT QUESTIONS DERIVED FROM SYLLABUS */}
              {/* ═════════════════════════════════════════════════ */}
              {selectedMark === 'important' && (
                <div className="space-y-4 pt-2">
                  <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4 text-xs text-amber-950 flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-amber-600 fill-amber-500" />
                      Curated High-Yield Exam Questions from syllabus analysis. Answers hidden until requested.
                    </span>
                    <span className="font-bold text-amber-800">{importantQuestions.length} Questions</span>
                  </div>

                  <div className="grid gap-4">
                    {importantQuestions.map((q, qIdx) => {
                      const ansKey = `imp_${q.markType}_${q.id}_${qIdx}`;
                      const isExpanded = !!expandedAnswers[ansKey];

                      return (
                        <div key={ansKey} className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm space-y-3 transition-all">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                {q.markBadge}
                              </span>
                              <span className="flex items-center gap-0.5 text-amber-500">
                                {Array.from({ length: q.stars || 3 }).map((_, sIdx) => (
                                  <Star key={sIdx} className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                                ))}
                              </span>
                            </div>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                              {q.priorityTag}
                            </span>
                          </div>

                          <p className="text-sm sm:text-base font-bold text-ink leading-snug">
                            {q.question}
                          </p>

                          {/* On-Demand View Answer Button */}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => toggleAnswer(ansKey)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isExpanded
                                  ? 'bg-stone-200 text-stone-800'
                                  : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                              }`}
                            >
                              {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              <span>{isExpanded ? 'Hide Answer' : 'View Answer'}</span>
                            </button>
                          </div>

                          {/* Collapsible Answer Content */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-stone-200 animate-fade-up">
                              {q.markType === '8' ? (
                                render8MarkAnswer(q.answer, language, (code) => handleCopyText(code, ansKey))
                              ) : typeof q.answer === 'string' ? (
                                <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line">
                                  {q.answer.replace(/\\n/g, '\n')}
                                </div>
                              ) : (
                                <div className="space-y-3.5 text-xs sm:text-sm">
                                  {q.answer?.introduction && (
                                    <div className="rounded-xl bg-teal-50/70 border border-teal-200 p-3.5 space-y-1">
                                      <p className="font-bold text-teal-900 text-xs flex items-center gap-1.5 uppercase">
                                        <FileText className="h-3.5 w-3.5 text-teal-700" />
                                        1. Introduction &amp; Definition:
                                      </p>
                                      <p className="text-stone-800 whitespace-pre-line leading-relaxed">{q.answer.introduction}</p>
                                    </div>
                                  )}
                                  {q.answer?.architecture_types && (
                                    <div className="rounded-xl bg-indigo-50/70 border border-indigo-200 p-3.5 space-y-1">
                                      <p className="font-bold text-indigo-900 text-xs flex items-center gap-1.5 uppercase">
                                        <Layers className="h-3.5 w-3.5 text-indigo-700" />
                                        2. Architecture &amp; Key Types:
                                      </p>
                                      <p className="text-stone-800 whitespace-pre-line leading-relaxed">{q.answer.architecture_types}</p>
                                    </div>
                                  )}
                                  {q.answer?.operations && (
                                    <div className="rounded-xl bg-cyan-50/70 border border-cyan-200 p-3.5 space-y-1">
                                      <p className="font-bold text-cyan-900 text-xs flex items-center gap-1.5 uppercase">
                                        <Terminal className="h-3.5 w-3.5 text-cyan-700" />
                                        Core Operations &amp; Algorithmic Mechanics:
                                      </p>
                                      <p className="text-stone-800 whitespace-pre-line leading-relaxed">{q.answer.operations}</p>
                                    </div>
                                  )}
                                  {q.answer?.concrete_example && (
                                    <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3.5 space-y-1">
                                      <p className="font-bold text-amber-900 text-xs flex items-center gap-1.5 uppercase">
                                        <BookOpen className="h-3.5 w-3.5 text-amber-700" />
                                        3. Real-World Relevance &amp; Example:
                                      </p>
                                      <p className="text-stone-800 whitespace-pre-line leading-relaxed">{q.answer.concrete_example}</p>
                                    </div>
                                  )}
                                  {q.answer?.program_code && (
                                    <div className="rounded-xl bg-stone-900 p-3.5 text-emerald-300 font-mono text-xs overflow-x-auto space-y-1 shadow-inner">
                                      <div className="flex items-center justify-between text-stone-400 pb-1 border-b border-stone-800">
                                        <span className="text-[11px] font-bold text-teal-400 uppercase flex items-center gap-1.5">
                                          <Code className="h-3.5 w-3.5" />
                                          4. Program Implementation
                                        </span>
                                      </div>
                                      <pre className="whitespace-pre leading-relaxed">{q.answer.program_code}</pre>
                                    </div>
                                  )}
                                  {q.answer?.program_output && (
                                    <div className="rounded-xl bg-stone-950 p-3.5 text-stone-300 font-mono text-xs overflow-x-auto border border-stone-800 space-y-1">
                                      <span className="text-[11px] font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                                        <Terminal className="h-3.5 w-3.5" />
                                        5. Exact Terminal Output
                                      </span>
                                      <pre className="text-stone-200 whitespace-pre leading-relaxed">{q.answer.program_output}</pre>
                                    </div>
                                  )}
                                  {q.answer?.numerical_problem && (
                                    <div className="rounded-xl bg-purple-50/70 border border-purple-200 p-3.5 space-y-1">
                                      <p className="font-bold text-purple-900 text-xs flex items-center gap-1.5 uppercase">
                                        <Calculator className="h-3.5 w-3.5 text-purple-700" />
                                        6. Numerical / Worked-Out Problem &amp; Solution:
                                      </p>
                                      <p className="text-stone-800 whitespace-pre-line leading-relaxed">{q.answer.numerical_problem}</p>
                                    </div>
                                  )}
                                  {q.answer?.tradeoffs_complexity && (
                                    <div className="rounded-xl bg-rose-50/70 border border-rose-200 p-3.5 space-y-1">
                                      <p className="font-bold text-rose-900 text-xs flex items-center gap-1.5 uppercase">
                                        <Award className="h-3.5 w-3.5 text-rose-700" />
                                        7. Advantages, Disadvantages &amp; Complexity:
                                      </p>
                                      <p className="text-stone-800 whitespace-pre-line leading-relaxed">{q.answer.tradeoffs_complexity}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════ */}
              {/* 2-MARK QUESTIONS (Part A Definitions) */}
              {/* ═════════════════════════════════════════════════ */}
              {(selectedMark === 'all' || selectedMark === '2') && questions2List.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-800">
                      PART A • 2 MARKS
                    </span>
                    <h3 className="text-base font-bold text-ink">
                      {language === 'ta' ? '2-மதிப்பெண் குறுவினாக்கள் (வரையறை / சூத்திரம்)' : 'Short 2-Mark Questions (Definitions & Principles)'}
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {questions2List.map((q) => {
                      const ansKey = `2_${q.id}`;
                      const isExpanded = !!expandedAnswers[ansKey];

                      return (
                        <div key={q.id} className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-teal-700 uppercase">Q.{q.id} • 2 Marks</span>
                              <span className="flex items-center gap-0.5 text-amber-500">
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                              </span>
                            </div>
                            <p className="text-sm font-bold text-ink">{q.question}</p>
                          </div>

                          <div className="pt-2 border-t border-stone-100">
                            <button
                              type="button"
                              onClick={() => toggleAnswer(ansKey)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer border border-teal-200"
                            >
                              {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              <span>{isExpanded ? 'Hide Answer' : 'View Answer'}</span>
                            </button>

                            {isExpanded && (
                              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3.5 text-xs leading-relaxed text-stone-800 font-medium mt-3 animate-fade-up">
                                <span className="font-bold text-teal-900">{language === 'ta' ? 'விடைக்குறிப்பு:' : 'Crisp Answer:'} </span>
                                {q.answer}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════ */}
              {/* 3-MARK QUESTIONS */}
              {/* ═════════════════════════════════════════════════ */}
              {(selectedMark === 'all' || selectedMark === '3') && questions3List.length > 0 && (
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-800">
                      PART B • 3 MARKS
                    </span>
                    <h3 className="text-base font-bold text-ink">
                      {language === 'ta' ? '3-மதிப்பெண் சிறுவினாக்கள் (பண்புகள் & முக்கியக் கூறுகள்)' : '3-Mark Conceptual Questions (Key Points & Features)'}
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {questions3List.map((q) => {
                      const ansKey = `3_${q.id}`;
                      const isExpanded = !!expandedAnswers[ansKey];

                      return (
                        <div key={q.id} className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-teal-700 uppercase">Q.{q.id} • 3 Marks</span>
                              <span className="flex items-center gap-0.5 text-amber-500">
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                              </span>
                            </div>
                            <p className="text-sm font-bold text-ink">{q.question}</p>
                          </div>

                          <div className="pt-2 border-t border-stone-100">
                            <button
                              type="button"
                              onClick={() => toggleAnswer(ansKey)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors cursor-pointer border border-teal-200"
                            >
                              {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              <span>{isExpanded ? 'Hide Answer' : 'View Answer'}</span>
                            </button>

                            {isExpanded && (
                              <div className="rounded-xl bg-teal-50/60 border border-teal-200 p-3.5 text-xs leading-relaxed text-stone-800 font-medium mt-3 animate-fade-up">
                                <span className="font-bold text-teal-900">{language === 'ta' ? 'விடைக்குறிப்பு:' : 'Core Explanation:'} </span>
                                {q.answer}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════ */}
              {/* 8-MARK STRUCTURED ESSAYS (Part B Standard) */}
              {/* ═════════════════════════════════════════════════ */}
              {(selectedMark === 'all' || selectedMark === '8') && questions8List.length > 0 && (
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-900">
                      PART B • 8 MARKS
                    </span>
                    <h3 className="text-base font-bold text-ink">
                      {language === 'ta' ? '8-மதிப்பெண் வினாக்கள் (கட்டமைப்பு விளக்கங்கள்)' : 'Structured 8-Mark University Questions (Mechanism & Points)'}
                    </h3>
                  </div>

                  <div className="grid gap-5">
                    {questions8List.map((q) => {
                      const ansKey = `8_${q.id}`;
                      const isExpanded = !!expandedAnswers[ansKey];

                      return (
                        <div key={q.id} className="rounded-2xl border-2 border-indigo-200/80 bg-white p-6 shadow-sm space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                              Q.{q.id} • 8 Marks Analytical Question
                            </span>
                            <span className="flex items-center gap-0.5 text-amber-500">
                              <Star className="h-4 w-4 fill-amber-400" />
                              <Star className="h-4 w-4 fill-amber-400" />
                              <Star className="h-4 w-4 fill-amber-400" />
                              <Star className="h-4 w-4 fill-amber-400" />
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-ink leading-snug">
                            {q.question}
                          </h4>

                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleAnswer(ansKey)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isExpanded
                                  ? 'bg-stone-200 text-stone-800'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200'
                              }`}
                            >
                              {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              <span>{isExpanded ? 'Hide Structured 8-Mark Answer' : 'View Structured 8-Mark Answer'}</span>
                            </button>

                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-indigo-100 animate-fade-up">
                                {render8MarkAnswer(q.answer, language, (code) => handleCopyText(code, ansKey))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════ */}
              {/* 12-MARK COMPREHENSIVE UNIVERSITY ESSAYS (Part C) */}
              {/* ═════════════════════════════════════════════════ */}
              {(selectedMark === 'all' || selectedMark === '12') && questions12List.length > 0 && (
                <div className="space-y-6 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-900">
                      PART C • 12 MARKS
                    </span>
                    <h3 className="text-base font-bold text-ink">
                      {language === 'ta' ? '12-மதிப்பெண் முழுமையான விரிவான வினாக்கள்' : '12-Mark University Essay Breakdown (7-Part Exam Format)'}
                    </h3>
                  </div>

                  <div className="grid gap-6">
                    {questions12List.map((q) => {
                      const ansKey = `12_${q.id}`;
                      const isExpanded = !!expandedAnswers[ansKey];

                      return (
                        <div key={q.id} className="rounded-3xl border-2 border-purple-200 bg-white p-6 sm:p-8 shadow-md space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-800 uppercase tracking-wide">
                              Q.{q.id} • 12 Marks Master Essay
                            </span>
                            <span className="flex items-center gap-1 text-xs font-extrabold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                              <Star className="h-3.5 w-3.5 fill-amber-400" />
                              University Exam High-Scorer (12/12)
                            </span>
                          </div>

                          <h4 className="text-lg font-extrabold text-ink leading-snug">
                            {q.question}
                          </h4>

                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleAnswer(ansKey)}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isExpanded
                                  ? 'bg-stone-200 text-stone-800'
                                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                              }`}
                            >
                              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              <span>{isExpanded ? 'Hide 12-Mark Breakdown' : 'View Full 12-Mark Exam Sheet Breakdown'}</span>
                            </button>

                            {isExpanded && (
                              <div className="space-y-5 pt-4 border-t border-purple-100 mt-4 animate-fade-up">
                                {/* 1. Introduction & Core Definition */}
                                {q.answer?.introduction && (
                                  <div className="rounded-2xl bg-teal-50/70 border border-teal-200 p-4 space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                                      <FileText className="h-4 w-4 text-teal-700" />
                                      1. {language === 'ta' ? 'அறிமுகம் & கோட்பாட்டு வரையறை' : 'Introduction & Core Definition'}
                                    </p>
                                    <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                                      {q.answer.introduction}
                                    </div>
                                  </div>
                                )}

                                {/* 2. Architectural Scope & Types */}
                                {q.answer?.architecture_types && (
                                  <div className="rounded-2xl bg-indigo-50/70 border border-indigo-200 p-4 space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                                      <Layers className="h-4 w-4 text-indigo-700" />
                                      2. {language === 'ta' ? 'கட்டமைப்பு வரம்புகள் & வகைகள்' : 'Architectural Scope & Types/Categories'}
                                    </p>
                                    <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                                      {q.answer.architecture_types}
                                    </div>
                                  </div>
                                )}

                                {/* Operations & Mechanics (if present) */}
                                {q.answer?.operations && (
                                  <div className="rounded-2xl bg-cyan-50/70 border border-cyan-200 p-4 space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
                                      <Terminal className="h-4 w-4 text-cyan-700" />
                                      {language === 'ta' ? 'அடிப்படை செயல்பாடுகள் & சிக்கல்தன்மை' : 'Core Operations & Algorithmic Mechanics'}
                                    </p>
                                    <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                                      {q.answer.operations}
                                    </div>
                                  </div>
                                )}

                                {/* 3. Concrete Example & Real-World Relevance */}
                                {q.answer?.concrete_example && (
                                  <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4 space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                                      <BookOpen className="h-4 w-4 text-amber-700" />
                                      3. {language === 'ta' ? 'நிஜ உலக பயன்பாடுகள் & உதாரணங்கள்' : 'Concrete Example & Real-world Relevance'}
                                    </p>
                                    <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                                      {q.answer.concrete_example}
                                    </div>
                                  </div>
                                )}

                                {/* 4. Full Clean Programming Code */}
                                {q.answer?.program_code && (
                                  <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-2 shadow-inner">
                                    <div className="flex items-center justify-between text-stone-400">
                                      <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                        <Code className="h-4 w-4 text-teal-400" />
                                        4. {language === 'ta' ? 'முழுமையான நிரல் (Clean Program Code)' : 'Full Clean Programming Code'}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyText(q.answer.program_code || '', `code_${q.id}`)}
                                        className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        {copiedCodeId === `code_${q.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                        {copiedCodeId === `code_${q.id}` ? 'Copied' : 'Copy Code'}
                                      </button>
                                    </div>
                                    <pre className="font-mono text-xs overflow-x-auto p-3 bg-black/40 rounded-xl text-emerald-300 leading-relaxed whitespace-pre">
                                      {q.answer.program_code}
                                    </pre>
                                  </div>
                                )}

                                {/* 5. Exact Program Output */}
                                {q.answer?.program_output && (
                                  <div className="rounded-2xl bg-stone-950 border border-stone-800 p-4 space-y-2 shadow-inner">
                                    <p className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                                      <Terminal className="h-4 w-4 text-emerald-400" />
                                      5. {language === 'ta' ? 'நிரல் வெளியீடு (Exact Program Output)' : 'Exact Program Output'}
                                    </p>
                                    <div className="font-mono text-xs text-stone-200 bg-stone-900/90 rounded-xl p-3 border border-stone-800 whitespace-pre leading-relaxed overflow-x-auto">
                                      <span className="text-emerald-500 font-bold">$ </span>{q.answer.program_output}
                                    </div>
                                  </div>
                                )}

                                {/* 6. Numerical Problem & Worked-Out Solution */}
                                {q.answer?.numerical_problem && (
                                  <div className="rounded-2xl bg-purple-50/70 border border-purple-200 p-4 space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                                      <Calculator className="h-4 w-4 text-purple-700" />
                                      6. {language === 'ta' ? 'கணித மாதிரி வினா & தீர்வு (Numerical Problem & Solution)' : 'Numerical/Example Problem & Worked-out Solution'}
                                    </p>
                                    <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                                      {q.answer.numerical_problem}
                                    </div>
                                  </div>
                                )}

                                {/* 7. Trade-offs & Complexity */}
                                {(q.answer?.tradeoffs_complexity || q.answer?.conclusion) && (
                                  <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                                      7. {language === 'ta' ? 'நன்மைகள் & கால/நினைவக சிக்கல்தன்மை (Advantages & Complexity)' : 'Advantages, Disadvantages & Time/Space Complexity'}
                                    </p>
                                    <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                                      {q.answer.tradeoffs_complexity || q.answer.conclusion}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </section>
          )}

          {/* ── Practice Quiz Section (Powered by Groq AI) ───────── */}
          {groqData && (
            <section className="space-y-6 pt-6 border-t border-stone-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                    <BookOpen className="h-6 w-6 text-teal-600" />
                    Practice Quiz: AI Multiple-Choice Questions
                  </h2>
                  <p className="text-xs text-stone-500">
                    Self-evaluation test generated directly from your uploaded material.
                  </p>
                </div>
                <button
                  onClick={() => setShowQuiz(!showQuiz)}
                  className="btn-primary bg-gradient-to-r from-teal-600 to-cyan-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <HelpCircle className="h-4 w-4" />
                  {showQuiz ? 'Hide Practice Quiz' : 'Take Practice Quiz'}
                </button>
              </div>

              {showQuiz && (
                <div className="rounded-3xl border-2 border-stone-200 bg-white p-6 sm:p-8 space-y-6 shadow-sm animate-fade-up">
                  {submittedQuiz && (
                    <div className="rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 p-5 text-white shadow-md flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider opacity-90">Your Score</p>
                        <p className="text-2xl font-extrabold">{calculateScore()} / {groqData.quiz.length} Correct</p>
                      </div>
                      <button
                        onClick={handleResetQuiz}
                        className="rounded-xl bg-white/20 hover:bg-white/30 px-4 py-2 text-xs font-bold transition-all cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  <div className="space-y-6">
                    {groqData.quiz.map((item, qIdx) => {
                      const selected = quizAnswers[qIdx];
                      const correctIdx = ['A', 'B', 'C', 'D'].indexOf(item.answer);

                      return (
                        <div key={qIdx} className="space-y-3 p-4 rounded-2xl bg-stone-50 border border-stone-200">
                          <p className="text-sm font-bold text-ink">
                            {qIdx + 1}. {item.question}
                          </p>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {item.options.map((opt, optIdx) => {
                              let optStyle = 'bg-white border-stone-200 hover:border-teal-400 text-stone-700';

                              if (submittedQuiz) {
                                if (optIdx === correctIdx) {
                                  optStyle = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold';
                                } else if (selected === optIdx) {
                                  optStyle = 'bg-rose-50 border-rose-500 text-rose-900 line-through';
                                }
                              } else if (selected === optIdx) {
                                optStyle = 'bg-teal-50 border-teal-600 text-teal-900 font-bold shadow-xs';
                              }

                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() => handleSelectAnswer(qIdx, optIdx)}
                                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm text-left transition-all cursor-pointer ${optStyle}`}
                                >
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-bold">
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span className="flex-1">{opt}</span>
                                  {submittedQuiz && optIdx === correctIdx && (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                  )}
                                  {submittedQuiz && selected === optIdx && optIdx !== correctIdx && (
                                    <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!submittedQuiz && (
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleSubmitQuiz}
                        disabled={Object.keys(quizAnswers).length === 0}
                        className="btn-primary px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold cursor-pointer disabled:opacity-50"
                      >
                        Submit Quiz &amp; Check Answers
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

        </div>

        {/* ═════════════════════════════════════════════════════════ */}
        {/* RIGHT COLUMN: Clean Sidebar AI Study Assistant (4 cols)   */}
        {/* ═════════════════════════════════════════════════════════ */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
          <div className="rounded-3xl border-2 border-indigo-200/90 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            
            {/* Sidebar Header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 text-white shadow-sm">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-ink leading-tight">
                    {language === 'ta' ? 'AI கல்வி உதவியாளர்' : 'AI Study Assistant'}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Online • On-Demand
                  </span>
                </div>
              </div>

              <span className="text-[10px] uppercase font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                Gemini AI
              </span>
            </div>

            {/* Quick Prompt Suggestion Pills */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                Quick Prompts:
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSendChat(`Write a structured 8-mark university exam answer with definition, 4-6 key mechanism points, and a concrete example for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
                  disabled={chatLoading}
                  className="rounded-lg border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-900 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <FileText className="h-3 w-3 text-indigo-600" />
                  📝 8-Mark Answer
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChat(`Write a comprehensive 12-mark university exam essay (approx 1.5 pages length) covering detailed introduction, architecture/working mechanism, core operations with complexity, clean code snippet with output, real-world use cases, and advantages/disadvantages for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
                  disabled={chatLoading}
                  className="rounded-lg border border-purple-200 bg-purple-50/80 hover:bg-purple-100 px-2.5 py-1 text-[11px] font-semibold text-purple-900 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <FileText className="h-3 w-3 text-purple-600" />
                  📋 12-Mark Essay
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChat(`How many times has this topic appeared in university exams, and what are the most repeated questions for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}?`)}
                  disabled={chatLoading}
                  className="rounded-lg border border-amber-200 bg-amber-50/80 hover:bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Star className="h-3 w-3 text-amber-600" />
                  📊 Exam Frequency &amp; Trends
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChat(`Give concise 2-mark definitions and 3-mark concept breakdowns for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
                  disabled={chatLoading}
                  className="rounded-lg border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <BookOpen className="h-3 w-3 text-emerald-600" />
                  📖 2 &amp; 3-Mark Definitions
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChat(`Provide complete clean compilable programming code with comments and exact terminal execution output for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
                  disabled={chatLoading}
                  className="rounded-lg border border-teal-200 bg-teal-50/80 hover:bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-900 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Code className="h-3 w-3 text-teal-600" />
                  💻 Code &amp; Output
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChat(`Draw a clean flowchart / diagram for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
                  disabled={chatLoading}
                  className="rounded-lg border border-cyan-200 bg-cyan-50/80 hover:bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-cyan-900 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Layers className="h-3 w-3 text-cyan-600" />
                  🎨 Flowchart
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChat(`Solve the mathematical problem or equation with Given Data, Formula/Approach, Step-by-Step Calculation, and Final Answer in clean Unicode for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
                  disabled={chatLoading}
                  className="rounded-lg border border-violet-200 bg-violet-50/80 hover:bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-900 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Calculator className="h-3 w-3 text-violet-600" />
                  📐 Solve Sum Step-by-Step
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChat(`Show the visual tree structure and ASCII/Mermaid diagram with balance factor calculations and rotation rules for: AVL Tree`)}
                  disabled={chatLoading}
                  className="rounded-lg border border-teal-200 bg-teal-50/80 hover:bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-900 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Layers className="h-3 w-3 text-teal-600" />
                  🌳 Tree &amp; AVL Rotations
                </button>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 rounded-2xl bg-stone-50/70 p-3 border border-stone-200/80">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'gemini' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white shadow-2xs text-[10px] font-bold mt-1">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl p-3 shadow-2xs text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-teal-700 to-indigo-700 text-white rounded-tr-xs'
                        : 'bg-white border border-stone-200 text-stone-800 rounded-tl-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1 pb-1 border-b border-black/5">
                      <span className="font-bold text-[10px] opacity-75">
                        {msg.sender === 'user' ? 'You' : 'Gemini AI'}
                      </span>
                      <span className="text-[9px] opacity-60">{msg.timestamp}</span>
                    </div>

                    <div className="font-sans">
                      {msg.imageUrl && (
                        <div className="mb-2 overflow-hidden rounded-xl border border-white/20 bg-black/10">
                          <img
                            src={msg.imageUrl}
                            alt="Attached Question"
                            className="max-h-48 w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(msg.imageUrl, '_blank')}
                          />
                          {msg.attachmentName && (
                            <p className="px-2 py-1 text-[10px] text-white/90 font-medium truncate bg-black/20">
                              📎 {msg.attachmentName}
                            </p>
                          )}
                        </div>
                      )}
                      {msg.sender === 'gemini' ? (
                        renderFormattedChatMessage(msg.text)
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      )}
                    </div>

                    {msg.sender === 'gemini' && (
                      <div className="mt-2 pt-1 border-t border-stone-100 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.text, msg.id)}
                          className="text-[10px] font-semibold text-stone-500 hover:text-teal-700 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {copiedCodeId === msg.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          {copiedCodeId === msg.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-ink shadow-2xs text-[10px] font-bold mt-1">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 text-teal-800 font-semibold text-xs py-1.5 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
                  Analyzing syllabus and generating answer…
                </div>
              )}

              {chatError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                  {chatError}
                </div>
              )}

              <div ref={chatMessagesEndRef} />
            </div>

            {/* Multi-Language Speech Selector & Live Recording Indicator */}
            <div className="pt-2 border-t border-stone-200/80 space-y-1.5">
              <div className="flex items-center justify-between px-1 text-[11px]">
                <span className="font-semibold text-stone-600 flex items-center gap-1">
                  <Mic className="h-3 w-3 text-teal-600" />
                  Voice Language:
                </span>
                <div className="flex items-center gap-1">
                  {MIC_LANGUAGES.map((langItem) => (
                    <button
                      key={langItem.code}
                      type="button"
                      onClick={() => handleSelectMicLang(langItem.code)}
                      title={`Speak in ${langItem.label}`}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        micLang === langItem.code
                          ? 'bg-teal-700 text-white shadow-2xs'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                      }`}
                    >
                      {langItem.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live recording status badge */}
              {isListening && (
                <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1 text-[11px] text-rose-800 animate-pulse">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                    Listening in {MIC_LANGUAGES.find((l) => l.code === micLang)?.label}…
                  </span>
                  <span className="text-[10px] text-rose-600 font-medium">Click Stop when finished</span>
                </div>
              )}

              {/* Active Attached Image Card Preview */}
              {chatAttachment && (
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-teal-50 to-indigo-50 border border-teal-200/90 p-2 shadow-xs animate-fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={chatAttachment.previewUrl}
                      alt="Attachment Preview"
                      className="h-10 w-10 rounded-xl object-cover border border-teal-300 shadow-2xs shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-teal-950 truncate max-w-[180px] sm:max-w-[240px]">
                        {chatAttachment.file.name}
                      </p>
                      <p className="text-[10px] text-teal-700 font-medium">Ready to analyze • Tap send to solve</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChatAttachment(null)}
                    className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-200/70 hover:text-stone-700 transition-colors shrink-0 cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Chat Input Bar with Simple Voice Microphone, Camera Attachment & Explicit Manual Stop */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isListening) stopListening();
                  handleSendChat();
                }}
                className="flex items-center gap-1.5"
              >
                {/* Camera / Photo Attachment Button */}
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={chatLoading}
                  title="Attach a photo, handwritten question, or document"
                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-xs ${
                    chatAttachment
                      ? 'bg-teal-700 text-white ring-2 ring-teal-400'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 hover:border-teal-500'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={chatFileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="sr-only"
                  onChange={handleChatFileSelect}
                />

                {/* Small, clean microphone icon directly adjacent to input box */}
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? 'Microphone active. Click to stop' : `Tap to speak in ${MIC_LANGUAGES.find((l) => l.code === micLang)?.label}`}
                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-xs ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-2 ring-rose-300'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                  }`}
                >
                  {isListening ? <Mic className="h-4 w-4 text-white animate-pulse" /> : <Mic className="h-4 w-4 text-stone-700" />}
                </button>

                {/* Explicit Manual Stop Button next to Mic when recording */}
                {isListening && (
                  <button
                    type="button"
                    onClick={stopListening}
                    title="Manually end voice recording"
                    className="px-2.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
                  >
                    <Square className="h-3.5 w-3.5 fill-white" />
                    <span>Stop</span>
                  </button>
                )}

                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    chatAttachment
                      ? `Ask a question about ${chatAttachment.file.name}...`
                      : isListening
                      ? `Listening in ${MIC_LANGUAGES.find((l) => l.code === micLang)?.label}... Click Stop when done.`
                      : language === 'ta'
                      ? 'கேள்வி அல்லது படம் கேட்கவும்...'
                      : 'Ask any question, or attach photo...'
                  }
                  className="input flex-1 text-xs py-2.5 px-3"
                  disabled={chatLoading}
                />

                <button
                  type="submit"
                  disabled={(!chatInput.trim() && !chatAttachment) || chatLoading}
                  className="btn-primary flex items-center justify-center p-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
