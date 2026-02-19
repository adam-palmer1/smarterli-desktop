import React, { useState } from 'react';
import { Key, Mail, Lock, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import appIcon from './icon.png';

interface LoginScreenProps {
  onConnected: () => void;
}

const SIGNUP_URL = 'https://app.smarter.li/signup';

const LoginScreen: React.FC<LoginScreenProps> = ({ onConnected }) => {
  const [mode, setMode] = useState<'api-key' | 'email'>('api-key');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleApiKeyConnect = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await window.electronAPI.serverSetApiKey(apiKey);
      const status = await window.electronAPI.getServerStatus();
      if (status.connected) {
        onConnected();
      } else {
        setError('Could not connect to server. Check your API key and try again.');
      }
    } catch (e: any) {
      setError(e.message || 'Connection failed');
    }
    setIsLoading(false);
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.serverLogin(email, password);
      if (result.success) {
        onConnected();
      } else {
        setError(result.error || 'Login failed. Check your credentials.');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    }
    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'api-key') {
      handleApiKeyConnect();
    } else {
      handleEmailLogin();
    }
  };

  const handleCreateAccount = () => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(SIGNUP_URL);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-bg-primary flex items-center justify-center overflow-hidden select-none">
      {/* Volumetric background glow */}
      <motion.div
        className="absolute w-[500px] h-[500px] bg-orange-500/8 rounded-full blur-[150px]"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: 'easeOut' }}
      />

      {/* Secondary glow */}
      <motion.div
        className="absolute w-64 h-64 bg-orange-500/5 rounded-full blur-[100px] translate-y-32"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.5, delay: 0.3 }}
      />

      {/* Glass card */}
      <motion.div
        className="relative z-10 w-full max-w-[380px] mx-4"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.1 }}
      >
        <div className="glass-panel p-8 bg-gradient-to-b from-white/[0.04] to-transparent">
          {/* Inner top highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-t-2xl" />

          {/* Logo */}
          <motion.div
            className="flex justify-center mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              <img
                src={appIcon}
                alt="Smarter.li"
                className="w-14 h-14 object-contain drop-shadow-[0_0_15px_rgba(232,117,10,0.2)]"
              />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            className="text-center mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-xl font-semibold text-text-primary tracking-tight mb-1">
              Connect to Smarter.li
            </h1>
            <p className="text-xs text-text-tertiary">
              {mode === 'api-key'
                ? 'Enter your API key to get started'
                : 'Sign in with your account'}
            </p>
          </motion.div>

          {/* Error message */}
          {error && (
            <motion.div
              className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <span className="text-xs text-red-400 leading-relaxed">{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'api-key' ? (
              /* API Key input */
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                  <Key size={14} />
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="API Key (ck_...)"
                  className="w-full bg-bg-input border border-border-subtle rounded-lg pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20 transition-all font-mono"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            ) : (
              /* Email / Password inputs */
              <>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                    <Mail size={14} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full bg-bg-input border border-border-subtle rounded-lg pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20 transition-all"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                    <Lock size={14} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-bg-input border border-border-subtle rounded-lg pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20 transition-all"
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                w-full relative overflow-hidden
                bg-gradient-to-b from-[#F59E0B] via-[#E8750A] to-[#D96C08]
                text-white
                py-2.5 rounded-lg
                text-sm font-medium tracking-normal
                shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(232,117,10,0.3)]
                hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_4px_16px_rgba(232,117,10,0.4)]
                hover:brightness-110
                active:scale-[0.98]
                transition-all duration-300 ease-out
                disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100
                flex items-center justify-center gap-2
              "
            >
              {/* Top highlight */}
              <div className="absolute inset-x-2 top-0 h-[40%] bg-gradient-to-b from-white/25 to-transparent blur-[1px] rounded-b-lg pointer-events-none" />

              {isLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>{mode === 'api-key' ? 'Connect' : 'Sign In'}</span>
              )}
            </button>
          </form>

          {/* Mode toggle links */}
          <div className="mt-5 flex flex-col items-center gap-2">
            {mode === 'api-key' ? (
              <button
                onClick={() => { setMode('email'); setError(null); }}
                className="text-xs text-text-tertiary hover:text-accent-primary transition-colors duration-200"
                disabled={isLoading}
              >
                Or sign in with email
              </button>
            ) : (
              <>
                <button
                  onClick={handleCreateAccount}
                  className="text-xs text-text-tertiary hover:text-accent-primary transition-colors duration-200 flex items-center gap-1"
                  disabled={isLoading}
                >
                  Create account
                  <ExternalLink size={10} />
                </button>
                <button
                  onClick={() => { setMode('api-key'); setError(null); }}
                  className="text-xs text-text-tertiary hover:text-text-secondary transition-colors duration-200"
                  disabled={isLoading}
                >
                  Use API key instead
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
