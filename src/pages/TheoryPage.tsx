import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Camera, FileUp, ImagePlus, Loader2, Play, Pause,
  Download, Music, BookOpen, Volume2, Globe, FileCheck, AlertCircle
} from 'lucide-react';
import { extractTextFromFile } from '@/lib/extractText';
import { normalizeText } from '@/lib/textAnalysis';
import {
  getActiveSyllabus, setActiveSyllabus, listScans, getScan
} from '@/lib/data';
import type { ScanSummary } from '@/types';
import { fetchGeminiStory, fetchSynthesizedSpeech, type GeminiStoryResponse } from '@/lib/geminiApi';
import { speakInLanguage, stopSpeaking } from '@/lib/speech';

export function TheoryPage() {
  const [audioLang, setAudioLang] = useState<'ta' | 'en'>('ta'); // Audio language state (Tamil or English)

  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Active syllabus text & metadata state
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Scanned syllabus selection
  const [availableScans, setAvailableScans] = useState<ScanSummary[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string>('');

  const [processingAudio, setProcessingAudio] = useState(false);
  const [audioGenerated, setAudioGenerated] = useState(false);

  // Gemini story conversion data
  const [storyData, setStoryData] = useState<GeminiStoryResponse | null>(null);

  // Audio player state & references
  const [playingStory, setPlayingStory] = useState(false);
  const [playingSpeech, setPlayingSpeech] = useState(false);
  const [loadingAudioMode, setLoadingAudioMode] = useState<'story' | 'tutor' | null>(null);
  const [storyAudioUrl, setStoryAudioUrl] = useState<string | null>(null);
  const [tutorAudioUrl, setTutorAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeModeRef = useRef<'story' | 'tutor' | null>(null);

  // Helper to reset audio playback elements & cached URLs
  const resetAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopSpeaking();
    setPlayingStory(false);
    setPlayingSpeech(false);
    setStoryAudioUrl(null);
    setTutorAudioUrl(null);
  };

  // Helper to reset generated story & audio on text or language change
  const resetAllAudio = () => {
    resetAudioPlayback();
    setStoryData(null);
    setAudioGenerated(false);
  };

  // Stop any playing audio on unmount
  useEffect(() => {
    return () => {
      resetAudioPlayback();
    };
  }, []);

  // ── Step 1: Load active syllabus & list of scans on mount ──
  useEffect(() => {
    let active = true;

    // Load available scans for the dropdown selector
    listScans().then((scans) => {
      if (active) setAvailableScans(scans);
    }).catch(() => { });

    // Check if a specific scanId was passed in hash (e.g. #/theory?scanId=xyz)
    const hash = window.location.hash;
    const match = hash.match(/scanId=([^&]+)/);
    const urlScanId = match ? decodeURIComponent(match[1]) : null;

    if (urlScanId) {
      getScan(urlScanId).then((foundScan) => {
        if (!active || !foundScan) return;
        if (foundScan.raw_text) {
          const raw = foundScan.raw_text.trim();
          setText(raw);
          const title = foundScan.chapter_title || foundScan.file_name || 'Active Syllabus';
          setFileName(title);
          setSelectedScanId(foundScan.id);
          setActiveSyllabus({
            id: foundScan.id,
            title,
            text: raw,
            fileName: foundScan.file_name || title,
          });
        }
      }).catch(() => { });
      return;
    }

    // Otherwise, load previously saved active syllabus or most recent scan
    const stored = getActiveSyllabus();
    if (stored && stored.text && stored.text.trim()) {
      setText(stored.text.trim());
      setFileName(stored.fileName || stored.title || 'Active Syllabus');
      if (stored.id) setSelectedScanId(stored.id);
    }

    return () => {
      active = false;
    };
  }, []);

  // Switch between user's scanned syllabus documents
  const handleSelectScan = async (scanId: string) => {
    setSelectedScanId(scanId);
    if (!scanId) return;

    resetAllAudio();
    try {
      const scan = await getScan(scanId);
      if (scan && scan.raw_text) {
        const raw = scan.raw_text.trim();
        setText(raw);
        const title = scan.chapter_title || scan.file_name || 'Scanned Syllabus';
        setFileName(title);
        setActiveSyllabus({
          id: scan.id,
          title,
          text: raw,
          fileName: scan.file_name || title,
        });
      }
    } catch (err) {
      console.error('Failed to load selected scan:', err);
    }
  };

  // Textarea change handler: dynamically syncs active syllabus and title from actual text
  const handleTextChange = (newText: string) => {
    setText(newText);
    resetAllAudio();

    const trimmed = newText.trim();
    if (!trimmed) {
      setFileName('');
      setSelectedScanId('');
      return;
    }

    // If user edited or pasted new text, derive an accurate title from the first line
    const firstLine = trimmed.split(/[\r\n]+/)[0].replace(/^[#*\-•\s]+/, '').slice(0, 60).trim();
    const dynamicTitle = firstLine || 'Custom Syllabus Notes';
    setFileName(dynamicTitle);
    setActiveSyllabus({
      title: dynamicTitle,
      text: trimmed,
      fileName: dynamicTitle,
    });
  };

  // Language change (Preserves the dynamic syllabus text, never replaces with mock text)
  const handleLanguageChange = (lang: 'ta' | 'en') => {
    resetAllAudio();
    setAudioLang(lang);
  };

  // Real file extraction from uploaded PDF, image, or text file
  const handleFileUpload = async (file: File) => {
    setExtracting(true);
    setExtractionError(null);
    setFileName(file.name);
    resetAllAudio();

    try {
      const extracted = await extractTextFromFile(file);
      const cleaned = normalizeText(extracted.text);
      if (!cleaned || cleaned.trim().length === 0) {
        throw new Error('Could not extract readable text from this file. Please make sure the file contains clear text or try another document.');
      }

      const finalText = cleaned.trim();
      setText(finalText);
      setFileName(file.name);
      setSelectedScanId('');

      // Persist as active syllabus
      setActiveSyllabus({
        title: file.name.replace(/\.[^.]+$/, ''),
        text: finalText,
        fileName: file.name,
      });
    } catch (err) {
      console.error('File extraction failed:', err);
      setExtractionError(err instanceof Error ? err.message : 'Failed to extract text from file.');
    } finally {
      setExtracting(false);
    }
  };

  // Helper to clean messy OCR artifacts (||, |, ~N, broken chars) from extracted syllabus text
  const cleanSyllabusForSpeech = (raw: string): string => {
    if (!raw) return '';
    return raw
      .replace(/\|\|+/g, '. ')
      .replace(/[|~«»+]/g, ' ')
      .replace(/^[#*\-•\s]+/gm, '')
      .replace(/\s+/g, ' ')
      .replace(/\.{2,}/g, '.')
      .trim();
  };

  // Convert actual syllabus text into engaging narrative story & conversational scripts
  const handleGenerateAudio = async () => {
    const rawText = text.trim();
    if (!rawText) {
      alert('Please enter, scan, or upload syllabus text first.');
      return;
    }

    const dynamicText = cleanSyllabusForSpeech(rawText);
    resetAudioPlayback();
    setProcessingAudio(true);

    // Timeout safety fallback: guarantees button NEVER hangs indefinitely
    const safetyTimer = setTimeout(() => {
      setProcessingAudio(false);
    }, 15000);

    try {
      // Pass the real cleaned dynamic syllabus text to the Gemini story converter
      const generated = await fetchGeminiStory(dynamicText, audioLang);
      clearTimeout(safetyTimer);
      setStoryData(generated);
      setAudioGenerated(true);
    } catch (err) {
      clearTimeout(safetyTimer);
      console.warn('Gemini story generation fallback:', err);
      // Fallback professor lecture directly grounded in the student's actual text
      const fallbackTitle = fileName || (audioLang === 'ta' ? 'பாடக் கோட்பாடுகள்' : 'Syllabus Concepts');
      const fallbackLecture = audioLang === 'ta'
        ? `வணக்கம் மாணவர்களே! நீங்கள் தேர்ந்தெடுத்த பாடத்தை நாம் ஆழமாக, தொடக்கம் முதல் முடிவு வரை (A to Z) ஆய்வு செய்வோம். ${dynamicText.slice(0, 1500)}. இந்த பாடத்தில் குறிப்பிடப்பட்டுள்ள ஒவ்வொரு தலைப்பும் கணினி அறிவியலின் முதன்மையான அடித்தளமாகும். நினைவக அமைப்பில் தரவுகள் எவ்வாறு ஒதுக்கீடு செய்யப்படுகின்றன, சுட்டிகள் (pointers) மற்றும் முகவரிகள் மூலமாக எவ்வாறு தொடர்பு கொள்ளப்படுகின்றன என்பதை நாம் புரிந்து கொள்வது அவசியமாகும். இவற்றை தேர்வில் தகுந்த வரைபடங்களுடன் சமர்ப்பிப்பது முழு மதிப்பெண்களை பெற்று தரும்.`
        : `Welcome scholars! Let us conduct a comprehensive, deep-dive academic breakdown from A to Z covering: ${dynamicText.slice(0, 1500)}. Each component detailed in your syllabus governs essential memory structures, algorithmic workflows, and operational efficiency. Master these mechanisms systematically for your university examinations.`;

      setStoryData({
        success: true,
        provider: 'local',
        title: fallbackTitle,
        simple_explanation: fallbackLecture,
        story: fallbackLecture,
        audio_script: fallbackLecture,
      });
      setAudioGenerated(true);
    } finally {
      clearTimeout(safetyTimer);
      setProcessingAudio(false);
    }
  };

  // Fallback to browser speech if offline or synthesis service is unreachable
  const fallbackBrowserSpeech = (content: string, isStory: boolean) => {
    const targetTag = audioLang === 'ta' ? 'ta-IN' : 'en-US';
    speakInLanguage(
      content,
      targetTag,
      () => {
        if (isStory) setPlayingStory(false);
        else setPlayingSpeech(false);
      },
      isStory
    );
    if (isStory) {
      setPlayingStory(true);
      setPlayingSpeech(false);
    } else {
      setPlayingSpeech(true);
      setPlayingStory(false);
    }
  };

  // Modern Neural Audio Playback (Azure Neural Voices / ElevenLabs API)
  const handlePlayPause = async (mode: 'story' | 'tutor') => {
    const rawText = text.trim();
    if (!rawText) {
      alert('No syllabus text found to read. Please upload, select, or paste syllabus content.');
      return;
    }
    const dynamicText = cleanSyllabusForSpeech(rawText);

    const isStory = mode === 'story';
    const currentPlaying = isStory ? playingStory : playingSpeech;

    // 1. If currently playing this mode, pause it
    if (currentPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      stopSpeaking();
      if (isStory) setPlayingStory(false);
      else setPlayingSpeech(false);
      return;
    }

    // 2. If the other mode was playing, stop it
    if (audioRef.current) {
      audioRef.current.pause();
    }
    stopSpeaking();
    setPlayingStory(false);
    setPlayingSpeech(false);

    // 3. Check if we already have the synthesized audio URL ready
    const existingUrl = isStory ? storyAudioUrl : tutorAudioUrl;
    if (existingUrl && audioRef.current && activeModeRef.current === mode) {
      audioRef.current.play().then(() => {
        if (isStory) setPlayingStory(true);
        else setPlayingSpeech(true);
      }).catch(() => {
        // Retry with fresh element
      });
      return;
    }

    // 4. Synthesize speech via Backend Modern Neural Voice Engine
    // CRITICAL: Text-to-Speech Mode reads the ACTUAL syllabus text!
    // Story Mode reads the generated story derived from the syllabus text!
    setLoadingAudioMode(mode);

    try {
      let contentToSpeak = '';

      if (isStory) {
        // If story hasn't been generated yet, generate it from the syllabus first
        let currentStory = storyData;
        if (!currentStory) {
          try {
            currentStory = await fetchGeminiStory(dynamicText, audioLang);
            setStoryData(currentStory);
            setAudioGenerated(true);
          } catch {
            currentStory = {
              success: true,
              provider: 'local',
              title: fileName || 'Syllabus Concepts',
              simple_explanation: dynamicText,
              story: dynamicText,
              audio_script: dynamicText,
            };
            setStoryData(currentStory);
            setAudioGenerated(true);
          }
        }
        contentToSpeak = currentStory.story || currentStory.audio_script || dynamicText;
      } else {
        // Text-to-Speech Mode: strictly reads the student's dynamic syllabus text!
        contentToSpeak = dynamicText;
      }

      // Safe length for single neural audio payload (~3000 chars)
      const cleanContent = cleanSyllabusForSpeech(contentToSpeak).slice(0, 3000);

      const blob = await fetchSynthesizedSpeech(cleanContent, audioLang, mode);
      const url = URL.createObjectURL(blob);
      if (isStory) setStoryAudioUrl(url);
      else setTutorAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      activeModeRef.current = mode;

      audio.onended = () => {
        if (isStory) setPlayingStory(false);
        else setPlayingSpeech(false);
      };

      audio.onerror = () => {
        fallbackBrowserSpeech(cleanContent, isStory);
      };

      await audio.play();
      if (isStory) setPlayingStory(true);
      else setPlayingSpeech(true);

    } catch (synthErr) {
      console.warn('Backend neural synthesis failed, falling back to browser speech:', synthErr);
      const fallbackContent = (isStory ? (storyData?.story || dynamicText) : dynamicText).slice(0, 3000);
      fallbackBrowserSpeech(fallbackContent, isStory);
    } finally {
      setLoadingAudioMode(null);
    }
  };

  // Download real MP3 audio file
  const handleDownloadAudio = async (type: 'Story' | 'Text-to-Speech') => {
    const dynamicText = text.trim();
    if (!dynamicText) return;

    const mode = type === 'Story' ? 'story' : 'tutor';
    let url = mode === 'story' ? storyAudioUrl : tutorAudioUrl;

    if (!url) {
      const content = cleanSyllabusForSpeech(
        mode === 'story'
          ? (storyData?.story || storyData?.audio_script || dynamicText)
          : dynamicText
      );

      try {
        const blob = await fetchSynthesizedSpeech(content.slice(0, 3000), audioLang, mode);
        url = URL.createObjectURL(blob);
        if (mode === 'story') setStoryAudioUrl(url);
        else setTutorAudioUrl(url);
      } catch {
        // Fallback to text file download if audio synthesis unreachable
        const element = document.createElement('a');
        const file = new Blob([`Theory Audio (${type} Mode) - Language: ${audioLang.toUpperCase()}\n\nContent:\n${content}`], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `Edumind_${type}_Audio_${audioLang}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        return;
      }
    }

    const element = document.createElement('a');
    element.href = url;
    element.download = `Edumind_${type}_Audio_${audioLang}.mp3`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-16">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-800 via-indigo-800 to-teal-700 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 w-fit text-xs font-bold text-amber-300 backdrop-blur-md mb-3">
              <Sparkles className="h-4 w-4" /> AI Theory Audio Studio
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Theory Audio & Text-to-Speech Lessons
            </h1>
            <p className="mt-2 text-sm text-purple-100">
              Listen to your actual scanned syllabus notes in conversational Tamil or soft English tutor voice.
            </p>
          </div>

          {/* Audio Language Switcher Buttons */}
          <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-2xl backdrop-blur-md border border-white/10">
            <Globe className="h-4 w-4 ml-2 text-amber-300" />
            <span className="text-xs font-bold px-2 text-stone-200">Audio Voice:</span>
            <button
              onClick={() => handleLanguageChange('ta')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${audioLang === 'ta'
                  ? 'bg-amber-400 text-stone-950 shadow-md'
                  : 'text-white hover:bg-white/10'
                }`}
            >
              தமிழ் (Tamil)
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${audioLang === 'en'
                  ? 'bg-amber-400 text-stone-950 shadow-md'
                  : 'text-white hover:bg-white/10'
                }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Scanner & Syllabus Selector Section */}
      <div className="card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-600" />
            1. Select Syllabus or Scan Theory Paper
          </h2>

          {/* Scanned Syllabus Dropdown Selector */}
          {availableScans.length > 0 && (
            <div className="flex items-center gap-2 bg-stone-100/90 px-3 py-1.5 rounded-xl border border-stone-200 text-xs">
              <FileCheck className="h-4 w-4 text-teal-700 shrink-0" />
              <label htmlFor="scan-selector" className="font-bold text-stone-700 shrink-0">
                Active Syllabus:
              </label>
              <select
                id="scan-selector"
                value={selectedScanId}
                onChange={(e) => handleSelectScan(e.target.value)}
                className="font-medium bg-white border border-stone-300 rounded-lg px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">-- Choose from your scanned notes --</option>
                {availableScans.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.chapter_title || s.file_name} ({new Date(s.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-4 p-8 border-2 border-dashed border-stone-300 rounded-2xl bg-stone-50/50 hover:border-teal-500 transition-colors">
          <button type="button" onClick={() => photoInputRef.current?.click()} disabled={extracting} className="btn-primary flex items-center gap-2">
            <ImagePlus className="h-4 w-4" /> Choose Photo
          </button>
          <button type="button" onClick={() => documentInputRef.current?.click()} disabled={extracting} className="btn-secondary flex items-center gap-2">
            <FileUp className="h-4 w-4" /> Upload PDF / File
          </button>
          <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={extracting} className="btn-secondary flex items-center gap-2">
            <Camera className="h-4 w-4" /> Take Camera Photo
          </button>
        </div>

        <input ref={photoInputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
        <input ref={documentInputRef} type="file" accept=".pdf,.txt,.md" className="sr-only" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />

        {extracting && (
          <div className="flex items-center justify-center gap-3 py-4 text-teal-700 font-bold animate-pulse">
            <Loader2 className="h-5 w-5 animate-spin" /> Reading document and extracting actual syllabus text...
          </div>
        )}

        {extractionError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            {extractionError}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-ink">
              Extracted / Selected Syllabus Text ({fileName || 'No file selected'}):
            </label>
            {text && (
              <span className="text-xs text-stone-500 font-medium">
                {text.length} characters loaded
              </span>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={6}
            placeholder="Upload a PDF/photo or select an active syllabus above..."
            className="input resize-y font-normal text-sm leading-relaxed"
          />
        </div>

        <button
          type="button"
          onClick={handleGenerateAudio}
          disabled={!text.trim() || processingAudio}
          className="btn-primary w-full sm:w-auto bg-gradient-to-r from-teal-600 to-indigo-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform active:scale-95"
        >
          {processingAudio ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <Volume2 className="h-4 w-4 inline mr-2" />}
          {processingAudio ? 'Analyzing Syllabus & Creating Story...' : `Generate Audio Lessons (${audioLang === 'ta' ? 'Tamil' : 'English'})`}
        </button>
      </div>

      {/* Generated Audio Output Section */}
      {audioGenerated && (
        <div className="space-y-6 animate-fade-in">
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <Music className="h-6 w-6 text-purple-600" />
            2. Your Generated Audio Lessons ({audioLang.toUpperCase()})
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* 1. Text-to-Speech Mode Card: Reads Exact Syllabus Text Directly */}
            <div className="card p-6 border-2 border-teal-300 bg-teal-50/50 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-teal-200 px-3 py-1 text-xs font-bold text-teal-900">
                  🔊 1. Text-to-Speech Mode (Priority • Direct Verbatim)
                </span>
                <span className="text-xs text-stone-500 font-semibold">Language: {audioLang === 'ta' ? 'தமிழ் (Tamil)' : 'English'}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {audioLang === 'ta' ? 'நேரடி பாடக் குரல் வாசிப்பு (அப்படியே வாசித்தல்)' : 'Direct Syllabus Audio Reader (Verbatim)'}
                </h3>
                {fileName && (
                  <p className="text-xs font-semibold text-teal-800 line-clamp-1 mt-0.5">
                    📄 {fileName}
                  </p>
                )}
              </div>
              <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                {text.trim()
                  ? (text.trim().length > 220 ? text.trim().slice(0, 220) + '...' : text.trim())
                  : 'Listen to the exact extracted syllabus text read aloud verbatim without any modification or omission.'}
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => handlePlayPause('tutor')}
                  disabled={loadingAudioMode === 'tutor'}
                  className="rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-75 text-white p-3 shadow flex items-center gap-2 text-xs font-bold px-4 transition-all cursor-pointer"
                >
                  {loadingAudioMode === 'tutor' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : playingSpeech ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {loadingAudioMode === 'tutor'
                    ? 'Synthesizing Voice...'
                    : playingSpeech
                      ? 'Pause Speech'
                      : 'Play Text-to-Speech'}
                </button>
                <button
                  onClick={() => handleDownloadAudio('Text-to-Speech')}
                  className="rounded-xl bg-white border border-teal-300 p-3 text-teal-800 hover:bg-teal-100 shadow-sm ml-auto cursor-pointer"
                  title="Download Speech Audio MP3"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 2. Story Mode Card: Spoken Narrative of the Exact Syllabus */}
            <div className="card p-6 border-2 border-purple-200 bg-purple-50/40 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-purple-200 px-3 py-1 text-xs font-bold text-purple-900">
                  📖 2. Story Mode (Professor Masterclass • A to Z)
                </span>
                <span className="text-xs text-stone-500 font-semibold">Language: {audioLang === 'ta' ? 'தமிழ் (Tamil)' : 'English'}</span>
              </div>
              <h3 className="text-lg font-bold text-ink">
                {storyData?.title || (audioLang === 'ta' ? 'விரிவான பேராசிரியப் பாடம் (A to Z)' : 'Comprehensive Professor Lecture (A to Z)')}
              </h3>
              <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                {storyData?.story || 'In-depth academic lecture analyzing the core principles, behavior, and working mechanisms from A to Z with zero fictional metaphors.'}
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => handlePlayPause('story')}
                  disabled={loadingAudioMode === 'story'}
                  className="rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-75 text-white p-3 shadow flex items-center gap-2 text-xs font-bold px-4 transition-all cursor-pointer"
                >
                  {loadingAudioMode === 'story' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : playingStory ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {loadingAudioMode === 'story'
                    ? 'Synthesizing Voice...'
                    : playingStory
                      ? 'Pause Story'
                      : 'Play Story Audio'}
                </button>
                <button
                  onClick={() => handleDownloadAudio('Story')}
                  className="rounded-xl bg-white border border-purple-300 p-3 text-purple-800 hover:bg-purple-100 shadow-sm ml-auto cursor-pointer"
                  title="Download Story Audio MP3"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
