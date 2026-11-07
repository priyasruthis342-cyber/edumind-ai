export type ExtractedKind = 'text' | 'pdf' | 'image';

export interface ExtractedFile {
  text: string;
  kind: ExtractedKind;
}

const MAX_PDF_PAGES = 60;

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(document.numPages, MAX_PDF_PAGES);
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      pageText += item.str;
      pageText += item.hasEOL ? '\n' : ' ';
    }
    pages.push(pageText);
  }

  await document.destroy();
  return pages.join('\n');
}

const OCR_ASSET_DIR = `${import.meta.env.BASE_URL}tesseract/`;

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
    throw new Error('The text reader could not start. Refresh the page and try again, or upload a PDF or text file.');
  }
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } catch {
    throw new Error('The photo could not be read. Try a clearer, well-lit photo or upload a PDF or text file.');
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
