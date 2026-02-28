import React, { useState, useEffect } from 'react';
import {
    X, Mic, Speaker, Monitor, Keyboard, LogOut,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    Camera, RotateCcw, Eye, Layout, MessageSquare, Crop,
    ChevronDown, Check, BadgeCheck, Power, Palette, Calendar, Sun, Moon, RefreshCw, Info, FlaskConical, Trash2, LayoutGrid, Plus, Pencil, Users
} from 'lucide-react';
import { AboutSection } from './AboutSection';
import { AIProvidersSettings } from './settings/AIProvidersSettings';
import { VoiceprintSettings } from './settings/VoiceprintSettings';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomSelectProps {
    label: string;
    icon: React.ReactNode;
    value: string;
    options: MediaDeviceInfo[];
    onChange: (value: string) => void;
    placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ label, icon, value, options, onChange, placeholder = "Select device" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.deviceId === value)?.label || placeholder;

    return (
        <div className="bg-bg-card rounded-xl p-4 border border-border-subtle" ref={containerRef}>
            {label && (
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-text-secondary">{icon}</span>
                    <label className="text-xs font-medium text-text-primary uppercase tracking-wide">{label}</label>
                </div>
            )}

            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary flex items-center justify-between hover:bg-bg-elevated transition-colors"
                >
                    <span className="truncate pr-4">{selectedLabel}</span>
                    <ChevronDown size={14} className={`text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animated fadeIn">
                        <div className="p-1 space-y-0.5">
                            {options.map((device) => (
                                <button
                                    key={device.deviceId}
                                    onClick={() => {
                                        onChange(device.deviceId);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between group transition-colors ${value === device.deviceId ? 'bg-bg-input hover:bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                >
                                    <span className="truncate">{device.label || `Device ${device.deviceId.slice(0, 5)}...`}</span>
                                    {value === device.deviceId && <Check size={14} className="text-accent-primary" />}
                                </button>
                            ))}
                            {options.length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500 italic">No devices found</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ProviderOption {
    id: string;
    label: string;
    badge?: string | null;
    desc: string;
    color: string;
    icon: React.ReactNode;
}

interface ProviderSelectProps {
    value: string;
    options: ProviderOption[];
    onChange: (value: string) => void;
}

const ProviderSelect: React.FC<ProviderSelectProps> = ({ value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = options.find(o => o.id === value);

    const getBadgeStyle = (color?: string) => {
        switch (color) {
            case 'blue': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'orange': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'purple': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'teal': return 'bg-teal-500/10 text-teal-500 border-teal-500/20';
            case 'cyan': return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
            case 'indigo': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
            case 'green': return 'bg-green-500/10 text-green-500 border-green-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    const getIconStyle = (color?: string, isSelectedItem: boolean = false) => {
        if (isSelectedItem) return 'bg-accent-primary text-white shadow-sm';
        // For unselected items in list or trigger
        switch (color) {
            case 'blue': return 'bg-orange-500/10 text-orange-600';
            case 'orange': return 'bg-orange-500/10 text-orange-600';
            case 'purple': return 'bg-purple-500/10 text-purple-600';
            case 'teal': return 'bg-teal-500/10 text-teal-600';
            case 'cyan': return 'bg-cyan-500/10 text-cyan-600';
            case 'indigo': return 'bg-indigo-500/10 text-indigo-600';
            case 'green': return 'bg-green-500/10 text-green-600';
            default: return 'bg-gray-500/10 text-gray-600';
        }
    };

    return (
        <div ref={containerRef} className="relative z-20 font-sans">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full group bg-bg-input border border-border-subtle hover:border-border-muted shadow-sm rounded-xl p-2.5 pr-3.5 flex items-center justify-between transition-all duration-200 outline-none focus:ring-2 focus:ring-accent-primary/20 ${isOpen ? 'ring-2 ring-accent-primary/20 border-accent-primary/50' : 'hover:shadow-md'}`}
            >
                {selected ? (
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-300 ${getIconStyle(selected.color)}`}>
                            {selected.icon}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-text-primary truncate leading-tight">{selected.label}</span>
                                {/* Badge removed from trigger */}
                            </div>
                            {/* Short description for trigger */}
                            <span className="text-[11px] text-text-tertiary truncate block leading-tight mt-0.5">{selected.desc}</span>
                        </div>
                    </div>
                ) : <span className="text-text-secondary px-2 text-sm">Select Provider</span>}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-text-tertiary transition-transform duration-300 group-hover:bg-bg-surface ${isOpen ? 'rotate-180 bg-bg-surface text-text-primary' : ''}`}>
                    <ChevronDown size={14} strokeWidth={2.5} />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute top-full left-0 w-full mt-2 bg-bg-elevated/90 backdrop-blur-xl border border-white/5 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5"
                    >
                        <div className="max-h-[320px] overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                            {options.map(option => {
                                const isSelected = value === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => { onChange(option.id); setIsOpen(false); }}
                                        className={`w-full rounded-[10px] p-2 flex items-center gap-3 transition-all duration-200 group relative ${isSelected ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-95 group-hover:scale-100'} ${getIconStyle(option.color, false)}`}>
                                            {option.icon}
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[13px] font-medium transition-colors ${isSelected ? 'text-white' : 'text-text-primary'}`}>{option.label}</span>
                                                    {option.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${getBadgeStyle(option.badge === 'Saved' ? 'green' : option.color)}`}>{option.badge}</span>}
                                                </div>
                                                {isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={14} className="text-accent-primary" strokeWidth={3} /></motion.div>}
                                            </div>
                                            <span className={`text-[11px] block truncate transition-colors ${isSelected ? 'text-white/70' : 'text-text-tertiary'}`}>{option.desc}</span>
                                        </div>
                                        {/* Hover Indicator */}
                                        {!isSelected && <div className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/0 group-hover:ring-white/5 pointer-events-none" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsOverlay: React.FC<SettingsOverlayProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('general');
    const [openOnLogin, setOpenOnLogin] = useState(false);
    const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');
    const [displayName, setDisplayName] = useState('');
    const [displayNameSaved, setDisplayNameSaved] = useState(false);
    const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'uptodate' | 'error'>('idle');
    const themeDropdownRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
                setIsThemeDropdownOpen(false);
            }
        };

        if (isThemeDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isThemeDropdownOpen]);

    const [showTranscript, setShowTranscript] = useState(() => {
        const stored = localStorage.getItem('smarterli_interviewer_transcript');
        return stored !== 'false';
    });

    // Sync transcript setting
    useEffect(() => {
        const handleStorage = () => {
            const stored = localStorage.getItem('smarterli_interviewer_transcript');
            setShowTranscript(stored !== 'false');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Theme Handlers
    const handleSetTheme = async (mode: 'system' | 'light' | 'dark') => {
        setThemeMode(mode);
        if (window.electronAPI?.setThemeMode) {
            await window.electronAPI.setThemeMode(mode);
        }
    };

    // Audio Settings
    const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedInput, setSelectedInput] = useState('');
    const [selectedOutput, setSelectedOutput] = useState('');
    const [micLevel, setMicLevel] = useState(0);
    const [outputLevel, setOutputLevel] = useState(0);
    const [useSckAudio, setUseSckAudio] = useState(false);

    const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; email?: string }>({ connected: false });
    const [isCalendarsLoading, setIsCalendarsLoading] = useState(false);

    // Custom Panels state
    const [customPanels, setCustomPanels] = useState<Array<{ id: string; name: string; icon: string; systemPrompt: string; instruction: string; isBuiltIn: boolean; color: string }>>([]);
    const [showPanelForm, setShowPanelForm] = useState(false);
    const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
    const [panelFormName, setPanelFormName] = useState('');
    const [panelFormInstruction, setPanelFormInstruction] = useState('');
    const [panelFormColor, setPanelFormColor] = useState('orange');

    const inputLevelSmooth = React.useRef(0);
    const outputLevelSmooth = React.useRef(0);

    // Load stored credentials on mount




    const handleCheckForUpdates = async () => {
        if (updateStatus === 'checking') return;
        setUpdateStatus('checking');
        try {
            await window.electronAPI.checkForUpdates();
        } catch (error) {
            console.error("Failed to check for updates:", error);
            setUpdateStatus('error');
            setTimeout(() => setUpdateStatus('idle'), 3000);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const unsubs = [
            window.electronAPI.onUpdateChecking(() => {
                setUpdateStatus('checking');
            }),
            window.electronAPI.onUpdateAvailable(() => {
                setUpdateStatus('available');
                // Don't close settings - let user see the button change to "Update Available"
            }),
            window.electronAPI.onUpdateNotAvailable(() => {
                setUpdateStatus('uptodate');
                setTimeout(() => setUpdateStatus('idle'), 3000);
            }),
            window.electronAPI.onUpdateError((err) => {
                console.error('[Settings] Update error:', err);
                setUpdateStatus('error');
                setTimeout(() => setUpdateStatus('idle'), 3000);
            })
        ];

        return () => unsubs.forEach(unsub => unsub());
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            if (window.electronAPI?.getOpenAtLogin) {
                window.electronAPI.getOpenAtLogin().then(setOpenOnLogin);
            }
            if (window.electronAPI?.getThemeMode) {
                window.electronAPI.getThemeMode().then(({ mode }) => setThemeMode(mode));
            }
            if (window.electronAPI?.getUserProfile) {
                window.electronAPI.getUserProfile().then(profile => {
                    if (profile?.display_name) setDisplayName(profile.display_name);
                });
            }

            // Load settings
            const loadDevices = async () => {
                try {
                    const [inputs, outputs] = await Promise.all([
                        // @ts-ignore
                        window.electronAPI?.getInputDevices() || Promise.resolve([]),
                        // @ts-ignore
                        window.electronAPI?.getOutputDevices() || Promise.resolve([])
                    ]);

                    // Map to shape compatible with CustomSelect (which expects MediaDeviceInfo-like objects)
                    const formatDevices = (devs: any[]) => devs.map(d => ({
                        deviceId: d.id,
                        label: d.name,
                        kind: 'audioinput' as MediaDeviceKind,
                        groupId: '',
                        toJSON: () => d
                    }));

                    setInputDevices(formatDevices(inputs));
                    setOutputDevices(formatDevices(outputs));

                    // Load saved preferences
                    const savedInput = localStorage.getItem('preferredInputDeviceId');
                    const savedOutput = localStorage.getItem('preferredOutputDeviceId');

                    if (savedInput && inputs.find((d: any) => d.id === savedInput)) {
                        setSelectedInput(savedInput);
                    } else if (inputs.length > 0 && !selectedInput) {
                        setSelectedInput(inputs[0].id);
                    }

                    if (savedOutput && outputs.find((d: any) => d.id === savedOutput)) {
                        setSelectedOutput(savedOutput);
                    } else if (outputs.length > 0 && !selectedOutput) {
                        setSelectedOutput(outputs[0].id);
                    }
                } catch (e) {
                    console.error("Error loading native devices:", e);
                }
            };
            loadDevices();

            // Load SCK Audio pref
            const savedSck = localStorage.getItem('useSckAudioBackend') === 'true';
            setUseSckAudio(savedSck);

            // Load Calendar Status
            if (window.electronAPI?.getCalendarStatus) {
                window.electronAPI.getCalendarStatus().then(setCalendarStatus);
            }

            // Load Custom Panels
            if (window.electronAPI?.getPanelConfigs) {
                window.electronAPI.getPanelConfigs().then(configs => {
                    setCustomPanels(configs.filter(c => !c.isBuiltIn));
                });
            }
        }
    }, [isOpen, selectedInput, selectedOutput]); // Re-run if isOpen changes, or if selected devices are cleared

    // Effect for real-time audio level monitoring
    useEffect(() => {
        if (isOpen && activeTab === 'audio') {
            // Start native audio level monitoring
            inputLevelSmooth.current = 0;
            outputLevelSmooth.current = 0;
            window.electronAPI.startAudioTest(selectedInput || undefined, selectedOutput || undefined);

            const unsubscribe = window.electronAPI.onAudioLevel(({ channel, level }) => {
                // level is 0-1 from native, convert to 0-100 with smoothing
                const targetLevel = Math.min(level * 100, 100);

                if (channel === 'input') {
                    if (targetLevel > inputLevelSmooth.current) {
                        inputLevelSmooth.current = inputLevelSmooth.current * 0.5 + targetLevel * 0.5;
                    } else {
                        inputLevelSmooth.current = inputLevelSmooth.current * 0.9 + targetLevel * 0.1;
                    }
                    setMicLevel(inputLevelSmooth.current);
                } else if (channel === 'output') {
                    if (targetLevel > outputLevelSmooth.current) {
                        outputLevelSmooth.current = outputLevelSmooth.current * 0.5 + targetLevel * 0.5;
                    } else {
                        outputLevelSmooth.current = outputLevelSmooth.current * 0.9 + targetLevel * 0.1;
                    }
                    setOutputLevel(outputLevelSmooth.current);
                }
            });

            return () => {
                unsubscribe();
                window.electronAPI.stopAudioTest();
                setMicLevel(0);
                setOutputLevel(0);
            };
        } else {
            window.electronAPI.stopAudioTest();
            setMicLevel(0);
            setOutputLevel(0);
        }
    }, [isOpen, activeTab, selectedInput, selectedOutput]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        className="bg-bg-elevated w-full max-w-4xl h-[80vh] rounded-2xl border border-border-subtle shadow-2xl flex overflow-hidden"
                    >
                        {/* Sidebar */}
                        <div className="w-64 bg-bg-sidebar flex flex-col border-r border-border-subtle">
                            <div className="p-6">
                                <h2 className="font-semibold text-gray-400 text-xs uppercase tracking-wider mb-2">Settings</h2>
                                <nav className="space-y-1">
                                    <button
                                        onClick={() => setActiveTab('general')}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'general' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Monitor size={16} /> General
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('ai-providers')}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'ai-providers' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <FlaskConical size={16} /> AI Providers
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('calendar')}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'calendar' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Calendar size={16} /> Calendar
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('audio')}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'audio' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Mic size={16} /> Audio
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('keybinds')}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'keybinds' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Keyboard size={16} /> Keybinds
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('panels')}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'panels' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <LayoutGrid size={16} /> Panels
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('voiceprints')}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'voiceprints' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Users size={16} /> People
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('about')}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'about' ? 'bg-bg-item-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                                    >
                                        <Info size={16} /> About
                                    </button>
                                </nav>
                            </div>

                            <div className="mt-auto p-6 border-t border-border-subtle">
                                <button
                                    onClick={() => window.electronAPI.quitApp()}
                                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3"
                                >
                                    <LogOut size={16} /> Quit Smarter.li
                                </button>
                                <button onClick={onClose} className="group mt-2 w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50 transition-colors flex items-center gap-3">
                                    <X size={18} className="group-hover:text-red-500 transition-colors" /> Close
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto bg-bg-main p-8">
                            {activeTab === 'general' && (
                                <div className="space-y-6 animated fadeIn">
                                    {/* Profile Section */}
                                    <div className="space-y-3.5">
                                        <div>
                                            <h3 className="text-lg font-bold text-text-primary mb-1">Profile</h3>
                                            <p className="text-xs text-text-secondary mb-3">This helps the AI identify you in conversations</p>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <label className="text-xs text-text-secondary mb-1 block">Your Name</label>
                                                    <input
                                                        type="text"
                                                        value={displayName}
                                                        onChange={e => { setDisplayName(e.target.value); setDisplayNameSaved(false); }}
                                                        onBlur={async () => {
                                                            if (displayName.trim() && window.electronAPI?.updateUserProfile) {
                                                                await window.electronAPI.updateUserProfile({ display_name: displayName.trim() });
                                                                setDisplayNameSaved(true);
                                                                setTimeout(() => setDisplayNameSaved(false), 2000);
                                                            }
                                                        }}
                                                        onKeyDown={async (e) => {
                                                            if (e.key === 'Enter' && displayName.trim() && window.electronAPI?.updateUserProfile) {
                                                                await window.electronAPI.updateUserProfile({ display_name: displayName.trim() });
                                                                setDisplayNameSaved(true);
                                                                setTimeout(() => setDisplayNameSaved(false), 2000);
                                                            }
                                                        }}
                                                        placeholder="Enter your name"
                                                        className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-orange-500/50"
                                                    />
                                                </div>
                                                {displayNameSaved && (
                                                    <span className="text-xs text-emerald-500 font-medium mt-5">Saved</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-border-subtle" />

                                    <div className="space-y-3.5">
                                        <div>
                                            <h3 className="text-lg font-bold text-text-primary mb-1">General settings</h3>
                                            <p className="text-xs text-text-secondary mb-2">Customize how Smarter.li works for you</p>

                                            <div className="space-y-4">
                                                {/* Open at Login */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary">
                                                            <Power size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">Open Smarter.li when you log in</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">Smarter.li will open automatically when you log in to your computer</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !openOnLogin;
                                                            setOpenOnLogin(newState);
                                                            window.electronAPI?.setOpenAtLogin(newState);
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${openOnLogin ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${openOnLogin ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>

                                                {/* Interviewer Transcript */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary">
                                                            <MessageSquare size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">Interviewer Transcript</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">Show real-time transcription of the interviewer</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !showTranscript;
                                                            setShowTranscript(newState);
                                                            localStorage.setItem('smarterli_interviewer_transcript', String(newState));
                                                            window.dispatchEvent(new Event('storage'));
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${showTranscript ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${showTranscript ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>


                                                {/* Theme */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary">
                                                            <Palette size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">Theme</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">Customize how Smarter.li looks on your device</p>
                                                        </div>
                                                    </div>

                                                    <div className="relative" ref={themeDropdownRef}>
                                                        <button
                                                            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                                                            className="bg-bg-component hover:bg-bg-elevated border border-border-subtle text-text-primary px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 min-w-[100px] justify-between"
                                                        >
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <span className="text-text-secondary shrink-0">
                                                                    {themeMode === 'system' && <Monitor size={14} />}
                                                                    {themeMode === 'light' && <Sun size={14} />}
                                                                    {themeMode === 'dark' && <Moon size={14} />}
                                                                </span>
                                                                <span className="capitalize text-ellipsis overflow-hidden whitespace-nowrap">{themeMode}</span>
                                                            </div>
                                                            <ChevronDown size={12} className={`shrink-0 transition-transform ${isThemeDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {/* Dropdown Menu */}
                                                        {isThemeDropdownOpen && (
                                                            <div className="absolute right-0 top-full mt-1 w-full bg-bg-elevated border border-border-subtle rounded-lg shadow-xl overflow-hidden z-20 p-1 animated fadeIn select-none">
                                                                {[
                                                                    { mode: 'system', label: 'System', icon: <Monitor size={14} /> },
                                                                    { mode: 'light', label: 'Light', icon: <Sun size={14} /> },
                                                                    { mode: 'dark', label: 'Dark', icon: <Moon size={14} /> }
                                                                ].map((option) => (
                                                                    <button
                                                                        key={option.mode}
                                                                        onClick={() => {
                                                                            handleSetTheme(option.mode as any);
                                                                            setIsThemeDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${themeMode === option.mode ? 'text-text-primary bg-bg-item-active/50' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                                                    >
                                                                        <span className={themeMode === option.mode ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}>{option.icon}</span>
                                                                        <span className="font-medium">{option.label}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Version */}
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-10 h-10 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary shrink-0">
                                                            <BadgeCheck size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">Version</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">
                                                                You are currently using Smarter.li version 1.0.1.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if (updateStatus === 'available') {
                                                                try {
                                                                    // @ts-ignore
                                                                    await window.electronAPI.downloadUpdate();
                                                                    onClose(); // Close settings to show the banner
                                                                } catch (err) {
                                                                    console.error("Failed to start download:", err);
                                                                }
                                                            } else {
                                                                handleCheckForUpdates();
                                                            }
                                                        }}
                                                        disabled={updateStatus === 'checking'}
                                                        className={`px-5 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 shrink-0 ${updateStatus === 'checking' ? 'bg-bg-input text-text-tertiary cursor-wait' :
                                                            updateStatus === 'available' ? 'bg-accent-primary text-white hover:bg-accent-secondary shadow-lg shadow-orange-500/20' :
                                                                updateStatus === 'uptodate' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                                    updateStatus === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                                        'bg-bg-component hover:bg-bg-input text-text-primary'
                                                            }`}
                                                    >
                                                        {updateStatus === 'checking' ? (
                                                            <>
                                                                <RefreshCw size={14} className="animate-spin" />
                                                                Checking...
                                                            </>
                                                        ) : updateStatus === 'available' ? (
                                                            <>
                                                                <ArrowDown size={14} />
                                                                Update Available
                                                            </>
                                                        ) : updateStatus === 'uptodate' ? (
                                                            <>
                                                                <Check size={14} />
                                                                Up to date
                                                            </>
                                                        ) : updateStatus === 'error' ? (
                                                            <>
                                                                <X size={14} />
                                                                Error
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RefreshCw size={14} />
                                                                Check for updates
                                                            </>
                                                        )}
                                                    </button>
                                                </div>

                                            </div>
                                        </div>

                                    </div>

                                </div>
                            )}
                            {activeTab === 'ai-providers' && (
                                <AIProvidersSettings />
                            )}
                            {activeTab === 'keybinds' && (
                                <div className="space-y-5 animated fadeIn select-text h-full flex flex-col justify-center">
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-1">Keyboard shortcuts</h3>
                                        <p className="text-xs text-text-secondary">Smarter.li works with these easy to remember commands.</p>
                                    </div>

                                    <div className="grid gap-6">
                                        {/* General Category */}
                                        <div>
                                            <h4 className="text-sm font-bold text-text-primary mb-3">General</h4>
                                            <div className="space-y-1">
                                                {[
                                                    { label: 'Toggle Visibility', keys: ['⌘', 'B'], icon: <Eye size={14} /> },
                                                    { label: 'Show/Center Smarter.li', keys: ['⌘', '⇧', 'Space'], icon: <Layout size={14} /> },
                                                    { label: 'Process Screenshots', keys: ['⌘', 'Enter'], icon: <MessageSquare size={14} /> },
                                                    { label: 'Reset / Cancel', keys: ['⌘', 'R'], icon: <RotateCcw size={14} /> },
                                                    { label: 'Take Screenshot', keys: ['⌘', 'H'], icon: <Camera size={14} /> },
                                                    { label: 'Selective Screenshot', keys: ['⌘', '⇧', 'H'], icon: <Crop size={14} /> },
                                                ].map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between py-1.5 group">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-text-tertiary group-hover:text-text-primary transition-colors">{item.icon}</span>
                                                            <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">{item.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {item.keys.map((k, j) => (
                                                                <span key={j} className="bg-bg-input text-text-secondary px-2 py-1 rounded-md text-xs font-sans min-w-[24px] text-center shadow-sm border border-border-subtle">
                                                                    {k}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Window Category */}
                                        <div>
                                            <h4 className="text-sm font-bold text-text-primary mb-3">Window</h4>
                                            <div className="space-y-1">
                                                {[
                                                    { label: 'Move Window Up', keys: ['⌘', '↑'], icon: <ArrowUp size={14} /> },
                                                    { label: 'Move Window Down', keys: ['⌘', '↓'], icon: <ArrowDown size={14} /> },
                                                    { label: 'Move Window Left', keys: ['⌘', '←'], icon: <ArrowLeft size={14} /> },
                                                    { label: 'Move Window Right', keys: ['⌘', '→'], icon: <ArrowRight size={14} /> }
                                                ].map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between py-1.5 group">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-text-tertiary group-hover:text-text-primary transition-colors">{item.icon}</span>
                                                            <span className="text-sm text-text-secondary font-medium group-hover:text-text-primary transition-colors">{item.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {item.keys.map((k, j) => (
                                                                <span key={j} className="bg-bg-input text-text-secondary px-2 py-1 rounded-md text-xs font-sans min-w-[24px] text-center shadow-sm border border-border-subtle">
                                                                    {k}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'audio' && (
                                <div className="space-y-6 animated fadeIn">
                                    {/* ── Audio Configuration Section ── */}
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-1">Audio Configuration</h3>
                                        <p className="text-xs text-text-secondary mb-5">Manage input and output devices.</p>

                                        <div className="space-y-4">
                                            <CustomSelect
                                                label="Input Device"
                                                icon={<Mic size={16} />}
                                                value={selectedInput}
                                                options={inputDevices}
                                                onChange={(id) => {
                                                    setSelectedInput(id);
                                                    localStorage.setItem('preferredInputDeviceId', id);
                                                }}
                                                placeholder="Default Microphone"
                                            />

                                            <div>
                                                <div className="flex justify-between text-xs text-text-secondary mb-2 px-1">
                                                    <span>Input Level</span>
                                                </div>
                                                <div className="h-1.5 bg-bg-input rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-500 transition-all duration-100 ease-out"
                                                        style={{ width: `${micLevel}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="h-px bg-border-subtle my-2" />

                                            <CustomSelect
                                                label="Output Device"
                                                icon={<Speaker size={16} />}
                                                value={selectedOutput}
                                                options={outputDevices}
                                                onChange={(id) => {
                                                    setSelectedOutput(id);
                                                    localStorage.setItem('preferredOutputDeviceId', id);
                                                }}
                                                placeholder="Default Speakers"
                                            />

                                            <div>
                                                <div className="flex justify-between text-xs text-text-secondary mb-2 px-1">
                                                    <span>Output Level</span>
                                                    <span className="text-text-tertiary">All system audio</span>
                                                </div>
                                                <div className="h-1.5 bg-bg-input rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 transition-all duration-100 ease-out"
                                                        style={{ width: `${outputLevel}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end">
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                                                            if (!AudioContext) {
                                                                console.error("Web Audio API not supported");
                                                                return;
                                                            }

                                                            const ctx = new AudioContext();

                                                            if (ctx.state === 'suspended') {
                                                                await ctx.resume();
                                                            }

                                                            const oscillator = ctx.createOscillator();
                                                            const gainNode = ctx.createGain();

                                                            oscillator.connect(gainNode);
                                                            gainNode.connect(ctx.destination);

                                                            oscillator.type = 'sine';
                                                            oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
                                                            gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
                                                            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);

                                                            if (selectedOutput && (ctx as any).setSinkId) {
                                                                try {
                                                                    await (ctx as any).setSinkId(selectedOutput);
                                                                } catch (e) {
                                                                    console.warn("Error setting sink for AudioContext", e);
                                                                }
                                                            }

                                                            oscillator.start();
                                                            oscillator.stop(ctx.currentTime + 1.0);
                                                        } catch (e) {
                                                            console.error("Error playing test sound", e);
                                                        }
                                                    }}
                                                    className="text-xs bg-bg-input hover:bg-bg-elevated text-text-primary px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                                                >
                                                    <Speaker size={12} /> Test Sound
                                                </button>
                                            </div>

                                            <div className="h-px bg-border-subtle my-2" />

                                            {/* CoreAudio Beta Toggle */}
                                            <div className="bg-orange-500/5 rounded-xl border border-orange-500/20 p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                                                            <FlaskConical size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <h3 className="text-sm font-bold text-text-primary">ScreenCaptureKit Backend</h3>
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 uppercase tracking-wide">Experimental</span>
                                                            </div>
                                                            <p className="text-xs text-text-secondary leading-relaxed max-w-[300px]">
                                                                Alternative audio capture method. Use only if CoreAudio Tap doesn't work on your system.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !useSckAudio;
                                                            setUseSckAudio(newState);
                                                            window.localStorage.setItem('useSckAudioBackend', newState ? 'true' : 'false');
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors shrink-0 ${useSckAudio ? 'bg-orange-500' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${useSckAudio ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}


                            {activeTab === 'calendar' && (
                                <div className="space-y-6 animated fadeIn h-full">
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-2">Visible Calendars</h3>
                                        <p className="text-xs text-text-secondary mb-4">Upcoming meetings are synchronized from these calendars</p>
                                    </div>

                                    <div className="bg-bg-card rounded-xl p-6 border border-border-subtle flex flex-col items-start gap-4">
                                        {calendarStatus.connected ? (
                                            <div className="w-full flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                                                        <Calendar size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-medium text-text-primary">Google Calendar</h4>
                                                        <p className="text-xs text-text-secondary">Connected as {calendarStatus.email || 'User'}</p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={async () => {
                                                        setIsCalendarsLoading(true);
                                                        try {
                                                            await window.electronAPI.calendarDisconnect();
                                                            const status = await window.electronAPI.getCalendarStatus();
                                                            setCalendarStatus(status);
                                                        } catch (e) {
                                                            console.error(e);
                                                        } finally {
                                                            setIsCalendarsLoading(false);
                                                        }
                                                    }}
                                                    disabled={isCalendarsLoading}
                                                    className="px-3 py-1.5 bg-bg-input hover:bg-bg-elevated border border-border-subtle text-text-primary rounded-md text-xs font-medium transition-colors"
                                                >
                                                    {isCalendarsLoading ? 'Disconnecting...' : 'Disconnect'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-full py-4">
                                                <div className="mb-4">
                                                    <Calendar size={24} className="text-text-tertiary mb-3" />
                                                    <h4 className="text-sm font-bold text-text-primary mb-1">No calendars</h4>
                                                    <p className="text-xs text-text-secondary">Get started by connecting a Google account.</p>
                                                </div>

                                                <button
                                                    onClick={async () => {
                                                        setIsCalendarsLoading(true);
                                                        try {
                                                            const res = await window.electronAPI.calendarConnect();
                                                            if (res.success) {
                                                                const status = await window.electronAPI.getCalendarStatus();
                                                                setCalendarStatus(status);
                                                            }
                                                        } catch (e) {
                                                            console.error(e);
                                                        } finally {
                                                            setIsCalendarsLoading(false);
                                                        }
                                                    }}
                                                    disabled={isCalendarsLoading}
                                                    className="bg-[#303033] hover:bg-[#3A3A3D] text-white px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2.5"
                                                >
                                                    <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
                                                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                                            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                                            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                                                            <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.734 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                                                            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                                                        </g>
                                                    </svg>
                                                    {isCalendarsLoading ? 'Connecting...' : 'Connect Google'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'panels' && (
                                <div className="space-y-6 animated fadeIn h-full">
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-2">Custom Panels</h3>
                                        <p className="text-xs text-text-secondary mb-4">Create persistent panels that analyze your meetings with custom prompts. These are available across all meetings.</p>
                                    </div>

                                    {/* Existing custom panels list */}
                                    {customPanels.length > 0 && (
                                        <div className="space-y-2">
                                            {customPanels.map(panel => (
                                                <div key={panel.id} className="bg-bg-card rounded-xl p-4 border border-border-subtle flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-medium text-text-primary">{panel.name}</h4>
                                                        <p className="text-xs text-text-secondary mt-1 truncate">{panel.instruction}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => {
                                                                setEditingPanelId(panel.id);
                                                                setPanelFormName(panel.name);
                                                                setPanelFormInstruction(panel.instruction);
                                                                setPanelFormColor(panel.color);
                                                                setShowPanelForm(true);
                                                            }}
                                                            className="p-1.5 rounded-md hover:bg-bg-elevated text-text-tertiary hover:text-text-primary transition-colors"
                                                            title="Edit panel"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                await window.electronAPI.deleteCustomPanel(panel.id);
                                                                setCustomPanels(prev => prev.filter(p => p.id !== panel.id));
                                                            }}
                                                            className="p-1.5 rounded-md hover:bg-red-500/10 text-text-tertiary hover:text-red-400 transition-colors"
                                                            title="Delete panel"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add / Edit form */}
                                    {showPanelForm ? (
                                        <div className="bg-bg-card rounded-xl p-4 border border-border-subtle space-y-3">
                                            <h4 className="text-sm font-medium text-text-primary">
                                                {editingPanelId ? 'Edit Panel' : 'New Custom Panel'}
                                            </h4>
                                            <div>
                                                <label className="text-xs text-text-secondary mb-1 block">Name</label>
                                                <input
                                                    type="text"
                                                    value={panelFormName}
                                                    onChange={e => setPanelFormName(e.target.value)}
                                                    placeholder="e.g. Action Items"
                                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-orange-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-secondary mb-1 block">Instruction</label>
                                                <textarea
                                                    value={panelFormInstruction}
                                                    onChange={e => setPanelFormInstruction(e.target.value)}
                                                    placeholder="What should this panel analyze? e.g. 'Track action items assigned to each person with deadlines'"
                                                    rows={3}
                                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-orange-500/50 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-secondary mb-1 block">Color</label>
                                                <div className="flex gap-2">
                                                    {['orange', 'emerald', 'indigo', 'amber'].map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setPanelFormColor(c)}
                                                            className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                                                panelFormColor === c ? 'border-white/60 scale-110' : 'border-transparent'
                                                            } ${
                                                                c === 'orange' ? 'bg-orange-500/30' :
                                                                c === 'emerald' ? 'bg-emerald-500/30' :
                                                                c === 'indigo' ? 'bg-indigo-500/30' :
                                                                'bg-amber-500/30'
                                                            }`}
                                                            title={c}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <button
                                                    onClick={async () => {
                                                        if (!panelFormName.trim() || !panelFormInstruction.trim()) return;
                                                        const panelConfig = {
                                                            id: editingPanelId || `custom-${Date.now()}`,
                                                            name: panelFormName.trim(),
                                                            icon: 'FileText',
                                                            systemPrompt: `You are a real-time meeting analysis panel called "${panelFormName.trim()}". Output ONLY concise bullet points (3-7 bullets, each under 15 words). No greetings, no filler, no commentary.`,
                                                            instruction: panelFormInstruction.trim(),
                                                            isBuiltIn: false,
                                                            color: panelFormColor,
                                                        };
                                                        await window.electronAPI.saveCustomPanel(panelConfig);
                                                        // Refresh list
                                                        const configs = await window.electronAPI.getPanelConfigs();
                                                        setCustomPanels(configs.filter(c => !c.isBuiltIn));
                                                        // Reset form
                                                        setShowPanelForm(false);
                                                        setEditingPanelId(null);
                                                        setPanelFormName('');
                                                        setPanelFormInstruction('');
                                                        setPanelFormColor('orange');
                                                    }}
                                                    disabled={!panelFormName.trim() || !panelFormInstruction.trim()}
                                                    className="px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-medium hover:bg-orange-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {editingPanelId ? 'Save Changes' : 'Create Panel'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowPanelForm(false);
                                                        setEditingPanelId(null);
                                                        setPanelFormName('');
                                                        setPanelFormInstruction('');
                                                        setPanelFormColor('orange');
                                                    }}
                                                    className="px-4 py-2 text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setEditingPanelId(null);
                                                setPanelFormName('');
                                                setPanelFormInstruction('');
                                                setPanelFormColor('orange');
                                                setShowPanelForm(true);
                                            }}
                                            className="w-full bg-bg-card rounded-xl p-4 border border-dashed border-border-subtle hover:border-orange-500/30 text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-2 text-sm"
                                        >
                                            <Plus size={16} /> Add Custom Panel
                                        </button>
                                    )}

                                    <div className="bg-bg-card rounded-xl p-4 border border-border-subtle">
                                        <p className="text-xs text-text-tertiary">
                                            Tip: You can also create temporary panels during a meeting using the "+" button in the panel bar. Those only last for the current session.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'voiceprints' && (
                                <VoiceprintSettings />
                            )}

                            {activeTab === 'about' && (
                                <AboutSection />
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )
            }
        </AnimatePresence >
    );
};

export default SettingsOverlay;
