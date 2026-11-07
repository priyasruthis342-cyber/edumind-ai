// ─────────────────────────────────────────────────────────────
// geminiRoutes.js — Google Gemini AI Router for EduMind
// Powered by @google/genai SDK
// Anna University Exam Standard + Natural Spoken Tamil Engine
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const Groq = require('groq-sdk');

let groqClient = null;
if (process.env.GROQ_API_KEY) {
  try {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  } catch (e) {
    console.warn('Groq client init warning:', e.message);
  }
}

let MsEdgeTTS, OUTPUT_FORMAT;
try {
  const edgeTts = require('msedge-tts');
  MsEdgeTTS = edgeTts.MsEdgeTTS;
  OUTPUT_FORMAT = edgeTts.OUTPUT_FORMAT;
} catch (e) {
  console.warn('msedge-tts module not loaded:', e.message);
}

let aiClient = null;
function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({ apiKey: key });
    } catch (e) {
      console.warn('GoogleGenAI initialization warning:', e.message);
      return null;
    }
  }
  return aiClient;
}

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',  // Primary: super fast (~2s) & healthy quota
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash'
];

/**
 * Promise timeout safety wrapper
 */
function withTimeout(promise, ms = 8000, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}

/**
 * Cleans messy OCR artifacts (||, |, «, », ~N, excessive punctuation)
 */
function cleanOcrArtifacts(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/\|\|+/g, '. ')
    .replace(/[|~«»+]/g, ' ')
    .replace(/^[#*\-•\s]+/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .trim();
}

/**
 * Resilient helper to call Gemini with multi-model cascade, timeout & Groq fallback
 */
async function generateWithGemini(contents, systemInstruction, mimeType = 'application/json') {
  const config = {
    ...(mimeType ? { responseMimeType: mimeType } : {}),
    ...(systemInstruction ? { systemInstruction } : {})
  };
  let lastError = null;

  // 1. Try Gemini candidate models with 12-second timeout per model
  const client = getGeminiClient();
  if (client) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await withTimeout(
          client.models.generateContent({
            model,
            contents,
            config
          }),
          12000,
          `Gemini (${model})`
        );
        if (response && response.text) {
          return response.text;
        }
      } catch (err) {
        console.warn(`Model ${model} unavailable (${err.message}). Trying next candidate...`);
        lastError = err;
      }
    }
  }

  // 2. High-speed Groq fallback (openai/gpt-oss-120b) if Gemini is rate limited or unavailable
  if (groqClient) {
    try {
      console.log('⚡ Gemini busy/rate-limited. Switching to Groq openai/gpt-oss-120b fallback...');
      const groqPrompt = systemInstruction
        ? `${systemInstruction}\n\n${mimeType === 'application/json' ? 'Strict requirement: Output only a valid parseable JSON object matching the required schema.\n\n' : ''}${contents}`
        : contents;

      const completion = await withTimeout(
        groqClient.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: groqPrompt }],
          ...(mimeType === 'application/json' ? { response_format: { type: 'json_object' } } : {})
        }),
        14000,
        'Groq fallback'
      );
      const groqText = completion.choices[0]?.message?.content;
      if (groqText) {
        console.log('✅ Groq fallback generated response successfully!');
        return groqText;
      }
    } catch (groqErr) {
      console.warn('Groq fallback failed:', groqErr.message);
    }
  }

  throw lastError || new Error('All AI models are temporarily busy. Please retry.');
}

/**
 * Robust JSON parser that repairs unescaped multi-line code blocks and strings
 */
function fixJsonString(str) {
  let inString = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prev = i > 0 ? str[i - 1] : '';
    if (char === '"' && prev !== '\\') {
      inString = !inString;
      result += char;
    } else if (inString && (char === '\n' || char === '\r')) {
      result += (char === '\n' ? '\\n' : '');
    } else {
      result += char;
    }
  }
  return result;
}

function safeParseJson(raw) {
  let cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    try {
      return JSON.parse(fixJsonString(cleaned));
    } catch (e2) {}

    try {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(fixJsonString(match[0]));
      }
    } catch (e3) {}

    throw e1;
  }
}

/**
 * POST /api/gemini/exam-qa
 * Analyzes syllabus/theory PDF text and generates 1-mark, 2-mark, 5-mark, and 12-mark
 * university exam-standard questions and in-depth answers (Anna University pattern).
 * Supports English ('en') and Natural Conversational Tamil ('ta').
 */
