import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ModelSelectorProps {
    currentModel: string;
    onSelectModel: (model: string) => void;
}

interface ModelOption {
    id: string;
    name: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModel, onSelectModel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [models, setModels] = useState<ModelOption[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load models from billing plan when dropdown opens
    useEffect(() => {
        if (!isOpen) return;

        const loadModels = async () => {
            try {
                const plan = await window.electronAPI?.getBillingPlan();
                if (plan?.allowed_models && Array.isArray(plan.allowed_models)) {
                    const parsed: ModelOption[] = plan.allowed_models.map((m: any) => ({
                        id: typeof m === 'string' ? m : m.id,
                        name: typeof m === 'string' ? formatModelName(m) : (m.name || m.id),
                    }));
                    setModels(parsed);
                }
            } catch (e) {
                console.error('Failed to load models:', e);
            }
        };
        loadModels();
    }, [isOpen]);

    const handleSelect = (modelId: string) => {
        onSelectModel(modelId);
        setIsOpen(false);
    };

    const getDisplayName = (modelId: string): string => {
        const found = models.find(m => m.id === modelId);
        if (found) return found.name;
        return formatModelName(modelId);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-bg-input hover:bg-bg-elevated border border-border-subtle rounded-lg transition-colors text-xs font-medium text-text-primary max-w-[150px]"
            >
                <span className="truncate">{getDisplayName(currentModel)}</span>
                <ChevronDown size={14} className={`shrink-0 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-bg-item-surface border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden animated fadeIn">
                    <div className="p-2 max-h-64 overflow-y-auto">
                        {models.length === 0 ? (
                            <div className="text-center py-4 text-text-tertiary">
                                <p className="text-xs">No models available.</p>
                                <p className="text-[10px] mt-1 opacity-70">Check your plan settings.</p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {models.map((model) => {
                                    const isSelected = currentModel === model.id;
                                    return (
                                        <button
                                            key={model.id}
                                            onClick={() => handleSelect(model.id)}
                                            className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors group ${isSelected ? 'bg-accent-primary/10' : 'hover:bg-bg-input'}`}
                                        >
                                            <div className="text-left">
                                                <div className={`text-xs font-medium truncate max-w-[180px] ${isSelected ? 'text-accent-primary' : 'text-text-primary'}`}>
                                                    {model.name}
                                                </div>
                                            </div>
                                            {isSelected && <Check size={14} className="text-accent-primary shrink-0 ml-2" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Convert a model ID string into a human-readable display name.
 * e.g. "gemini-3-flash-preview" -> "Gemini 3 Flash Preview"
 */
function formatModelName(id: string): string {
    return id
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
