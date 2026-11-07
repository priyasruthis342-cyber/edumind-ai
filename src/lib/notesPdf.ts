import type { ExamAnswer } from '@/lib/examAnswers';
import type { NotesDocument } from '@/lib/textAnalysis';
import type { PdfLine } from '@/lib/pdfExport';

export interface NotesPdfLabels {
  aiNotes: string;
  overview: string;
  keyPoints: string;
  definitions: string;
  checklist: string;
  examAnswers: string;
  intro: string;
  conclusion: string;
  part: (n: number) => string;
}

export function notesToPdfLines(notes: NotesDocument, exam: ExamAnswer[], labels: NotesPdfLabels): PdfLine[] {
  const lines: PdfLine[] = [{ text: notes.title, style: 'title' }, { text: labels.aiNotes, style: 'heading' }];

  lines.push({ text: labels.overview, style: 'heading' });
  notes.overview.forEach((line) => lines.push({ text: line }));

  lines.push({ text: labels.keyPoints, style: 'heading' });
  notes.keyPoints.forEach((line) => lines.push({ text: `- ${line}` }));

  if (notes.definitions.length > 0) {
    lines.push({ text: labels.definitions, style: 'heading' });
    notes.definitions.forEach((d) => lines.push({ text: `${d.term}: ${d.meaning}` }));
  }

  if (exam.length > 0) {
    lines.push({ text: labels.examAnswers, style: 'heading' });
    exam.forEach((answer) => {
      lines.push({ text: `${answer.question} [${answer.importance.toUpperCase()}]`, style: 'body' });
      lines.push({ text: `${labels.intro}: ${answer.intro}` });
      answer.sections.forEach((section, index) => {
        if (answer.sections.length > 1) lines.push({ text: labels.part(index + 1) });
        section.points.forEach((point) => lines.push({ text: `- ${point}` }));
      });
      if (answer.conclusion) lines.push({ text: `${labels.conclusion}: ${answer.conclusion}` });
      lines.push({ text: '' });
    });
  }

  lines.push({ text: labels.checklist, style: 'heading' });
  notes.revisionChecklist.forEach((line) => lines.push({ text: `[ ] ${line}` }));
  return lines;
}
