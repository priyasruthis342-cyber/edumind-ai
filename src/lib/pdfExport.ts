const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const LINE_HEIGHT = 16;
const BODY_SIZE = 11;
const WRAP_CHARS = 88;

export interface PdfLine {
  text: string;
  style?: 'title' | 'heading' | 'body';
}

function toPdfSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/[\\()]/g, (ch) => `\\${ch}`);
}

function wrap(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > WRAP_CHARS) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

interface LayoutCommand {
  font: 'F1' | 'F2';
  size: number;
  x: number;
  y: number;
  text: string;
}

function layout(lines: PdfLine[]): LayoutCommand[][] {
  const pages: LayoutCommand[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (height: number) => {
    if (y - height < MARGIN) {
      pages.push([]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  for (const line of lines) {
    const style = line.style ?? 'body';
    const size = style === 'title' ? 20 : style === 'heading' ? 13 : BODY_SIZE;
    const font: LayoutCommand['font'] = style === 'body' ? 'F1' : 'F2';
    const gap = style === 'title' ? 12 : style === 'heading' ? 10 : 0;
    y -= gap;
    for (const wrapped of wrap(toPdfSafe(line.text))) {
      ensureSpace(size + 4);
      pages[pages.length - 1].push({ font, size, x: MARGIN, y, text: wrapped });
      y -= style === 'title' ? size + 6 : LINE_HEIGHT;
    }
    if (style === 'body') y -= 4;
  }
  return pages;
}

export function buildPdfBlob(lines: PdfLine[]): Blob {
  const pages = layout(lines);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  pages.forEach((commands, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    pageObjectIds.push(pageId);
    const stream = commands
      .map((c) => `BT /${c.font} ${c.size} Tf ${c.x} ${c.y} Td (${c.text}) Tj ET`)
      .join('\n');
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