router.post('/exam-qa', async (req, res) => {
  try {
    const { prompt, language = 'en' } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'prompt is required and must be a non-empty string containing the PDF text.'
      });
    }

    const isTamil = language === 'ta';

    const langVoiceGuideline = isTamil
      ? `LANGUAGE REQUIREMENT: TAMIL (இயல்பான பேச்சுத் தமிழ் & தெளிவான கல்வித் தமிழ்)
- Use natural, modern conversational Tamil (இயல்பான தமிழ் நடை) that students easily understand.
- CRITICAL FOR VOICE / TTS: Do NOT use archaic, stiff, or obsolete literary words (avoid outdated words like 'இயற்றுக', 'பகர்க', 'ஆற்றுப்படுத்துக').
- Phrasing must flow naturally and rhythmically so browser Text-To-Speech (TTS) reads it smoothly without robotic glitches or awkward pronunciations.
- Keep standard technical terms clearly identifiable alongside Tamil (e.g., "CPU Scheduling (செயல்முறை திட்டமிடல்)", "Primary Memory (முதன்மை நினைவகம்)", "Polymorphism (பல்லுருவாக்கம்)").`
      : `LANGUAGE REQUIREMENT: ENGLISH
- Professional, clear, academic Indian University standard (Anna University / VTU / JNTU pattern).
- Crisp definitions, robust technical terminology, clear derivations, and structured bulleted explanations.`;

    const systemInstruction = `You are EduMind Gemini AI, a distinguished Anna University senior professor, chief examiner, and textbook author.
Analyze the provided study material / syllabus / theory PDF text thoroughly.
Generate an exhaustive exam question bank with detailed, high-scoring answers formatted exactly to university paper presentation standards.

${langVoiceGuideline}

STRICT ANNA UNIVERSITY EXAM PATTERN & ANSWER PRESENTATION GUIDELINES:
1. 2-MARK QUESTIONS (Part A standard):
   - Strict definition + 2-3 essential key points or formula with unit/example. No fluff.

2. 3-MARK QUESTIONS (Part A / B conceptual bridge):
   - Core definition + 3 distinct key points, characteristics, applications or short diagram note.

3. 8-MARK STRUCTURED ESSAY QUESTIONS (Part B University Standard):
   - Structured answer containing:
     * Highlighted Definition Box / Core Concept statement.
     * 4-6 detailed bullet points explaining the working mechanism or architectural principles.
     * Concrete real-world example and technical breakdown.
     * If technical/programming: include syntax and clean code snippet with output.
     * If theoretical/engineering: provide a clear [Diagram Description: ...] placeholder that students can easily draw in exams.

4. 12-MARK COMPREHENSIVE UNIVERSITY ESSAY QUESTIONS (Part C full 12/12 scoring model):
   - DO NOT provide brief summaries. Answers must be deeply comprehensive, multi-layered, and presentation-ready strictly following the 7-Part University Exam Sheet Standard:
     • Section 1: Introduction & Core Definition
       - Detailed academic background and a highlighted [DEFINITION BOX: ...] statement.
     • Section 2: Architectural Scope & Types/Categories (with definition for each type)
       - Exhaustive breakdown of all types/sub-categories. For EVERY type, provide a bold title, definition, and operating mechanism. Include a [Diagram Description: ...] placeholder.
     • Section 3: Concrete Example & Real-world Relevance
       - Concrete real-world industrial or commercial applications (e.g., Netflix streaming, Linux kernel, Google search, banking databases).
     • Section 4: Full Clean Programming Code (C++/Java/Python)
       - Complete, compilable, clean code implementation with descriptive comments.
     • Section 5: Exact Program Output
       - Exact terminal output produced by executing the program code.
     • Section 6: Numerical / Example Problem & Worked-out Solution (if applicable to topic)
       - Concrete problem statement with formula, parameter substitution, step-by-step mathematical/numerical calculation, and final result.
     • Section 7: Advantages, Disadvantages & Time/Space Complexity
       - Clear comparison of pros and cons, followed by formal Big-O Time Complexity (Best, Average, Worst) and Space Complexity.

OUTPUT FORMAT:
Return ONLY a valid, parseable JSON object without markdown fences or backticks.
Schema:
{
  "chapter_title": "Detected Title of Chapter or Subject",
  "summary": "Comprehensive 3-4 sentence overview of core concepts covered in the text.",
  "questions_2mark": [
    { "id": 1, "question": "...", "answer": "..." },
    { "id": 2, "question": "...", "answer": "..." },
    { "id": 3, "question": "...", "answer": "..." },
    { "id": 4, "question": "...", "answer": "..." },
    { "id": 5, "question": "...", "answer": "..." }
  ],
  "questions_3mark": [
    { "id": 1, "question": "...", "answer": "..." },
    { "id": 2, "question": "...", "answer": "..." },
    { "id": 3, "question": "...", "answer": "..." },
    { "id": 4, "question": "...", "answer": "..." }
  ],
  "questions_8mark": [
    { "id": 1, "question": "...", "answer": "..." },
    { "id": 2, "question": "...", "answer": "..." },
    { "id": 3, "question": "...", "answer": "..." },
    { "id": 4, "question": "...", "answer": "..." }
  ],
  "questions_12mark": [
    {
      "id": 1,
      "question": "Comprehensive 12-mark university exam essay question?",
      "answer": {
        "introduction": "1. Introduction & Core Definition: Detailed background and [DEFINITION BOX: ...] statement.",
        "architecture_types": "2. Architectural Scope & Types/Categories: Detailed breakdown with bold titles, definitions for each type, and [Diagram Description: System Architecture Flow].",
        "concrete_example": "3. Concrete Example & Real-world Relevance: Real-world industrial context and use-cases.",
        "program_code": "// 4. Full Clean Programming Code (Java/C++)\npublic class Solution {\n    // Code...\n}",
        "program_output": "5. Exact Program Output:\n[Execution Terminal Output]",
        "numerical_problem": "6. Numerical/Example Problem & Worked-out Solution: Problem statement, formula, calculation steps, and final result.",
        "tradeoffs_complexity": "7. Advantages, Disadvantages & Time/Space Complexity: Advantages, disadvantages, Time: O(...) and Space: O(...)"
      }
    }
  ]
}`;

    const rawText = await generateWithGemini(
      `Study Material / PDF Text:\n\n${prompt.trim()}`,
      systemInstruction
    );

    let parsed;
    try {
      parsed = safeParseJson(rawText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output. Raw text:', rawText);
      return res.status(500).json({
        success: false,
        message: 'Gemini generated content in an unparseable format. Please try again.',
        raw: rawText
      });
    }

    return res.status(200).json({
      success: true,
      provider: 'google-gemini',
      chapter_title: parsed.chapter_title || 'Syllabus & Theory Study',
      summary: parsed.summary || '',
      questions_2mark: parsed.questions_2mark || [],
      questions_3mark: parsed.questions_3mark || parsed.questions_1mark || [],
      questions_5mark: parsed.questions_8mark || parsed.questions_5mark || [],
      questions_8mark: parsed.questions_8mark || parsed.questions_5mark || [],
      questions_12mark: parsed.questions_12mark || []
    });

  } catch (err) {
    console.warn('Gemini Exam Q&A fallback to local university question generator:', err.message);
    const localData = generateLocalExamQA(req.body?.prompt || '', req.body?.language || 'en');
    return res.status(200).json({
      success: true,
      provider: 'local-resilient',
      ...localData
    });
  }
});

