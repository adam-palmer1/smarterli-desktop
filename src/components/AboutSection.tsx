import React from 'react';
import {
    Shield, Cpu, Database,
    Heart, MicOff
} from 'lucide-react';

interface AboutSectionProps { }

export const AboutSection: React.FC<AboutSectionProps> = () => {
    const handleOpenLink = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
        e.preventDefault();
        if (window.electronAPI?.invoke) {
            window.electronAPI.invoke('open-external', url);
        } else {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="space-y-6 animated fadeIn pb-10">
            {/* Header */}
            <div>
                <h3 className="text-lg font-bold text-text-primary mb-1">About Smarter.li</h3>
                <p className="text-sm text-text-secondary">Your AI copilot for every conversation.</p>
            </div>

            {/* Architecture Section */}
            <div>
                <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 px-1">How Smarter.li Works</h4>
                <div className="bg-bg-item-surface rounded-xl border border-border-subtle overflow-hidden">
                    <div className="p-5 border-b border-border-subtle bg-bg-card/50">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0">
                                <Cpu size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary mb-1">Hybrid Intelligence</h5>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Smarter.li routes queries between <span className="text-text-primary font-medium">Groq</span> for near-instant responses and <span className="text-text-primary font-medium">Google Gemini</span> for complex reasoning. Audio is processed via Google Speech-to-Text for enterprise-grade accuracy.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 bg-bg-card/50">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0">
                                <Database size={20} />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary mb-1">Context Awareness (RAG)</h5>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    A local vector memory system allows Smarter.li to recall details from your past interactions. Context retrieval happens securely on-device where possible to minimize latency.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Privacy Section */}
            <div>
                <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 px-1">Privacy & Data</h4>
                <div className="bg-bg-item-surface rounded-xl border border-border-subtle p-5 space-y-4">
                    <div className="flex items-start gap-3">
                        <Shield size={16} className="text-green-400 mt-0.5" />
                        <div>
                            <h5 className="text-sm font-medium text-text-primary">Controlled Data Flow</h5>
                            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                                Audio and text are transmitted only to processed endpoints (Google Cloud, Groq) and are not stored permanently by Smarter.li's servers.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MicOff size={16} className="text-red-500 mt-0.5" />
                        <div>
                            <h5 className="text-sm font-medium text-text-primary">No Recording</h5>
                            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                                Smarter.li listens only when active. It does not record video, take arbitrary screenshots without command, or perform background surveillance.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Support Section */}
            <div>
                <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2 px-1">Community</h4>
                <div className="space-y-4">
                    <div className="bg-bg-item-surface rounded-xl border border-border-subtle p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 shadow-sm shadow-orange-500/5">
                                <Heart size={18} fill="currentColor" className="opacity-80" />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-text-primary">Support Development</h5>
                                <p className="text-xs text-text-secondary mt-0.5">Smarter.li is independent open-source software.</p>
                            </div>
                        </div>
                        <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            className="whitespace-nowrap px-4 py-2 bg-text-primary hover:bg-white/90 text-bg-main text-xs font-bold rounded-lg transition-all shadow hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                        >
                            Support Project
                        </a>
                    </div>
                </div>
            </div>

            {/* Credits */}
            <div className="pt-4 border-t border-border-subtle">
                <div>
                    <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-3">Core Technology</h4>
                    <div className="flex flex-wrap gap-2">
                        {['Groq', 'Google Gemini', 'Google Speech-to-Text', 'Electron', 'React', 'Rust', 'Cpal'].map(tech => (
                            <span key={tech} className="px-2.5 py-1 rounded-md bg-bg-input border border-border-subtle text-[11px] font-medium text-text-secondary">
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
