import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronRight, Trash2, Loader2 } from 'lucide-react';

interface PersonItem {
    id: string;
    name: string;
    email: string | null;
}

interface VoiceprintItem {
    id: string;
    person_id: string;
    meeting_id: string | null;
    speaker_label: string | null;
    created_at: string;
}

export const VoiceprintSettings: React.FC = () => {
    const [search, setSearch] = useState('');
    const [persons, setPersons] = useState<PersonItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [voiceprints, setVoiceprints] = useState<Map<string, VoiceprintItem[]>>(new Map());
    const [loadingVoiceprints, setLoadingVoiceprints] = useState<string | null>(null);
    const [deletingPerson, setDeletingPerson] = useState<string | null>(null);
    const [deletingVoiceprint, setDeletingVoiceprint] = useState<string | null>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load persons on mount and on search change
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            setLoading(true);
            try {
                const results = await window.electronAPI.searchPersons(search.trim() || undefined, 50);
                setPersons(results || []);
            } catch {
                setPersons([]);
            }
            setLoading(false);
        }, search ? 300 : 0);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [search]);

    const handleExpand = async (personId: string) => {
        if (expandedId === personId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(personId);
        if (!voiceprints.has(personId)) {
            setLoadingVoiceprints(personId);
            try {
                const vps = await window.electronAPI.getPersonVoiceprints(personId);
                setVoiceprints(prev => new Map(prev).set(personId, vps || []));
            } catch {
                setVoiceprints(prev => new Map(prev).set(personId, []));
            }
            setLoadingVoiceprints(null);
        }
    };

    const handleDeletePerson = async (personId: string) => {
        setDeletingPerson(personId);
        const success = await window.electronAPI.deletePerson(personId);
        if (success) {
            setPersons(prev => prev.filter(p => p.id !== personId));
            setVoiceprints(prev => {
                const next = new Map(prev);
                next.delete(personId);
                return next;
            });
            if (expandedId === personId) setExpandedId(null);
        }
        setDeletingPerson(null);
    };

    const handleDeleteVoiceprint = async (personId: string, voiceprintId: string) => {
        setDeletingVoiceprint(voiceprintId);
        const success = await window.electronAPI.deleteVoiceprint(voiceprintId);
        if (success) {
            setVoiceprints(prev => {
                const next = new Map(prev);
                const current = next.get(personId) || [];
                next.set(personId, current.filter(v => v.id !== voiceprintId));
                return next;
            });
        }
        setDeletingVoiceprint(null);
    };

    return (
        <div className="space-y-6 animated fadeIn">
            <div>
                <h3 className="text-lg font-bold text-text-primary mb-1">People & Voiceprints</h3>
                <p className="text-xs text-text-secondary mb-4">Manage known people and their voice enrollments. Voiceprints help automatically identify speakers in meetings.</p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search people..."
                    className="w-full pl-9 pr-3 py-2 bg-bg-input border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-orange-500/50"
                />
            </div>

            {/* Persons list */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={18} className="animate-spin text-text-tertiary" />
                </div>
            ) : persons.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-sm text-text-tertiary">
                        {search ? 'No people found matching your search.' : 'No people yet. People are created when you assign speakers in meetings.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-1">
                    {persons.map(person => {
                        const isExpanded = expandedId === person.id;
                        const personVoiceprints = voiceprints.get(person.id) || [];
                        const isLoadingVp = loadingVoiceprints === person.id;

                        return (
                            <div key={person.id} className="bg-bg-card rounded-xl border border-border-subtle overflow-hidden">
                                {/* Person row */}
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <button
                                        onClick={() => handleExpand(person.id)}
                                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-bg-item-surface border border-border-subtle flex items-center justify-center text-text-tertiary text-xs font-bold shrink-0">
                                            {person.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium text-text-primary truncate">{person.name}</div>
                                            {person.email && (
                                                <div className="text-[11px] text-text-tertiary truncate">{person.email}</div>
                                            )}
                                        </div>
                                        <ChevronRight
                                            size={14}
                                            className={`text-text-tertiary transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                                        />
                                    </button>
                                    <button
                                        onClick={() => handleDeletePerson(person.id)}
                                        disabled={deletingPerson === person.id}
                                        className="p-1.5 rounded-md hover:bg-red-500/10 text-text-tertiary hover:text-red-400 transition-colors shrink-0 disabled:opacity-50"
                                        title="Delete person and all voiceprints"
                                    >
                                        {deletingPerson === person.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={14} />
                                        )}
                                    </button>
                                </div>

                                {/* Expanded voiceprints */}
                                {isExpanded && (
                                    <div className="border-t border-border-subtle bg-bg-main px-4 py-3">
                                        {isLoadingVp ? (
                                            <div className="flex items-center gap-2 py-2">
                                                <Loader2 size={12} className="animate-spin text-text-tertiary" />
                                                <span className="text-xs text-text-tertiary">Loading voiceprints...</span>
                                            </div>
                                        ) : personVoiceprints.length === 0 ? (
                                            <p className="text-xs text-text-tertiary py-1">No voiceprints enrolled. Assign this person to a speaker in a meeting to create one.</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mb-1">
                                                    {personVoiceprints.length} voiceprint{personVoiceprints.length !== 1 ? 's' : ''}
                                                </div>
                                                {personVoiceprints.map(vp => (
                                                    <div key={vp.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-bg-card border border-border-subtle">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-xs text-text-secondary truncate">
                                                                {vp.speaker_label || 'Unknown speaker'}
                                                            </div>
                                                            <div className="text-[10px] text-text-tertiary">
                                                                {new Date(vp.created_at).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteVoiceprint(person.id, vp.id)}
                                                            disabled={deletingVoiceprint === vp.id}
                                                            className="p-1 rounded hover:bg-red-500/10 text-text-tertiary hover:text-red-400 transition-colors shrink-0 disabled:opacity-50"
                                                            title="Delete voiceprint"
                                                        >
                                                            {deletingVoiceprint === vp.id ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={12} />
                                                            )}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
