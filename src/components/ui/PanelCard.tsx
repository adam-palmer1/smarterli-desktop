import React, { useState } from 'react';
import {
  ListChecks, FileText, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface PanelCardProps {
  panelId: string;
  name: string;
  icon: string;
  color: string;
  content: string;
  isStreaming: boolean;
  error: string | null;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  ListChecks,
  FileText,
  RefreshCw,
  AlertTriangle,
};

// Unified orange theme — the `color` prop is accepted for backward compat but all
// values resolve to the same palette.
const UNIFIED_COLORS = {
  border: 'border-orange-500/30',
  header: 'text-orange-400',
  text: 'text-slate-200',
  dot: 'bg-orange-400',
} as const;

const COLOR_MAP: Record<string, { border: string; header: string; text: string; dot: string }> = {
  orange:  UNIFIED_COLORS,
  emerald: UNIFIED_COLORS,
  blue:    UNIFIED_COLORS,
  indigo:  UNIFIED_COLORS,
  amber:   UNIFIED_COLORS,
};

const PanelCard: React.FC<PanelCardProps> = ({
  name, icon, color, content, isStreaming, error,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const IconComponent = ICON_MAP[icon] || FileText;
  const colors = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className={`bg-glass-bg-light border border-glass-border rounded-lg overflow-hidden transition-all`}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-glass-bg-light transition-colors"
      >
        <div className="flex items-center gap-2">
          <IconComponent className={`w-3.5 h-3.5 text-accent-primary`} />
          <span className={`text-[11px] font-semibold uppercase tracking-wide text-accent-primary`}>
            {name}
          </span>
          {isStreaming && (
            <Loader2 className={`w-3 h-3 text-accent-primary animate-spin`} />
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-text-tertiary" />
        )}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-3 pb-3 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : content ? (
            <div className="text-text-primary text-[12px] leading-relaxed markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  p: ({ ...props }: any) => <p className="mb-1.5 last:mb-0" {...props} />,
                  ul: ({ ...props }: any) => <ul className="list-disc ml-3 mb-1.5 space-y-0.5" {...props} />,
                  ol: ({ ...props }: any) => <ol className="list-decimal ml-3 mb-1.5 space-y-0.5" {...props} />,
                  li: ({ ...props }: any) => <li className="pl-0.5" {...props} />,
                  strong: ({ ...props }: any) => <strong className="font-bold text-text-primary" {...props} />,
                  code: ({ ...props }: any) => <code className="bg-black/20 rounded px-1 py-0.5 text-[11px] font-mono" {...props} />,
                  a: ({ ...props }: any) => <a className="text-accent-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-[11px] text-text-tertiary italic">Waiting for conversation...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PanelCard;
