import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { GitBranch, Layers, ArrowRight } from 'lucide-react';

mermaid.initialize({
  startOnLoad: false,
  suppressErrorRendering: true, // Prevents Mermaid from injecting the bomb error graphic into DOM
  theme: 'neutral',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis'
  }
});

interface MermaidDiagramProps {
  code: string;
}

/**
 * Pre-sanitizes common LLM Mermaid syntax mistakes before giving to Mermaid parser:
 * - Quotes unquoted node labels with parentheses or colons, e.g. [1: Immutable String (Java String)] -> ["1: Immutable String (Java String)"]
 * - Removes stray markdown fences
 */
function sanitizeMermaid(raw: string): string {
  let text = raw
    .replace(/^```(mermaid)?/im, '')
    .replace(/```$/im, '')
    .trim();

  // Ensure diagram starts with standard directive if missing
  const validHeaders = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram'];
  const hasHeader = validHeaders.some((h) => text.toLowerCase().startsWith(h.toLowerCase()));
  if (!hasHeader) {
    text = `graph TD\n${text}`;
  }

  // Quote unquoted square bracket node labels that contain parentheses or colons
  // Example: A[Immutable String (Java String)] -> A["Immutable String (Java String)"]
  text = text.replace(/\[\s*([A-Za-z0-9_:\s]+?\([A-Za-z0-9_:\s\-+/*.]+\)[^\]]*?)\s*\]/g, '["$1"]');

  return text;
}

/**
 * Extracts clean, human-readable flow steps from mermaid code when rendering fails
 */
function extractStructuredSteps(code: string): string[] {
  const lines = code.split('\n');
  const steps: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(graph|flowchart|sequenceDiagram|classDiagram|style|classDef)/i.test(trimmed)) continue;

    // Extract node text inside brackets or quotes
    const matches = trimmed.match(/\["?(.*?)"?\]|\("?(.*?)"?\)|\{"?(.*?)"?\}/g);
    if (matches && matches.length > 0) {
      matches.forEach((m) => {
        const clean = m.replace(/^[[({"'`]+|[\])}"''`]+$/g, '').trim();
        if (clean && !steps.includes(clean) && !/^(Start|End|Yes|No|True|False)$/i.test(clean)) {
          steps.push(clean);
        }
      });
    } else {
      const arrowParts = trimmed.split(/-->|->|==>|--/);
      arrowParts.forEach((p) => {
        const clean = p.replace(/^[A-Za-z0-9_]+\s*\[?|\]?\s*$/g, '').trim();
        if (clean && clean.length > 2 && !steps.includes(clean)) {
          steps.push(clean);
        }
      });
    }
  }

  return steps;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderFailed, setRenderFailed] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      if (!code || !code.trim()) return;

      const sanitized = sanitizeMermaid(code);

      // Clean up any rogue mermaid error nodes in body
      if (typeof document !== 'undefined') {
        document.querySelectorAll('[id^="dmermaid"]').forEach((el) => el.remove());
      }

      try {
        // Validate syntax with parse() before render() to avoid bomb SVG insertion
        await mermaid.parse(sanitized);

        const uniqueId = 'mermaid_' + Math.random().toString(36).substring(2, 9);
        const { svg } = await mermaid.render(uniqueId, sanitized);

        // Double check: if SVG contains Mermaid's built-in error bomb text, treat as failed
        if (svg.includes('Syntax error in text') || svg.includes('error-icon') || svg.includes('class="error"')) {
          if (isMounted) {
            setRenderFailed(true);
            setSvgContent('');
          }
          return;
        }

        if (isMounted) {
          setSvgContent(svg);
          setRenderFailed(false);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Mermaid syntax note: falling back to plain structured flowcard', err);
          setRenderFailed(true);
          setSvgContent('');
        }
      } finally {
        if (typeof document !== 'undefined') {
          document.querySelectorAll('[id^="dmermaid"]').forEach((el) => el.remove());
        }
      }
    };

    void renderChart();

    return () => {
      isMounted = false;
      if (typeof document !== 'undefined') {
        document.querySelectorAll('[id^="dmermaid"]').forEach((el) => el.remove());
      }
    };
  }, [code]);

  // Fallback: Elegant Plain Structured Text Flowcard (Zero bomb graphics, zero broken errors)
  if (renderFailed || !svgContent) {
    const steps = extractStructuredSteps(code);

    return (
      <div className="my-3 rounded-2xl border-2 border-teal-200/80 bg-gradient-to-br from-teal-50/50 via-white to-indigo-50/40 p-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-teal-100">
          <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-teal-600" />
            Structured Flowchart / Process Diagram
          </span>
          <span className="text-[10px] text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full font-semibold">
            Structured Flow
          </span>
        </div>

        {steps.length > 0 ? (
          <div className="space-y-2 py-1">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white shadow-2xs mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 rounded-xl bg-white border border-teal-100 p-2.5 text-xs text-stone-800 font-medium shadow-2xs">
                  {step}
                </div>
                {idx < steps.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-teal-400 shrink-0 self-center hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-stone-900 p-3 text-emerald-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">
            {code.replace(/^(graph|flowchart)\s+[A-Z]+\s*/i, '').trim()}
          </div>
        )}
      </div>
    );
  }

  // Live SVG Diagram
  return (
    <div className="my-3 rounded-2xl border-2 border-indigo-200/80 bg-white p-4 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200">
        <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-indigo-600" />
          Interactive Visual Flowchart / Diagram
        </span>
        <span className="text-[10px] text-stone-500 font-medium">Rendered Live</span>
      </div>
      <div
        ref={containerRef}
        className="w-full overflow-x-auto py-2 flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
};