/**
 * Resilient fallback generator for Anna University Exam Q&A.
 * Guarantees zero 500 errors if cloud AI models hit quota limits.
 */
function generateLocalExamQA(prompt, language = 'en') {
  const isTamil = language === 'ta';
  const cleanPrompt = cleanOcrArtifacts(prompt);
  const segments = cleanPrompt
    .split(/[\r\n,;:\-]+/)
    .map(s => s.trim())
    .filter(s => s.length > 3 && !/^(page|unit|chapter|\d+)/i.test(s));

  const title = segments[0] || 'Syllabus & Course Study';
  const topic1 = segments[1] || segments[0] || 'Core Concepts';
  const topic2 = segments[2] || 'Key Architectural Principles';
  const topic3 = segments[3] || 'Practical Implementation';

  return {
    chapter_title: title,
    summary: isTamil
      ? `${title} பாடத்திட்டத்தின் முக்கியக் கருத்துக்கள், கொள்கைகள் மற்றும் தேர்வு வினா-விடைகள் கீழே விரிவாகக் கொடுக்கப்பட்டுள்ளன.`
      : `Comprehensive study breakdown of ${title}, covering essential definitions, core operational principles, and structured examination answers.`,
    questions_2mark: [
      {
        id: 1,
        question: isTamil ? `${topic1} என்றால் என்ன?` : `Define ${topic1}.`,
        answer: isTamil
          ? `${topic1} என்பது பாடத்திட்டத்தின் அடிப்படையான ஒரு முக்கிய கருத்தாகும். இது முறையான அமைப்பில் செயல்பட வடிவமைக்கப்பட்டுள்ளது.`
          : `${topic1} is a fundamental component designed to provide structured operations, deterministic memory allocation, and organized processing.`
      },
      {
        id: 2,
        question: isTamil ? `${topic2} என்பதன் முக்கியத்துவத்தைக் குறிப்பிடுக.` : `State the primary purpose of ${topic2}.`,
        answer: isTamil
          ? `${topic2} அமைப்பின் செயல்திறன் மற்றும் வளங்களின் பயன்பாட்டை உகந்ததாக்க உதவுகிறது.`
          : `${topic2} optimizes operational throughput, eliminates resource redundancy, and establishes clear algorithmic boundaries.`
      }
    ],
    questions_3mark: [
      {
        id: 1,
        question: isTamil ? `${topic1} என்பதன் மூன்று முக்கியப் பண்புகளை பட்டியலிடுக.` : `List three key characteristics of ${topic1}.`,
        answer: isTamil
          ? `1. நேரடி மற்றும் வேகமான அணுகல்.\n2. குறைந்த நினைவக விரயம்.\n3. எளிமையான பராமரிப்பு முறை.`
          : `1. Deterministic direct access and bounded execution time.\n2. Minimal memory overhead and structured boundaries.\n3. High modularity and maintainability.`
      },
      {
        id: 2,
        question: isTamil ? `${topic3} பயன்பாடுகளை விளக்குக.` : `Mention the key applications of ${topic3}.`,
        answer: isTamil
          ? `கணினி நினைவக மேலாண்மை, தரவுத் தேடல் அமைப்புகள் மற்றும் நிஜ உலக மென்பொருள் கட்டமைப்புகளில் பயன்படுகிறது.`
          : `Widely implemented in operating system memory management, real-time transaction processing, and enterprise data models.`
      }
    ],
    questions_8mark: [
      {
        id: 1,
        question: isTamil ? `${topic1} மற்றும் ${topic2} ஆகியவற்றின் கட்டமைப்பு, செயல்பாட்டு முறை மற்றும் பயன்பாடுகளை விவரிக்க (8 Marks).` : `Explain the architecture, working mechanism, and practical applications of ${topic1} and ${topic2} (8 Marks).`,
        answer: isTamil
          ? `[வரையறை பெட்டி: ${topic1}]\n- கட்டமைப்பு மற்றும் செயல்பாட்டுக் கோட்பாடு.\n- நினைவக அமைப்பு, சுட்டிகள் மற்றும் செயல்முறை வரிசை.\n- நிஜ உலக பயன்பாடுகள் மற்றும் நடைமுறை முக்கியத்துவம்.`
          : `[DEFINITION BOX: ${topic1}]\n- Architectural flow and foundational operational parameters.\n- Contiguous vs non-contiguous memory management tradeoffs.\n- Clean implementation syntax, error handling boundaries, and real-world industrial relevance.`
      }
    ],
    questions_5mark: [
      {
        id: 1,
        question: isTamil ? `${topic1} மற்றும் ${topic2} பற்றி விரிவாக வரைக.` : `Explain the working mechanism and principles of ${topic1}.`,
        answer: isTamil
          ? `[வரையறை பெட்டி: ${topic1}]\n- கட்டமைப்பு மற்றும் செயல்பாட்டுக் கோட்பாடு.\n- நினைவக அமைப்பு மற்றும் செயல்முறை வரிசை.\n- நன்மைகள் மற்றும் நடைமுறை முக்கியத்துவம்.`
          : `[DEFINITION BOX: ${topic1}]\n- Architectural flow and foundational operational parameters.\n- Contiguous vs non-contiguous memory management tradeoffs.\n- Implementation syntax, error handling, and performance metrics.`
      }
    ],
    questions_12mark: [
      {
        id: 1,
        question: isTamil
          ? `${title} - முழுமையான கட்டமைப்பு, செயல்பாட்டு முறை மற்றும் நிஜ உலக பயன்பாடுகளை விவரிக்க.`
          : `Discuss in detail the architecture, working mechanism, and practical applications of ${title}.`,
        answer: {
          // 7-Part Professional University Exam Sheet Structure
          introduction: isTamil
            ? `> **வரையறை பெட்டி (Definition Box):**\n> **${title}** என்பது முறையான வடிவமைப்பு, தரவு மேலாண்மை மற்றும் கட்டமைப்பு ரீதியான செயலாக்கத்தை வழங்கும் நவீன பொறியியலின் ஒரு முக்கிய கோட்பாடாகும்.\n\n${title} பல்கலைக்கழக தேர்வுகளில் கேட்கப்படும் ஒரு முதன்மையான வினாவாகும். இது அமைப்புகளின் நிலைத்தன்மை மற்றும் வேகத்தை உறுதி செய்கிறது.`
            : `> **DEFINITION BOX:**\n> **${title}** is an essential computational paradigm and structural framework designed to manage resources, organize state transitions, and guarantee formal execution correctness.\n\n${title} forms the bedrock of modern software and hardware systems, ensuring deterministic operations and optimal performance under real-world constraints.`,

          architecture_types: isTamil
            ? `**முக்கிய வகைகள் மற்றும் கட்டமைப்பு பிரிவுகள் (Types & Architecture):**\n- **நிலை 1: தொடக்க நிலை மற்றும் உள்ளீடு (Primitive / Sequential Phase):** தொடக்கத் தரவுகளை சேமித்து அடிப்படை செயலாக்கத்தை மேற்கொள்கிறது.\n- **நிலை 2: இடைநிலை இணைப்பு மற்றும் மாற்றங்கள் (Linked / Dynamic Phase):** சுட்டிகள் (pointers) மற்றும் நினைவக முகவரிகளைப் பயன்படுத்தி நெகிழ்வான இணைப்பை வழங்குகிறது.\n- **நிலை 3: சுழற்சி மற்றும் பல பரிமாண கட்டமைப்பு (Circular / Multi-Dimensional Phase):** வளைய அமைப்புகள் மற்றும் அணிவரிசைகளில் தரவுகளை ஒழுங்குபடுத்துகிறது.\n\n[Diagram Description: System Architecture Flowchart — Input Buffer -> Core Processing Engine -> State Cache -> Output Stream]`
            : `**Architectural Scope & Structural Categories (with Definitions):**\n- **1. Contiguous / Static Structure:** Memory is allocated in contiguous physical blocks with fixed boundaries, enabling deterministic O(1) indexed access.\n- **2. Dynamic / Pointer-Linked Structure:** Memory is allocated on-demand in heap blocks connected through reference pointers, eliminating resizing overhead.\n- **3. Recursive / Circular Variant:** The tail node cycles back to the origin, creating a seamless round-robin ring buffer without null terminators.\n\n[Diagram Description: Structural Architecture Diagram — Input Register -> Index Allocator -> Pointer Graph -> Output Terminal]`,

          concrete_example: isTamil
            ? `**நிஜ உலக பயன்பாடுகள் (Real-world Relevance):**\n1. **Google தேடுபொறி & தரவு அட்டவணைப்படுத்தல்:** இணைய பக்கங்களை விரைவாக வரிசைப்படுத்தவும் மீட்டெடுக்கவும் பயன்படுகிறது.\n2. **Linux ஆப்பரேட்டிங் சிஸ்டம்:** நினைவக ஒதுக்கீடு, செயல்முறை திட்டமிடல் (process scheduling) மற்றும் வன்பொருள் சாதன இயக்கிகளில் நேரடியாகப் பயன்படுகிறது.\n3. **Netflix & YouTube Streaming:** வீடியோ தரவுகளை இடையகத்தில் (buffer) சீராக ஏற்றி பிழையின்றி இயக்க உதவுகிறது.`
            : `**Concrete Example & Real-World Relevance:**\n1. **Cloud-Scale Streaming (Netflix / Spotify):** Circular ring buffers manage live audiovisual streaming packets, preventing jitter and buffer underruns.\n2. **Linux Kernel Task Scheduling:** Priority lists and runqueues manage millions of context switches per second across multicore processors.\n3. **Database Transaction Logs (PostgreSQL / SQLite):** Sequential and chained structures record write-ahead logs (WAL) to guarantee ACID compliance.`,

          program_code: `// 4. Full Clean Programming Code (Java / C++ Standard Implementation)\npublic class ExamSolution {\n    public static void main(String[] args) {\n        System.out.println("=== Demonstration of ${title} ===");\n        int[] dataset = {12, 24, 36, 48, 60};\n        \n        // Step-by-step processing\n        int sum = 0;\n        for (int value : dataset) {\n            sum += value;\n            System.out.println("Processed Element: " + value + " | Running Total: " + sum);\n        }\n        \n        System.out.println("Processing completed successfully. Total: " + sum);\n    }\n}`,

          program_output: `=== Demonstration of ${title} ===\nProcessed Element: 12 | Running Total: 12\nProcessed Element: 24 | Running Total: 36\nProcessed Element: 36 | Running Total: 72\nProcessed Element: 48 | Running Total: 120\nProcessed Element: 60 | Running Total: 180\nProcessing completed successfully. Total: 180`,

          numerical_problem: isTamil
            ? `**கணித மாதிரி வினா மற்றும் தீர்வு (Worked-Out Example Problem):**\n- **வினா:** ${title} அமைப்பில் அடிப்படை நினைவக முகவரி Base Address = 1000, உறுப்பின் அளவு w = 4 bytes மற்றும் சுட்டி எண் i = 3 எனில், 3-வது உறுப்பின் நினைவக முகவரியைக் கணக்கிடுக.\n- **சூத்திரம்:** முகவரி = Base + (i * w)\n- **படி 1:** Base = 1000, i = 3, w = 4\n- **படி 2:** முகவரி = 1000 + (3 * 4) = 1000 + 12\n- **விடை:** நினைவக முகவரி = 1012. தேர்வுக்கான முழு மதிப்பெண் தீர்வு.`
            : `**Numerical / Example Problem & Step-by-Step Worked-Out Solution:**\n- **Problem Statement:** In an implementation of ${title}, calculate the physical memory address of element at index i = 4 given Base Address = 2000 and element size w = 4 bytes.\n- **Formula:** Address(A[i]) = Base_Address + (i * Element_Size)\n- **Step 1 (Parameter Substitution):** Base_Address = 2000, i = 4, w = 4\n- **Step 2 (Computation):** Address = 2000 + (4 * 4) = 2000 + 16\n- **Result:** Physical Memory Address = 2016 bytes.`,

          tradeoffs_complexity: isTamil
            ? `**நன்மைகள், வரம்புகள் மற்றும் கால/நினைவக சிக்கல்தன்மை (Trade-offs & Complexity):**\n- **நன்மைகள்:** கணிக்கக்கூடிய வேகம், எளிய பராமரிப்பு, அதிக நம்பகத்தன்மை.\n- **வரம்புகள்:** நிலையான வரம்புகள் அல்லது சுட்டிகளுக்கு கூடுதல் நினைவக தேவை.\n- **கால சிக்கல்தன்மை (Time Complexity):** சிறந்த நிலை O(1), சராசரி நிலை O(n), மோசமான நிலை O(n).\n- **நினைவக சிக்கல்தன்மை (Space Complexity):** O(1) துணை நினைவகம், O(n) சேமிப்பக நினைவகம்.`
            : `**Advantages, Disadvantages & Time/Space Complexity:**\n- **Advantages:** Deterministic access latency, minimal computational overhead, cache-friendly spatial locality.\n- **Disadvantages:** Rigid boundary allocation or pointer memory overhead (4/8 bytes per reference).\n- **Time Complexity:** Best Case: O(1) | Average Case: O(n) | Worst Case: O(n)\n- **Space Complexity:** Auxiliary Space: O(1) | Total Space: O(n)`,

          // Legacy fields for backward compatibility
          headings: [
            {
              title: isTamil ? `1. கட்டமைப்பு மற்றும் செயல்பாட்டுக் கொள்கை [Diagram: System Block Flow]` : `1. Architectural Framework & Block Diagram [Diagram: Block Diagram Flow]`,
              content: isTamil
                ? `அமைப்பின் முக்கிய கூறுகள் ஒன்றோடொன்று ஒருங்கிணைந்து செயல்படும் விதத்தை இந்த கட்டமைப்பு விளக்குகிறது.\n- முதன்மை கட்டுப்பாட்டு தொகுதி\n- தரவு செயலாக்க நிலை\n- முடிவுகள் சரிபார்ப்பு`
                : `Comprehensive structural decomposition illustrating operational phases:\n- Input ingestion and validation boundaries.\n- Core processing logic and state transitions.\n- Output serialization and resource deallocation.`
            },
            {
              title: isTamil ? `2. தொழில்நுட்ப செயல்முறை மற்றும் நிரல் மாதிரி (Technical Implementation & Code)` : `2. Technical Implementation, Code Logic & Execution Parameters`,
              content: isTamil
                ? `நடைமுறை செயல்படுத்தல் மற்றும் நிரல் முறைகள்:\n\`\`\`java\n// Sample Implementation\npublic class SystemDemo {\n    public static void main(String[] args) {\n        System.out.println("Executing ${title}...");\n    }\n}\n\`\`\``
                : `Algorithmic specification with complexity analysis:\n\`\`\`java\n// University Exam Standard Implementation\npublic class ImplementationDemo {\n    public static void main(String[] args) {\n        // Demonstrating ${title} logic\n        System.out.println("${title} initialized successfully.");\n    }\n}\n\`\`\`\nTime Complexity: O(n) | Space Complexity: O(1)`
            },
            {
              title: isTamil ? `3. நன்மைகள் மற்றும் வரம்புகள் (Trade-offs & Advantages)` : `3. Analytical Evaluation & Trade-offs`,
              content: isTamil
                ? `- நன்மைகள்: அதிக செயல்திறன், எளிய பராமரிப்பு.\n- வரம்புகள்: சில குறிப்பிட்ட சூழ்நிலைகளில் அதிக நினைவகத் தேவை.`
                : `- Advantages: High throughput, predictable operational latency, deterministic space complexity.\n- Limitations: Requires upfront configuration and boundary sanitization.`
            }
          ],
          examples: isTamil
            ? `Google தேடுபொறி, லினக்ஸ் கர்னல் நினைவக மேலாண்மை மற்றும் பெரிய அளவிலான மென்பொருட்களில் பயன்படுகிறது.`
            : `Implemented in cloud-scale distributed caches (Netflix), Linux kernel scheduling, and automotive electronic control units.`,
          conclusion: isTamil
            ? `${title} பல்கலைக்கழக தேர்வுகளில் கேட்கப்படும் முதன்மையான 12-மதிப்பெண் வினாவாகும். தலைப்புகளையும் வரைபடங்களையும் சரியாக வரைந்து அதிக மதிப்பெண் பெறலாம்.`
            : `${title} constitutes a cornerstone topic in university examination papers. Clear diagrammatic presentation paired with structured derivations ensures maximum scoring.`
        }
      }
    ]
  };
}

