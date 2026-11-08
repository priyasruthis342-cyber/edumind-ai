import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
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

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderFailed, setRenderFailed] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      if (!code || !code.trim()) return;
      try {
        const uniqueId = 'mermaid_' + Math.random().toString(36).substring(2, 9);
        const { svg } = await mermaid.render(uniqueId, code.trim());
        if (isMounted) {
          setSvgContent(svg);
          setRenderFailed(false);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Mermaid rendering notice:', err);
          setRenderFailed(true);
        }
      }
    };
    void renderChart();
    return () => {
      isMounted = false;
    };
  }, [code]);

  if (renderFailed || !svgContent) {
    return (
      <div className="rounded-xl bg-slate-950 p-3.5 my-2 text-cyan-200 font-mono text-xs overflow-x-auto border border-cyan-900/60 shadow-inner">
        <div className="text-[10px] uppercase font-bold text-cyan-400 mb-1 pb-1 border-b border-cyan-900">
          Diagram Code Flow
        </div>
        <pre className="whitespace-pre leading-relaxed">{code}</pre>
      </div>
    );
  }

  return (
    <div className="my-3 rounded-2xl border-2 border-indigo-200/80 bg-white p-4 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200">
        <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
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

