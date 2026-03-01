import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Mail, Link, ChevronDown, Play, ArrowUp, Copy, Check, MoreHorizontal, Settings, ArrowRight, X, Users, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MeetingChatOverlay from './MeetingChatOverlay';
import EditableTextBlock from './EditableTextBlock';
import SmarterliLogo from './icon.png';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

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

const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
};

const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${Number(seconds) < 10 ? '0' : ''}${seconds}`;
};

interface Meeting {
    id: string;
    title: string;
    date: string;
    duration: string;
    summary: string;
    detailedSummary?: {
        overview?: string;
        actionItems: string[];
        keyPoints: string[];
        actionItemsTitle?: string;
        keyPointsTitle?: string;
    };
    transcript?: Array<{
        speaker: string;
        text: string;
        timestamp: number;
    }>;
    usage?: Array<{
        type: 'assist' | 'followup' | 'chat' | 'followup_questions';
        timestamp: number;
        question?: string;
        answer?: string;
        items?: string[];
    }>;
}

interface MeetingDetailsProps {
    meeting: Meeting;
    onBack: () => void;
    onOpenSettings: () => void;
}

const MeetingDetails: React.FC<MeetingDetailsProps> = ({ meeting: initialMeeting }) => {
    // We need local state for the meeting object to reflect optimistic updates
    const [meeting, setMeeting] = useState<Meeting>(initialMeeting);
    const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'usage'>('summary');
    const [query, setQuery] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [speakers, setSpeakers] = useState<Map<string, SpeakerInfo>>(new Map());
    const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [personResults, setPersonResults] = useState<PersonResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const editInputRef = useRef<HTMLInputElement>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editHandledRef = useRef(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isSelectingRef = useRef(false);

    // Load speakers on mount
    useEffect(() => {
        if (meeting.id && window.electronAPI?.getMeetingSpeakers) {
            window.electronAPI.getMeetingSpeakers(meeting.id).then((list) => {
                const map = new Map<string, SpeakerInfo>();
                list.forEach((s: any) => map.set(s.channel_label, s));
                setSpeakers(map);
            });
        }
    }, [meeting.id]);

    // Focus edit input
    useEffect(() => {
        if (editingSpeaker && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingSpeaker]);

    // Debounced person search — always show dropdown when editing (other speakers are always available)
    useEffect(() => {
        if (!editingSpeaker) {
            setPersonResults([]);
            setShowDropdown(false);
            return;
        }
        // Always show dropdown for merge options even before typing
        setShowDropdown(true);
        if (!editValue.trim()) {
            setPersonResults([]);
            return;
        }
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
        const match = speaker.match(/speaker_(?:SPEAKER_)?(?:speaker)?(\d+)/i);
        if (match) return `Speaker ${parseInt(match[1], 10) + 1}`;
        return speaker;
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

    const handleStartEdit = (speaker: string) => {
        editHandledRef.current = false;
        setEditingSpeaker(speaker);
        setEditValue('');
        setPersonResults([]);
    };

    const handleSelectPerson = async (person: PersonResult) => {
        if (!editingSpeaker || !meeting.id) return;
        editHandledRef.current = true;
        const speakerInfo = speakers.get(editingSpeaker);
        if (speakerInfo) {
            await window.electronAPI.renameSpeaker(meeting.id, speakerInfo.id, person.name, person.id);
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
        if (!editingSpeaker || !meeting.id) return;
        editHandledRef.current = true;
        const speakerInfo = speakers.get(editingSpeaker);
        if (!speakerInfo) return;
        const person = await window.electronAPI.createPerson(name);
        if (!person) return;
        await window.electronAPI.renameSpeaker(meeting.id, speakerInfo.id, person.name, person.id);
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
        if (!editingSpeaker || !meeting.id) { setEditingSpeaker(null); setEditValue(''); setShowDropdown(false); return; }
        const trimmed = editValue.trim();
        const speakerInfo = speakers.get(editingSpeaker);
        // If user typed a new name, rename; if empty, treat as cancel
        if (trimmed && speakerInfo && trimmed !== getSpeakerLabel(editingSpeaker)) {
            await window.electronAPI.renameSpeaker(meeting.id, speakerInfo.id, trimmed);
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
        if (!meeting.id) return;
        const speakerInfo = speakers.get(speaker);
        if (speakerInfo) {
            await window.electronAPI.unlinkSpeakerPerson(meeting.id, speakerInfo.id);
            setSpeakers(prev => {
                const next = new Map(prev);
                next.set(speaker, { ...speakerInfo, display_name: null, person_id: null, person_name: null });
                return next;
            });
        }
    };

    // Merge current editing speaker into a target speaker (same person identity)
    const handleMergeSpeaker = async (targetChannelLabel: string) => {
        if (!editingSpeaker || !meeting.id) return;
        editHandledRef.current = true;
        const sourceInfo = speakers.get(editingSpeaker);
        const targetInfo = speakers.get(targetChannelLabel);
        if (!sourceInfo || !targetInfo) return;

        const targetName = getSpeakerLabel(targetChannelLabel);

        try {
            if (targetInfo.person_id) {
                await window.electronAPI.renameSpeaker(meeting.id, sourceInfo.id, targetName, targetInfo.person_id);
                setSpeakers(prev => {
                    const next = new Map(prev);
                    next.set(editingSpeaker!, { ...sourceInfo, display_name: targetName, person_id: targetInfo.person_id, person_name: targetInfo.person_name });
                    return next;
                });
            } else {
                // Target has no person — just rename source to match target's display name
                await window.electronAPI.renameSpeaker(meeting.id, sourceInfo.id, targetName);
                setSpeakers(prev => {
                    const next = new Map(prev);
                    next.set(editingSpeaker!, { ...sourceInfo, display_name: targetName });
                    return next;
                });
            }
        } catch (err) {
            // silently handle merge errors
        }
        setEditingSpeaker(null);
        setEditValue('');
        setShowDropdown(false);
    };

    const handleSubmitQuestion = () => {
        if (query.trim()) {
            setSubmittedQuery(query);
            if (!isChatOpen) {
                setIsChatOpen(true);
            }
            setQuery('');
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && query.trim()) {
            e.preventDefault();
            handleSubmitQuestion();
        }
    };

    const handleCopy = async () => {
        let textToCopy = '';

        if (activeTab === 'summary' && meeting.detailedSummary) {
            textToCopy = `
