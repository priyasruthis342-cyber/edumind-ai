import React from 'react';
import { Mic, MicOff, Volume2, Sparkles, Square, Radio } from 'lucide-react';

export type VoiceAssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface LiveVoiceOrbProps {
  state: VoiceAssistantState;
  language: 'en' | 'ta';
  liveTranscript: string;
  activeSpokenText: string;
  onToggleListening: () => void;
  onStopSpeaking: () => void;
  onClose?: () => void;
}

export const LiveVoiceOrb: React.FC<LiveVoiceOrbProps> = ({
  state,
  language,
  liveTranscript,
  activeSpokenText,
  onToggleListening,
  onStopSpeaking,
}) => {
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-2xl border border-cyan-500/30">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-6">
        {/* Header Badge */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-400/30 text-cyan-300 text-xs font-bold tracking-wide backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>
            {language === 'ta'
              ? 'நேரலை குரல் உதவியாளர் (Live Voice)'
              : 'EduMind Live Voice Assistant'}
          </span>
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isListening ? 'bg-rose-400' : isSpeaking ? 'bg-cyan-400' : 'bg-emerald-400'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isListening ? 'bg-rose-500' : isSpeaking ? 'bg-cyan-500' : 'bg-emerald-500'}`} />
          </span>
        </div>

        {/* ── Dynamic Glowing Blue Orb & Visualizer ── */}
        <div className="relative flex items-center justify-center py-4">
          {/* Outer Ripple Rings for Listening */}
          {isListening && (
            <>
              <div
                className="absolute w-36 h-36 rounded-full border border-cyan-400/50"
                style={{ animation: 'rippleRing 2s cubic-bezier(0, 0.2, 0.8, 1) infinite' }}
              />
              <div
                className="absolute w-44 h-44 rounded-full border border-blue-400/40"
                style={{ animation: 'rippleRing 2s cubic-bezier(0, 0.2, 0.8, 1) infinite', animationDelay: '0.6s' }}
              />
              <div
                className="absolute w-52 h-52 rounded-full border border-sky-300/30"
                style={{ animation: 'rippleRing 2s cubic-bezier(0, 0.2, 0.8, 1) infinite', animationDelay: '1.2s' }}
              />
            </>
          )}

          {/* Orbiting Gyro Ring for Thinking */}
          {isThinking && (
            <div
              className="absolute w-40 h-40 rounded-full border-2 border-dashed border-cyan-400/70"
              style={{ animation: 'orbSpinSwirl 3s linear infinite' }}
            />
          )}

          {/* Central Luminescent Blue Orb */}
          <button
            type="button"
            onClick={onToggleListening}
            title={isListening ? 'Tap to finish speaking' : 'Tap to speak'}
            className={`relative group h-32 w-32 sm:h-36 sm:w-36 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 transform active:scale-95 focus:outline-none ${
              isListening
                ? 'orb-listening bg-[radial-gradient(circle_at_35%_35%,#38bdf8,#0284c7_50%,#0369a1_80%,#082f49)]'
                : isSpeaking
                ? 'orb-speaking bg-[radial-gradient(circle_at_35%_35%,#67e8f9,#0ea5e9_45%,#2563eb_80%,#1e1b4b)]'
                : isThinking
                ? 'orb-thinking bg-[radial-gradient(circle_at_35%_35%,#93c5fd,#3b82f6_50%,#4338ca_85%,#1e1b4b)]'
                : 'orb-idle bg-[radial-gradient(circle_at_35%_35%,#38bdf8,#2563eb_55%,#1d4ed8_80%,#0f172a)] hover:brightness-110'
            }`}
          >
            {/* Inner Glare / Specular Highlight */}
            <div className="absolute top-3 left-6 w-10 h-6 bg-white/40 rounded-full blur-xs rotate-[-25deg]" />

            {/* Central Icon / Waveform */}
            <div className="relative z-10 flex flex-col items-center justify-center text-white drop-shadow-md">
              {isListening ? (
                <div className="flex flex-col items-center gap-1">
                  <Mic className="h-9 w-9 text-white animate-pulse" />
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-cyan-200">
                    Listening
                  </span>
                </div>
              ) : isSpeaking ? (
                <div className="flex flex-col items-center gap-1.5">
                  <Volume2 className="h-8 w-8 text-cyan-200 animate-bounce" />
                  {/* Dynamic 5-bar Sound Wave Visualizer */}
                  <div className="flex items-center gap-1 h-6">
                    <span className="w-1 bg-cyan-200 rounded-full" style={{ animation: 'soundWaveBar 0.9s ease-in-out infinite', animationDelay: '0.1s' }} />
                    <span className="w-1 bg-cyan-100 rounded-full" style={{ animation: 'soundWaveBar 0.8s ease-in-out infinite', animationDelay: '0.3s' }} />
                    <span className="w-1.5 bg-white rounded-full" style={{ animation: 'soundWaveBar 0.7s ease-in-out infinite', animationDelay: '0.15s' }} />
                    <span className="w-1 bg-cyan-100 rounded-full" style={{ animation: 'soundWaveBar 0.85s ease-in-out infinite', animationDelay: '0.4s' }} />
                    <span className="w-1 bg-cyan-200 rounded-full" style={{ animation: 'soundWaveBar 0.95s ease-in-out infinite', animationDelay: '0.2s' }} />
                  </div>
                </div>
              ) : isThinking ? (
                <div className="flex flex-col items-center gap-1">
                  <Radio className="h-8 w-8 text-cyan-200 animate-spin" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-200">
                    Thinking
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Mic className="h-9 w-9 text-cyan-100 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-200">
                    {language === 'ta' ? 'பேச தட்டவும்' : 'Tap to Speak'}
                  </span>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* ── Status Text & Live Synchronized Display ── */}
        <div className="w-full max-w-lg space-y-3">
          {/* Status Headline */}
          <p className="text-sm sm:text-base font-semibold text-cyan-200">
            {isListening
              ? language === 'ta'
                ? '🎙️ நீங்கள் பேசுவதைக் கேட்கிறேன்... (பேசி முடித்ததும் நிறுத்துங்கள்)'
                : '🎙️ Listening to you in real-time... Speak your question clearly'
              : isThinking
              ? language === 'ta'
                ? '⚡ உங்கள் வினாவை ஆராய்கிறேன்...'
                : '⚡ Analyzing syllabus and crafting your answer...'
              : isSpeaking
              ? language === 'ta'
                ? '🔊 பதிலைப் பேசுகிறேன்...'
                : '🔊 Speaking response synchronized with text below...'
              : language === 'ta'
              ? 'நீல நிற உருண்டையை தட்டவும் அல்லது பேசத் தொடங்கவும்.'
              : 'Tap the glowing blue orb to ask questions via live voice.'}
          </p>

          {/* Live User Voice Transcript (STT) */}
          {liveTranscript && (
            <div className="rounded-2xl bg-cyan-950/40 border border-cyan-500/30 p-3.5 backdrop-blur-md">
              <span className="text-[11px] font-bold text-cyan-400 block mb-1 uppercase tracking-wider">
                {language === 'ta' ? 'நீங்கள் பேசியது (Live Voice Input):' : 'Your Live Speech:'}
              </span>
              <p className="text-sm font-medium text-white italic">
                "{liveTranscript}"
              </p>
            </div>
          )}

          {/* Synchronized Live Spoken AI Text (TTS) */}
          {isSpeaking && activeSpokenText && (
            <div className="rounded-2xl bg-indigo-950/50 border border-indigo-400/40 p-4 shadow-lg backdrop-blur-md animate-fade-up">
              <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-1.5 pb-1 border-b border-indigo-800/60">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                  Synchronized Spoken Output
                </span>
                <span className="text-cyan-400/80 text-[10px]">Live Audio</span>
              </div>
              <p className="text-xs sm:text-sm text-cyan-100 font-medium leading-relaxed">
                {activeSpokenText}
              </p>
            </div>
          )}
        </div>

        {/* ── Interactive Voice Controls ── */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {isListening ? (
            <button
              type="button"
              onClick={onToggleListening}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer"
            >
              <MicOff className="h-4 w-4" />
              <span>{language === 'ta' ? 'பேசி முடித்தேன் (Send)' : 'Done Speaking (Submit)'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleListening}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold px-5 py-2.5 text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Mic className="h-4 w-4 text-slate-950" />
              <span>{language === 'ta' ? 'குரல் மூலம் கேள்' : 'Ask with Voice'}</span>
            </button>
          )}

          {isSpeaking && (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-md transition-all cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-cyan-300" />
              <span>{language === 'ta' ? 'குரலை நிறுத்து' : 'Stop Audio'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