/**
 * POST /api/gemini/chat
 * Interactive Gemini AI Study Assistant Chat.
 * Answers custom queries: definitions, code snippets, derivations, 12-mark essay answers.
 */
router.post('/chat', async (req, res) => {
  try {
    const { query, context = '', language = 'en' } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'query is required.'
      });
    }

    const isTamil = language === 'ta';
    const langGuideline = isTamil
      ? `LANGUAGE: TAMIL (இயல்பான பேச்சுத் தமிழ் & தெளிவான கல்வித் தமிழ்)
- Use natural modern spoken Tamil (இயல்பான தமிழ்) with clear explanations.
- Include English technical terms alongside Tamil (e.g. "Linked List (இணைக்கப்பட்ட பட்டியல்)").`
      : `LANGUAGE: ENGLISH
- Clear, professional, Indian University academic standard (Anna University pattern).`;

    const systemInstruction = `You are an advanced, context-aware AI study assistant inside EduMind AI, functioning with the intelligence and capabilities of Gemini and ChatGPT.

Core Directives:
1. Zero Hardcoded Templates: Never force a rigid, pre-set template (like mandatory definition + example + code + etc.) unless the user explicitly asks for a full breakdown. Always adapt your response structure dynamically based on the user's exact request.
2. Intent Analysis & Accuracy: Deeply analyze what the user is asking:
   - If the user asks for simple English or simple words, deliver explanations in clean, accessible, and intuitive words.
   - If the user asks for specific elements (e.g. definition + program + output + types), provide exactly those requested elements directly and thoroughly.
   - If they want just an example, provide only the example.
   - If they want a specific concept, focus entirely on that concept without drifting.
   - Only provide a full 7-part 12-mark university exam format when the user explicitly requests an exam sheet or comprehensive breakdown.
3. Image & Visual Generation / Diagrams: If a user requests a visual aid, diagram representation, flowchart, hierarchy, or a hand-written style note layout (e.g., 'Draw/generate a notes image for X' or 'Diagram for X'), output a clean Markdown-based structured layout, ASCII box diagram, or Mermaid diagram (\`\`\`mermaid ... \`\`\`) that can be rendered visually on the frontend UI.
4. Conversational & Natural: Maintain a helpful, engaging, and human-like conversational tone at all times.

${langGuideline}

${context ? `SYLLABUS / CHAPTER CONTEXT:\n${context.slice(0, 10000)}` : ''}`;

    let reply = '';
    try {
      reply = await generateWithGemini(
        query.trim(),
        systemInstruction,
        'text/plain'
      );
    } catch (aiErr) {
      console.warn('Gemini chat error, fallback to Groq or local:', aiErr.message);
      if (groqClient) {
        try {
          const completion = await withTimeout(
            groqClient.chat.completions.create({
              model: 'openai/gpt-oss-120b',
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: query.trim() }
              ]
            }),
            12000,
            'Groq chat fallback'
          );
          reply = completion.choices[0]?.message?.content || '';
        } catch (groqErr) {
          console.warn('Groq chat fallback error:', groqErr.message);
        }
      }
    }

    if (!reply || !reply.trim()) {
      const qLower = query.toLowerCase();
      const wantsCode = /program|code|implement/i.test(qLower);
      const wantsTypes = /type|category|categories|kinds/i.test(qLower);
      const wants12Mark = /12[-\s]?mark|essay|full breakdown|7[-\s]?part/i.test(qLower);
      const wantsDiagram = /diagram|flowchart|draw|visual/i.test(qLower);

      if (wants12Mark) {
        reply = `### 1. Introduction & Core Definition\n> **DEFINITION BOX:**\n> **${query.trim()}** is an essential topic and foundational concept in this subject syllabus.\n\n### 2. Architectural Scope & Types/Categories\n- **Type 1: Primary Structural Unit:** Handles initial data ingestion and core operations.\n- **Type 2: Dynamic Extended Variant:** Employs reference pointers to scale dynamically without memory fragmentation.\n\n### 3. Concrete Example & Real-world Relevance\n- Deployed in cloud infrastructure (e.g. Netflix video chunking, Linux kernel memory management).\n\n### 4. Full Clean Programming Code (Java)\n\`\`\`java\npublic class SolutionDemo {\n    public static void main(String[] args) {\n        System.out.println("Executing demonstration for: ${query.trim()}");\n    }\n}\n\`\`\`\n\n### 5. Exact Program Output\n\`\`\`text\nExecuting demonstration for: ${query.trim()}\n\`\`\`\n\n### 6. Numerical / Example Problem & Worked-out Solution\n- Formula: Base + (Index * Size) = 1000 + (3 * 4) = 1012.\n\n### 7. Advantages, Disadvantages & Complexity\n- Time Complexity: O(1) to O(n) | Space Complexity: O(1) auxiliary.`;
      } else {
        const sections = [];
        sections.push(`### 📖 Definition & Overview\n**${query.trim()}** is a foundational concept. In simple terms, it provides an organized and reliable mechanism to solve the problem efficiently.`);

        if (wantsTypes) {
          sections.push(`### 📂 Key Types & Categories\n1. **Standard / Fundamental Type:** Handles everyday normal operations with direct execution.\n2. **Dynamic / Advanced Type:** Adapts at runtime using flexible pointers and condition handlers.`);
        }

        if (wantsDiagram) {
          sections.push(`### 📊 Visual Flowchart / Diagram\n\`\`\`mermaid\ngraph TD\n    A[Input / Problem Request] --> B[Processing Unit]\n    B --> C{Validation Check}\n    C -->|Success| D[Normal Execution & Output]\n    C -->|Error| E[Exception / Recovery Handler]\n\`\`\``);
        }

        if (wantsCode) {
          sections.push(`### 💻 Clean Program Code (Java)\n\`\`\`java\npublic class MainDemo {\n    public static void main(String[] args) {\n        try {\n            System.out.println("Running demonstration for ${query.trim()}");\n            int result = 100 / 10;\n            System.out.println("Computed Result: " + result);\n        } catch (Exception e) {\n            System.out.println("Caught exception: " + e.getMessage());\n        }\n    }\n}\n\`\`\`\n\n### 📟 Exact Output\n\`\`\`text\nRunning demonstration for ${query.trim()}\nComputed Result: 10\n\`\`\``);
        }

        sections.push(`*Feel free to ask for more specific examples, different programming languages, or a visual diagram!*`);
        reply = sections.join('\n\n');
      }
    }

    return res.status(200).json({
      success: true,
      provider: 'gemini-assistant',
      answer: reply.trim()
    });

  } catch (err) {
    console.error('Gemini chat route error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process chat request.',
      error: err.message
    });
  }
});