Meeting: ${meeting.title}
Date: ${new Date(meeting.date).toLocaleDateString()}

OVERVIEW:
${meeting.detailedSummary.overview || ''}

ACTION ITEMS:
${meeting.detailedSummary.actionItems?.map(item => `- ${item}`).join('\n') || 'None'}

KEY POINTS:
${meeting.detailedSummary.keyPoints?.map(item => `- ${item}`).join('\n') || 'None'}
            `.trim();
        } else if (activeTab === 'transcript' && meeting.transcript) {
            textToCopy = meeting.transcript.map(t => `[${formatTime(t.timestamp)}] ${getSpeakerLabel(t.speaker)}: ${t.text}`).join('\n');
        } else if (activeTab === 'usage' && meeting.usage) {
            textToCopy = meeting.usage.map(u => `Q: ${u.question || ''}\nA: ${u.answer || ''}`).join('\n\n');
        }

        if (!textToCopy) return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy content:', err);
        }
    };

    // UPDATE HANDLERS
    const handleTitleSave = async (newTitle: string) => {
        setMeeting(prev => ({ ...prev, title: newTitle }));
        if (window.electronAPI?.updateMeetingTitle) {
            await window.electronAPI.updateMeetingTitle(meeting.id, newTitle);
        }
    };

    const handleOverviewSave = async (newOverview: string) => {
        setMeeting(prev => ({
            ...prev,
            detailedSummary: {
                ...prev.detailedSummary!,
                overview: newOverview
            }
        }));
        if (window.electronAPI?.updateMeetingSummary) {
            await window.electronAPI.updateMeetingSummary(meeting.id, { overview: newOverview });
        }
    };

    const handleActionItemSave = async (index: number, newVal: string) => {
        const newItems = [...(meeting.detailedSummary?.actionItems || [])];
        if (!newVal.trim()) {
            // Optional: Remove empty items? For now just keep empty or update
        }
        newItems[index] = newVal;

        setMeeting(prev => ({
            ...prev,
            detailedSummary: {
                ...prev.detailedSummary!,
                actionItems: newItems
            }
        }));

        if (window.electronAPI?.updateMeetingSummary) {
            await window.electronAPI.updateMeetingSummary(meeting.id, { actionItems: newItems });
        }
    };

    const handleKeyPointSave = async (index: number, newVal: string) => {
        const newItems = [...(meeting.detailedSummary?.keyPoints || [])];
        newItems[index] = newVal;

        setMeeting(prev => ({
            ...prev,
            detailedSummary: {
                ...prev.detailedSummary!,
                keyPoints: newItems
            }
        }));

        if (window.electronAPI?.updateMeetingSummary) {
            await window.electronAPI.updateMeetingSummary(meeting.id, { keyPoints: newItems });
        }
    };


    return (
        <div className="h-full w-full flex flex-col bg-bg-secondary dark:bg-bg-primary text-text-secondary font-sans overflow-hidden">
            {/* Main Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="max-w-4xl mx-auto px-8 py-8 pb-32" // Added pb-32 for floating footer clearance
                >
                    {/* Meta Info & Actions Row */}
                    <div className="flex items-start justify-between mb-6">
                        <div className="w-full pr-4">
                            {/* Date formatting could be improved to use meeting.date if it's an ISO string */}
                            <div className="text-xs text-text-tertiary font-medium mb-1">
                                {new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </div>

                            {/* Editable Title */}
                            <EditableTextBlock
                                initialValue={meeting.title}
                                onSave={handleTitleSave}
                                tagName="h1"
                                className="text-3xl font-bold text-text-primary tracking-tight -ml-2 px-2 py-1 rounded-md transition-colors"
                                multiline={false}
                            />
                        </div>

                        {/* Moved Actions: Follow-up & Share (REMOVED per user request) */}
                        {/* <div className="flex items-center gap-2 mt-1"> ... </div> */}
                    </div>

                    {/* Participants */}
                    {speakers.size > 0 && (
                        <div className="mb-6">
                            <div className="text-xs font-medium text-text-tertiary mb-2">Participants</div>
                            <div className="flex flex-wrap items-center gap-2">
                                {Array.from(speakers.entries()).map(([channelLabel, info]) => (
                                    editingSpeaker === channelLabel ? (
                                        <div key={channelLabel} className="relative" ref={dropdownRef}>
                                            <input
                                                ref={editInputRef}
                                                type="text"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={() => setTimeout(() => { if (!isSelectingRef.current) handleFinishEdit(); isSelectingRef.current = false; }, 150)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { e.preventDefault(); handleFinishEdit(); }
                                                    if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit(); }
                                                }}
                                                placeholder={getSpeakerLabel(channelLabel)}
                                                className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-bg-input border border-border-subtle text-text-primary placeholder-text-tertiary outline-none w-36"
                                            />
                                            {showDropdown && (() => {
                                                const otherSpeakers = Array.from(speakers.entries())
                                                    .filter(([cl]) => cl !== editingSpeaker)
                                                    .filter(([cl]) => {
                                                        if (!editValue.trim()) return true;
                                                        return getSpeakerLabel(cl).toLowerCase().includes(editValue.trim().toLowerCase());
                                                    });
                                                const canCreate = editValue.trim().length > 0 && !personResults.some(p => p.name.toLowerCase() === editValue.trim().toLowerCase());
                                                const hasContent = otherSpeakers.length > 0 || personResults.length > 0 || canCreate;
                                                if (!hasContent) return null;
                                                return (
                                                    <div className="absolute top-full left-0 mt-1 w-52 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 overflow-hidden max-h-[200px] overflow-y-auto">
                                                        {otherSpeakers.length > 0 && (
                                                            <>
                                                                <div className="px-3 py-1.5 text-[10px] font-medium text-text-tertiary uppercase tracking-wider">Merge with speaker</div>
                                                                {otherSpeakers.map(([cl]) => (
                                                                    <button
                                                                        key={cl}
                                                                        onMouseDown={(e) => { e.preventDefault(); isSelectingRef.current = true; handleMergeSpeaker(cl); }}
                                                                        className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-input flex items-center gap-2 transition-colors"
                                                                    >
                                                                        <Users size={11} className="text-text-tertiary shrink-0" />
                                                                        <span className="truncate">{getSpeakerLabel(cl)}</span>
                                                                    </button>
                                                                ))}
                                                            </>
                                                        )}
                                                        {personResults.length > 0 && (
                                                            <>
                                                                <div className={`px-3 py-1.5 text-[10px] font-medium text-text-tertiary uppercase tracking-wider ${otherSpeakers.length > 0 ? 'border-t border-border-subtle' : ''}`}>Link to person</div>
                                                                {personResults.map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        onMouseDown={(e) => { e.preventDefault(); isSelectingRef.current = true; handleSelectPerson(p); }}
                                                                        className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-input flex items-center gap-2 transition-colors"
                                                                    >
                                                                        <Link size={11} className="text-text-tertiary shrink-0" />
                                                                        <span className="truncate">{p.name}</span>
                                                                    </button>
                                                                ))}
                                                            </>
                                                        )}
                                                        {canCreate && (
                                                            <>
                                                                <div className={`px-3 py-1.5 text-[10px] font-medium text-text-tertiary uppercase tracking-wider ${(otherSpeakers.length > 0 || personResults.length > 0) ? 'border-t border-border-subtle' : ''}`}>Create new person</div>
                                                                <button
                                                                    onMouseDown={(e) => { e.preventDefault(); isSelectingRef.current = true; handleCreateAndLink(editValue.trim()); }}
                                                                    className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-input flex items-center gap-2 transition-colors"
                                                                >
                                                                    <Plus size={11} className="text-orange-400 shrink-0" />
                                                                    <span className="truncate">Create "{editValue.trim()}"</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <div key={channelLabel} className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleStartEdit(channelLabel)}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getSpeakerColor(channelLabel)} cursor-pointer hover:opacity-80 transition-opacity`}
                                                title="Click to rename speaker"
                                            >
                                                {getSpeakerLabel(channelLabel)}
                                                {info.person_id && <Link size={10} className="opacity-50" />}
                                            </button>
                                            {(info.display_name || info.person_id) && (
                                                <button
                                                    onClick={() => handleClearMapping(channelLabel)}
                                                    className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-500/20 text-text-tertiary hover:text-red-400 transition-colors"
                                                    title="Clear speaker name"
                                                >
                                                    <X size={10} />
                                                </button>
                                            )}
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    {/* Designing Tabs to match reference 1:1 (Dark Pill Container) */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="glass-panel-light bg-[#E5E5EA] dark:bg-white/5 p-1 rounded-xl inline-flex items-center gap-0.5 border border-black/[0.04] dark:border-glass-border">
                            {['summary', 'transcript', 'usage'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`
                                        relative px-3 py-1 text-[13px] font-medium rounded-lg transition-all duration-200 z-10
                                        ${activeTab === tab ? 'text-black dark:text-[#E9E9E9]' : 'text-text-tertiary hover:text-text-secondary dark:text-[#888889] dark:hover:text-[#B0B0B1]'}
                                    `}
                                >
                                    {activeTab === tab && (
                                        <motion.div
                                            layoutId="activeTabBackground"
                                            className="absolute inset-0 bg-white dark:bg-[#3A3A3C] rounded-lg -z-10 shadow-sm"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Copy Button - Inline with Tabs (Always visible) */}
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                        >
                            {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            {isCopied ? 'Copied' : activeTab === 'summary' ? 'Copy full summary' : activeTab === 'transcript' ? 'Copy full transcript' : 'Copy usage'}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="space-y-8">
                        {/* Using standard divs for content, framer motion for layout */}
                        {activeTab === 'summary' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                {/* Overview - Rendered as Markdown */}
                                <div className="mb-6 pb-6 border-b border-border-subtle prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-text-primary mt-4 mb-2" {...props} />,
                                            h2: ({ node, ...props }) => <h2 className="text-lg font-semibold text-text-primary mt-4 mb-2" {...props} />,
                                            h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-text-primary mt-3 mb-1" {...props} />,
                                            p: ({ node, ...props }) => <p className="text-sm text-text-secondary leading-relaxed mb-2" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                                            li: ({ node, ...props }) => <li className="text-sm text-text-secondary" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-semibold text-text-primary" {...props} />,
                                            a: ({ node, ...props }) => <a className="text-orange-500 hover:underline" {...props} />,
                                        }}
                                    >
                                        {meeting.detailedSummary?.overview || ''}
                                    </ReactMarkdown>
                                </div>


                                {/* Action Items - Only show if there are items */}
                                {meeting.detailedSummary?.actionItems && meeting.detailedSummary.actionItems.length > 0 && (
                                    <section className="mb-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <EditableTextBlock
                                                initialValue={meeting.detailedSummary?.actionItemsTitle || 'Action Items'}
                                                onSave={(val) => {
                                                    setMeeting(prev => ({
                                                        ...prev,
                                                        detailedSummary: { ...prev.detailedSummary!, actionItemsTitle: val }
                                                    }));
                                                    window.electronAPI?.updateMeetingSummary(meeting.id, { actionItemsTitle: val });
                                                }}
                                                tagName="h2"
                                                className="text-lg font-semibold text-text-primary -ml-2 px-2 py-1 rounded-sm transition-colors"
                                                multiline={false}
                                            />
                                        </div>
                                        <ul className="space-y-3">
                                            {meeting.detailedSummary.actionItems.map((item, i) => (
                                                <li key={i} className="flex items-start gap-3 group">
                                                    <div className="mt-2 w-1.5 h-1.5 rounded-full bg-text-secondary group-hover:bg-orange-500 transition-colors shrink-0" />
                                                    <div className="flex-1">
                                                        <EditableTextBlock
                                                            initialValue={item}
                                                            onSave={(val) => handleActionItemSave(i, val)}
                                                            tagName="p"
                                                            className="text-sm text-text-secondary leading-relaxed -ml-2 px-2 rounded-sm transition-colors"
                                                            placeholder="Type an action item..."
                                                            onEnter={() => {
                                                                const newItems = [...(meeting.detailedSummary?.actionItems || [])];
                                                                newItems.splice(i + 1, 0, "");
                                                                setMeeting(prev => ({
                                                                    ...prev,
                                                                    detailedSummary: { ...prev.detailedSummary!, actionItems: newItems }
                                                                }));
                                                            }}
                                                        />
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}

                                {/* Key Points - Only show if there are items */}
                                {meeting.detailedSummary?.keyPoints && meeting.detailedSummary.keyPoints.length > 0 && (
                                    <section>
                                        <div className="flex items-center justify-between mb-4">
                                            <EditableTextBlock
                                                initialValue={meeting.detailedSummary?.keyPointsTitle || 'Key Points'}
                                                onSave={(val) => {
                                                    setMeeting(prev => ({
                                                        ...prev,
                                                        detailedSummary: { ...prev.detailedSummary!, keyPointsTitle: val }
                                                    }));
                                                    window.electronAPI?.updateMeetingSummary(meeting.id, { keyPointsTitle: val });
                                                }}
                                                tagName="h2"
                                                className="text-lg font-semibold text-text-primary -ml-2 px-2 py-1 rounded-sm transition-colors"
                                                multiline={false}
                                            />
                                        </div>
                                        <ul className="space-y-3">
                                            {meeting.detailedSummary.keyPoints.map((item, i) => (
                                                <li key={i} className="flex items-start gap-3 group">
                                                    <div className="mt-2 w-1.5 h-1.5 rounded-full bg-text-secondary group-hover:bg-purple-500 transition-colors shrink-0" />
                                                    <div className="flex-1">
                                                        <EditableTextBlock
                                                            initialValue={item}
                                                            onSave={(val) => handleKeyPointSave(i, val)}
                                                            tagName="p"
                                                            className="text-sm text-text-secondary leading-relaxed -ml-2 px-2 rounded-sm transition-colors"
                                                            placeholder="Type a key point..."
                                                            onEnter={() => {
                                                                const newItems = [...(meeting.detailedSummary?.keyPoints || [])];
                                                                newItems.splice(i + 1, 0, "");
                                                                setMeeting(prev => ({
                                                                    ...prev,
                                                                    detailedSummary: { ...prev.detailedSummary!, keyPoints: newItems }
                                                                }));
                                                            }}
                                                        />
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'transcript' && (
                            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <div className="space-y-6">
                                    {(() => {
                                        console.log('Raw Transcript:', meeting.transcript);
                                        const filteredTranscript = meeting.transcript?.filter(entry => {
                                            const isHidden = ['system', 'ai', 'assistant', 'model'].includes(entry.speaker?.toLowerCase());
                                            if (isHidden) console.log('Filtered out:', entry);
                                            return !isHidden;
                                        }) || [];
                                        console.log('Filtered Transcript:', filteredTranscript);

                                        if (filteredTranscript.length === 0) {
                                            return <p className="text-text-tertiary">No transcript available.</p>;
                                        }

                                        return filteredTranscript.map((entry, i) => (
                                            <div key={i} className="group">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${getSpeakerColor(entry.speaker)}`}>
                                                        {getSpeakerLabel(entry.speaker)}
                                                        {speakers.get(entry.speaker)?.person_id && <Link size={9} className="opacity-50" />}
                                                    </span>
                                                    <span className="text-xs text-text-tertiary font-mono">{entry.timestamp ? formatTime(entry.timestamp) : '0:00'}</span>
                                                </div>
                                                <p className="text-text-secondary text-[15px] leading-relaxed transition-colors select-text cursor-text">{entry.text}</p>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </motion.section>
                        )}

                        {activeTab === 'usage' && (
                            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8 pb-10">
                                {meeting.usage?.map((interaction, i) => (
                                    <div key={i} className="space-y-4">
                                        {/* User Question */}
                                        {interaction.question && (
                                            <div className="flex justify-end">
                                                <div className="bg-accent-primary text-white px-5 py-2.5 rounded-2xl rounded-tr-sm max-w-[80%] text-[15px] font-medium leading-relaxed shadow-sm">
                                                    {interaction.question}
                                                </div>
                                            </div>
                                        )}

                                        {/* AI Answer */}
                                        {interaction.answer && (
                                            <div className="flex items-start gap-4">
                                                <div className="mt-1 w-6 h-6 rounded-full bg-bg-input flex items-center justify-center border border-border-subtle shrink-0">
                                                    <img src={SmarterliLogo} alt="AI" className="w-4 h-4 opacity-50 grayscale object-contain" />
                                                </div>
                                                <div>
                                                    <div className="text-[11px] text-text-tertiary mb-1.5 font-medium">{formatTime(interaction.timestamp)}</div>
                                                    <p className="text-text-secondary text-[15px] leading-relaxed whitespace-pre-wrap">{interaction.answer}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {!meeting.usage?.length && <p className="text-text-tertiary">No usage history.</p>}
                            </motion.section>
                        )}
                    </div>
                </motion.div>
            </main>

            {/* Floating Footer (Ask Bar) */}
            <div className={`absolute bottom-0 left-0 right-0 p-6 flex justify-center pointer-events-none ${isChatOpen ? 'z-50' : 'z-20'}`}>
                <div className="w-full max-w-[440px] relative group pointer-events-auto">
                    {/* Dark Glass Effect Input (Matching Reference) */}
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Ask about this meeting..."
                        className="w-full pl-5 pr-12 py-3 bg-transparent backdrop-blur-[24px] backdrop-saturate-[140%] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 dark:border-white/10 rounded-full text-sm text-text-primary placeholder-text-tertiary/70 focus:outline-none transition-shadow duration-200"
                    />
                    <button
                        onClick={handleSubmitQuestion}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all duration-200 border border-white/5 ${query.trim() ? 'bg-text-primary text-bg-primary hover:scale-105' : 'bg-bg-item-active text-text-primary hover:bg-bg-item-hover'
                            }`}
                    >
                        <ArrowUp size={16} className="transform rotate-45" />
                    </button>
                </div>
            </div>

            {/* Chat Overlay */}
            <MeetingChatOverlay
                isOpen={isChatOpen}
                onClose={() => {
                    setIsChatOpen(false);
                    setQuery('');
                    setSubmittedQuery('');
                }}
                meetingContext={{
                    id: meeting.id,  // Required for RAG queries
                    title: meeting.title,
                    summary: meeting.detailedSummary?.overview,
                    keyPoints: meeting.detailedSummary?.keyPoints,
                    actionItems: meeting.detailedSummary?.actionItems,
                    transcript: meeting.transcript
                }}
                initialQuery={submittedQuery}
                onNewQuery={(newQuery) => {
                    setSubmittedQuery(newQuery);
                }}
            />
        </div>
    );
};

export default MeetingDetails;
