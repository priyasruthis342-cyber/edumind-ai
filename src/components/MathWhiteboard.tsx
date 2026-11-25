import React, { useState, useEffect, useRef } from 'react';
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
  Volume2
} from 'lucide-react';
import type { MathSolveResponse, MathSolveStep } from '@/lib/geminiApi';

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
    <div className={`whitespace-pre-wrap ${className}`}>
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
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isErasing, setIsErasing] = useState<boolean>(false);
  const [understoodState, setUnderstoodState] = useState<boolean | null>(null);

  // Handwriting typewriter state for current step board
  const [displayedBoardText, setDisplayedBoardText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typewriterTimerRef = useRef<NodeJS.Timeout | null>(null);

  const steps = lesson.steps || [];
  const totalSteps = steps.length;
  const isTamil = language === 'ta';

  // Step typing animation
  useEffect(() => {
    if (!steps[currentStep]) {
      setDisplayedBoardText('');
      return;
    }

    const fullText = steps[currentStep].board || '';
    setDisplayedBoardText('');
    setIsTyping(true);

    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
    }

    let charIndex = 0;
    // Fast typewriter step
    const interval = Math.max(15, Math.min(35, Math.floor(1200 / (fullText.length || 1))));
    
    typewriterTimerRef.current = setInterval(() => {
      charIndex += 2; // two chars per tick for smooth writing feel
      if (charIndex >= fullText.length) {
        setDisplayedBoardText(fullText);
        setIsTyping(false);
        if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
      } else {
        setDisplayedBoardText(fullText.slice(0, charIndex));
      }
    }, interval);

    return () => {
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
    };
  }, [currentStep, lesson]);

  const handleNextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleNotUnderstoodClick = () => {
    // Trigger blackboard eraser animation
    setIsErasing(true);
    setUnderstoodState(false);
    setTimeout(() => {
      setIsErasing(false);
      if (onNotUnderstood) {
        onNotUnderstood();
      }
    }, 1200);
  };

  const handleUnderstoodClick = () => {
    setUnderstoodState(true);
    if (onUnderstood) {
      onUnderstood();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Teacher Intro Banner */}
      {lesson.intro && (
        <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border border-emerald-200/80 shadow-sm text-slate-800">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 font-sans">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              {isTamil ? 'கணித ஆசிரியை:' : 'AI Maths Teacher:'}
            </span>
            <p className="text-sm sm:text-base font-medium leading-relaxed font-sans text-slate-900">
              {lesson.intro}
            </p>
          </div>
        </div>
      )}

      {/* Classroom Greenboard Frame */}
      <div className="relative rounded-3xl p-3 sm:p-4 bg-gradient-to-b from-[#8B5A2B] via-[#654321] to-[#4A2F17] shadow-2xl border-4 border-[#5c3a1e]">
        
        {/* Board Screws / Top Trim */}
        <div className="flex items-center justify-between px-3 pb-2 text-[#d2b48c] text-[11px] font-mono select-none">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#3e2714] inline-block shadow-inner"></span>
            {isTamil ? 'கரும்பலகை கற்பித்தல்' : 'Classroom Chalkboard'}
          </span>
          <span className="font-bold tracking-widest uppercase">
            {isTamil ? `படி ${currentStep + 1} / ${totalSteps || 1}` : `Step ${currentStep + 1} of ${totalSteps || 1}`}
          </span>
          <span className="h-2 w-2 rounded-full bg-[#3e2714] inline-block shadow-inner"></span>
        </div>

        {/* Chalkboard Slate Area */}
        <div className="relative min-h-[320px] sm:min-h-[380px] rounded-2xl p-5 sm:p-7 bg-gradient-to-b from-[#0c2417] via-[#0d281a] to-[#071910] text-[#fffdf0] shadow-inner overflow-hidden border border-emerald-950/80">
          
          {/* Subtle chalk dust noise overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

          {/* ERASER ANIMATION WIPE */}
          {isErasing && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-700 animate-out fade-out">
              <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-amber-950/90 border border-amber-500/60 shadow-2xl animate-bounce">
                <span className="text-3xl">🧹</span>
                <span className="text-amber-200 font-bold font-sans text-sm sm:text-base">
                  {isTamil ? 'கரும்பலகையை அழிக்கிறோம்... எளிய விளக்கம் தயார்!' : 'Erasing board... preparing simpler explanation!'}
                </span>
              </div>
            </div>
          )}

          {/* Chalkboard Content Area */}
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[290px] space-y-4">
            
            {/* Step Heading */}
            <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
              <span className="text-amber-300 font-bold font-serif text-sm sm:text-base tracking-wide flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-400" />
                {isTamil ? `படி ${currentStep + 1}: தீர்வு முறை` : `Step ${currentStep + 1}: Mathematical Working`}
              </span>
              <span className="text-xs text-emerald-300/80 font-mono">
                {isTyping ? (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
                    {isTamil ? 'எழுதுகிறது...' : 'Writing...'}
                  </span>
                ) : (
                  <span>✓ {isTamil ? 'எழுதியாச்சு' : 'Written'}</span>
                )}
              </span>
            </div>

            {/* Handwriting Board Chalk Text (Caveat / Patrick Hand) */}
            <div className="flex-1 py-3 font-['Caveat',_'Patrick_Hand',_cursive] text-2xl sm:text-3xl tracking-wide text-amber-100 leading-relaxed overflow-x-auto">
              <RenderMathText text={displayedBoardText || steps[currentStep]?.board || ''} />
              {isTyping && (
                <span className="inline-block h-6 w-2 bg-amber-300 ml-1.5 animate-pulse align-middle"></span>
              )}
            </div>

            {/* Final Answer Banner (If on last step or finalAnswer exists) */}
            {currentStep === totalSteps - 1 && lesson.finalAnswer && (
              <div className="mt-4 p-3.5 sm:p-4 rounded-xl border-2 border-dashed border-amber-400 bg-amber-950/40 text-center animate-in fade-in slide-in-from-bottom-2">
                <span className="text-xs uppercase font-serif font-extrabold tracking-wider text-amber-300 block mb-1">
                  🎯 {isTamil ? 'இறுதி விடை (FINAL ANSWER):' : 'FINAL ANSWER:'}
                </span>
                <div className="text-xl sm:text-2xl font-black font-['Caveat',_cursive] text-white">
                  <RenderMathText text={lesson.finalAnswer} />
                </div>
              </div>
            )}

            {/* Chalkboard Chalk Tray / Navigation Controls */}
            <div className="pt-3 border-t border-emerald-800/60 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={currentStep === 0 || isTyping}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-950/90 text-emerald-200 border border-emerald-700/60 hover:bg-emerald-900/80 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-sans transition-all active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{isTamil ? 'முந்தைய படி' : 'Previous'}</span>
              </button>

              <div className="flex items-center gap-1.5">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    className={`h-2.5 rounded-full transition-all cursor-pointer ${
                      idx === currentStep ? 'w-6 bg-amber-400' : 'w-2.5 bg-emerald-700/60 hover:bg-emerald-600'
                    }`}
                    title={`Go to step ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleNextStep}
                disabled={currentStep >= totalSteps - 1 || isTyping}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-sans transition-all active:scale-95"
              >
                <span>{isTamil ? 'அடுத்த படி' : 'Next Step'}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
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

      {/* Teacher's Spoken Explanation Box Below Board */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-amber-700 shrink-0" />
          <h4 className="font-bold text-amber-950 text-xs sm:text-sm uppercase tracking-wide">
            {isTamil ? `படி ${currentStep + 1} - ஆசிரியையின் எளிய விளக்கம்:` : `Teacher's Spoken Explanation for Step ${currentStep + 1}:`}
          </h4>
        </div>
        <p className="text-sm sm:text-base text-slate-800 font-sans leading-relaxed pl-6">
          {steps[currentStep]?.explanation || (isTamil ? 'கணக்கை கவனமாகப் பார்த்து தீர்வு முறையை புரிந்து கொள்ளுங்கள்.' : 'Follow the step carefully on the board.')}
        </p>
      </div>

      {/* Understood / Not Understood Action Buttons (Shown after final answer or throughout) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-center space-y-3">
        <p className="text-sm sm:text-base font-bold text-slate-800">
          {isTamil ? 'மாணவர்களே, இந்த கணக்கு உங்களுக்குப் புரிந்ததா? (Did you understand?)' : 'Did you understand the solution?'}
        </p>

        {understoodState === true && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold flex items-center justify-center gap-2 animate-in zoom-in-95">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span>{isTamil ? 'அருமை! நீங்கள் நன்றாக புரிந்து கொண்டீர்கள். தொடர்ந்து பயிற்சி செய்யுங்கள்!' : 'Awesome! Great job understanding this problem. Keep up the great work!'}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleUnderstoodClick}
            className={`py-3 px-6 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center gap-2 cursor-pointer shadow-md ${
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
            className="py-3 px-6 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 font-bold text-sm sm:text-base transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-sm disabled:opacity-50"
          >
            {isSimplerLoading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin text-rose-600" />
                <span>{isTamil ? 'எளிய விளக்கம் தயாரிப்பில்...' : 'Preparing simpler explanation...'}</span>
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
            : '💡 Clicking "Not understood" will erase the board and re-explain in a simpler way with an easy example.'}
        </p>
      </div>

    </div>
  );
}
