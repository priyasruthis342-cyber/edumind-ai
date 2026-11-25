import React, { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  BookOpen,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Gauge
} from 'lucide-react';
import { fetchTeacherAudioUrl, type MathSolveResponse, type MathSolveStep } from '@/lib/geminiApi';
import { speakInLanguage, loadVoices } from '@/lib/speech';

interface MathWhiteboardProps {
  lesson: MathSolveResponse;
  onUnderstood?: () => void;
  onNotUnderstood?: () => void;
  isSimplerLoading?: boolean;
  language?: string;
}

/**
 * Safely renders a string containing math / LaTeX formulas with KaTeX.
 * Parses $...$ inline math, $$...$$ display math, or direct LaTeX formulas.
 */
export function RenderMathText({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null;

  // Split by $$...$$ or $...$
  const regex = /(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g;
  const parts = text.split(regex);

  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
            return <div key={index} className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={index} className="font-mono text-amber-200">{math}</span>;
          }
        }

        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1).trim();
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
            return <span key={index} className="inline-block px-1" dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={index} className="font-mono text-amber-200">{math}</span>;
          }
        }

        // Check if plain line looks like LaTeX command (e.g. \frac, \sqrt, \text)
        if (/\\(?:frac|sqrt|cdot|pm|times|alpha|beta|theta|pi|int|sum|text)/.test(part)) {
          try {
            const html = katex.renderToString(part, { displayMode: true, throwOnError: false });
            return <div key={index} className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={index}>{part}</span>;
          }
        }

        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}

