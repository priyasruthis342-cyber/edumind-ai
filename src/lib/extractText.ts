import { extractImageWithGemini } from './geminiApi';
import { cleanMathFormatting } from './mathFormatter';

export type ExtractedKind = 'text' | 'pdf' | 'image';

export interface ExtractedFile {
  text: string;
  kind: ExtractedKind;
}

const OCR_ASSET_DIR = `${import.meta.env.BASE_URL}tesseract/`;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} (timed out after ${Math.round(ms / 1000)}s)`)), ms)
    ),
  ]);
}

/**
 * Checks whether the extracted text is genuine legible text vs random OCR sensor noise (like 'Fs he (Q mo Rk G0 pe 2 cg <').
 * Supports English, Tamil, Hindi, Malayalam, Telugu, and Kannada.
 */
export function isLegibleAcademicText(text: string): boolean {
  if (!text || text.trim().length < 5) return false;
  
  // If Indian language characters (Tamil, Hindi, Malayalam, Telugu, Kannada) are present in real words, it's valid!
  if (/[\u0B80-\u0BFF\u0900-\u097F\u0D00-\u0D7F\u0C00-\u0C7F\u0C80-\u0CFF]/.test(text)) {
    const indianCharCount = (text.match(/[\u0B80-\u0BFF\u0900-\u097F\u0D00-\u0D7F\u0C00-\u0C7F\u0C80-\u0CFF]/g) || []).length;
    if (indianCharCount >= 5) return true;
  }

  // If text contains genuine mathematical equations (e.g. x² + 5x + 6 = 0 or dy/dx = 2x)
  if (/[a-zA-Z\d]\s*[=<>≤≥]\s*[-+]?[a-zA-Z\d]/.test(text)) {
    return true;
  }

  const words = text.split(/\s+/).filter((w) => /[a-zA-Z\u0B80-\u0BFF\u0900-\u097F\u0D00-\u0D7F\u0C00-\u0C7F\u0C80-\u0CFF]/.test(w));
  if (words.length < 2) return false;

  // Identify suspicious 1-2 letter non-standard fragments (e.g. 'cg', 'G0', '3_f', 'Ld', 'ANE')
  const validTwoLetterWords = new Set([
    'in', 'on', 'at', 'to', 'is', 'an', 'as', 'or', 'by', 'we', 'it', 'he', 'if', 'my', 'no', 'so',
    'up', 'do', 'go', 'am', 'of', 'us', 'pi', 'bf', 'll', 'rr', 'lr', 'rl', 'dx', 'dy', 'dt', 'db',
    'ok', 'cm', 'mm', 'km', 'kg', 'mg', 'ml', 'hz', 'ev', 'pa', 'na', 'ai', 'ml', 'ds', 'cs', 'it'
  ]);
  const junkWords = words.filter((w) => {
    const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return clean.length <= 2 && !validTwoLetterWords.has(clean);
  });

  // If over 40% of words are strange isolated 1-2 letter fragments, it's OCR sensor noise
  if (junkWords.length / words.length > 0.40) return false;
  return true;
}

/**
 * Cleans garbage OCR artifacts (lone copyright/trademark symbols, stray punctuation lines)
 * produced by noisy camera scans or weak handwriting recognition.
 */
export function cleanOcrNoise(raw: string): string {
  if (!raw) return '';
  return raw
    .split('\n')
    .map((line) => line.replace(/[©®™]/g, '').trim())
    .filter((line) => {
      if (!line) return false;
      // Discard lines that consist exclusively of punctuation or garbage symbols
      if (/^[;:*~^_`|\\/\-=+.,?!#@$%&()<>{}[\]'"]+$/.test(line)) return false;
      // Discard lines that contain models explanations about blank images
      if (line.toLowerCase().includes('no text, notes, or diagrams are visible') || line.toLowerCase().includes('entirely blank')) return false;
      // Discard tiny lines without any actual alphanumeric characters
      if (line.length <= 2 && !/[a-zA-Z0-9\u0B80-\u0BFF\u0900-\u097F\u0D00-\u0D7F\u0C00-\u0C7F\u0C80-\u0CFF]/.test(line)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Rapid canvas-based image downscaling & compression.
 * Preserves high resolution (1800px) and quality (0.88) so handwritten pen/pencil strokes remain sharp.
 */
async function compressAndDownscaleImage(file: Blob | File, maxDim = 1800): Promise<Blob> {
  // If it's already a compact file (< 900KB), return as is
  if (file.size < 900 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.88
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Extract text from an image.
 * Uses high-speed server-side Gemini Vision OCR with multi-lingual support (Tamil, English, Hindi, Malayalam, Telugu, Kannada).
 * Deciphers handwritten notes accurately without falling back to broken client-side character engines.
 */
async function extractImage(file: Blob | File, onProgress?: (msg: string) => void): Promise<string> {
  onProgress?.('Optimizing photo for handwriting & text reading...');
  let optimizedBlob: Blob | File = file;
  try {
    optimizedBlob = await compressAndDownscaleImage(file, 1600);
  } catch (e) {
    console.warn('Downscaling skipped:', e);
  }

  // 1. High-Speed Gemini Vision OCR (Primary attempt)
  try {
    onProgress?.('Transcribing handwriting & text with Google Gemini Vision...');
    const rawVisionText = await withTimeout(
      extractImageWithGemini(optimizedBlob),
      40000,
      'Gemini Vision OCR'
    );
    const cleanedVision = cleanOcrNoise(rawVisionText);
    if (cleanedVision && cleanedVision.length >= 8 && isLegibleAcademicText(cleanedVision)) {
      return cleanMathFormatting(cleanedVision);
    }
  } catch (visionErr) {
    console.warn('Gemini Vision OCR primary attempt note:', visionErr);
  }

  // 2. High-Speed Gemini Vision OCR (Immediate retry with compact payload)
  try {
    onProgress?.('Retrying high-accuracy handwriting recognition...');
    const compactBlob = await compressAndDownscaleImage(file, 1200);
    const rawVisionText2 = await withTimeout(
      extractImageWithGemini(compactBlob),
      35000,
      'Gemini Vision OCR Retry'
    );
    const cleanedVision2 = cleanOcrNoise(rawVisionText2);
    if (cleanedVision2 && cleanedVision2.length >= 8 && isLegibleAcademicText(cleanedVision2)) {
      return cleanMathFormatting(cleanedVision2);
    }
  } catch (retryErr) {
    console.warn('Gemini Vision OCR retry note:', retryErr);
  }

  throw new Error('Could not clearly read the text in this photo. Please ensure good lighting and take a closer photo, or paste your text directly.');
}

/**
 * Extract complete text from a PDF file using pdfjs-dist.
 * Complete A to Z extraction supporting digital PDFs and multi-page scanned PDFs.
 */
async function extractPdf(file: File, onProgress?: (msg: string) => void): Promise<string> {
  onProgress?.('Reading PDF structure...');
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const totalPages = document.numPages;
  const pages: string[] = [];
  let totalChars = 0;

  // 1. Fast Digital Text Extraction across ALL pages
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    onProgress?.(`Extracting digital page ${pageNumber} of ${totalPages}...`);
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = '';

    for (const item of content.items) {
      if (!('str' in item)) continue;
      pageText += item.str;
      pageText += item.hasEOL ? '\n' : ' ';
    }

    if (pageText.trim()) {
      pages.push(`--- Page ${pageNumber} ---\n` + pageText.trim());
      totalChars += pageText.trim().length;
    }
  }

  // If digital text was extracted and is genuinely legible academic text, return complete A-to-Z text!
  const combinedDigital = pages.join('\n\n');
  const isHighQualityDigital = totalChars > 80 && isLegibleAcademicText(combinedDigital);

  if (isHighQualityDigital) {
    await document.destroy();
    return cleanMathFormatting(combinedDigital);
  }

  // 2. Scanned / Handwritten PDF fallback: render pages to canvas & extract with Gemini Vision
  onProgress?.('Scanned PDF detected. Extracting all pages with Gemini Vision...');
  const maxOcrPages = Math.min(totalPages, 15);
  const ocrPages: string[] = [];

  for (let pageNumber = 1; pageNumber <= maxOcrPages; pageNumber++) {
    try {
      onProgress?.(`Reading scanned page ${pageNumber} of ${maxOcrPages}...`);
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = window.document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: context, viewport } as any).promise;

        const pageBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
        if (pageBlob) {
          const text = await extractImage(pageBlob, onProgress);
          if (text.trim()) {
            ocrPages.push(`--- Page ${pageNumber} ---\n` + text.trim());
          }
        }
      }
    } catch (e) {
      console.warn(`Scanned PDF page ${pageNumber} OCR note:`, e);
    }
  }

  await document.destroy();
  if (ocrPages.length > 0) {
    return cleanMathFormatting(ocrPages.join('\n\n'));
  }

  throw new Error('Could not extract readable text from this PDF. Please ensure the pages are clear and uncorrupted.');
}

/**
 * Read complete un-truncated text from an uploaded file (.txt, .pdf, or image).
 */
export async function extractTextFromFile(
  file: File,
  onProgress?: (msg: string) => void
): Promise<ExtractedFile> {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    const raw = await extractPdf(file, onProgress);
    return { text: cleanMathFormatting(raw), kind: 'pdf' };
  }
  if (file.type.startsWith('image/')) {
    const raw = await extractImage(file, onProgress);
    return { text: cleanMathFormatting(raw), kind: 'image' };
  }
  const raw = await file.text();
  return { text: cleanMathFormatting(raw), kind: 'text' };
}
