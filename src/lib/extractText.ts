export type ExtractedKind = 'text' | 'pdf' | 'image';

export interface ExtractedFile {
  text: string;
  kind: ExtractedKind;
}

const OCR_ASSET_DIR = `${import.meta.env.BASE_URL}tesseract/`;

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const totalPages = document.numPages;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = '';

    for (const item of content.items) {
      if (!('str' in item)) continue;
      pageText += item.str;
      pageText += item.hasEOL ? '\n' : ' ';
    }

    // If page is scanned (no digital text layer), attempt OCR on this page
    if (pageText.trim().length < 20) {
      try {
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = window.document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await page.render({ canvasContext: context, viewport } as any).promise;
          const { createWorker } = await import('tesseract.js');
          const worker = await createWorker('eng', 1, {
            workerPath: `${OCR_ASSET_DIR}worker.min.js`,
            corePath: OCR_ASSET_DIR,
            langPath: OCR_ASSET_DIR,
            gzip: true,
          });
          const { data } = await worker.recognize(canvas);
          await worker.terminate();
          if (data && data.text.trim()) {
            pageText = data.text;
          }
        }
      } catch (ocrErr) {
        console.warn(`Scanned PDF OCR fallback note for page ${pageNumber}:`, ocrErr);
      }
    }

    if (pageText.trim()) {
      pages.push(`--- Page ${pageNumber} ---\n` + pageText.trim());
    }
  }

  await document.destroy();
  return pages.join('\n\n');
}

async function extractImage(file: File): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker('eng', 1, {
      workerPath: `${OCR_ASSET_DIR}worker.min.js`,
      corePath: OCR_ASSET_DIR,
      langPath: OCR_ASSET_DIR,
      gzip: true,
    });
  } catch {
    throw new Error('The text OCR engine could not initialize. Refresh and try again.');
  }

  try {
    const { data } = await worker.recognize(file);
    return data.text || '';
  } catch {
    throw new Error('The photo/document could not be read clearly. Please try a clearer scan or upload a PDF.');
  } finally {
    await worker.terminate();
  }
}

export async function extractTextFromFile(file: File): Promise<ExtractedFile> {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    return { text: await extractPdf(file), kind: 'pdf' };
  }
  if (file.type.startsWith('image/')) {
    return { text: await extractImage(file), kind: 'image' };
  }
  return { text: await file.text(), kind: 'text' };
}
