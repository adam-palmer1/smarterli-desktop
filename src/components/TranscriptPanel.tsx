import React, { useState, useEffect, useRef } from 'react';
import { X, Pencil } from 'lucide-react';

interface TranscriptEntry {
    id: string;
    speaker: string;
    text: string;
    final: boolean;
    timestamp: number;
}

const TranscriptPanel: React.FC = () => {
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [speakerMappings, setSpeakerMappings] = useState<Map<string, string>>(new Map());
    const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const idCounter = useRef(0);

    useEffect(() => {
        const unsubscribe = window.electronAPI.onNativeAudioTranscript((data) => {
            setEntries(prev => {
                const last = prev[prev.length - 1];

                // If same speaker and last entry is not final, update it (live preview)
                if (last && !last.final && last.speaker === data.speaker) {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        ...last,
                        text: data.text,
                        final: data.final,
                    };
                    return updated;
                }

                // Speaker change or last was final → start new entry
                idCounter.current += 1;
                return [
                    ...prev,
                    {
                        id: `t-${idCounter.current}`,
                        speaker: data.speaker,
                        text: data.text,
                        final: data.final,
                        timestamp: Date.now(),
                    },
                ];
            });
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [entries]);

    // Clear on session reset
    useEffect(() => {
        const unsubscribe = window.electronAPI.onSessionReset(() => {
            setEntries([]);
            setSpeakerMappings(new Map());
            idCounter.current = 0;
        });
        return () => { unsubscribe(); };
    }, []);

    // Load speaker mappings on mount + subscribe to updates
    useEffect(() => {
        window.electronAPI.getSpeakerMappings().then((mappings) => {
            const map = new Map<string, string>();
            mappings.forEach(m => map.set(m.original, m.displayName));
            setSpeakerMappings(map);
        });

        const unsubscribe = window.electronAPI.onSpeakerMappingsUpdated((mappings) => {
            const map = new Map<string, string>();
            mappings.forEach(m => map.set(m.original, m.displayName));
            setSpeakerMappings(map);
        });
        return () => { unsubscribe(); };
    }, []);

    // Focus edit input when editing
    useEffect(() => {
        if (editingSpeaker && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingSpeaker]);

    const getSpeakerLabel = (speaker: string) => {
        if (speakerMappings.has(speaker)) return speakerMappings.get(speaker)!;
        if (speaker === 'user') return 'You';
        if (speaker === 'interviewer') return 'Speaker';
        return speaker;
    };

    const handleStartEdit = (speaker: string) => {
        if (speaker === 'user') return; // Don't allow renaming self
        setEditingSpeaker(speaker);
        setEditValue(getSpeakerLabel(speaker));
    };

    const handleFinishEdit = async () => {
        if (!editingSpeaker) return;
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== getSpeakerLabel(editingSpeaker)) {
            await window.electronAPI.renameSpeaker(editingSpeaker, trimmed);
        }
        setEditingSpeaker(null);
        setEditValue('');
    };

    const getSpeakerColor = (speaker: string) => {
        if (speaker === 'user') return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
        if (speaker === 'interviewer') return 'bg-purple-500/20 text-purple-600 dark:text-purple-400';
        const colors = [
            'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
            'bg-amber-500/20 text-amber-600 dark:text-amber-400',
            'bg-rose-500/20 text-rose-600 dark:text-rose-400',
            'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
        ];
        let hash = 0;
        for (let i = 0; i < speaker.length; i++) {
            hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="glass-panel-heavy w-[300px] max-h-[420px] flex flex-col rounded-xl overflow-hidden">
            {/* Header — drag region */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0 drag-region select-none">
                <span className="text-xs font-medium text-text-secondary">Live Transcript</span>
                <button
                    onClick={() => window.electronAPI.toggleTranscriptPanel()}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-tertiary hover:text-text-secondary transition-colors"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Transcript list */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0 no-drag">
                {entries.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-xs text-text-tertiary">Waiting for audio...</span>
                    </div>
                ) : (
                    entries.map((entry) => (
                        <div key={entry.id} className="flex flex-col gap-0.5">
                            {editingSpeaker === entry.speaker ? (
                                <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={handleFinishEdit}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleFinishEdit();
                                        if (e.key === 'Escape') { setEditingSpeaker(null); setEditValue(''); }
                                    }}
                                    className={`inline-flex self-start px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-input border border-border-subtle text-text-primary outline-none w-24`}
                                />
                            ) : (
                                <button
                                    onClick={() => handleStartEdit(entry.speaker)}
                                    className={`inline-flex self-start items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${getSpeakerColor(entry.speaker)} ${entry.speaker !== 'user' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
                                    title={entry.speaker !== 'user' ? 'Click to rename speaker' : undefined}
                                >
                                    {getSpeakerLabel(entry.speaker)}
                                    {entry.speaker !== 'user' && <Pencil size={8} className="opacity-0 group-hover:opacity-50" />}
                                </button>
                            )}
                            <p className={`text-xs text-text-primary leading-relaxed ${!entry.final ? 'opacity-60 italic' : ''}`}>
                                {entry.text}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TranscriptPanel;
