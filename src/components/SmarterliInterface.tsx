import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import {
    MessageSquare,
    RefreshCw,
    Settings,
    ArrowRight,
    HelpCircle,
    Image,
    X,
    Zap,
    Code,
    Copy,
    MessageSquareText,
    Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import TopPill from './ui/TopPill';
import RollingTranscript from './ui/RollingTranscript';
import PanelBar from './ui/PanelBar';
import OverlaySettingsPopover from './OverlaySettingsPopover';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { analytics } from '../lib/analytics/analytics.service';

interface Message {
    id: string;
    role: 'user' | 'system' | 'interviewer';
    text: string;
    isStreaming?: boolean;
    hasScreenshot?: boolean;
    screenshotPreview?: string;
    isCode?: boolean;
    intent?: string;
}

interface SmarterliInterfaceProps {
    onEndMeeting?: () => void;
}

const SmarterliInterface: React.FC<SmarterliInterfaceProps> = ({ onEndMeeting }) => {
    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMeetingPaused, setIsMeetingPaused] = useState(false);
    const [isOverlaySettingsOpen, setIsOverlaySettingsOpen] = useState(false);
    const [showStopConfirm, setShowStopConfirm] = useState(false);
    const [conversationContext, setConversationContext] = useState<string>('');
    const [isManualRecording, setIsManualRecording] = useState(false);
    const isRecordingRef = useRef(false);  // Ref to track recording state (avoids stale closure)
    const [manualTranscript, setManualTranscript] = useState('');
    const [showTranscript, setShowTranscript] = useState(() => {
        const stored = localStorage.getItem('smarterli_interviewer_transcript');
        return stored !== 'false';
    });

    // Panel State
    const [panelConfigs, setPanelConfigs] = useState<Array<{ id: string; name: string; icon: string; systemPrompt: string; instruction: string; isBuiltIn: boolean; color: string }>>([]);
    const [activePanelIds, setActivePanelIds] = useState<string[]>([]);
    const [panelStates, setPanelStates] = useState<Map<string, { content: string; isStreaming: boolean; error: string | null }>>(new Map());
    const ephemeralPanelCounter = useRef(0);

    // Analytics State
    const requestStartTimeRef = useRef<number | null>(null);

    // Sync transcript setting
    useEffect(() => {
        const handleStorage = () => {
            const stored = localStorage.getItem('smarterli_interviewer_transcript');
            setShowTranscript(stored !== 'false');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const [rollingTranscript, setRollingTranscript] = useState('');  // For interviewer rolling text bar
    const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);  // Track if actively speaking
    const [voiceInput, setVoiceInput] = useState('');  // Accumulated user voice input
    const voiceInputRef = useRef<string>('');  // Ref for capturing in async handlers
    const textInputRef = useRef<HTMLInputElement>(null); // Ref for input focus

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    // const settingsButtonRef = useRef<HTMLButtonElement>(null);

    // Latent Context State (Screenshot attached but not sent)
    const [attachedContext, setAttachedContext] = useState<{ path: string, preview: string } | null>(null);

    // Settings State with Persistence
    const [hideChatHidesWidget, setHideChatHidesWidget] = useState(() => {
        const stored = localStorage.getItem('smarterli_hideChatHidesWidget');
        return stored ? stored === 'true' : true;
    });

    // Persist Settings
    useEffect(() => {
        localStorage.setItem('smarterli_hideChatHidesWidget', String(hideChatHidesWidget));
    }, [hideChatHidesWidget]);

    // Auto-resize Window (debounced to avoid excessive IPC during animations)
    useLayoutEffect(() => {
        if (!contentRef.current) return;

        let resizeTimer: ReturnType<typeof setTimeout> | null = null;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const rect = entry.target.getBoundingClientRect();
                const width = Math.ceil(rect.width);
                const height = Math.ceil(rect.height);

                if (resizeTimer) clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    window.electronAPI?.updateContentDimensions({ width, height });
                }, 50);
            }
        });

        observer.observe(contentRef.current);
        return () => {
            observer.disconnect();
            if (resizeTimer) clearTimeout(resizeTimer);
        };
    }, []);

    // Force initial sizing safety check
    useEffect(() => {
        const timer = setTimeout(() => {
            if (contentRef.current) {
                const rect = contentRef.current.getBoundingClientRect();
                window.electronAPI?.updateContentDimensions({
                    width: Math.ceil(rect.width),
                    height: Math.ceil(rect.height)
                });
            }
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isProcessing]);

    // Build conversation context from messages
    useEffect(() => {
        const context = messages
            .filter(m => m.role !== 'user' || !m.hasScreenshot)
            .map(m => `${m.role === 'interviewer' ? 'Interviewer' : m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
            .slice(-20)
            .join('\n');
        setConversationContext(context);
    }, [messages]);

    // Listen for settings window visibility changes
    useEffect(() => {
        if (!window.electronAPI?.onSettingsVisibilityChange) return;
        const unsubscribe = window.electronAPI.onSettingsVisibilityChange((isVisible) => {
            setIsSettingsOpen(isVisible);
        });
        return () => unsubscribe();
    }, []);


    // Session Reset Listener - Clears UI when a NEW meeting starts
    useEffect(() => {
        if (!window.electronAPI?.onSessionReset) return;
        const unsubscribe = window.electronAPI.onSessionReset(() => {
            console.log('[SmarterliInterface] Resetting session state...');
            setMessages([]);
            setInputValue('');
            setAttachedContext(null);
            setManualTranscript('');
            setVoiceInput('');
            setIsProcessing(false);
            setIsMeetingPaused(false);
            setIsOverlaySettingsOpen(false);
            // Optionally reset connection status if needed, but connection persists

            // Track new conversation/session if applicable?
            // Actually 'app_opened' is global, 'assistant_started' is overlay.
            // Maybe 'conversation_started' event?
            analytics.trackConversationStarted();
        });
        return () => unsubscribe();
    }, []);

    // Meeting Pause/Resume Listeners
    useEffect(() => {
        if (!window.electronAPI?.onMeetingPaused) return;
        const cleanups: (() => void)[] = [];
        cleanups.push(window.electronAPI.onMeetingPaused(() => {
            setIsMeetingPaused(true);
        }));
        cleanups.push(window.electronAPI.onMeetingResumed(() => {
            setIsMeetingPaused(false);
        }));
        return () => cleanups.forEach(fn => fn());
    }, []);

    // Pause/Resume handler
    const handlePauseToggle = async () => {
        if (isMeetingPaused) {
            await window.electronAPI.resumeMeeting();
        } else {
            await window.electronAPI.pauseMeeting();
        }
    };

    // Load panel configs and active panels on mount
    useEffect(() => {
        if (!window.electronAPI?.getPanelConfigs) return;
        window.electronAPI.getPanelConfigs().then(configs => {
            setPanelConfigs(configs);
        }).catch(() => {});
        window.electronAPI.getActivePanelIds().then(ids => {
            setActivePanelIds(ids);
        }).catch(() => {});
    }, []);

    // Panel streaming subscriptions
    useEffect(() => {
        if (!window.electronAPI?.onPanelToken) return;
        const cleanups: (() => void)[] = [];

        cleanups.push(window.electronAPI.onPanelToken((data) => {
            setPanelStates(prev => {
                const next = new Map(prev);
                const existing = next.get(data.panelId) || { content: '', isStreaming: false, error: null };
                if (data.isStart) {
                    next.set(data.panelId, { content: '', isStreaming: true, error: null });
                } else {
                    next.set(data.panelId, { ...existing, content: existing.content + data.token, isStreaming: true });
                }
                return next;
            });
        }));

        cleanups.push(window.electronAPI.onPanelComplete((data) => {
            setPanelStates(prev => {
                const next = new Map(prev);
                next.set(data.panelId, { content: data.content, isStreaming: false, error: null });
                return next;
            });
        }));

        cleanups.push(window.electronAPI.onPanelError((data) => {
            setPanelStates(prev => {
                const next = new Map(prev);
                const existing = next.get(data.panelId);
                next.set(data.panelId, { content: existing?.content || '', isStreaming: false, error: data.error });
                return next;
            });
        }));

        return () => cleanups.forEach(fn => fn());
    }, []);

    // Panel toggle handler
    const handleTogglePanel = (panelId: string, active: boolean) => {
        window.electronAPI.togglePanel(panelId, active).then(() => {
            setActivePanelIds(prev =>
                active ? [...prev.filter(id => id !== panelId), panelId] : prev.filter(id => id !== panelId)
            );
        }).catch(() => {});
    };

    // Create ephemeral panel (lives for this meeting only)
    const handleCreateEphemeral = (name: string, instruction: string) => {
        ephemeralPanelCounter.current += 1;
        const id = `ephemeral-${ephemeralPanelCounter.current}-${Date.now()}`;
        const newPanel = {
            id,
            name,
            icon: 'FileText',
            color: 'blue',
            isBuiltIn: false,
            systemPrompt: `You are a silent real-time meeting assistant. You produce ONLY bullet-point output. Rules:
- Output 3-7 short bullets, each under 15 words
- No introductions, no summaries of what you are doing, no sign-offs
- No markdown headers, no numbered lists — only "- " dashed bullets
- Never mention that you are an AI or assistant
- If the conversation is too short or unclear, output "- Listening..." and nothing else

${instruction}`,
            instruction,
        };
        // Save and activate
        window.electronAPI.saveCustomPanel(newPanel).then(() => {
            setPanelConfigs(prev => [...prev, newPanel]);
            handleTogglePanel(id, true);
        }).catch(() => {});
    };

    // Connect to Native Audio Backend
    useEffect(() => {
        const cleanups: (() => void)[] = [];

        // Connection Status
        window.electronAPI.getNativeAudioStatus().then((status) => {
            setIsConnected(status.connected);
        }).catch(() => setIsConnected(false));

        cleanups.push(window.electronAPI.onNativeAudioConnected(() => {
            setIsConnected(true);
        }));
        cleanups.push(window.electronAPI.onNativeAudioDisconnected(() => {
            setIsConnected(false);
        }));

        // Real-time Transcripts
        cleanups.push(window.electronAPI.onNativeAudioTranscript((transcript) => {
            // When Answer button is active, capture USER transcripts for voice input
            // Use ref to avoid stale closure issue
            if (isRecordingRef.current && transcript.speaker === 'user') {
                if (transcript.final) {
                    // Accumulate final transcripts
                    setVoiceInput(prev => {
                        const updated = prev + (prev ? ' ' : '') + transcript.text;
                        voiceInputRef.current = updated;
                        return updated;
                    });
                    setManualTranscript('');  // Clear partial preview
                } else {
                    // Show live partial transcript
                    setManualTranscript(transcript.text);
                }
                return;  // Don't add to messages while recording
            }

            // Ignore user mic transcripts when not recording
            // Only interviewer (system audio) transcripts should appear in chat
            if (transcript.speaker === 'user') {
                return;  // Skip user mic input - only relevant when Answer button is active
            }

            // Show all non-user transcripts (interviewer + diarized speakers) in rolling bar
            // speaker can be 'interviewer', 'speaker_0', 'speaker_SPEAKER_00', etc.

            // Route to rolling transcript bar - accumulate text continuously
            setIsInterviewerSpeaking(!transcript.final);

            const namePrefix = transcript.person_name ? `${transcript.person_name}: ` : '';

            if (transcript.final) {
                // Append finalized text to accumulated transcript
                setRollingTranscript(prev => {
                    const separator = prev ? '  ·  ' : '';
                    return prev + separator + namePrefix + transcript.text;
                });

                // Clear speaking indicator after pause
                setTimeout(() => {
                    setIsInterviewerSpeaking(false);
                }, 3000);
            } else {
                // For partial transcripts, show current segment appended to accumulated
                setRollingTranscript(prev => {
                    // Find where previous finalized content ends (look for last separator)
                    const lastSeparator = prev.lastIndexOf('  ·  ');
                    const accumulated = lastSeparator >= 0 ? prev.substring(0, lastSeparator + 5) : '';
                    return accumulated + namePrefix + transcript.text;
                });
            }
        }));

        // AI Suggestions from native audio (legacy)
        cleanups.push(window.electronAPI.onSuggestionProcessingStart(() => {
            setIsProcessing(true);
        }));

        cleanups.push(window.electronAPI.onSuggestionGenerated((data) => {
            setIsProcessing(false);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: data.suggestion
            }]);
        }));

        cleanups.push(window.electronAPI.onSuggestionError((err) => {
            setIsProcessing(false);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: `Error: ${err.error}`
            }]);
        }));



        cleanups.push(window.electronAPI.onIntelligenceSuggestedAnswerToken((data) => {
            // Progressive update for 'what_to_answer' mode
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];

                // If we already have a streaming message for this intent, append
                if (lastMsg && lastMsg.isStreaming && lastMsg.intent === 'what_to_answer') {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        text: lastMsg.text + data.token
                    };
                    return updated;
                }

                // Otherwise, start a new one (First token)
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: data.token,
                    intent: 'what_to_answer',
                    isStreaming: true
                }];
            });
        }));

        cleanups.push(window.electronAPI.onIntelligenceSuggestedAnswer((data) => {
            setIsProcessing(false);
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];

                // If we were streaming, finalize it
                if (lastMsg && lastMsg.isStreaming && lastMsg.intent === 'what_to_answer') {
                    // Start new array to avoid mutation
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        text: data.answer, // Ensure final consistency
                        isStreaming: false
                    };
                    return updated;
                }

                // If we missed the stream (or not streaming), append fresh
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: data.answer,  // Plain text, no markdown - ready to speak
                    intent: 'what_to_answer'
                }];
            });
        }));

        // STREAMING: Refinement
        cleanups.push(window.electronAPI.onIntelligenceRefinedAnswerToken((data) => {
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.isStreaming && lastMsg.intent === data.intent) {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        text: lastMsg.text + data.token
                    };
                    return updated;
                }
                // New stream start (e.g. user clicked Shorten)
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: data.token,
                    intent: data.intent,
                    isStreaming: true
                }];
            });
        }));

        cleanups.push(window.electronAPI.onIntelligenceRefinedAnswer((data) => {
            setIsProcessing(false);
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.isStreaming && lastMsg.intent === data.intent) {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        text: data.answer,
                        isStreaming: false
                    };
                    return updated;
                }
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: data.answer,
                    intent: data.intent
                }];
            });
        }));

        // STREAMING: Recap
        cleanups.push(window.electronAPI.onIntelligenceRecapToken((data) => {
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.isStreaming && lastMsg.intent === 'recap') {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        text: lastMsg.text + data.token
                    };
                    return updated;
                }
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: data.token,
                    intent: 'recap',
                    isStreaming: true
                }];
            });
        }));

        cleanups.push(window.electronAPI.onIntelligenceRecap((data) => {
            setIsProcessing(false);
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.isStreaming && lastMsg.intent === 'recap') {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        text: data.summary,
                        isStreaming: false
                    };
                    return updated;
                }
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: data.summary,
                    intent: 'recap'
                }];
            });
        }));

        // STREAMING: Follow-Up Questions (Rendered as message? Or specific UI?)
        // Currently interface typically renders follow-up Qs as a message or button update.
        // Let's assume message for now based on existing 'follow_up_questions_update' handling
        // But wait, existing handle just sets state?
        // Let's check how 'follow_up_questions_update' was handled.
        // It was handled separate locally in this component maybe?
        // Ah, I need to see the existing listener for 'onIntelligenceFollowUpQuestionsUpdate'

        // Let's implemented token streaming for it anyway, likely it updates a message bubble 
        // OR it might update a specialized "Suggested Questions" area.
        // Assuming it's a message for consistency with "Copilot" approach.

        cleanups.push(window.electronAPI.onIntelligenceFollowUpQuestionsToken((data) => {
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.isStreaming && lastMsg.intent === 'follow_up_questions') {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        text: lastMsg.text + data.token
                    };
                    return updated;
                }
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: data.token,
                    intent: 'follow_up_questions',
                    isStreaming: true
                }];
            });
        }));

        cleanups.push(window.electronAPI.onIntelligenceFollowUpQuestionsUpdate((data) => {
            // This event name is slightly different ('update' vs 'answer')
            setIsProcessing(false);
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.isStreaming && lastMsg.intent === 'follow_up_questions') {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        text: data.questions,
                        isStreaming: false
                    };
                    return updated;
                }
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: data.questions,
                    intent: 'follow_up_questions'
                }];
            });
        }));

        cleanups.push(window.electronAPI.onIntelligenceManualResult((data) => {
            setIsProcessing(false);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: `🎯 **Answer:**\n\n${data.answer}`
            }]);
        }));

        cleanups.push(window.electronAPI.onIntelligenceError((data) => {
            setIsProcessing(false);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: `❌ Error (${data.mode}): ${data.error}`
            }]);
        }));




        // Screenshot taken - auto-analyze
        cleanups.push(window.electronAPI.onScreenshotTaken(async (data) => {
            setIsProcessing(true);
            analytics.trackCommandExecuted('screenshot_analysis');

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                text: 'Analyzing screenshot...',
                hasScreenshot: true,
                screenshotPreview: data.preview
            }]);

            // Auto-focus input for immediate typing (Robust Retry)
            // We retry a few times to ensure window focus has settled
            [100, 300, 600].forEach(delay => {
                setTimeout(() => {
                    textInputRef.current?.focus();
                }, delay);
            });

            try {
                const result = await window.electronAPI.invoke('analyze-image-file', data.path);
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: result.text
                }]);
            } catch (err) {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: `Error analyzing screenshot: ${err}`
                }]);
            } finally {
                setIsProcessing(false);
            }
        }));

        // Selective Screenshot (Latent Context)
        if (window.electronAPI.onScreenshotAttached) {
            cleanups.push(window.electronAPI.onScreenshotAttached((data) => {
                setAttachedContext(data);
                // toast/notification could go here
            }));
        }

        return () => cleanups.forEach(fn => fn());
    }, []);

    // Quick Actions - Updated to use new Intelligence APIs

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        analytics.trackCopyAnswer();
        // Optional: Trigger a small toast or state change for visual feedback
    };

    const handleWhatToSay = async () => {
        setIsProcessing(true);
        analytics.trackCommandExecuted('what_to_say');

        // Capture and clear attached image context
        const currentAttachment = attachedContext;
        if (currentAttachment) {
            setAttachedContext(null);
            // Show the attached image in chat
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                text: 'What should I say about this?',
                hasScreenshot: true,
                screenshotPreview: currentAttachment.preview
            }]);
        }

        try {
            // Pass imagePath if attached
            await window.electronAPI.generateWhatToSay(currentAttachment?.path);
        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: `Error: ${err}`
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFollowUp = async (intent: string = 'rephrase') => {
        setIsProcessing(true);
        analytics.trackCommandExecuted('follow_up_' + intent);

        try {
            await window.electronAPI.generateFollowUp(intent);
        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: `Error: ${err}`
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRecap = async () => {
        setIsProcessing(true);
        analytics.trackCommandExecuted('recap');

        try {
            await window.electronAPI.generateRecap();
        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: `Error: ${err}`
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFollowUpQuestions = async () => {
        setIsProcessing(true);
        analytics.trackCommandExecuted('suggest_questions');

        try {
            await window.electronAPI.generateFollowUpQuestions();
        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: `Error: ${err}`
            }]);
        } finally {
            setIsProcessing(false);
        }
    };


    // Setup Streaming Listeners
    useEffect(() => {
        const cleanups: (() => void)[] = [];

        // Stream Token
        cleanups.push(window.electronAPI.onGeminiStreamToken((token) => {
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                // Should we be updating the last message or finding the specific streaming one?
                // Assuming the last added message is the one we are streaming into.
                if (lastMsg && lastMsg.isStreaming && lastMsg.role === 'system') {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        text: lastMsg.text + token,
                        // re-check code status on every token? Expensive but needed for progressive highlighting
                        isCode: (lastMsg.text + token).includes('```') || (lastMsg.text + token).includes('def ') || (lastMsg.text + token).includes('function ')
                    };
                    return updated;
                }
                return prev;
            });
        }));

        // Stream Done
        cleanups.push(window.electronAPI.onGeminiStreamDone(() => {
            setIsProcessing(false);

            // Calculate latency if we have a start time
            let latency = 0;
            if (requestStartTimeRef.current) {
                latency = Date.now() - requestStartTimeRef.current;
                requestStartTimeRef.current = null;
            }

            // Track Usage
            analytics.trackModelUsed({
                model_name: 'server',
                provider_type: 'cloud',
                latency_ms: latency
            });

            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.isStreaming) {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        isStreaming: false
                    };
                    return updated;
                }
                return prev;
            });
        }));

        // Stream Error
        cleanups.push(window.electronAPI.onGeminiStreamError((error) => {
            setIsProcessing(false);
            requestStartTimeRef.current = null; // Clear timer on error
            setMessages(prev => {
                // Append error to the current message or add new one?
                // Let's add a new error block if the previous one confusing,
                // or just update status.
                // Ideally we want to show the partial response AND the error.
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.isStreaming) {
                    const updated = [...prev];
                    updated[prev.length - 1] = {
                        ...lastMsg,
                        isStreaming: false,
                        text: lastMsg.text + `\n\n[Error: ${error}]`
                    };
                    return updated;
                }
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: `❌ Error: ${error}`
                }];
            });
        }));

        return () => cleanups.forEach(fn => fn());
    }, []);

    // MODE 5: Manual Answer - Toggle recording for voice-to-answer
    const handleAnswerNow = async () => {
        if (isManualRecording) {
            // Stop recording - send accumulated voice input to Gemini
            isRecordingRef.current = false;  // Update ref immediately
            setIsManualRecording(false);
            setManualTranscript('');  // Clear live preview

            const currentAttachment = attachedContext;
            setAttachedContext(null); // Clear context immediately on send

            const question = voiceInputRef.current.trim();
            setVoiceInput('');
            voiceInputRef.current = '';

            if (!question && !currentAttachment) {
                // No voice input and no image
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: '⚠️ No speech detected. Try speaking closer to your microphone.'
                }]);
                return;
            }

            // Show user's spoken question
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                text: question,
                hasScreenshot: !!currentAttachment,
                screenshotPreview: currentAttachment?.preview
            }]);

            // Add placeholder for streaming response
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: '',
                isStreaming: true
            }]);

            setIsProcessing(true);

            try {
                let prompt = '';

                if (currentAttachment) {
                    // Image + Voice Context
                    prompt = `You are a helper. The user has provided a screenshot and a spoken question/command.
User said: "${question}"

Instructions:
1. Analyze the screenshot in the context of what the user said.
2. Provide a direct, helpful answer.
3. Be concise.`;
                } else {
                    // Voice Only (Smart Extract)
                    // We pass the instructions as CONTEXT so the backend logs the user question cleanly
                    prompt = `You are a real-time interview assistant. The user just repeated or paraphrased a question from their interviewer.
Instructions:
1. Extract the core question being asked
2. Provide a clear, concise, and professional answer that the user can say out loud
3. Keep the answer conversational but informative (2-4 sentences ideal)
4. Do NOT include phrases like "The question is..." - just give the answer directly
5. Format for speaking out loud, not for reading

Provide only the answer, nothing else.`;
                }

                // Call Streaming API: message = question, context = instructions
                requestStartTimeRef.current = Date.now();
                await window.electronAPI.streamGeminiChat(question, currentAttachment?.path, prompt, { skipSystemPrompt: true });

            } catch (err) {
                // Initial invocation failing (e.g. IPC error before stream starts)
                setIsProcessing(false);
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    // If we just added the empty streaming placeholder, remove it or fill it with error
                    if (last && last.isStreaming && last.text === '') {
                        return prev.slice(0, -1).concat({
                            id: Date.now().toString(),
                            role: 'system',
                            text: `❌ Error starting stream: ${err}`
                        });
                    }
                    return [...prev, {
                        id: Date.now().toString(),
                        role: 'system',
                        text: `❌ Error: ${err}`
                    }];
                });
            }
        } else {
            // Start recording - reset voice input state
            setVoiceInput('');
            voiceInputRef.current = '';
            setManualTranscript('');
            isRecordingRef.current = true;  // Update ref immediately
            setIsManualRecording(true);


            // Ensure native audio is connected
            try {
                // Native audio is now managed by main process
                // await window.electronAPI.invoke('native-audio-connect');
            } catch (err) {
                // Already connected, that's fine
            }
        }
    };

    const handleManualSubmit = async () => {
        if (!inputValue.trim() && !attachedContext) return;

        const userText = inputValue;
        const currentAttachment = attachedContext;

        // Clear inputs immediately
        setInputValue('');
        setAttachedContext(null);

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'user',
            text: userText || (currentAttachment ? 'Analyze this screenshot' : ''),
            hasScreenshot: !!currentAttachment,
            screenshotPreview: currentAttachment?.preview
        }]);

        // Add placeholder for streaming response
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            text: '',
            isStreaming: true
        }]);

        setIsProcessing(true);

        try {
            // Pass imagePath if attached, AND conversation context
            requestStartTimeRef.current = Date.now();
            await window.electronAPI.streamGeminiChat(
                userText || 'Analyze this screenshot',
                currentAttachment?.path,
                conversationContext // Pass context so "answer this" works
            );
        } catch (err) {
            setIsProcessing(false);
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.isStreaming && last.text === '') {
                    // remove the empty placeholder
                    return prev.slice(0, -1).concat({
                        id: Date.now().toString(),
                        role: 'system',
                        text: `❌ Error starting stream: ${err}`
                    });
                }
                return [...prev, {
                    id: Date.now().toString(),
                    role: 'system',
                    text: `❌ Error: ${err}`
                }];
            });
        }
    };

    const clearChat = () => {
        setMessages([]);
    };




    const renderMessageText = useCallback((msg: Message) => {
        // Code-containing messages get special styling
        // We split by code blocks to keep the "Code Solution" UI intact for the code parts
        // But use ReactMarkdown for the text parts around it
        if (msg.isCode || (msg.role === 'system' && msg.text.includes('```'))) {
            const parts = msg.text.split(/(```[\s\S]*?```)/g);
            return (
                <div className="bg-glass-bg-light border border-glass-border rounded-lg p-3 my-1">
                    <div className="flex items-center gap-2 mb-2 text-accent-primary font-semibold text-xs uppercase tracking-wide">
                        <Code className="w-3.5 h-3.5" />
                        <span>Code Solution</span>
                    </div>
                    <div className="space-y-2 text-text-primary text-[13px] leading-relaxed">
                        {parts.map((part, i) => {
                            if (part.startsWith('```')) {
                                const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
                                if (match) {
                                    const lang = match[1] || 'python';
                                    const code = match[2].trim();
                                    return (
                                        <div key={i} className="my-3 rounded-lg overflow-hidden border border-glass-border shadow-sm bg-bg-primary">
                                            {/* IDE-style Header */}
                                            <div className="bg-bg-elevated px-3 py-1.5 flex items-center justify-between border-b border-border-subtle">
                                                <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-text-secondary font-mono">
                                                    <div className="w-2 h-2 rounded-full bg-accent-primary/80" />
                                                    {lang || 'CODE'}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-white/10" />
                                                    <div className="w-2 h-2 rounded-full bg-white/10" />
                                                </div>
                                            </div>
                                            <SyntaxHighlighter
                                                language={lang}
                                                style={dracula}
                                                customStyle={{
                                                    margin: 0,
                                                    borderRadius: 0,
                                                    fontSize: '12px',
                                                    background: 'transparent',
                                                    padding: '12px',
                                                    fontFamily: 'JetBrains Mono, Menlo, monospace'
                                                }}
                                                wrapLongLines={true}
                                                showLineNumbers={true}
                                                lineNumberStyle={{ minWidth: '2em', paddingRight: '1em', color: '#475569', textAlign: 'right' }}
                                            >
                                                {code}
                                            </SyntaxHighlighter>
                                        </div>
                                    );
                                }
                            }
                            // Regular text - Render with Markdown
                            return (
                                <div key={i} className="markdown-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
                                            strong: ({ node, ...props }: any) => <strong className="font-bold text-text-primary" {...props} />,
                                            em: ({ node, ...props }: any) => <em className="italic text-text-secondary" {...props} />,
                                            ul: ({ node, ...props }: any) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                                            ol: ({ node, ...props }: any) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                                            li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
                                            h1: ({ node, ...props }: any) => <h1 className="text-lg font-bold text-text-primary mb-2 mt-3" {...props} />,
                                            h2: ({ node, ...props }: any) => <h2 className="text-base font-bold text-text-primary mb-2 mt-3" {...props} />,
                                            h3: ({ node, ...props }: any) => <h3 className="text-sm font-bold text-text-primary mb-1 mt-2" {...props} />,
                                            code: ({ node, ...props }: any) => <code className="bg-bg-elevated rounded px-1 py-0.5 text-xs font-mono text-accent-primary" {...props} />,
                                            blockquote: ({ node, ...props }: any) => <blockquote className="border-l-2 border-accent-primary/50 pl-3 italic text-text-tertiary my-2" {...props} />,
                                            a: ({ node, ...props }: any) => <a className="text-accent-primary hover:opacity-80 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                        }}
                                    >
                                        {part}
                                    </ReactMarkdown>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // Custom Styled Labels (Shorten, Recap, Follow-up) - also use Markdown for content
        if (msg.intent === 'shorten') {
            return (
                <div className="bg-glass-bg-light border border-glass-border rounded-lg p-3 my-1">
                    <div className="flex items-center gap-2 mb-2 text-accent-primary font-semibold text-xs uppercase tracking-wide">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Shortened</span>
                    </div>
                    <div className="text-text-primary text-[13px] leading-relaxed markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                            p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
                            strong: ({ node, ...props }: any) => <strong className="font-bold text-text-primary" {...props} />,
                            ul: ({ node, ...props }: any) => <ul className="list-disc ml-4 mb-2" {...props} />,
                            li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
                        }}>
                            {msg.text}
                        </ReactMarkdown>
                    </div>
                </div>
            );
        }

        if (msg.intent === 'recap') {
            return (
                <div className="bg-glass-bg-light border border-glass-border rounded-lg p-3 my-1">
                    <div className="flex items-center gap-2 mb-2 text-accent-primary font-semibold text-xs uppercase tracking-wide">
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Recap</span>
                    </div>
                    <div className="text-text-primary text-[13px] leading-relaxed markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                            p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
                            strong: ({ node, ...props }: any) => <strong className="font-bold text-text-primary" {...props} />,
                            ul: ({ node, ...props }: any) => <ul className="list-disc ml-4 mb-2" {...props} />,
                            li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
                        }}>
                            {msg.text}
                        </ReactMarkdown>
                    </div>
                </div>
            );
        }

        if (msg.intent === 'follow_up_questions') {
            return (
                <div className="bg-glass-bg-light border border-glass-border rounded-lg p-3 my-1">
                    <div className="flex items-center gap-2 mb-2 text-accent-primary font-semibold text-xs uppercase tracking-wide">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Follow-Up Questions</span>
                    </div>
                    <div className="text-text-primary text-[13px] leading-relaxed markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                            p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
                            strong: ({ node, ...props }: any) => <strong className="font-bold text-text-primary" {...props} />,
                            ul: ({ node, ...props }: any) => <ul className="list-disc ml-4 mb-2" {...props} />,
                            li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
                        }}>
                            {msg.text}
                        </ReactMarkdown>
                    </div>
                </div>
            );
        }

        if (msg.intent === 'what_to_answer') {
            // Split text by code blocks (Handle unclosed blocks at EOF)
            const parts = msg.text.split(/(```[\s\S]*?(?:```|$))/g);

            return (
                <div className="bg-glass-bg-light border border-glass-border rounded-lg p-3 my-1">
                    <div className="flex items-center gap-2 mb-2 text-accent-primary font-semibold text-xs uppercase tracking-wide">
                        <span>Say this</span>
                    </div>
                    <div className="text-text-primary text-[14px] leading-relaxed">
                        {parts.map((part, i) => {
                            if (part.startsWith('```')) {
                                // Robust matching: handles unclosed blocks for streaming (```...$)
                                const match = part.match(/```(\w*)\s+([\s\S]*?)(?:```|$)/);

                                // Fallback logic: if it starts with ticks, treat as code (even if unclosed)
                                if (match || part.startsWith('```')) {
                                    const lang = (match && match[1]) ? match[1] : 'python';
                                    let code = '';

                                    if (match && match[2]) {
                                        code = match[2].trim();
                                    } else {
                                        // Manual strip if regex failed
                                        code = part.replace(/^```\w*\s*/, '').replace(/```$/, '').trim();
                                    }

                                    return (
                                        <div key={i} className="my-3 rounded-lg overflow-hidden border border-glass-border shadow-sm bg-bg-primary">
                                            {/* IDE-style Header */}
                                            <div className="bg-bg-elevated px-3 py-1.5 flex items-center justify-between border-b border-border-subtle">
                                                <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-text-secondary font-mono">
                                                    <div className="w-2 h-2 rounded-full bg-accent-primary/80" />
                                                    {lang || 'CODE'}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-white/10" />
                                                    <div className="w-2 h-2 rounded-full bg-white/10" />
                                                </div>
                                            </div>

                                            <SyntaxHighlighter
                                                language={lang}
                                                style={dracula}
                                                customStyle={{
                                                    margin: 0,
                                                    borderRadius: 0,
                                                    fontSize: '12px',
                                                    background: 'transparent',
                                                    padding: '12px',
                                                    fontFamily: 'JetBrains Mono, Menlo, monospace'
                                                }}
                                                wrapLongLines={true}
                                                showLineNumbers={true}
                                                lineNumberStyle={{ minWidth: '2em', paddingRight: '1em', color: '#475569', textAlign: 'right' }}
                                            >
                                                {code}
                                            </SyntaxHighlighter>
                                        </div>
                                    );
                                }
                            }
                            // Regular text - Render Markdown
                            return (
                                <div key={i} className="markdown-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
                                            strong: ({ node, ...props }: any) => <strong className="font-bold text-text-primary" {...props} />,
                                            em: ({ node, ...props }: any) => <em className="italic text-text-secondary" {...props} />,
                                            ul: ({ node, ...props }: any) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                                            ol: ({ node, ...props }: any) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                                            li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
                                        }}
                                    >
                                        {part}
                                    </ReactMarkdown>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // Standard Text Messages (e.g. from User or Interviewer)
        // We still want basic markdown support here too
        return (
            <div className="markdown-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                        p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />,
                        strong: ({ node, ...props }: any) => <strong className="font-bold opacity-100" {...props} />,
                        em: ({ node, ...props }: any) => <em className="italic opacity-90" {...props} />,
                        ul: ({ node, ...props }: any) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                        ol: ({ node, ...props }: any) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                        li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
                        code: ({ node, ...props }: any) => <code className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono" {...props} />,
                        a: ({ node, ...props }: any) => <a className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer" {...props} />,
                    }}
                >
                    {msg.text}
                </ReactMarkdown>
            </div>
        );
    }, []);

    return (
        <div ref={contentRef} className="flex flex-col items-center w-fit mx-auto h-fit min-h-0 bg-transparent p-0 rounded-[24px] font-sans text-text-primary gap-2 drag-region">

            <div className="flex flex-col items-center gap-2 w-full">
                <TopPill
                    onQuit={() => setShowStopConfirm(true)}
                    isPaused={isMeetingPaused}
                    onPauseToggle={handlePauseToggle}
                />
                        <div className="
                    relative w-[600px] max-w-full
                    glass-panel-heavy
                    shadow-2xl shadow-black/40
                    rounded-[24px]
                    overflow-hidden
                    flex flex-col
                ">




                            {/* Paused Banner */}
                            {isMeetingPaused && (
                                <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 no-drag">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                        <span className="text-[12px] font-medium text-amber-300">Meeting Paused</span>
                                    </div>
                                    <button
                                        onClick={handlePauseToggle}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors interaction-base interaction-press"
                                    >
                                        <Play className="w-3 h-3" />
                                        Resume
                                    </button>
                                </div>
                            )}

                            {/* Overlay Settings Popover */}
                            <AnimatePresence>
                                {isOverlaySettingsOpen && (
                                    <OverlaySettingsPopover
                                        isOpen={isOverlaySettingsOpen}
                                        onClose={() => setIsOverlaySettingsOpen(false)}
                                        isPaused={isMeetingPaused}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Rolling Transcript Bar - Single-line interviewer speech */}
                            {(rollingTranscript || isInterviewerSpeaking) && showTranscript && (
                                <RollingTranscript
                                    text={rollingTranscript}
                                    isActive={isInterviewerSpeaking}
                                />
                            )}

                            {/* Chat History - Only show if there are messages OR active states */}
                            {(messages.length > 0 || isManualRecording || isProcessing) && (
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[clamp(300px,35vh,450px)] no-drag" style={{ scrollbarWidth: 'none' }}>
                                    {messages.map((msg) => (
                                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                            <div className={`
                      ${msg.role === 'user' ? 'max-w-[72.25%] px-[13.6px] py-[10.2px]' : 'max-w-[85%] px-4 py-3'} text-[14px] leading-relaxed relative group whitespace-pre-wrap
                      ${msg.role === 'user'
                                                    ? 'bg-accent-secondary backdrop-blur-md border border-accent-primary/30 text-text-primary rounded-[20px] rounded-tr-[4px] shadow-sm font-medium'
                                                    : ''
                                                }
                      ${msg.role === 'system'
                                                    ? 'text-text-primary font-normal'
                                                    : ''
                                                }
                      ${msg.role === 'interviewer'
                                                    ? 'text-text-tertiary italic pl-0 text-[13px]'
                                                    : ''
                                                }
                    `}>
                                                {msg.role === 'interviewer' && (
                                                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-600 font-medium uppercase tracking-wider">
                                                        Interviewer
                                                        {msg.isStreaming && <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />}
                                                    </div>
                                                )}
                                                {msg.role === 'user' && msg.hasScreenshot && (
                                                    <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1 border-b border-white/10 pb-1">
                                                        <Image className="w-2.5 h-2.5" />
                                                        <span>Screenshot attached</span>
                                                    </div>
                                                )}
                                                {msg.role === 'system' && !msg.isStreaming && (
                                                    <button
                                                        onClick={() => handleCopy(msg.text)}
                                                        className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 text-slate-400 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Copy to clipboard"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {renderMessageText(msg)}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Active Recording State with Live Transcription */}
                                    {isManualRecording && (
                                        <div className="flex flex-col items-end gap-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {/* Live transcription preview */}
                                            {(manualTranscript || voiceInput) && (
                                                <div className="max-w-[85%] px-3.5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-[18px] rounded-tr-[4px]">
                                                    <span className="text-[13px] text-emerald-300">
                                                        {voiceInput}{voiceInput && manualTranscript ? ' ' : ''}{manualTranscript}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="px-3 py-2 flex gap-1.5 items-center">
                                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                <span className="text-[10px] text-emerald-400/70 ml-1">Listening...</span>
                                            </div>
                                        </div>
                                    )}

                                    {isProcessing && (
                                        <div className="flex justify-start">
                                            <div className="px-3 py-2 flex gap-1.5">
                                                <div className="w-2 h-2 bg-accent-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 bg-accent-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 bg-accent-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}

                            {/* Panel Bar - Configurable meeting panels */}
                            {panelConfigs.length > 0 && (
                                <PanelBar
                                    panelConfigs={panelConfigs}
                                    activePanelIds={activePanelIds}
                                    panelStates={panelStates}
                                    onTogglePanel={handleTogglePanel}
                                    onCreateEphemeral={handleCreateEphemeral}
                                />
                            )}

                            {/* Quick Actions - Minimal & Clean */}
                            <div className={`flex flex-nowrap justify-center items-center gap-1.5 px-4 pb-3 overflow-x-hidden ${rollingTranscript && showTranscript ? 'pt-1' : 'pt-3'}`}>
                                <button onClick={() => handleFollowUp('shorten')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-text-secondary bg-glass-bg-light border border-transparent hover:text-text-primary hover:bg-accent-primary/10 hover:border-accent-primary/10 transition-all active:scale-95 duration-200 interaction-base interaction-press whitespace-nowrap shrink-0">
                                    <MessageSquare className="w-3 h-3 opacity-70" /> Shorten
                                </button>
                                <button onClick={handleRecap} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-text-secondary bg-glass-bg-light border border-transparent hover:text-text-primary hover:bg-accent-primary/10 hover:border-accent-primary/10 transition-all active:scale-95 duration-200 interaction-base interaction-press whitespace-nowrap shrink-0">
                                    <RefreshCw className="w-3 h-3 opacity-70" /> Recap
                                </button>
                                <button onClick={handleFollowUpQuestions} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-text-secondary bg-glass-bg-light border border-transparent hover:text-text-primary hover:bg-accent-primary/10 hover:border-accent-primary/10 transition-all active:scale-95 duration-200 interaction-base interaction-press whitespace-nowrap shrink-0">
                                    <HelpCircle className="w-3 h-3 opacity-70" /> Follow Up Question
                                </button>
                                <button
                                    onClick={handleAnswerNow}
                                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95 duration-200 interaction-base interaction-press min-w-[74px] whitespace-nowrap shrink-0 ${isManualRecording
                                        ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
                                        : 'bg-glass-bg-light text-text-secondary hover:text-emerald-400 hover:bg-emerald-500/10'
                                        }`}
                                >
                                    {isManualRecording ? (
                                        <>
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                            Stop
                                        </>
                                    ) : (
                                        <><Zap className="w-3 h-3 opacity-70" /> Answer</>
                                    )}
                                </button>
                            </div>

                            {/* Input Area */}
                            <div className="p-3 pt-0">
                                {/* Latent Context Preview (Attached Screenshot) */}
                                {attachedContext && (
                                    <div className="mb-2 flex items-center justify-between bg-glass-bg-light border border-glass-border rounded-lg p-2 animate-in fade-in slide-in-from-bottom-1">
                                        <div className="flex items-center gap-3">
                                            <div className="relative group">
                                                <img
                                                    src={attachedContext.preview}
                                                    alt="Context"
                                                    className="h-10 w-auto rounded border border-white/20"
                                                />
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors rounded" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-medium text-text-primary">Screenshot attached</span>
                                                <span className="text-[10px] text-text-tertiary">Ask a question or click Answer</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setAttachedContext(null)}
                                            className="p-1 hover:bg-glass-bg-light rounded-full text-text-tertiary hover:text-text-primary transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}

                                <div className="relative group">
                                    <input
                                        ref={textInputRef}
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}

                                        className="
                                    w-full
                                    bg-bg-input
                                    hover:bg-bg-input
                                    focus:bg-bg-input
                                    border border-border-subtle
                                    focus:border-accent-primary/40
                                    focus:ring-1 focus:ring-accent-primary/20
                                    rounded-xl
                                    pl-3 pr-10 py-2.5
                                    text-text-primary
                                    focus:outline-none
                                    transition-all duration-200 ease-sculpted
                                    text-[13px] leading-relaxed
                                    placeholder:text-text-tertiary
                                "
                                    />

                                    {/* Custom Rich Placeholder */}
                                    {!inputValue && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-[13px] text-text-tertiary">
                                            <span>Ask anything on screen or conversation, or</span>
                                            <div className="flex items-center gap-1 opacity-80">
                                                <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] font-sans">⌘</kbd>
                                                <span className="text-[10px]">+</span>
                                                <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] font-sans">H</kbd>
                                            </div>
                                            <span>for screenshot</span>
                                        </div>
                                    )}

                                    {!inputValue && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none opacity-20">
                                            <span className="text-[10px]">↵</span>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Row */}
                                <div className="flex items-center justify-between mt-3 px-0.5">
                                    <div className="flex items-center gap-1.5">
                                        {/* Live Transcript */}
                                        <button
                                            onClick={() => window.electronAPI.toggleTranscriptPanel()}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg interaction-base interaction-press text-text-tertiary hover:text-text-secondary hover:bg-glass-bg-light"
                                            title="Live Transcript"
                                        >
                                            <MessageSquareText className="w-3.5 h-3.5" />
                                        </button>

                                        <div className="w-px h-3 bg-white/10" />

                                        {/* Live Feedback */}
                                        <button
                                            onClick={() => window.electronAPI.toggleLiveFeedback()}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg interaction-base interaction-press text-[11px] font-medium text-[#E8750A]/70 hover:text-[#E8750A] hover:bg-[#E8750A]/8 transition-colors"
                                            title="Live Feedback"
                                        >
                                            <Zap className="w-3 h-3" />
                                            <span>Feedback</span>
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {/* Settings Cog — opens inline overlay settings */}
                                        <button
                                            onClick={() => setIsOverlaySettingsOpen(prev => !prev)}
                                            className={`
                                                w-7 h-7 flex items-center justify-center rounded-lg
                                                interaction-base interaction-press
                                                ${isOverlaySettingsOpen ? 'text-text-primary bg-glass-bg-light' : 'text-text-tertiary hover:text-text-secondary hover:bg-glass-bg-light'}
                                            `}
                                            title="Audio Settings"
                                        >
                                            <Settings className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                            onClick={handleManualSubmit}
                                            disabled={!inputValue.trim()}
                                            className={`
                                                w-7 h-7 rounded-full flex items-center justify-center
                                                interaction-base interaction-press
                                                ${inputValue.trim()
                                                    ? 'bg-accent-primary text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600'
                                                    : 'bg-white/5 text-white/10 cursor-not-allowed'
                                                }
                                            `}
                                        >
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
            </div>

            {/* Stop Confirmation Modal */}
            <AnimatePresence>
                {showStopConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center no-drag"
                        onClick={() => setShowStopConfirm(false)}
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 8 }}
                            transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
                            className="relative w-[340px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50"
                            style={{ background: 'rgba(20, 20, 20, 0.95)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Orange accent bar */}
                            <div className="h-1 w-full bg-gradient-to-r from-[#F59E0B] via-[#E8750A] to-[#D96C08]" />

                            <div className="p-5">
                                {/* Icon + Title */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B]/20 via-[#E8750A]/15 to-[#D96C08]/10 flex items-center justify-center border border-[#E8750A]/20">
                                        <div className="w-4 h-4 rounded-[3px] bg-[#E8750A]" />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-semibold text-white">End Meeting?</h3>
                                        <p className="text-[12px] text-white/50">This will stop all recording</p>
                                    </div>
                                </div>

                                <p className="text-[13px] text-white/60 leading-relaxed mb-5">
                                    Your transcript and conversation history will be saved. Audio capture will stop immediately.
                                </p>

                                {/* Actions */}
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={() => setShowStopConfirm(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white/70 bg-white/5 border border-white/8 hover:bg-white/10 hover:text-white transition-all duration-150"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowStopConfirm(false);
                                            onEndMeeting ? onEndMeeting() : window.electronAPI.quitApp();
                                        }}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-[#F59E0B] via-[#E8750A] to-[#D96C08] hover:brightness-110 shadow-lg shadow-[#E8750A]/20 transition-all duration-150 active:scale-[0.97]"
                                    >
                                        End Meeting
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SmarterliInterface;
