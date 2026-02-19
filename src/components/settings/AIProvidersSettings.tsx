import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader2, ExternalLink, Eye, EyeOff } from 'lucide-react';

export const AIProvidersSettings: React.FC = () => {
    // Server connection
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(false);

    // Status indicators
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
    const [testError, setTestError] = useState('');

    const [savingKey, setSavingKey] = useState(false);
    const [savedKey, setSavedKey] = useState(false);

    // Billing
    const [balance, setBalance] = useState<number | null>(null);
    const [planName, setPlanName] = useState<string | null>(null);

    // Load stored credentials and billing info
    useEffect(() => {
        const loadData = async () => {
            try {
                const creds = await window.electronAPI.getStoredCredentials();
                if (creds) {
                    setHasApiKey(creds.hasApiKey);
                    setIsConnected(creds.isConnected);
                }
            } catch (e) {
                console.error('Failed to load credentials:', e);
            }

            try {
                const b = await window.electronAPI.getBillingBalance();
                if (b) setBalance(b.balance_minutes);
            } catch (e) {
                console.warn('Failed to load balance:', e);
            }

            try {
                const p = await window.electronAPI.getBillingPlan();
                if (p) setPlanName(p.name || null);
            } catch (e) {
                console.warn('Failed to load plan:', e);
            }
        };
        loadData();
    }, []);

    const handleSaveApiKey = async () => {
        if (!apiKey.trim()) return;
        setSavingKey(true);
        try {
            const result = await window.electronAPI.serverSetApiKey(apiKey.trim());
            if (result?.success) {
                setSavedKey(true);
                setHasApiKey(true);
                setApiKey('');
                setTimeout(() => setSavedKey(false), 2000);
            }
        } catch (e) {
            console.error('Failed to save API key:', e);
        } finally {
            setSavingKey(false);
        }
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult('idle');
        setTestError('');
        try {
            const status = await window.electronAPI.getServerStatus();
            if (status?.connected) {
                setTestResult('success');
                setIsConnected(true);
                // Refresh billing info on successful connection
                try {
                    const b = await window.electronAPI.getBillingBalance();
                    if (b) setBalance(b.balance_minutes);
                    const p = await window.electronAPI.getBillingPlan();
                    if (p) setPlanName(p.name || null);
                } catch (_) { /* ignore billing errors */ }
            } else {
                setTestResult('error');
                setTestError('Server is not reachable');
                setIsConnected(false);
            }
            setTimeout(() => setTestResult('idle'), 5000);
        } catch (e: any) {
            setTestResult('error');
            setTestError(e.message || 'Connection failed');
            setIsConnected(false);
        } finally {
            setIsTesting(false);
        }
    };

    const maskedApiKeyDisplay = hasApiKey ? '••••••••••••' : '';

    return (
        <div className="space-y-5 animated fadeIn pb-10">
            {/* Server Connection */}
            <div className="space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Server Connection</h3>
                    <p className="text-xs text-text-secondary mb-2">Connect to your Smarter.li server for AI processing and speech-to-text.</p>
                </div>

                {/* Connection Status */}
                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]'}`} />
                        <div>
                            <label className="block text-xs font-medium text-text-primary uppercase tracking-wide">Status</label>
                            <p className="text-[10px] text-text-secondary">{isConnected ? 'Connected to server' : 'Not connected'}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-border-subtle flex items-center gap-2 ${
                            testResult === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            testResult === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            'bg-bg-input hover:bg-bg-elevated text-text-primary'
                        }`}
                    >
                        {isTesting ? <><Loader2 size={12} className="animate-spin" /> Testing...</> :
                            testResult === 'success' ? <><CheckCircle size={12} /> Connected</> :
                            testResult === 'error' ? <><AlertCircle size={12} /> Failed</> :
                            'Test Connection'}
                    </button>
                </div>
                {testError && <p className="text-[10px] text-red-400 -mt-3 ml-1">{testError}</p>}

                {/* API Key */}
                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle">
                    <div className="mb-2">
                        <label className="block text-xs font-medium text-text-primary uppercase tracking-wide">
                            API Key
                            {hasApiKey && <span className="ml-2 text-green-500 normal-case">&#10003; Saved</span>}
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={hasApiKey ? maskedApiKeyDisplay : 'sk-...'}
                                className="w-full bg-bg-input border border-border-subtle rounded-lg px-4 py-2.5 pr-10 text-xs text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                            />
                            <button
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                                type="button"
                            >
                                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        <button
                            onClick={handleSaveApiKey}
                            disabled={savingKey || !apiKey.trim()}
                            className={`px-5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                                savedKey
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-bg-input hover:bg-bg-secondary border border-border-subtle text-text-primary disabled:opacity-50'
                            }`}
                        >
                            {savingKey ? 'Saving...' : savedKey ? 'Saved!' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Plan & Credits */}
            <div className="space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-text-primary mb-1">Plan & Credits</h3>
                    <p className="text-xs text-text-secondary mb-2">Your current subscription and remaining usage.</p>
                </div>

                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-0.5">Current Plan</label>
                            <p className="text-sm font-bold text-accent-primary">{planName || (isConnected ? 'Loading...' : 'Not connected')}</p>
                        </div>
                        <div className="text-right">
                            <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-0.5">Credits Remaining</label>
                            <p className="text-sm font-bold text-text-primary">
                                {balance !== null ? `${Math.floor(balance)} min` : (isConnected ? '...' : '--')}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => window.electronAPI?.openExternal('https://app.smarter.li/billing')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 transition-colors border border-accent-primary/20"
                    >
                        <ExternalLink size={14} />
                        Manage Plan
                    </button>
                </div>
            </div>
        </div>
    );
};
