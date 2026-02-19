import React, { useState } from 'react';
import {
  ListChecks, FileText, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
    <div className={`bg-white/5 border ${colors.border} rounded-lg overflow-hidden transition-all`}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <IconComponent className={`w-3.5 h-3.5 ${colors.header}`} />
          <span className={`text-[11px] font-semibold uppercase tracking-wide ${colors.header}`}>
            {name}
          </span>
          {isStreaming && (
            <Loader2 className={`w-3 h-3 ${colors.header} animate-spin`} />
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
        )}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-3 pb-3 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : content ? (
            <div className="text-slate-200 text-[12px] leading-relaxed markdown-content">
              <ReactMarkdown
                components={{
                  p: ({ ...props }: any) => <p className="mb-1.5 last:mb-0" {...props} />,
                  ul: ({ ...props }: any) => <ul className="list-disc ml-3 mb-1.5 space-y-0.5" {...props} />,
                  li: ({ ...props }: any) => <li className="pl-0.5" {...props} />,
                  strong: ({ ...props }: any) => <strong className={`font-bold ${colors.text}`} {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">Waiting for conversation...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PanelCard;
