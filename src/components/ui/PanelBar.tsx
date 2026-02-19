import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import PanelCard from './PanelCard';

interface PanelConfig {
  id: string;
  name: string;
  icon: string;
  systemPrompt: string;
  instruction: string;
  isBuiltIn: boolean;
  color: string;
}

interface PanelState {
  content: string;
  isStreaming: boolean;
  error: string | null;
}

interface PanelBarProps {
  panelConfigs: PanelConfig[];
  activePanelIds: string[];
  panelStates: Map<string, PanelState>;
  onTogglePanel: (panelId: string, active: boolean) => void;
  onCreateEphemeral?: (name: string, instruction: string) => void;
}

// Unified orange theme — all panel colors resolve to the same palette.
const UNIFIED_PILL = {
  pill: 'text-slate-400/60 border-slate-500/20',
  pillActive: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
} as const;

const COLOR_MAP: Record<string, { pill: string; pillActive: string }> = {
  orange:  UNIFIED_PILL,
  emerald: UNIFIED_PILL,
  blue:    UNIFIED_PILL,
  indigo:  UNIFIED_PILL,
  amber:   UNIFIED_PILL,
};

const PanelBar: React.FC<PanelBarProps> = ({
  panelConfigs, activePanelIds, panelStates, onTogglePanel, onCreateEphemeral,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInstruction, setNewInstruction] = useState('');
  const activeSet = new Set(activePanelIds);

  const handleAddEphemeral = () => {
    if (!newName.trim() || !newInstruction.trim()) return;
    onCreateEphemeral?.(newName.trim(), newInstruction.trim());
    setNewName('');
    setNewInstruction('');
    setShowAddForm(false);
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      {/* Toggle pills row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {panelConfigs.map(config => {
          const isActive = activeSet.has(config.id);
          const colors = COLOR_MAP[config.color] || COLOR_MAP.blue;

          return (
            <button
              key={config.id}
              onClick={() => onTogglePanel(config.id, !isActive)}
              className={`
                px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all duration-200
                ${isActive ? colors.pillActive : `${colors.pill} bg-transparent hover:bg-white/5`}
              `}
            >
              {config.name}
            </button>
          );
        })}

        {/* Add ephemeral panel button */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-500/20 text-slate-500 hover:text-orange-400 hover:border-orange-500/40 hover:bg-white/5 transition-colors"
          title="Add custom panel for this meeting"
        >
          {showAddForm ? <X size={10} /> : <Plus size={10} />}
        </button>
      </div>

      {/* Inline add form */}
      {showAddForm && (
        <div className="flex flex-col gap-1.5 bg-white/5 border border-white/10 rounded-lg p-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Panel name"
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/30"
          />
          <textarea
            value={newInstruction}
            onChange={e => setNewInstruction(e.target.value)}
            placeholder="What should this panel analyze? (e.g. 'Track action items assigned to each person')"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/30 resize-none"
          />
          <button
            onClick={handleAddEphemeral}
            disabled={!newName.trim() || !newInstruction.trim()}
            className="self-end px-3 py-1 rounded-md text-[10px] font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Add Panel
          </button>
        </div>
      )}

      {/* Active panel cards */}
      {activePanelIds.length > 0 && (
        <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {activePanelIds.map(panelId => {
            const config = panelConfigs.find(p => p.id === panelId);
            if (!config) return null;
            const state = panelStates.get(panelId);

            return (
              <PanelCard
                key={panelId}
                panelId={panelId}
                name={config.name}
                icon={config.icon}
                color={config.color}
                content={state?.content || ''}
                isStreaming={state?.isStreaming || false}
                error={state?.error || null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PanelBar;
