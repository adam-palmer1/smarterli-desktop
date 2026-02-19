import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { MessageSquare, Link, Camera, Zap, Heart } from 'lucide-react';

const SettingsPopup = () => {
    const [balance, setBalance] = useState<number | null>(null);

    useEffect(() => {
        const loadBalance = async () => {
            try {
                const b = await window.electronAPI.getBillingBalance();
                if (b) setBalance(b.balance_minutes);
            } catch (e) {
                console.warn('Failed to load balance:', e);
            }
        };
        loadBalance();
    }, []);

    const [showTranscript, setShowTranscript] = useState(() => {
        const stored = localStorage.getItem('smarterli_interviewer_transcript');
        return stored !== 'false'; // Default to true if not set
    });

    useEffect(() => {
        const handleStorage = () => {
            const stored = localStorage.getItem('smarterli_interviewer_transcript');
            setShowTranscript(stored !== 'false');
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const contentRef = useRef<HTMLDivElement>(null);

    // Auto-resize Window
    useLayoutEffect(() => {
        if (!contentRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const rect = entry.target.getBoundingClientRect();
                // Send exact dimensions to Electron
                try {
                    // @ts-ignore
                    window.electronAPI?.updateContentDimensions({
                        width: Math.ceil(rect.width),
                        height: Math.ceil(rect.height)
                    });
                } catch (e) {
                    console.warn("Failed to update dimensions", e);
                }
            }
        });

        observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div className="w-fit h-fit bg-transparent flex flex-col">
            <div ref={contentRef} className="w-[200px] glass-panel-heavy px-2 pt-2 pb-2 flex flex-col animate-scale-in origin-top-left justify-between">

                {/* Credits Display */}
                <div className="flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg transition-colors duration-200 group cursor-default">
                    <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-orange-500" fill="currentColor" />
                        <span className="text-[12px] text-slate-400 font-medium">{balance !== null ? `${Math.floor(balance)} min` : '...'}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Credits</span>
                </div>

                {/* Interviewer Transcript Toggle */}
                <div className="flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg transition-colors duration-200 group cursor-default">
                    <div className="flex items-center gap-3">
                        <MessageSquare
                            className={`w-3.5 h-3.5 transition-colors ${showTranscript ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                            fill={showTranscript ? "currentColor" : "none"}
                        />
                        <span className={`text-[12px] font-medium transition-colors ${showTranscript ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>Transcript</span>
                    </div>
                    <button
                        onClick={() => {
                            const newState = !showTranscript;
                            setShowTranscript(newState);
                            localStorage.setItem('smarterli_interviewer_transcript', String(newState));
                            // Dispatch event for same-window listeners
                            window.dispatchEvent(new Event('storage'));
                        }}
                        className={`w-[30px] h-[18px] rounded-full p-[1.5px] transition-all duration-300 ease-spring active:scale-[0.92] ${showTranscript ? 'bg-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}
                    >
                        <div className={`w-[15px] h-[15px] rounded-full bg-black shadow-sm transition-transform duration-300 ease-spring ${showTranscript ? 'translate-x-[12px]' : 'translate-x-0'}`} />
                    </button>
                </div>

                <div className="h-px bg-white/[0.04] my-0.5 mx-2" />

                {/* Show/Hide Smarter.li */}
                <div className="flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg transition-colors duration-200 group cursor-pointer interaction-base interaction-press">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                        <span className="text-[12px] text-slate-400 group-hover:text-slate-200 transition-colors">Show/Hide</span>
                    </div>
                    <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <div className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-slate-500 font-medium">&#8984;</div>
                        <div className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-slate-500 font-medium">B</div>
                    </div>
                </div>

                {/* Screenshot */}
                <div className="flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg transition-colors duration-200 group cursor-pointer interaction-base interaction-press">
                    <div className="flex items-center gap-3">
                        <Camera className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                        <span className="text-[12px] text-slate-400 group-hover:text-slate-200 transition-colors">Screenshot</span>
                    </div>
                    <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <div className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-slate-500 font-medium">&#8984;</div>
                        <div className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-slate-500 font-medium">H</div>
                    </div>
                </div>

                <div className="h-px bg-white/[0.04] my-0.5 mx-2" />

                {/* Donate */}
                <div
                    // @ts-ignore
                    onClick={() => window.electronAPI.openExternal('https://buymeacoffee.com/evinjohnn')}
                    className="flex items-center justify-between px-3 py-2 hover:bg-pink-500/10 rounded-lg transition-colors duration-200 group cursor-pointer interaction-base interaction-press"
                >
                    <div className="flex items-center gap-3">
                        <Heart className="w-3.5 h-3.5 text-pink-400 group-hover:fill-pink-400 transition-all duration-300" />
                        <span className="text-[12px] text-slate-400 group-hover:text-pink-100 transition-colors">Donate</span>
                    </div>
                    <div className="opacity-60 group-hover:opacity-100 transition-opacity">
                        <Link className="w-3 h-3 text-slate-500 group-hover:text-pink-400" />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SettingsPopup;
