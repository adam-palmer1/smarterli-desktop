import React, { useState, useEffect, useRef } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface FeedbackEntry {
    id: string;
    content: string;
    isStreaming: boolean;
    topic?: string;
    timestamp: number;
}

const LiveFeedbackPanel: React.FC = () => {
    const [entries, setEntries] = useState<FeedbackEntry[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [thinkingTopic, setThinkingTopic] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new content
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [entries, isThinking]);

    // Listen for live feedback events
    useEffect(() => {
        const cleanups: (() => void)[] = [];

        // Thinking state — system detected a topic being discussed
        cleanups.push(window.electronAPI.on('live-feedback-thinking', (_: any, data: { topic: string }) => {
            setIsThinking(true);
            setThinkingTopic(data.topic);
        }));

        // Token — streaming response
        cleanups.push(window.electronAPI.on('live-feedback-token', (_: any, data: { token: string; isStart?: boolean }) => {
            setIsThinking(false);

            setEntries(prev => {
                if (data.isStart || prev.length === 0 || !prev[prev.length - 1].isStreaming) {
                    // Start a new entry
                    return [...prev, {
                        id: `fb-${Date.now()}`,
                        content: data.token,
                        isStreaming: true,
                        topic: thinkingTopic || undefined,
                        timestamp: Date.now(),
                    }];
                }
                // Append to current streaming entry
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: last.content + data.token };
                return updated;
            });
        }));

        // Complete — finalize current entry
        cleanups.push(window.electronAPI.on('live-feedback-complete', (_: any, _data: { content: string }) => {
            setIsThinking(false);
            setEntries(prev => {
                if (prev.length === 0) return prev;
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], isStreaming: false };
                return updated;
            });
        }));

        // Error
        cleanups.push(window.electronAPI.on('live-feedback-error', (_: any, data: { error: string }) => {
            setIsThinking(false);
            console.error('[LiveFeedback] Error:', data.error);
        }));

        return () => cleanups.forEach(fn => fn());
    }, [thinkingTopic]);

    return (
        <div className="h-full w-full flex flex-col bg-[#0D0D0D] rounded-2xl overflow-hidden border border-white/8 font-sans">
            {/* Header */}
            <div className="drag-region flex items-center gap-2.5 px-4 py-3 border-b border-white/6">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F59E0B]/20 via-[#E8750A]/15 to-[#D96C08]/10 flex items-center justify-center border border-[#E8750A]/20">
                    <Zap className="w-3.5 h-3.5 text-[#E8750A]" />
                </div>
                <div className="flex-1">
                    <h2 className="text-[13px] font-semibold text-white/90 tracking-tight">Live Feedback</h2>
                    <p className="text-[10px] text-white/35 leading-tight">Real-time insights from conversation</p>
                </div>
                {/* Live indicator */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#E8750A]/10">
                    <span className="w-1.5 h-1.5 bg-[#E8750A] rounded-full animate-pulse" />
                    <span className="text-[10px] font-medium text-[#E8750A]/80 uppercase tracking-wide">Live</span>
                </div>
            </div>

            {/* Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 no-drag" style={{ scrollbarWidth: 'none' }}>
                {entries.length === 0 && !isThinking && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-12 opacity-40">
                        <Zap className="w-8 h-8 text-white/20" />
                        <div className="text-center">
                            <p className="text-[12px] text-white/40 font-medium">Listening to conversation...</p>
                            <p className="text-[11px] text-white/25 mt-1">Feedback will appear here automatically</p>
                        </div>
                    </div>
                )}

                {entries.map((entry) => (
                    <div
                        key={entry.id}
                        className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 animate-fade-in-up"
                    >
                        {entry.topic && (
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-[10px] font-semibold text-[#E8750A]/70 uppercase tracking-wider">{entry.topic}</span>
                            </div>
                        )}
                        <div className="text-[13px] text-white/80 leading-relaxed markdown-content">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
                                    strong: ({ node, ...props }: any) => <strong className="font-bold text-white/95" {...props} />,
                                    em: ({ node, ...props }: any) => <em className="italic text-white/60" {...props} />,
                                    ul: ({ node, ...props }: any) => <ul className="list-disc ml-4 mb-2 space-y-0.5" {...props} />,
                                    ol: ({ node, ...props }: any) => <ol className="list-decimal ml-4 mb-2 space-y-0.5" {...props} />,
                                    li: ({ node, ...props }: any) => <li className="pl-1 text-[12px]" {...props} />,
                                    h1: ({ node, ...props }: any) => <h1 className="text-[14px] font-bold text-white/90 mb-2 mt-2" {...props} />,
                                    h2: ({ node, ...props }: any) => <h2 className="text-[13px] font-bold text-white/90 mb-1.5 mt-2" {...props} />,
                                    h3: ({ node, ...props }: any) => <h3 className="text-[12px] font-bold text-white/85 mb-1 mt-1.5" {...props} />,
                                    code: ({ node, ...props }: any) => <code className="bg-white/5 rounded px-1 py-0.5 text-[11px] font-mono text-[#E8750A]/80" {...props} />,
                                    a: ({ node, ...props }: any) => <a className="text-[#E8750A] hover:opacity-80 underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                }}
                            >
                                {entry.content}
                            </ReactMarkdown>
                        </div>
                        {entry.isStreaming && (
                            <div className="flex items-center gap-1 mt-2">
                                <div className="w-1.5 h-1.5 bg-[#E8750A]/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-[#E8750A]/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-[#E8750A]/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        )}
                    </div>
                ))}

                {/* Thinking indicator */}
                {isThinking && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#E8750A]/5 border border-[#E8750A]/10 animate-fade-in-up">
                        <Loader2 className="w-3.5 h-3.5 text-[#E8750A]/60 animate-spin" />
                        <span className="text-[12px] text-[#E8750A]/60 font-medium">
                            Preparing feedback{thinkingTopic ? ` on ${thinkingTopic}` : ''}...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveFeedbackPanel;
