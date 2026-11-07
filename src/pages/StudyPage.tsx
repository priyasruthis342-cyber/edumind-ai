import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Star, CheckCircle2, XCircle,
  BookOpen, Award, Eye, EyeOff, Loader2, AlertTriangle,
  Layers, FileText, Check, Globe, Volume2,
  Send, Bot, User, Copy, Code,
  Terminal, Calculator
} from 'lucide-react';
import { getScan, setActiveSyllabus } from '@/lib/data';
import { fetchGroqStudyData, type GroqAIResponse } from '@/lib/groqApi';
import {
  fetchGeminiExamQA,
  fetchGeminiChat,
  type GeminiExamQAResponse
} from '@/lib/geminiApi';
import type { Scan } from '@/types';

interface StudyPageProps {
  id: string;
}

type MarkFilter = 'all' | '2' | '3' | '5' | '12';

interface ChatMessage {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  timestamp: string;
}

function renderFormattedChatMessage(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-2.5 font-sans">
      {parts.map((part, pIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-z0-9_-]+$/i.test(firstLine);
          const lang = hasLang ? firstLine : '';
          const codeContent = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div key={pIdx} className="rounded-xl bg-stone-900 border border-stone-800 p-3 my-2 text-stone-100 font-mono text-xs overflow-x-auto shadow-inner">
              {lang && (
                <div className="text-[10px] font-bold uppercase text-teal-400 mb-1.5 pb-1 border-b border-stone-800">
                  {lang}
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

              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="font-extrabold text-teal-900 text-xs sm:text-sm pt-2 pb-0.5 border-b border-teal-100">
                    {trimmed.replace(/^###\s*/, '')}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                return (
                  <h3 key={lIdx} className="font-extrabold text-ink text-sm sm:text-base pt-2.5 pb-1 border-b border-stone-200">
                    {trimmed.replace(/^#+\s*/, '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('> ')) {
                return (
                  <div key={lIdx} className="border-l-3 border-teal-600 bg-teal-50/70 rounded-r-xl p-2.5 my-1.5 text-stone-900 font-medium text-xs leading-relaxed">
                    {trimmed.replace(/^>\s*/, '')}
                  </div>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-1.5 text-xs text-stone-700 pl-2">
                    <span className="text-teal-600 font-bold">•</span>
                    <span>{trimmed.replace(/^[-*]\s*/, '')}</span>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="text-xs text-stone-800 leading-relaxed font-normal">
                  {line}
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

  // ── UI Filters & Controls ─────────────────────────────────────
  const [selectedMark, setSelectedMark] = useState<MarkFilter>('all');
  const [language, setLanguage] = useState<'en' | 'ta'>('en');

  // Quiz states
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState(false);

  // ── Gemini AI Interactive Chat Assistant State ──────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'gemini',
      text: 'Hello! I am your EduMind Gemini AI Live Study Assistant. Ask me for custom definitions, full code/programs, or complete Anna University 12-mark essay answers for any topic in this syllabus!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const handleSendChat = async (customQuery?: string) => {
    const queryToSend = (customQuery || chatInput).trim();
    if (!queryToSend || chatLoading) return;

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: queryToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    setChatError(null);

    try {
      const aiReply = await fetchGeminiChat(
        queryToSend,
        scan?.raw_text || '',
        language
      );
      const geminiMsg: ChatMessage = {
        id: 'gemini_' + Date.now(),
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
    try {
      // 1. Fetch Gemini Exam Q&A (1, 2, 5, 12 marks in selected language)
      const geminiResult = await fetchGeminiExamQA(text, lang);
      setGeminiData(geminiResult);

      // 2. Fetch Groq AI quiz in background if not already loaded
      if (!groqData) {
        fetchGroqStudyData(text)
          .then((res) => setGroqData(res))
          .catch((err) => console.warn('Groq background quiz load:', err.message));
      }

      setQuizAnswers({});
      setSubmittedQuiz(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch AI exam questions.';
      setAiError(msg);
      console.error('Gemini Exam Q&A fetch error:', err);
    } finally {
      setAiLoading(false);
    }
  }, [groqData]);

  useEffect(() => {
    if (!scan?.raw_text) return;
    void loadExamContent(scan.raw_text, language);
  }, [scan, language, loadExamContent]);

  // ── Quiz score evaluation ─────────────────────────────────────
  const correctCount = groqData
    ? Object.entries(quizAnswers).filter(([qIdx, optIdx]) => {
        const q = groqData.quiz[Number(qIdx)];
        if (!q) return false;
        const correctIdx = q.answer.charCodeAt(0) - 65;
        return optIdx === correctIdx;
      }).length
    : 0;

  if (scanLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-stone-500">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        <p className="text-sm font-medium">Loading your study material…</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-up pb-16">

      {/* ── Header Banner ───────────────────────────────────── */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-700 via-indigo-800 to-purple-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 w-fit text-xs font-bold text-amber-300 backdrop-blur-md">
            <Sparkles className="h-4 w-4" />
            Gemini AI Exam Question Bank &amp; Study Assistant
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

            {/* Bilingual Language Switcher (English / தமிழ்) */}
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
          Complete syllabus analysis: 2-mark, 3-mark, 5-mark, and 12-mark university exam questions with detailed answers directly below.
        </p>

        {geminiData?.summary && (
          <div className="mt-4 rounded-2xl bg-white/10 backdrop-blur-md px-5 py-3 text-sm text-teal-50 leading-relaxed border border-white/20">
            <span className="font-bold text-amber-300">📋 {language === 'ta' ? 'பாடச் சுருக்கம்:' : 'Chapter Summary:'} </span>
            {geminiData.summary}
          </div>
        )}
      </div>

      {/* ── AI Loading State ────────────────────────────────── */}
      {aiLoading && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-teal-300 bg-teal-50 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
          <div className="text-center">
            <p className="font-bold text-teal-800">
              {language === 'ta'
                ? 'கூகிள் ஜெமினி AI உங்கள் PDF பாடத்திட்டத்தை பகுப்பாய்வு செய்கிறது…'
                : 'Google Gemini AI is analyzing your PDF syllabus & notes…'}
            </p>
            <p className="text-xs text-teal-600 mt-1">
              {language === 'ta'
                ? '2, 3, 5 மற்றும் 12 மதிப்பெண் வினா-விடைகள் உருவாக்கப்படுகின்றன...'
                : 'Generating 2-mark, 3-mark, 5-mark, and 12-mark university-style answers — please wait.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Error Notification ──────────────────────────────── */}
      {aiError && !aiLoading && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-sm text-rose-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="font-bold">Could not load AI exam content</p>
            <p className="mt-1 text-xs">{aiError}</p>
            <p className="mt-2 text-xs text-rose-700">
              Make sure your backend server is running: <code className="rounded bg-rose-100 px-1 py-0.5">node server.js</code>
            </p>
          </div>
        </div>
      )}

      {/* ── Main Exam Questions Section (Organized by Marks) ─── */}
      {geminiData && !aiLoading && (
        <section className="space-y-6">

          {/* Mark Filter Pill Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                <Award className="h-6 w-6 text-amber-500" />
                {language === 'ta' ? 'தேர்வு வினா-விடை வங்கி' : 'University Exam Question Bank'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {language === 'ta'
                  ? 'கேள்விகள் மதிப்பெண் வாரியாக பிரிக்கப்பட்டுள்ளன. விடைகள் நேரடியாக கீழே கொடுக்கப்பட்டுள்ளன.'
                  : 'Questions organized by marks. Every question has its detailed answer directly below.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedMark('all')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border ${
                  selectedMark === 'all'
                    ? 'bg-teal-700 border-teal-700 text-white shadow-sm'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-teal-400'
                }`}
              >
                🌟 {language === 'ta' ? 'அனைத்தும்' : 'All Questions'}
              </button>
              <button
                onClick={() => setSelectedMark('2')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border ${
                  selectedMark === '2'
                    ? 'bg-teal-700 border-teal-700 text-white shadow-sm'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-teal-400'
                }`}
              >
                2 Marks ({geminiData.questions_2mark.length})
              </button>
              <button
                onClick={() => setSelectedMark('3')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border ${
                  selectedMark === '3'
                    ? 'bg-teal-700 border-teal-700 text-white shadow-sm'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-teal-400'
                }`}
              >
                3 Marks ({geminiData.questions_3mark?.length || 0})
              </button>
              <button
                onClick={() => setSelectedMark('5')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border ${
                  selectedMark === '5'
                    ? 'bg-teal-700 border-teal-700 text-white shadow-sm'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-teal-400'
                }`}
              >
                5 Marks ({geminiData.questions_5mark.length})
              </button>
              <button
                onClick={() => setSelectedMark('12')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border ${
                  selectedMark === '12'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 border-amber-200 text-amber-900 hover:border-amber-400'
                }`}
              >
                ⭐ 12 Marks ({geminiData.questions_12mark.length})
              </button>
            </div>
          </div>

          <div className="space-y-8">

            {/* ── 2-MARK QUESTIONS ───────────────────────────── */}
            {(selectedMark === 'all' || selectedMark === '2') && geminiData.questions_2mark.length > 0 && (
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
                  {geminiData.questions_2mark.map((q) => (
                    <div key={q.id} className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-700 uppercase">Q.{q.id} • 2 Marks</span>
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                        </span>
                      </div>
                      <p className="text-sm font-bold text-ink">{q.question}</p>
                      <div className="rounded-xl bg-stone-50 border border-stone-200 p-3.5 text-xs leading-relaxed text-stone-800 font-medium">
                        <span className="font-bold text-teal-900">{language === 'ta' ? 'விடைக்குறிப்பு:' : 'Crisp Answer:'} </span>
                        {q.answer}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 3-MARK QUESTIONS ───────────────────────────── */}
            {(selectedMark === 'all' || selectedMark === '3') && (geminiData.questions_3mark?.length ?? 0) > 0 && (
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
                  {geminiData.questions_3mark.map((q) => (
                    <div key={q.id} className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-700 uppercase">Q.{q.id} • 3 Marks</span>
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                        </span>
                      </div>
                      <p className="text-sm font-bold text-ink">{q.question}</p>
                      <div className="rounded-xl bg-teal-50/60 border border-teal-200 p-3.5 text-xs leading-relaxed text-stone-800 font-medium">
                        <span className="font-bold text-teal-900">{language === 'ta' ? 'விடைக்குறிப்பு:' : 'Core Explanation:'} </span>
                        {q.answer}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 5-MARK QUESTIONS ───────────────────────────── */}
            {(selectedMark === 'all' || selectedMark === '5') && geminiData.questions_5mark.length > 0 && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-900">
                    PART B • 5 MARKS
                  </span>
                  <h3 className="text-base font-bold text-ink">
                    {language === 'ta' ? '5-மதிப்பெண் வினாக்கள் (கட்டமைப்பு விளக்கங்கள்)' : 'Structured 5-Mark Analytical Questions'}
                  </h3>
                </div>

                <div className="grid gap-5">
                  {geminiData.questions_5mark.map((q) => (
                    <div key={q.id} className="rounded-2xl border-2 border-indigo-200/60 bg-white p-6 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                          Q.{q.id} • 5 Marks Structured Answer
                        </span>
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                          ⭐ High Priority
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-ink">{q.question}</h4>
                      <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 text-xs sm:text-sm leading-relaxed text-stone-800 space-y-2">
                        <p className="font-bold text-indigo-950">
                          {language === 'ta' ? 'தேர்வு விடை கட்டமைப்பு:' : 'Structured Answer Format:'}
                        </p>
                        <p className="whitespace-pre-line font-medium text-stone-700">{q.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 12-MARK COMPREHENSIVE UNIVERSITY ESSAY QUESTIONS ── */}
            {(selectedMark === 'all' || selectedMark === '12') && geminiData.questions_12mark.length > 0 && (
              <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                      PART C • 12 MARKS
                    </span>
                    <h3 className="text-lg font-extrabold text-ink">
                      {language === 'ta' ? '12-மதிப்பெண் விரிவான பல்கலைக்கழக வினா-விடை' : 'Comprehensive University 12-Mark Essay Questions'}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                    ⭐ 12/12 Full Marks Format
                  </span>
                </div>

                <div className="space-y-6">
                  {geminiData.questions_12mark.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-3xl border-2 border-teal-500/40 bg-white p-6 sm:p-8 shadow-md space-y-6"
                    >
                      {/* Question Header */}
                      <div className="border-b border-stone-100 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-extrabold uppercase tracking-wide text-teal-700">
                            Question {q.id} • 12 Marks
                          </span>
                          <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">
                            <Star className="h-4 w-4 fill-amber-400" /> Star Verified Exam Question
                          </span>
                        </div>
                        <h4 className="text-lg sm:text-xl font-extrabold text-ink leading-snug">
                          {q.question}
                        </h4>
                      </div>

                      {/* Detailed 12-Mark University Structure Directly Below */}
                      <div className="space-y-4 text-sm">

                        {/* 1. Introduction & Core Definition */}
                        {q.answer?.introduction && (
                          <div className="rounded-2xl bg-teal-50/80 border border-teal-200 p-4 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                              <BookOpen className="h-4 w-4 text-teal-700" />
                              1. {language === 'ta' ? 'முன்னுரை & அடிப்படைக் கோட்பாடு (Introduction & Core Definition)' : 'Introduction & Core Definition'}
                            </p>
                            <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1 border-l-2 border-teal-600 pl-3">
                              {q.answer.introduction}
                            </div>
                          </div>
                        )}

                        {/* 2. Architectural Scope & Types/Categories (with definition for each type) */}
                        {(q.answer?.architecture_types || (q.answer?.headings && q.answer.headings.length > 0)) && (
                          <div className="rounded-2xl bg-indigo-50/60 border border-indigo-200 p-4 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                              <Layers className="h-4 w-4 text-indigo-700" />
                              2. {language === 'ta' ? 'கட்டமைப்பு & வகைகள் / பிரிவுகள் (Architectural Scope & Types/Categories)' : 'Architectural Scope & Types/Categories (with definitions for each type)'}
                            </p>
                            {q.answer?.architecture_types ? (
                              <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                                {q.answer.architecture_types}
                              </div>
                            ) : (
                              <div className="grid gap-2.5 pt-1">
                                {q.answer.headings?.map((h, hIdx) => (
                                  <div key={hIdx} className="rounded-xl border border-stone-200 bg-white/90 p-3 space-y-1">
                                    <h5 className="font-bold text-ink text-xs sm:text-base flex items-center gap-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-[11px] font-bold text-white">
                                        {hIdx + 1}
                                      </span>
                                      {h.title}
                                    </h5>
                                    <p className="text-xs text-stone-700 leading-relaxed font-normal whitespace-pre-line pl-7">
                                      {h.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. Concrete Example & Real-world Relevance */}
                        {(q.answer?.concrete_example || q.answer?.examples) && (
                          <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                              <Sparkles className="h-4 w-4 text-amber-700" />
                              3. {language === 'ta' ? 'நிஜ உலக உதாரணம் & நடைமுறை பயன்பாடுகள் (Concrete Example & Real-World Relevance)' : 'Concrete Example & Real-world Relevance'}
                            </p>
                            <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                              {q.answer.concrete_example || q.answer.examples}
                            </div>
                          </div>
                        )}

                        {/* 4. Full Clean Programming Code (C++/Java/Python) */}
                        {q.answer?.program_code && (
                          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-2 text-stone-100 shadow-sm">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                                <Code className="h-4 w-4 text-teal-400" />
                                4. {language === 'ta' ? 'முழுமையான நிரல் முறை (Full Clean Programming Code)' : 'Full Clean Programming Code (C++/Java/Python)'}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleCopyText(q.answer.program_code!, `code_${q.id}`)}
                                className="text-[11px] font-semibold text-stone-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
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

                        {/* 6. Numerical/Example Problem & Worked-out Solution (if applicable to topic) */}
                        {q.answer?.numerical_problem && (
                          <div className="rounded-2xl bg-purple-50/70 border border-purple-200 p-4 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                              <Calculator className="h-4 w-4 text-purple-700" />
                              6. {language === 'ta' ? 'கணித மாதிரி வினா & முழுமையான தீர்வு (Numerical / Example Problem & Solution)' : 'Numerical/Example Problem & Worked-out Solution'}
                            </p>
                            <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                              {q.answer.numerical_problem}
                            </div>
                          </div>
                        )}

                        {/* 7. Advantages, Disadvantages & Time/Space Complexity */}
                        {(q.answer?.tradeoffs_complexity || q.answer?.conclusion) && (
                          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                              7. {language === 'ta' ? 'நன்மைகள், வரம்புகள் & கால/நினைவக சிக்கல்தன்மை (Advantages, Disadvantages & Complexity)' : 'Advantages, Disadvantages & Time/Space Complexity'}
                            </p>
                            <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium whitespace-pre-line pl-1">
                              {q.answer.tradeoffs_complexity || q.answer.conclusion}
                            </div>
                          </div>
                        )}

                        <div className="pt-2 text-xs text-stone-500 flex items-center gap-1.5">
                          💡 <span>Tip: Draw diagrams and present sub-headings in boxes during your university exam for full 12/12 marks.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </section>
      )}

      {/* ── Interactive Gemini AI Live Study Assistant Chat Box ── */}
      <section className="space-y-4 pt-2">
        <div className="rounded-3xl border-2 border-indigo-200 bg-white p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 via-indigo-600 to-purple-600 text-white shadow-md">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-ink">
                    {language === 'ta' ? 'ஜெமினி AI நேரலை கல்வி உதவியாளர்' : 'Gemini AI Live Study Assistant'}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    Online
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {language === 'ta'
                    ? '12-மதிப்பெண் வினாக்கள், நிரல்கள் (Code), அல்லது விளக்கங்களை நேரடியாகக் கேளுங்கள்.'
                    : 'Ask for custom 12-mark essay answers, code snippets, definitions, or exam diagrams.'}
                </p>
              </div>
            </div>

            <div className="text-xs text-stone-500 font-medium">
              Syllabus: <strong className="text-teal-800">{geminiData?.chapter_title || scan?.chapter_title || 'Active Material'}</strong>
            </div>
          </div>

          {/* Quick Prompt Suggestion Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSendChat(`Write a comprehensive 12-mark university exam answer for "${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}" strictly structured with all 7 sections: 1. Introduction & Core Definition, 2. Architectural Scope & Types/Categories, 3. Concrete Example & Real-world Relevance, 4. Full Clean Programming Code, 5. Exact Program Output, 6. Numerical/Example Problem & Worked-out Solution, and 7. Advantages, Disadvantages & Time/Space Complexity.`)}
              disabled={chatLoading}
              className="rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-900 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <FileText className="h-3.5 w-3.5 text-indigo-600" />
              📝 7-Part 12-Mark Exam Sheet
            </button>
            <button
              type="button"
              onClick={() => handleSendChat(`Provide complete clean compilable programming code with comments, exact terminal execution output, and time complexity for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
              disabled={chatLoading}
              className="rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-900 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Code className="h-3.5 w-3.5 text-teal-600" />
              💻 Code &amp; Program Output
            </button>
            <button
              type="button"
              onClick={() => handleSendChat(`Provide a numerical / worked-out example problem with step-by-step formula and complete solution for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
              disabled={chatLoading}
              className="rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-900 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Calculator className="h-3.5 w-3.5 text-purple-600" />
              🔢 Numerical Problem &amp; Solution
            </button>
            <button
              type="button"
              onClick={() => handleSendChat(`Provide crisp 2-mark and 3-mark university definitions with key formulas/features for: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
              disabled={chatLoading}
              className="rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-600" />
              📖 2 &amp; 3-Mark Definitions
            </button>
            <button
              type="button"
              onClick={() => handleSendChat(`Give a point-by-point tabular comparison highlighting key differences and trade-offs for topics in: ${geminiData?.chapter_title || scan?.chapter_title || 'this topic'}`)}
              disabled={chatLoading}
              className="rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-800 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Layers className="h-3.5 w-3.5 text-stone-600" />
              ⚡ Tabular Comparison
            </button>
          </div>

          {/* Chat Messages Feed */}
          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 rounded-2xl bg-stone-50/60 p-4 border border-stone-200/80">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'gemini' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-xs text-xs font-bold mt-1">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 shadow-xs text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-teal-700 to-indigo-700 text-white rounded-tr-xs'
                      : 'bg-white border border-stone-200 text-stone-800 rounded-tl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-black/5">
                    <span className="font-bold text-[11px] opacity-75">
                      {msg.sender === 'user' ? 'You' : 'Gemini AI Tutor'}
                    </span>
                    <span className="text-[10px] opacity-60">{msg.timestamp}</span>
                  </div>

                  <div className="font-sans">
                    {msg.sender === 'gemini' ? (
                      renderFormattedChatMessage(msg.text)
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    )}
                  </div>

                  {msg.sender === 'gemini' && (
                    <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.text, msg.id)}
                        className="text-[11px] font-semibold text-stone-500 hover:text-teal-700 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedCodeId === msg.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        {copiedCodeId === msg.id ? 'Copied to Clipboard' : 'Copy Answer'}
                      </button>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-ink shadow-xs text-xs font-bold mt-1">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="flex items-center gap-3 text-teal-800 font-semibold text-xs py-2 animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
                Gemini AI is analyzing syllabus &amp; generating your custom answer...
              </div>
            )}

            {chatError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {chatError}
              </div>
            )}

            <div ref={chatMessagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={language === 'ta' ? 'கேள்வி அல்லது தலைப்பை தட்டச்சு செய்து கேட்கவும் (எ.கா: Circular Linked List நிரல் தருக)...' : 'Type topic or request (e.g. Write a 12-mark answer for Stacks vs Queues with code)...'}
              className="input flex-1 text-xs sm:text-sm py-3"
              disabled={chatLoading}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="btn-primary flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{language === 'ta' ? 'அனுப்பு' : 'Ask AI'}</span>
            </button>
          </form>
        </div>
      </section>

      {/* ── Practice Quiz Section (Preserved & Powered by AI) ─── */}
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
              className="btn-primary bg-gradient-to-r from-teal-600 to-cyan-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2"
            >
              {showQuiz ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showQuiz ? 'Hide Quiz' : 'Start Practice Quiz'}
            </button>
          </div>

          {showQuiz && (
            <div className="space-y-6 animate-fade-in pt-4">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-teal-50 border border-teal-200 p-4">
                <p className="text-xs font-bold text-teal-900">
                  Answer the questions below and click Submit to check your score.
                </p>
                <button
                  onClick={() => setSubmittedQuiz(true)}
                  disabled={submittedQuiz}
                  className="rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold px-5 py-2 text-xs shadow transition-colors"
                >
                  Submit &amp; Check Answers
                </button>
              </div>

              {submittedQuiz && (
                <div className="rounded-2xl bg-indigo-50 border-2 border-indigo-300 p-5 text-center text-indigo-950">
                  <h3 className="text-lg font-extrabold">Quiz Result</h3>
                  <p className="text-sm mt-1">
                    You scored{' '}
                    <span className="font-bold text-teal-700">{correctCount}</span>
                    {' '}out of{' '}
                    <span className="font-bold">{groqData.quiz.length}</span> correct!
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {groqData.quiz.map((q, qIdx) => {
                  const selectedOpt = quizAnswers[qIdx];
                  const correctIdx = q.answer.charCodeAt(0) - 65;

                  return (
                    <div
                      key={qIdx}
                      className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm space-y-3"
                    >
                      <p className="text-sm font-bold text-ink">
                        {qIdx + 1}. {q.question}
                      </p>

                      <div className="space-y-2">
                        {(q.options || []).map((opt, optIdx) => {
                          const isSelected = selectedOpt === optIdx;
                          const isCorrectOpt = optIdx === correctIdx;

                          let optClass = 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100';
                          if (isSelected && !submittedQuiz) {
                            optClass = 'bg-teal-100 border-teal-600 text-teal-900';
                          } else if (submittedQuiz) {
                            if (isSelected && isCorrectOpt)
                              optClass = 'bg-emerald-100 border-emerald-500 text-emerald-900';
                            else if (isSelected && !isCorrectOpt)
                              optClass = 'bg-rose-100 border-rose-500 text-rose-900';
                            else if (isCorrectOpt)
                              optClass = 'bg-emerald-50 border-emerald-300 text-emerald-800';
                          }

                          return (
                            <button
                              key={optIdx}
                              onClick={() => {
                                if (!submittedQuiz) {
                                  setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx });
                                }
                              }}
                              className={`w-full text-left rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${optClass}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      {submittedQuiz && (
                        <div className="pt-2 text-xs font-bold">
                          {selectedOpt === correctIdx ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" /> Correct!
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1">
                              <XCircle className="h-4 w-4" />
                              Correct answer: {q.options[correctIdx]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
