import React, { useState, useEffect, useRef } from 'react';
import { X, Pencil, Link, Unlink, Plus } from 'lucide-react';

interface TranscriptEntry {
    id: string;
    speaker: string;
    text: string;
    final: boolean;
    timestamp: number;
}

interface SpeakerInfo {
    id: string;
    channel_label: string;
    display_name: string | null;
    person_id: string | null;
    person_name: string | null;
    is_self: boolean;
}

interface PersonResult {
    id: string;
    name: string;
    email: string | null;
}

interface TranscriptPanelProps {
    meetingId?: string;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ meetingId }) => {
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [speakers, setSpeakers] = useState<Map<string, SpeakerInfo>>(new Map());
    const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [personResults, setPersonResults] = useState<PersonResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [currentMeetingId, setCurrentMeetingId] = useState<string | undefined>(meetingId);
    const scrollRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const idCounter = useRef(0);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editHandledRef = useRef(false);
    const seenSpeakers = useRef<Set<string>>(new Set());

    // Sync meetingId from prop or IPC
    useEffect(() => {
        if (meetingId) { setCurrentMeetingId(meetingId); return; }
        const unsub = window.electronAPI.onMeetingIdUpdated((id) => setCurrentMeetingId(id));
        return () => { unsub(); };
    }, [meetingId]);

    useEffect(() => {
        const unsubscribe = window.electronAPI.onNativeAudioTranscript((data) => {
            if (!seenSpeakers.current.has(data.speaker)) {
                seenSpeakers.current.add(data.speaker);
                console.log('[TranscriptPanel] New speaker ID from backend:', JSON.stringify(data.speaker), '| All seen:', [...seenSpeakers.current]);
            }

            // Real-time identity from voiceprint recognition
            if (data.person_id && data.person_name) {
                setSpeakers(prev => {
                    const existing = prev.get(data.speaker);
                    if (existing?.person_id === data.person_id) return prev;
                    const next = new Map(prev);
                    next.set(data.speaker, {
                        ...(existing || { id: '', channel_label: data.speaker, display_name: null, person_id: null, person_name: null, is_self: false }),
                        person_id: data.person_id!,
                        person_name: data.person_name!,
                    });
                    return next;
                });
            }

            setEntries(prev => {
                // Find the last non-final entry for this speaker (not just the absolute last entry)
                const lastIdx = prev.findLastIndex(e => e.speaker === data.speaker && !e.final);
                if (lastIdx >= 0) {
                    const updated = [...prev];
                    updated[lastIdx] = { ...updated[lastIdx], text: data.text, final: data.final };
                    return updated;
                }
                idCounter.current += 1;
                return [...prev, {
                    id: `t-${idCounter.current}`,
                    speaker: data.speaker,
                    text: data.text,
                    final: data.final,
                    timestamp: Date.now(),
                }];
            });
        });
        return () => { unsubscribe(); };
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [entries]);

    // Clear on session reset
    useEffect(() => {
        const unsubscribe = window.electronAPI.onSessionReset(() => {
            setEntries([]);
            setSpeakers(new Map());
            idCounter.current = 0;
            seenSpeakers.current.clear();
        });
        return () => { unsubscribe(); };
    }, []);

    // Load speakers when meetingId available
    useEffect(() => {
        if (!currentMeetingId) return;
        window.electronAPI.getMeetingSpeakers(currentMeetingId).then((list) => {
            const map = new Map<string, SpeakerInfo>();
            list.forEach(s => map.set(s.channel_label, s));
            setSpeakers(map);
        });
    }, [currentMeetingId]);

    // Focus edit input
    useEffect(() => {
        if (editingSpeaker && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingSpeaker]);

    // Debounced person search — always show dropdown when typing (for create option)
    useEffect(() => {
        if (!editingSpeaker) {
            setPersonResults([]);
            setShowDropdown(false);
            return;
        }
        if (!editValue.trim()) {
            setPersonResults([]);
            setShowDropdown(false);
            return;
        }
        setShowDropdown(true);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            const results = await window.electronAPI.searchPersons(editValue.trim(), 5);
            setPersonResults(results || []);
        }, 200);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [editValue, editingSpeaker]);

    const getSpeakerLabel = (speaker: string) => {
        const info = speakers.get(speaker);
        if (info?.display_name) return info.display_name;
        if (info?.person_name) return info.person_name;
        if (speaker === 'user') return 'You';
        if (speaker === 'interviewer') return 'Speaker';
        // Handle diarized speaker labels like "speaker_0", "speaker_SPEAKER_00", "speaker_speaker0", etc.
        const match = speaker.match(/speaker_(?:SPEAKER_)?(?:speaker)?(\d+)/i);
        if (match) return `Speaker ${parseInt(match[1], 10) + 1}`;
        return speaker;
    };

    const handleStartEdit = (speaker: string) => {
        editHandledRef.current = false;
        setEditingSpeaker(speaker);
        setEditValue(getSpeakerLabel(speaker));
        setPersonResults([]);
        setShowDropdown(false);
    };

    const handleSelectPerson = async (person: PersonResult) => {
        if (!editingSpeaker || !currentMeetingId) return;
        editHandledRef.current = true;
        const speakerInfo = speakers.get(editingSpeaker);
        if (speakerInfo) {
            // Try voiceprint enrollment first (also links the speaker as a side effect)
            const voiceprint = await window.electronAPI.enrollVoiceprint(person.id, currentMeetingId, speakerInfo.channel_label);
            if (!voiceprint) {
                // Fallback to plain rename/link if enrollment fails (e.g. older meeting without embeddings)
                await window.electronAPI.renameSpeaker(currentMeetingId, speakerInfo.id, person.name, person.id);
            }
            setSpeakers(prev => {
                const next = new Map(prev);
                next.set(editingSpeaker!, { ...speakerInfo, display_name: person.name, person_id: person.id, person_name: person.name });
                return next;
            });
        }
        setEditingSpeaker(null);
        setEditValue('');
        setShowDropdown(false);
    };

    const handleCreateAndLink = async (name: string) => {
        if (!editingSpeaker || !currentMeetingId) return;
        editHandledRef.current = true;
        const speakerInfo = speakers.get(editingSpeaker);
        if (!speakerInfo) return;
        const person = await window.electronAPI.createPerson(name);
        if (!person) return;
        const voiceprint = await window.electronAPI.enrollVoiceprint(person.id, currentMeetingId, speakerInfo.channel_label);
        if (!voiceprint) {
            await window.electronAPI.renameSpeaker(currentMeetingId, speakerInfo.id, person.name, person.id);
        }
        setSpeakers(prev => {
            const next = new Map(prev);
            next.set(editingSpeaker!, { ...speakerInfo, display_name: person.name, person_id: person.id, person_name: person.name });
            return next;
        });
        setEditingSpeaker(null);
        setEditValue('');
        setShowDropdown(false);
    };

    const handleFinishEdit = async () => {
        if (editHandledRef.current) return;
        editHandledRef.current = true;
        if (!editingSpeaker || !currentMeetingId) return;
        const trimmed = editValue.trim();
        const speakerInfo = speakers.get(editingSpeaker);
        if (trimmed && speakerInfo && trimmed !== getSpeakerLabel(editingSpeaker)) {
            await window.electronAPI.renameSpeaker(currentMeetingId, speakerInfo.id, trimmed);
            setSpeakers(prev => {
                const next = new Map(prev);
                next.set(editingSpeaker!, { ...speakerInfo, display_name: trimmed });
                return next;
            });
        }
        setEditingSpeaker(null);
        setEditValue('');
        setShowDropdown(false);
    };

    const handleCancelEdit = () => {
        editHandledRef.current = true;
        setEditingSpeaker(null);
        setEditValue('');
        setShowDropdown(false);
    };

    const handleClearMapping = async (speaker: string) => {
        if (!currentMeetingId) return;
        const speakerInfo = speakers.get(speaker);
        if (speakerInfo) {
            await window.electronAPI.unlinkSpeakerPerson(currentMeetingId, speakerInfo.id);
            setSpeakers(prev => {
                const next = new Map(prev);
                next.set(speaker, { ...speakerInfo, display_name: null, person_id: null, person_name: null });
                return next;
            });
        }
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
        for (let i = 0; i < speaker.length; i++) hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="glass-panel-heavy w-[300px] max-h-[420px] flex flex-col rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0 drag-region select-none">
                <span className="text-xs font-medium text-text-secondary">Live Transcript</span>
                <button
                    onClick={() => window.electronAPI.toggleTranscriptPanel()}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-tertiary hover:text-text-secondary transition-colors"
                >
                    <X size={12} />
                </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0 no-drag">
                {entries.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-xs text-text-tertiary">Waiting for audio...</span>
                    </div>
                ) : (
                    entries.map((entry) => (
                        <div key={entry.id} className="flex flex-col gap-0.5">
                            {editingSpeaker === entry.speaker ? (
                                <div className="relative" ref={dropdownRef}>
                                    <input
                                        ref={editInputRef}
                                        type="text"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onBlur={() => setTimeout(() => { handleFinishEdit(); }, 150)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); handleFinishEdit(); }
                                            if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit(); }
                                        }}
                                        className="inline-flex self-start px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-input border border-border-subtle text-text-primary outline-none w-32"
                                    />
                                    {showDropdown && (() => {
                                        const canCreate = editValue.trim().length > 0 && !personResults.some(p => p.name.toLowerCase() === editValue.trim().toLowerCase());
                                        if (personResults.length === 0 && !canCreate) return null;
                                        return (
                                            <div className="absolute top-full left-0 mt-1 w-44 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 overflow-hidden max-h-[160px] overflow-y-auto">
                                                {personResults.length > 0 && (
                                                    <>
                                                        <div className="px-2 py-1 text-[9px] font-medium text-text-tertiary uppercase tracking-wider">Link to person</div>
                                                        {personResults.map(p => (
                                                            <button
                                                                key={p.id}
                                                                onMouseDown={(e) => { e.preventDefault(); handleSelectPerson(p); }}
                                                                className="w-full text-left px-2 py-1.5 text-[11px] text-text-primary hover:bg-bg-input flex items-center gap-1.5 transition-colors"
                                                            >
                                                                <Link size={10} className="text-text-tertiary shrink-0" />
                                                                <span className="truncate">{p.name}</span>
                                                            </button>
                                                        ))}
                                                    </>
                                                )}
                                                {canCreate && (
                                                    <>
                                                        <div className={`px-2 py-1 text-[9px] font-medium text-text-tertiary uppercase tracking-wider ${personResults.length > 0 ? 'border-t border-border-subtle' : ''}`}>Create new</div>
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); handleCreateAndLink(editValue.trim()); }}
                                                            className="w-full text-left px-2 py-1.5 text-[11px] text-text-primary hover:bg-bg-input flex items-center gap-1.5 transition-colors"
                                                        >
                                                            <Plus size={10} className="text-orange-400 shrink-0" />
                                                            <span className="truncate">Create "{editValue.trim()}"</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 self-start">
                                    <button
                                        onClick={() => handleStartEdit(entry.speaker)}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${getSpeakerColor(entry.speaker)} cursor-pointer hover:opacity-80 transition-opacity`}
                                        title="Click to rename speaker"
                                    >
                                        {getSpeakerLabel(entry.speaker)}
                                        {speakers.get(entry.speaker)?.person_id && <Link size={8} className="opacity-50" />}
                                    </button>
                                    {speakers.get(entry.speaker)?.display_name && (
                                        <button
                                            onClick={() => handleClearMapping(entry.speaker)}
                                            className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-red-500/20 text-text-tertiary hover:text-red-400 transition-colors"
                                            title="Clear speaker name"
                                        >
                                            <X size={8} />
                                        </button>
                                    )}
                                </div>
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
