import { extractImageWithGemini } from './geminiApi';

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
  const words = text.split(/\s+/).filter(w => /[a-zA-Z\u0B80-\u0BFF\u0900-\u097F]/.test(w));
  if (words.length < 2) return false;

  // Identify suspicious 1-2 letter non-standard fragments (e.g. 'cg', 'G0', '3_f', 'Ld', 'ANE')
  const validTwoLetterWords = new Set(['in', 'on', 'at', 'to', 'is', 'an', 'as', 'or', 'by', 'we', 'it', 'he', 'if', 'my', 'no', 'so', 'up', 'do', 'go', 'am', 'of', 'us']);
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

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(blob || file);
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
 * Timeout helper to prevent infinite loading freezes
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallbackErrorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(fallbackErrorMsg)), ms)
    )
  ]);
}

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

  // 1. Fast Digital Text Extraction (takes <200ms)
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    onProgress?.(`Extracting page ${pageNumber} of ${totalPages}...`);
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

  // If digital text was extracted successfully, return immediately!
  if (totalChars > 40) {
    await document.destroy();
    return pages.join('\n\n');
  }

  // 2. Scanned PDF fallback: render first 3 pages to canvas & extract
  onProgress?.('Scanned PDF detected. Extracting text from pages...');
  const maxOcrPages = Math.min(totalPages, 3);
  const ocrPages: string[] = [];

  for (let pageNumber = 1; pageNumber <= maxOcrPages; pageNumber++) {
    try {
      onProgress?.(`Reading scanned page ${pageNumber}...`);
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = window.document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: context, viewport } as any).promise;

        const pageBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
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
    return ocrPages.join('\n\n');
  }

  throw new Error('Could not extract readable text from this PDF. Please try a text document or clear textbook photo.');
}

async function extractImage(file: Blob | File, onProgress?: (msg: string) => void): Promise<string> {
  onProgress?.('Optimizing photo for handwriting & text reading...');
  const optimizedBlob = await compressAndDownscaleImage(file, 1800);

  // 1. High-Speed Gemini Vision OCR (runs in ~1-2s on server, understands messy handwriting)
  try {
    onProgress?.('Transcribing handwriting & text with Gemini Vision...');
    const rawVisionText = await withTimeout(
      extractImageWithGemini(optimizedBlob),
      25000,
      'Gemini Vision timeout'
    );
    const cleanedVision = cleanOcrNoise(rawVisionText);
    if (cleanedVision && cleanedVision.length >= 8) {
      return cleanedVision;
    }
  } catch (visionErr) {
    console.warn('Gemini Vision note (falling back to local engine):', visionErr);
  }

  // 2. Client-side Tesseract OCR fallback
  try {
    onProgress?.('Reading text locally...');
    const { createWorker } = await import('tesseract.js');
    const worker = await withTimeout(
      createWorker('eng', 1, {
        workerPath: `${OCR_ASSET_DIR}worker.min.js`,
        corePath: OCR_ASSET_DIR,
        langPath: OCR_ASSET_DIR,
        gzip: true,
      }),
      12000,
      'OCR engine initialization timed out'
    );

    try {
      const { data } = await withTimeout(
        worker.recognize(optimizedBlob),
        18000,
        'OCR recognition timed out'
      );
      await worker.terminate();
      if (data && data.text) {
        const cleanedLocal = cleanOcrNoise(data.text);
        // Strictly verify that the text is legible academic content and not random letter noise
        if (isLegibleAcademicText(cleanedLocal)) {
          return cleanedLocal;
        }
      }
    } catch (recErr) {
      await worker.terminate().catch(() => {});
      throw recErr;
    }
  } catch (localErr) {
    console.warn('Local OCR attempt error:', localErr);
  }

  throw new Error('The handwriting or document photo could not be read clearly. Please make sure the lighting is bright and handwriting is legible, or paste the text directly.');
}

export async function extractTextFromFile(
  file: File,
  onProgress?: (msg: string) => void
): Promise<ExtractedFile> {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    return { text: await extractPdf(file, onProgress), kind: 'pdf' };
  }
  if (file.type.startsWith('image/')) {
    return { text: await extractImage(file, onProgress), kind: 'image' };
  }
  return { text: await file.text(), kind: 'text' };
}