export function MathWhiteboard({
  lesson,
  onUnderstood,
  onNotUnderstood,
  isSimplerLoading = false,
  language = 'en'
}: MathWhiteboardProps) {
  // Teaching Phases: 'question' (first shows question + intro) -> 'teaching' (step by step) -> 'completed' (final answer + understood prompt)
  const [phase, setPhase] = useState<'question' | 'teaching' | 'completed'>('question');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isErasing, setIsErasing] = useState<boolean>(false);
  const [understoodState, setUnderstoodState] = useState<boolean | null>(null);

  // Playback Controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0); // 0.75, 1.0, 1.25
  const [isAudioSpeaking, setIsAudioSpeaking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Handwriting typewriter state for board text
  const [displayedText, setDisplayedText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typewriterTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio elements & timers
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const steps = lesson.steps || [];
  const totalSteps = steps.length;
  const isTamil = language === 'ta';

  // Cleanup audio & timers helper
  const stopCurrentAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
      audioElementRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setIsAudioSpeaking(false);
  }, []);

  // Initialize browser voices once
  useEffect(() => {
    void loadVoices();
    return () => {
      stopCurrentAudio();
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
    };
  }, [stopCurrentAudio]);

  // Reset to Question Phase on new lesson
  useEffect(() => {
    stopCurrentAudio();
    setPhase('question');
    setCurrentStep(0);
    setUnderstoodState(null);
    setIsPlaying(true);
  }, [lesson, stopCurrentAudio]);

  // Female voice audio player: backend Neural TTS with fallback to browser SpeechSynthesis
  const speakTeacherText = useCallback(
    async (text: string, onEnd?: () => void) => {
      if (isMuted || !text || !text.trim()) {
        onEnd?.();
        return;
      }

      stopCurrentAudio();
      setIsAudioSpeaking(true);

      let ended = false;
      const handleEnd = () => {
        if (!ended) {
          ended = true;
          setIsAudioSpeaking(false);
          onEnd?.();
        }
      };

      try {
        const audioUrl = await fetchTeacherAudioUrl(text, language);
        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audioElementRef.current = audio;
          audio.playbackRate = speechSpeed;
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            handleEnd();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            // Fallback to browser voice if audio element fails
            fallbackBrowserSpeech(text, handleEnd);
          };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('Teacher audio fetch failed, falling back to browser voice:', err);
      }

      // Browser speech synthesis fallback
      fallbackBrowserSpeech(text, handleEnd);
    },
    [isMuted, language, speechSpeed, stopCurrentAudio]
  );

  const fallbackBrowserSpeech = (text: string, onEnd: () => void) => {
    const langTag = isTamil ? 'ta-IN' : 'en-US';
    const result = speakInLanguage(text, langTag, onEnd, true);
    if (result !== 'playing') {
      onEnd();
    }
  };

  // Start Handwriting Typewriter Animation on chalkboard
  const startTypewriter = useCallback((fullText: string, onComplete?: () => void) => {
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
    }
    setDisplayedText('');
    setIsTyping(true);

    if (!fullText) {
      setIsTyping(false);
      onComplete?.();
      return;
    }

    let charIndex = 0;
    const baseInterval = Math.max(14, Math.min(32, Math.floor(1100 / (fullText.length || 1))));
    const interval = Math.max(8, Math.floor(baseInterval / speechSpeed));

    typewriterTimerRef.current = setInterval(() => {
      charIndex += 2;
      if (charIndex >= fullText.length) {
        setDisplayedText(fullText);
        setIsTyping(false);
        if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
        onComplete?.();
      } else {
        setDisplayedText(fullText.slice(0, charIndex));
      }
    }, interval);
  }, [speechSpeed]);

  // Phase & Step Coordinator
  useEffect(() => {
    if (!isPlaying) {
      if (audioElementRef.current) audioElementRef.current.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.pause();
      return;
    }

    // ─────────────────────────────────────────────
    // 1. QUESTION PHASE: Teacher writes question first, speaks intro
    // ─────────────────────────────────────────────
    if (phase === 'question') {
      const questionText = lesson.questionTitle || (isTamil ? 'கணித வினா' : 'Mathematics Question');
      startTypewriter(questionText);

      const introText = lesson.intro || (isTamil
        ? 'சரி பசங்களா, இப்போ இந்த கணக்கைப் பார்க்கலாம். கரும்பலகையில வினாவை எழுதியிருக்கேன்.'
        : "Come students, let's look at today's question. I have written it on the chalkboard.");

      void speakTeacherText(introText);
      return;
    }

    // ─────────────────────────────────────────────
    // 2. TEACHING PHASE: Writes one step, speaks step, says "இது இப்படி வந்துச்சு", advances only after speaking
    // ─────────────────────────────────────────────
    if (phase === 'teaching') {
      const stepData = steps[currentStep];
      if (!stepData) {
        setPhase('completed');
        return;
      }

      // 1. Write the step on the board
      startTypewriter(stepData.board);

      // 2. Speak the step aloud with female teacher voice
      const speechText = stepData.speech || (stepData as any).explanation || (isTamil ? 'இதை கவனியுங்கள்.' : 'Observe this step.');

      void speakTeacherText(speechText, () => {
        // Step speech finished! Wait a short natural pause before proceeding
        autoAdvanceTimerRef.current = setTimeout(() => {
          if (currentStep < totalSteps - 1) {
            setCurrentStep((prev) => prev + 1);
          } else {
            setPhase('completed');
          }
        }, 900);
      });
      return;
    }

    // ─────────────────────────────────────────────
    // 3. COMPLETED PHASE: Final answer boxed + asks "புரிஞ்சுதா?"
    // ─────────────────────────────────────────────
    if (phase === 'completed') {
      const finalBoxText = lesson.finalAnswer || (isTamil ? 'சரிபார்க்கப்பட்ட விடை' : 'Verified Final Solution');
      startTypewriter(finalBoxText);

      const promptText = lesson.understoodPrompt || (isTamil
        ? 'பசங்களா, இந்த கணக்கு இப்போ நல்லா புரிஞ்சுதா?'
        : 'Did you understand the solution students?');

      void speakTeacherText(promptText);
      return;
    }
  }, [phase, currentStep, isPlaying, lesson, isTamil, speakTeacherText, startTypewriter, steps, totalSteps]);

  // User Actions
  const handleStartTeaching = () => {
    stopCurrentAudio();
    setPhase('teaching');
    setCurrentStep(0);
    setIsPlaying(true);
  };

  const handlePauseResume = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopCurrentAudio();
    } else {
      setIsPlaying(true);
    }
  };

  const handleReplayCurrent = () => {
    stopCurrentAudio();
    setIsPlaying(true);
    if (phase === 'question') {
      const q = lesson.questionTitle || '';
      startTypewriter(q);
      void speakTeacherText(lesson.intro || '');
    } else if (phase === 'teaching') {
      const s = steps[currentStep];
      if (s) {
        startTypewriter(s.board);
        void speakTeacherText(s.speech || (s as any).explanation || '');
      }
    } else if (phase === 'completed') {
      startTypewriter(lesson.finalAnswer || '');
      void speakTeacherText(lesson.understoodPrompt || (isTamil ? 'புரிஞ்சுதா?' : 'Did you understand?'));
    }
  };

  const handleRestartFromBeginning = () => {
    stopCurrentAudio();
    setPhase('question');
    setCurrentStep(0);
    setIsPlaying(true);
  };

  const handleCycleSpeed = () => {
    const speeds = [0.75, 1.0, 1.25];
    const nextIndex = (speeds.indexOf(speechSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setSpeechSpeed(nextSpeed);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = nextSpeed;
    }
  };

  const handleUnderstoodClick = () => {
    stopCurrentAudio();
    setUnderstoodState(true);
    if (onUnderstood) onUnderstood();
  };

  const handleNotUnderstoodClick = () => {
    stopCurrentAudio();
    setIsErasing(true);
    setUnderstoodState(false);
    setTimeout(() => {
      setIsErasing(false);
      if (onNotUnderstood) {
        onNotUnderstood();
      }
    }, 1200);
  };

  const hasStudentAnswer = !!lesson.userFeedback?.hasUserAnswer;
  const isStudentAnswerCorrect = !!lesson.userFeedback?.isCorrect;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">

      {/* ─────────────────────────────────────────────────────────────
          1. CLASSROOM FEMALE TEACHER INTRO & STUDENT FEEDBACK BANNER
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border border-emerald-200/90 p-4 sm:p-5 shadow-sm text-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-md bg-white">
                <img
                  src="/teacher-girl.jpg"
                  alt="AI Female Maths Teacher"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              {isAudioSpeaking && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-600 border-2 border-white"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  {isTamil ? 'கணித ஆசிரியை (நேரலை வகுப்பு):' : 'AI Maths Teacher (Live Classroom):'}
                </span>
                {isAudioSpeaking && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                    <Volume2 className="h-3 w-3" />
                    {isTamil ? 'பேசுகிறார்...' : 'Speaking...'}
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base font-medium text-slate-900 mt-0.5">
                {phase === 'question'
                  ? (lesson.intro || (isTamil ? 'சரி பசங்களா, இப்போ இந்த கணக்கைப் பார்க்கலாம்.' : "Come students, let's look at today's question."))
                  : phase === 'teaching'
                  ? (isTamil ? `படி ${currentStep + 1} - கரும்பலகையில தீர்வு எழுதப்படுகிறது.` : `Step ${currentStep + 1} of ${totalSteps} - Teaching on chalkboard.`)
                  : (lesson.understoodPrompt || (isTamil ? 'புரிஞ்சுதா பசங்களா?' : 'Did you understand students?'))}
              </p>
            </div>
          </div>

          {/* Quick Classroom Toolbar Controls */}
          <div className="flex items-center gap-1.5 self-end sm:self-center bg-white/90 backdrop-blur-sm border border-emerald-200 rounded-2xl p-1 shadow-xs">
            <button
              type="button"
              onClick={handlePauseResume}
              className="p-2 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleReplayCurrent}
              className="p-2 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer"
              title="Replay step"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCycleSpeed}
              className="px-2 py-1 text-xs font-bold text-slate-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              title="Change Speed"
            >
              <Gauge className="h-3.5 w-3.5" />
              <span>{speechSpeed}x</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const nextMute = !isMuted;
                setIsMuted(nextMute);
                if (nextMute) stopCurrentAudio();
              }}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isMuted ? 'text-rose-600 bg-rose-50' : 'text-slate-700 hover:bg-emerald-50'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Student Written Answer Review (Case B) */}
        {hasStudentAnswer && (
          <div className="mt-3 pt-3 border-t border-emerald-200/80 flex items-start gap-2.5 text-xs sm:text-sm">
            <span className="text-base shrink-0">{isStudentAnswerCorrect ? '🎉' : '📝'}</span>
            <div>
              <span className="font-bold text-emerald-950">
                {isTamil ? 'மாணவரின் விடை சரிபார்ப்பு: ' : "Review of Student's Answer: "}
              </span>
              <span className="text-slate-800">
                {lesson.userFeedback?.feedback ||
                  (isStudentAnswerCorrect
                    ? (isTamil ? 'உங்கள் விடை மிகச் சரியானது! அருமை!' : 'Your answer is correct! Excellent work!')
                    : (isTamil ? 'உங்கள் விடையில் ஒரு சிறிய பிழை உள்ளது. கரும்பலகையில் சரியான வழியைப் பார்க்கலாம்!' : 'There is a small mistake in your steps. Let us see the correct solution on the chalkboard!'))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. CHALKBOARD (WOODEN FRAME + GREEN SLATE + HANDWRITING FONT)
      ───────────────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl p-3 sm:p-4 bg-gradient-to-b from-[#8B5A2B] via-[#654321] to-[#4A2F17] shadow-2xl border-4 border-[#5c3a1e]">
        {/* Board Screws / Top Trim */}
        <div className="flex items-center justify-between px-3 pb-2 text-[#d2b48c] text-[11px] font-mono select-none">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="h-2 w-2 rounded-full bg-[#3e2714] inline-block shadow-inner"></span>
            {isTamil ? 'வகுப்பறை கரும்பலகை' : 'Classroom Chalkboard'}
          </span>
          <span className="font-bold tracking-widest uppercase text-amber-300">
            {phase === 'question'
              ? (isTamil ? 'வினா மட்டும்' : 'Question Statement')
              : phase === 'teaching'
              ? (isTamil ? `படி ${currentStep + 1} / ${totalSteps}` : `Step ${currentStep + 1} of ${totalSteps}`)
              : (isTamil ? 'இறுதி விடை' : 'Final Solution')}
          </span>
          <span className="h-2 w-2 rounded-full bg-[#3e2714] inline-block shadow-inner"></span>
        </div>

        {/* Green Chalkboard Slate */}
        <div className="relative min-h-[340px] sm:min-h-[400px] rounded-2xl p-5 sm:p-8 bg-gradient-to-b from-[#0c2417] via-[#0d281a] to-[#071910] text-[#fffdf0] shadow-inner overflow-hidden border border-emerald-950/80">
          {/* Subtle chalk dust texture overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

          {/* SPONGE ERASER WIPE ANIMATION */}
          {isErasing && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm transition-all duration-700 animate-out fade-out">
              <div className="flex flex-col items-center gap-2 p-5 rounded-3xl bg-amber-950/95 border border-amber-500/70 shadow-2xl animate-bounce">
                <span className="text-4xl">🧹</span>
                <span className="text-amber-200 font-bold font-sans text-sm sm:text-base">
                  {isTamil ? 'கரும்பலகை அழிக்கப்படுகிறது... எளிய விளக்கம் தயார்!' : 'Erasing board... preparing simpler explanation!'}
                </span>
              </div>
            </div>
          )}

          {/* Chalkboard Content Display */}
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[300px] space-y-4">
            
            {/* Header of chalkboard */}
            <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
              <span className="text-amber-300 font-bold font-serif text-sm sm:text-base tracking-wide flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-400" />
                {phase === 'question'
                  ? (isTamil ? 'வினா (QUESTION):' : 'QUESTION:')
                  : phase === 'teaching'
                  ? (isTamil ? `படி ${currentStep + 1}: கணக்கீடு` : `Step ${currentStep + 1}: Working`)
                  : (isTamil ? 'நிரூபிக்கப்பட்ட இறுதி விடை:' : 'Final Boxed Result:')}
              </span>

              <span className="text-xs text-emerald-300/80 font-mono">
                {isTyping ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-300 font-sans">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
                    {isTamil ? 'ஆசிரியை எழுதுகிறார்...' : 'Teacher writing...'}
                  </span>
                ) : (
                  <span>✓ {isTamil ? 'எழுதியாச்சு' : 'Ready'}</span>
                )}
              </span>
            </div>

            {/* Handwriting Chalk Area (Caveat / Patrick Hand handwriting styling) */}
            <div className="flex-1 py-3 font-['Caveat',_'Patrick_Hand',_cursive] text-2xl sm:text-3xl tracking-wide text-amber-100 leading-relaxed overflow-x-auto min-h-[160px]">
              <RenderMathText text={displayedText} />
              {isTyping && (
                <span className="inline-block h-6 w-2 bg-amber-300 ml-1.5 animate-pulse align-middle"></span>
              )}
            </div>

            {/* Final Answer Banner (During completed phase) */}
            {phase === 'completed' && lesson.finalAnswer && (
              <div className="p-4 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-950/40 text-center animate-in zoom-in-95">
                <span className="text-xs uppercase font-serif font-extrabold tracking-wider text-amber-300 block mb-1">
                  🎯 {isTamil ? 'இறுதி விடை (FINAL ANSWER):' : 'FINAL ANSWER:'}
                </span>
                <div className="text-2xl sm:text-3xl font-black font-['Caveat',_cursive] text-white">
                  <RenderMathText text={lesson.finalAnswer} />
                </div>
              </div>
            )}

            {/* Chalkboard Bottom Bar / Navigation */}
            <div className="pt-3 border-t border-emerald-800/60 flex items-center justify-between text-xs font-sans">
              {phase === 'question' ? (
                <div className="w-full flex items-center justify-between">
                  <span className="text-emerald-300/80 text-xs">
                    {isTamil ? 'வினாவை படித்துப் பாருங்கள்' : 'Read the question above'}
                  </span>

                  <button
                    type="button"
                    onClick={handleStartTeaching}
                    className="py-2.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold shadow-md flex items-center gap-2 cursor-pointer transition-transform active:scale-95 text-xs sm:text-sm"
                  >
                    <span>{isTamil ? '✨ தீர்த்து சொல்லிக் கொடுங்க / Teach Me ➔' : '✨ Teach Me / Show Solution ➔'}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      stopCurrentAudio();
                      if (currentStep > 0) {
                        setCurrentStep((p) => p - 1);
                      } else {
                        setPhase('question');
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-950/90 text-emerald-200 border border-emerald-700/60 hover:bg-emerald-900/80 cursor-pointer transition-all active:scale-95"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>{isTamil ? 'முந்தைய படி' : 'Previous'}</span>
                  </button>

                  {/* Step dots */}
                  <div className="flex items-center gap-1.5">
                    {steps.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          stopCurrentAudio();
                          setPhase('teaching');
                          setCurrentStep(idx);
                        }}
                        className={`h-2.5 rounded-full transition-all cursor-pointer ${
                          phase === 'teaching' && idx === currentStep
                            ? 'w-6 bg-amber-400'
                            : 'w-2.5 bg-emerald-700/60 hover:bg-emerald-600'
                        }`}
                        title={`Go to step ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      stopCurrentAudio();
                      if (currentStep < totalSteps - 1) {
                        setCurrentStep((p) => p + 1);
                      } else {
                        setPhase('completed');
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-all active:scale-95"
                  >
                    <span>{phase === 'teaching' && currentStep === totalSteps - 1 ? (isTamil ? 'இறுதி விடை' : 'Final Answer') : (isTamil ? 'அடுத்த படி' : 'Next Step')}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chalk Shelf / Tray */}
        <div className="mt-2 h-3 rounded-full bg-[#3e2714] shadow-inner flex items-center px-6 gap-3">
          <div className="h-1.5 w-6 rounded-full bg-[#fdfbf7] opacity-80 shadow"></div>
          <div className="h-1.5 w-4 rounded-full bg-amber-200 opacity-80 shadow"></div>
          <div className="h-1.5 w-5 rounded-full bg-cyan-200 opacity-80 shadow"></div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TEACHER'S SPOKEN EXPLANATION BOX BELOW BOARD
      ───────────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-amber-700 shrink-0" />
            <h4 className="font-bold text-amber-950 text-xs sm:text-sm uppercase tracking-wide">
              {phase === 'question'
                ? (isTamil ? 'ஆசிரியை உரை (கேள்வி அறிமுகம்):' : "Teacher's Spoken Intro:")
                : phase === 'teaching'
                ? (isTamil ? `படி ${currentStep + 1} - ஆசிரியை வாய்மொழி விளக்கம்:` : `Teacher's Spoken Explanation for Step ${currentStep + 1}:`)
                : (isTamil ? 'முடிவு உரை:' : 'Concluding Remark:')}
            </h4>
          </div>

          <button
            type="button"
            onClick={handleReplayCurrent}
            className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{isTamil ? 'மீண்டும் கேட்க' : 'Replay Voice'}</span>
          </button>
        </div>

        <p className="text-sm sm:text-base text-slate-800 font-sans leading-relaxed pl-6">
          {phase === 'question'
            ? (lesson.intro || (isTamil ? 'கணக்கை கவனமாகப் பாருங்கள்.' : 'Follow the problem statement on the board.'))
            : phase === 'teaching'
            ? (steps[currentStep]?.speech || (steps[currentStep] as any)?.explanation || (isTamil ? 'இது இப்படி வந்துச்சு பாருங்க.' : 'Here is how this step came about.'))
            : (lesson.understoodPrompt || (isTamil ? 'புரிஞ்சுதா பசங்களா?' : 'Did you understand?'))}
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. "புரிஞ்சுதா?" (UNDERSTOOD / NOT UNDERSTOOD) BUTTONS
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-3.5">
        <p className="text-base sm:text-lg font-extrabold text-slate-800">
          {lesson.understoodPrompt || (isTamil ? 'மாணவர்களே, இந்த கணக்கு உங்களுக்குப் புரிந்ததா? (Did you understand?)' : 'Did you understand the solution?')}
        </p>

        {understoodState === true && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold flex items-center justify-center gap-2 animate-in zoom-in-95">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span>
              {isTamil
                ? 'அருமை! நீங்கள் நன்றாக புரிந்து கொண்டீர்கள். தொடர்ந்து பயிற்சி செய்யுங்கள்!'
                : 'Awesome! Great job understanding this problem. Keep up the great work!'}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleUnderstoodClick}
            className={`py-3.5 px-6 rounded-2xl font-extrabold text-sm sm:text-base transition-all flex items-center gap-2 cursor-pointer shadow-md ${
              understoodState === true
                ? 'bg-emerald-600 text-white ring-4 ring-emerald-200'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95'
            }`}
          >
            <CheckCircle className="h-5 w-5" />
            <span>{isTamil ? 'ஆம், புரிந்தது (Understood)' : 'Understood'}</span>
          </button>

          <button
            type="button"
            onClick={handleNotUnderstoodClick}
            disabled={isSimplerLoading || isErasing}
            className="py-3.5 px-6 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 font-extrabold text-sm sm:text-base transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-sm disabled:opacity-50"
          >
            {isSimplerLoading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin text-rose-600" />
                <span>{isTamil ? 'கரும்பலகை அழிக்கப்பட்டு எளிய விளக்கம் தயாரிப்பில்...' : 'Erasing board... preparing simpler explanation...'}</span>
              </>
            ) : (
              <>
                <HelpCircle className="h-5 w-5 text-rose-600" />
                <span>{isTamil ? 'புரியவில்லை, இன்னும் எளிமையா சொல்லுங்க (Not understood)' : 'Not understood'}</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          {isTamil
            ? '💡 "புரியவில்லை" என அழுத்தினால், கரும்பலகை அழிக்கப்பட்டு மிக எளிய உதாரணங்களுடன் மீண்டும் கற்பிக்கப்படும்.'
            : '💡 Clicking "Not understood" will erase the chalkboard and explain in a simpler way.'}
        </p>
      </div>

    </div>
  );
}
