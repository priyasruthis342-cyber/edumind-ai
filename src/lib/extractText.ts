import { extractImageWithGemini } from './geminiApi';
import { cleanMathFormatting } from './mathFormatter';

export type ExtractedKind = 'text' | 'pdf' | 'image';

export interface ExtractedFile {
  text: string;
  kind: ExtractedKind;
}

const OCR_ASSET_DIR = `${import.meta.env.BASE_URL}tesseract/`;

/**
 * Checks whether the extracted text is genuine legible text vs random OCR sensor noise (like 'Fs he (Q mo Rk G0 pe 2 cg <').
 */
export function isLegibleAcademicText(text: string): boolean {
  if (!text || text.trim().length < 8) return false;
  // If text contains mathematical equations or calculations, it is genuine academic math
  if (/[=+\-*\/^√²³]/.test(text) && /\d/.test(text)) {
    return true;
  }
  const words = text.split(/\s+/).filter(w => /[a-zA-Z\u0B80-\u0BFF\u0900-\u097F]/.test(w));
  if (words.length < 2) return false;

  // Identify suspicious 1-2 letter non-standard fragments (e.g. 'cg', 'G0', '3_f', 'Ld', 'ANE')
  const validTwoLetterWords = new Set(['in', 'on', 'at', 'to', 'is', 'an', 'as', 'or', 'by', 'we', 'it', 'he', 'if', 'my', 'no', 'so', 'up', 'do', 'go', 'am', 'of', 'us', 'pi', 'bf', 'll', 'rr', 'lr', 'rl', 'dx', 'dy', 'dt']);
  const junkWords = words.filter(w => {
    const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return clean.length <= 2 && !validTwoLetterWords.has(clean);
  });

  // If over 40% of words are strange isolated 1-2 letter fragments, it's OCR noise
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
      // Discard tiny lines without any actual alphanumeric characters
      if (line.length <= 2 && !/[a-zA-Z0-9\u0B80-\u0BFF\u0900-\u097F]/.test(line)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Rapid canvas-based image downscaling & compression.
 * Preserves high resolution (1800px) and quality (0.88) so handwritten pen/pencil strokes remain clear.
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
 * Uses high-speed server-side Gemini Vision OCR.
 * Transparently falls back to local Tesseract if offline or network fails.
 */
async function extractImage(
  file: Blob | File,
  onProgress?: (msg: string) => void
): Promise<string> {
  // Step 1: Compress high-res camera snaps for rapid transmission
  onProgress?.('Preparing image...');
  let optimizedFile: Blob | File = file;
  try {
    optimizedFile = await compressAndDownscaleImage(file);
  } catch (compErr) {
    console.warn('Image downscaling skipped:', compErr);
  }

  // Step 2: High-accuracy server-side Gemini Vision OCR
  try {
    onProgress?.('Extracting text with Google Gemini Vision...');
    const extracted = await extractImageWithGemini(optimizedFile);
    const cleaned = cleanOcrNoise(extracted.trim());

    // Validate that the returned text is legible academic content and not garbage
    if (cleaned && isLegibleAcademicText(cleaned)) {
      return cleaned;
    }
    console.warn('Gemini Vision returned sparse or noisy text, trying enhanced pass...');
  } catch (apiErr: unknown) {
    console.warn('Server-side Gemini Vision OCR failed, falling back to local OCR:', apiErr);
  }

  // Step 3: Resilient client-side fallback via Tesseract.js
  onProgress?.('Initializing local OCR engine...');
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker('eng+tam', 1, {
    workerPath: `${OCR_ASSET_DIR}worker.min.js`,
    corePath: `${OCR_ASSET_DIR}tesseract-core.wasm.js`,
    langPath: `${OCR_ASSET_DIR}lang-data`,
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text' && onProgress && m.progress != null) {
        onProgress(`Reading image (${Math.round(m.progress * 100)}%)...`);
      }
    },
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(optimizedFile);
    await worker.terminate();

    const cleaned = cleanOcrNoise(text.trim());
    if (!cleaned) {
      throw new Error(
        'Could not detect readable text in this image. Please take a clearer photo under good lighting or type key words manually.'
      );
    }
    return cleaned;
  } catch (tessErr) {
    await worker.terminate().catch(() => {});
    throw tessErr;
  }
}

/**
 * Extract text from a PDF file using pdfjs-dist.
 * If pages have little/no text layer, renders page to canvas and runs OCR.
 */
async function extractPdf(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  onProgress?.('Loading PDF...');
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const numPages = pdf.numPages;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(`Reading page ${pageNum} of ${numPages}...`);
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
      .trim();

    if (strings.length > 50) {
      pageTexts.push(strings);
    } else {
      // Scanned PDF page: render to canvas and run OCR
      onProgress?.(`Page ${pageNum} is scanned — running OCR...`);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (blob) {
          const ocrText = await extractImage(blob, onProgress);
          if (ocrText.trim()) {
            pageTexts.push(ocrText.trim());
          }
        }
      }
    }
  }

  const combined = cleanOcrNoise(pageTexts.join('\n\n').trim());
  if (!combined) {
    throw new Error(
      'Could not extract text from this PDF. It may be empty or password-protected.'
    );
  }
  return combined;
}

/**
 * Read text from an uploaded file (.txt, .pdf, or image).
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
