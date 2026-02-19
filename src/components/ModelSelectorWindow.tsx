import React, { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface ModelOption {
    id: string;
    name: string;
}

const ModelSelectorWindow = () => {
    const [currentModel, setCurrentModel] = useState<string>('');
    const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Load models from billing plan
    useEffect(() => {
        const loadModels = async () => {
            setIsLoading(true);
            try {
                const plan = await window.electronAPI.getBillingPlan();

                const models: ModelOption[] = [];
                if (plan?.allowed_models && Array.isArray(plan.allowed_models)) {
                    plan.allowed_models.forEach((m: any) => {
                        models.push({
                            id: typeof m === 'string' ? m : m.id,
                            name: typeof m === 'string' ? formatModelName(m) : (m.name || m.id),
                        });
                    });
                }

                setAvailableModels(models);

                // Get current active model
                const config = await window.electronAPI.invoke('get-current-llm-config');
                if (config?.model) {
                    setCurrentModel(config.model);
                }
            } catch (err) {
                console.error('Failed to load models:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadModels();

        // Listen for external model changes
        const unsubscribe = window.electronAPI?.onModelChanged?.((modelId: string) => {
            setCurrentModel(modelId);
        });
        return () => unsubscribe?.();
    }, []);

    const handleSelect = (modelId: string) => {
        setCurrentModel(modelId);
        window.electronAPI?.invoke('set-model', modelId)
            .catch((err: any) => console.error('Failed to set model:', err));
    };

    return (
        <div className="w-fit h-fit bg-transparent flex flex-col">
            <div className="w-[160px] h-[220px] glass-panel-heavy p-2 flex flex-col animate-scale-in origin-top-left">

                {isLoading ? (
                    <div className="flex items-center justify-center py-4 text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-xs">Loading...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-0.5">
                        {availableModels.length === 0 ? (
                            <div className="px-4 py-3 text-center text-xs text-slate-500">
                                No models available.<br />Check your plan.
                            </div>
                        ) : (
                            availableModels.map((model) => {
                                const isSelected = currentModel === model.id;
                                return (
                                    <button
                                        key={model.id}
                                        onClick={() => handleSelect(model.id)}
                                        className={`
                                            w-full text-left px-3 py-2 flex items-center justify-between group transition-colors duration-200 rounded-lg
                                            ${isSelected ? 'bg-accent-primary/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
                                        `}
                                    >
                                        <span className="text-[12px] font-medium truncate flex-1 min-w-0">{model.name}</span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0 ml-2" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}

            </div>
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

export default ModelSelectorWindow;