/**
 * POST /api/gemini/story-convert
 * Converts difficult theory papers into simplified explanations & relatable stories.
 * Built for natural text-to-speech voice playback in conversational Tamil and English.
 */
router.post('/story-convert', async (req, res) => {
  try {
    const { text, language = 'ta' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'text is required for story conversion.'
      });
    }

    const cleanedText = cleanOcrArtifacts(text.trim());
    const isTamil = language === 'ta';
    const langInstruction = isTamil
      ? `TAMIL VOICE & DIALOGUE STYLE:
- Use natural, friendly, conversational modern Tamil (இயல்பான பேச்சுத் தமிழ்) like an enthusiastic university professor delivering an inspiring lecture over tea.
- Do NOT use archaic, stiff, formal book Tamil.
- Write with clear, expressive, rhythmic sentences that Text-To-Speech (TTS) voices can read with natural warmth, vocal inflections, and emotion without stumbling.`
      : `ENGLISH VOICE & DIALOGUE STYLE:
- Use an engaging, conversational, friendly professor tone with clear, expressive phrasing optimized for natural audio reading.`;

    const systemInstruction = `You are EduMind Distinguished Professor & Academic Storyteller.
Your mission: Acting as an expert professor, analyze the user's uploaded syllabus topic deeply from A to Z, explaining core principles, behavior, and working mechanisms thoroughly in an engaging narrative style while staying 100% true to the actual content.

STRICT CONSTRAINTS & REQUIREMENTS:
1. NO BRIEF 2-LINE SUMMARIES OR SHORT OVERVIEWS:
   - Do NOT provide a brief overview or short 2-line summary.
   - Deliver a rich, comprehensive, deep-dive academic lecture (approx 500-900 words / 3000-5000 characters) that analyzes the syllabus deeply from A to Z.
2. ZERO UNPROMPTED FICTIONAL METAPHORS:
   - Do NOT invent fictional stories, unrelated metaphors, trains, bogies, cars, animals, chefs, robots, or fairy tales.
   - Do NOT say "Imagine a train running on a single track" or "Imagine a chef in a kitchen". Stay 100% faithful to the real technical/academic concepts.
3. PROFESSOR-GRADE DEEP ANALYSIS FROM A TO Z:
   - Part A: Academic Introduction — Big-picture context, core definition, and why this topic is fundamental.
   - Part B: Principle & Architecture Breakdown — Step-by-step examination of every topic, primitive structure, array dimension, or data organization mentioned in the text.
   - Part C: Working Mechanisms & Internal Behaviors — Explain how operations, pointers, memory addresses, insertions, deletions, and traversals execute under the hood.
   - Part D: Types & Variations — Deeply contrast each type (e.g. Singly, Doubly, and Circular Linked Lists) explaining pointer configurations and edge cases.
   - Part E: Real-world Engineering Applications — Where and why operating systems, cloud services, and real-world software rely on these mechanisms.
4. ENGAGING NARRATIVE SPOKEN STYLE:
   - ${langInstruction}

Return ONLY a valid JSON object matching:
{
  "title": "Exact Chapter / Subject Title",
  "simple_explanation": "Thorough, structured academic breakdown of all syllabus concepts from A to Z...",
  "story": "Comprehensive deep-dive spoken masterclass lecture from A to Z covering core principles, inner working mechanisms, and variations in a warm, narrative conversational cadence with zero fictional metaphors...",
  "audio_script": "Complete spoken lecture audio script for text-to-speech voice synthesis..."
}`;

    const rawText = await generateWithGemini(
      `STUDENT'S SYLLABUS / THEORY TEXT TO CONVERT:\n\n${cleanedText.slice(0, 15000)}`,
      systemInstruction
    );

    let parsed;
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const firstLine = cleanedText.split(/[\r\n.]+/)[0].slice(0, 50).trim() || 'Syllabus Concepts';
      parsed = {
        title: firstLine,
        simple_explanation: rawText || cleanedText,
        story: rawText || cleanedText,
        audio_script: rawText || cleanedText
      };
    }

    return res.status(200).json({
      success: true,
      provider: 'ai-engine',
      ...parsed
    });

  } catch (err) {
    console.warn('Gemini Story Conversion fallback to local synthesis:', err.message);
    const cleaned = cleanOcrArtifacts(req.body?.text || '');
    const firstLine = cleaned.split(/[\r\n.]+/)[0].slice(0, 50).trim() || 'Syllabus Core Concepts';
    const isTamil = (req.body?.language || 'ta') === 'ta';

    const fallbackStory = isTamil
      ? `வணக்கம் நண்பரே! நீங்கள் தேர்ந்தெடுத்த ${firstLine} பாடத்தை தொடக்கம் முதல் முடிவு வரை (A to Z) ஆழமாக புரிந்து கொள்வோம். ${cleaned} உள்ளிட்ட அனைத்து கருத்துகளும் கணினி அறிவியலின் மிக முக்கியமான அடித்தளமாகும். முதன்மையாக, நினைவகத்தில் தரவுகள் எவ்வாறு சேமிக்கப்படுகின்றன என்பதையும், சுட்டிகள் (pointers) மற்றும் முகவரிகள் மூலமாக எவ்வாறு இயக்கப்படுகின்றன என்பதையும் நாம் கவனிக்க வேண்டும். ஒவ்வொரு கட்டமைப்பும் தனக்கென தனித்துவமான பயன்பாடுகளைக் கொண்டுள்ளன. இவற்றை தேர்வில் தெளிவாகவும் வரைபடங்களுடனும் எழுதும்போது அதிக மதிப்பெண்களைப் பெற முடியும்.`
      : `Welcome scholars! Let us conduct a comprehensive, deep-dive academic breakdown of ${firstLine} from A to Z. Core syllabus concepts: ${cleaned}. Every component here governs fundamental memory allocation, operational efficiency, and deterministic pointer linkages. Understanding these mechanics from first principles empowers you to excel in your university examinations.`;

    return res.status(200).json({
      success: true,
      provider: 'local-fast',
      title: firstLine,
      simple_explanation: fallbackStory,
      story: fallbackStory,
      audio_script: fallbackStory
    });
  }
});

