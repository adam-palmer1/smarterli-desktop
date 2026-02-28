import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

interface OverlaySettingsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    isPaused: boolean;
}

const OverlaySettingsPopover: React.FC<OverlaySettingsPopoverProps> = ({ isOpen, onClose, isPaused: _isPaused }) => {
    const [inputDevices, setInputDevices] = useState<Array<{ id: string; name: string }>>([]);
    const [outputDevices, setOutputDevices] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedInput, setSelectedInput] = useState(() => localStorage.getItem('preferredInputDeviceId') || '');
    const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('preferredOutputDeviceId') || '');
    const [noiseCancellation, setNoiseCancellation] = useState(() => localStorage.getItem('smarterli_noiseCancellation') !== 'false');
    const [inputStreaming, setInputStreaming] = useState(() => localStorage.getItem('smarterli_inputStreaming') !== 'false');
    const [outputStreaming, setOutputStreaming] = useState(() => localStorage.getItem('smarterli_outputStreaming') !== 'false');
    const popoverRef = useRef<HTMLDivElement>(null);

    // Load devices on mount
    useEffect(() => {
        if (!isOpen) return;
        window.electronAPI.getInputDevices().then(setInputDevices).catch(() => {});
        window.electronAPI.getOutputDevices().then(setOutputDevices).catch(() => {});
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Defer to avoid closing on the same click that opened
        const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClick);
        };
    }, [isOpen, onClose]);

    const handleInputChange = (deviceId: string) => {
        setSelectedInput(deviceId);
        localStorage.setItem('preferredInputDeviceId', deviceId);
        window.electronAPI.reconfigureAudioMidMeeting({
            inputDeviceId: deviceId || undefined,
            outputDeviceId: selectedOutput || undefined,
        }).catch(() => {});
    };

    const handleOutputChange = (deviceId: string) => {
        setSelectedOutput(deviceId);
        localStorage.setItem('preferredOutputDeviceId', deviceId);
        window.electronAPI.reconfigureAudioMidMeeting({
            inputDeviceId: selectedInput || undefined,
            outputDeviceId: deviceId || undefined,
        }).catch(() => {});
    };

    const handleToggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
        setter(value);
        localStorage.setItem(key, String(value));
    };

    const handleInputStreamingToggle = (value: boolean) => {
        setInputStreaming(value);
        localStorage.setItem('smarterli_inputStreaming', String(value));
        window.electronAPI.setInputStreaming(value).catch(() => {});
    };

    const handleOutputStreamingToggle = (value: boolean) => {
        setOutputStreaming(value);
        localStorage.setItem('smarterli_outputStreaming', String(value));
        window.electronAPI.setOutputStreaming(value).catch(() => {});
    };

    if (!isOpen) return null;

    return (
        <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="glass-panel-light p-4 w-full no-drag"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-semibold text-text-primary uppercase tracking-wide">Audio Settings</span>
                <button
                    onClick={onClose}
                    className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-glass-bg-light transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="space-y-3">
                {/* Input Device */}
                <div>
                    <label className="text-[11px] text-text-secondary font-medium mb-1 block">Input Device</label>
                    <select
                        value={selectedInput}
                        onChange={(e) => handleInputChange(e.target.value)}
                        className="w-full bg-bg-input border border-border-subtle rounded-lg px-2.5 py-1.5 text-[12px] text-text-primary focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20 transition-colors"
                    >
                        <option value="">System Default</option>
                        {inputDevices.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                {/* Output Device */}
                <div>
                    <label className="text-[11px] text-text-secondary font-medium mb-1 block">Output Device</label>
                    <select
                        value={selectedOutput}
                        onChange={(e) => handleOutputChange(e.target.value)}
                        className="w-full bg-bg-input border border-border-subtle rounded-lg px-2.5 py-1.5 text-[12px] text-text-primary focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20 transition-colors"
                    >
                        <option value="">System Default</option>
                        {outputDevices.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                <div className="w-full h-px bg-border-subtle" />

                {/* Noise Cancellation Toggle */}
                <ToggleRow
                    label="Noise Cancellation"
                    checked={noiseCancellation}
                    onChange={(v) => handleToggle('smarterli_noiseCancellation', v, setNoiseCancellation)}
                />

                {/* Mic Streaming Toggle */}
                <ToggleRow
                    label="Mic Streaming"
                    checked={inputStreaming}
                    onChange={handleInputStreamingToggle}
                />

                {/* System Audio Streaming Toggle */}
                <ToggleRow
                    label="System Audio Streaming"
                    checked={outputStreaming}
                    onChange={handleOutputStreamingToggle}
                />
            </div>
        </motion.div>
    );
};

interface ToggleRowProps {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-secondary font-medium">{label}</span>
        <button
            onClick={() => onChange(!checked)}
            className={`
                relative w-8 h-[18px] rounded-full transition-colors duration-200
                ${checked ? 'bg-accent-primary' : 'bg-bg-toggle-switch'}
            `}
        >
            <div className={`
                absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-200
                ${checked ? 'translate-x-[16px]' : 'translate-x-[2px]'}
            `} />
        </button>
    </div>
);

export default OverlaySettingsPopover;