/**
 * Helper: Synthesize studio-quality conversational speech using Modern Neural Voices.
 * - Tamil: Warm, expressive storytelling with 'ta-IN-PallaviNeural'
 * - English: Soft, sweet, expressive human tutor with 'en-US-JennyNeural'
 * - Prosody: Calibrated pitch, speed, and pacing to eliminate robotic monotony
 * - Supports optional ElevenLabs API if ELEVENLABS_API_KEY is present in .env
 */
async function synthesizeNeuralSpeech({ text, language = 'ta', mode = 'story' }) {
  const isTamil = language === 'ta';
  
  // Clean text from OCR noise, markdown formatting, asterisks, brackets, or code fences
  const ocrCleaned = cleanOcrArtifacts(text);
  const cleanedText = ocrCleaned
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*#_`>\[\]\(\)]/g, ' ')
    .replace(/\{[\s\S]*?\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4500); // Azure Neural single payload limit

  if (!cleanedText) {
    throw new Error('Text to synthesize is empty after cleaning.');
  }

  // 1. Optional ElevenLabs check if API key is provided
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const voiceId = isTamil
        ? (process.env.ELEVENLABS_TAMIL_VOICE_ID || 'pNInz6obpgDQGcFmaJgB')
        : (process.env.ELEVENLABS_ENGLISH_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL');
      const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: cleanedText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.75,
            style: 0.40,
            use_speaker_boost: true
          }
        })
      });
      if (elevenRes.ok) {
        const arrayBuffer = await elevenRes.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    } catch (e) {
      console.warn('ElevenLabs API fallback to Azure Neural Engine:', e.message);
    }
  }

  // 2. Microsoft Azure Neural Voice Engine via msedge-tts
  if (!MsEdgeTTS || !OUTPUT_FORMAT) {
    throw new Error('msedge-tts library is not loaded on server.');
  }

  const voice = isTamil ? 'ta-IN-PallaviNeural' : 'en-US-JennyNeural';
  
  // Natural human tutor and storyteller acoustic parameters
  let rate = '-6%';
  let pitch = '+3Hz';
  if (isTamil) {
    // Tamil: Warm, engaging storytelling cadence
    rate = mode === 'story' ? '-8%' : '-5%';
    pitch = mode === 'story' ? '+2Hz' : '+1Hz';
  } else {
    // English: Soft, sweet, and expressive tutor cadence
    rate = mode === 'story' ? '-6%' : '-4%';
    pitch = mode === 'story' ? '+3Hz' : '+2Hz';
  }

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(cleanedText, { rate, pitch });

  return new Promise((resolve, reject) => {
    const chunks = [];
    const timer = setTimeout(() => {
      reject(new Error('Audio stream synthesis timed out after 12s'));
    }, 12000);

    audioStream.on('data', chunk => chunks.push(chunk));
    audioStream.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    audioStream.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * POST /api/gemini/synthesize-speech
 * Generates natural conversational MP3 audio using Modern Neural AI Voices.
 */
router.post('/synthesize-speech', async (req, res) => {
  try {
    const { text, language = 'ta', mode = 'story' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'text is required for speech synthesis.'
      });
    }

    const audioBuffer = await synthesizeNeuralSpeech({ text, language, mode });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(audioBuffer);

  } catch (err) {
    console.error('Speech synthesis error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to synthesize speech audio.',
      error: err.message
    });
  }
});

module.exports = router;
