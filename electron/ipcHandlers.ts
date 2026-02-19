// ipcHandlers.ts

import { app, ipcMain, shell, BrowserWindow } from "electron"
import { AppState } from "./main"
import * as path from "path";
import * as fs from "fs";
import { AudioDevices } from "./audio/AudioDevices";

import { ENGLISH_VARIANTS } from "./config/languages"
import { SERVER_URL } from "./config/constants"

export function initializeIpcHandlers(appState: AppState): void {
  const safeHandle = (channel: string, listener: (event: any, ...args: any[]) => Promise<any> | any) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, listener);
  };

  /** Validate URL format */
  const validateUrl = (url: string): string | null => {
    if (!url || typeof url !== 'string') return 'URL is required';
    const trimmed = url.trim();
    if (trimmed.length === 0) return 'URL cannot be empty';
    if (trimmed.length > 2000) return 'URL exceeds maximum length';
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) return 'URL must use http or https protocol';
    } catch {
      return 'Invalid URL format';
    }
    return null; // valid
  };

  // ==========================================
  // Language
  // ==========================================

  safeHandle("get-recognition-languages", async () => {
    return ENGLISH_VARIANTS;
  });

  // No-op: demo seeding is not needed with server backend
  safeHandle("seed-demo", async () => {
    return { success: true };
  });

  // Model selection is now server-side; return a sensible default
  safeHandle("get-default-model", async () => {
    return { model: 'gemini-2.5-flash-preview-05-20', provider: 'server' };
  });

  // Runtime model selection (session-only, not persisted)
  safeHandle("set-model", async (_, modelId: string) => {
    return { success: true, model: modelId };
  });

  safeHandle("get-current-llm-config", async () => {
    return { model: 'gemini-2.5-flash-preview-05-20', provider: 'server' };
  });

  // ==========================================
  // Window Management Handlers
  // ==========================================

  safeHandle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (!width || !height) return

      const senderWebContents = event.sender
      const settingsWin = appState.settingsWindowHelper.getSettingsWindow()
      const overlayWin = appState.getWindowHelper().getOverlayWindow()
      const launcherWin = appState.getWindowHelper().getLauncherWindow()

      const transcriptWin = appState.transcriptWindowHelper.getWindow()

      if (settingsWin && !settingsWin.isDestroyed() && settingsWin.webContents.id === senderWebContents.id) {
        appState.settingsWindowHelper.setWindowDimensions(settingsWin, width, height)
      } else if (transcriptWin && !transcriptWin.isDestroyed() && transcriptWin.webContents.id === senderWebContents.id) {
        appState.transcriptWindowHelper.setWindowDimensions(transcriptWin, width, height)
      } else if (
        overlayWin && !overlayWin.isDestroyed() && overlayWin.webContents.id === senderWebContents.id
      ) {
        appState.getWindowHelper().setOverlayDimensions(width, height)
      }
    }
  )

  safeHandle("set-window-mode", async (event, mode: 'launcher' | 'overlay') => {
    appState.getWindowHelper().setWindowMode(mode);
    return { success: true };
  })

  safeHandle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  safeHandle("show-window", async () => {
    appState.showMainWindow()
  })

  safeHandle("hide-window", async () => {
    appState.hideMainWindow()
  })

  // Window movement handlers
  safeHandle("move-window-left", async () => {
    appState.moveWindowLeft()
  })

  safeHandle("move-window-right", async () => {
    appState.moveWindowRight()
  })

  safeHandle("move-window-up", async () => {
    appState.moveWindowUp()
  })

  safeHandle("move-window-down", async () => {
    appState.moveWindowDown()
  })

  safeHandle("center-and-show-window", async () => {
    appState.centerAndShowWindow()
  })

  // Settings Window
  safeHandle("toggle-settings-window", (event, { x, y } = {}) => {
    appState.settingsWindowHelper.toggleWindow(x, y)
  })

  safeHandle("close-settings-window", () => {
    appState.settingsWindowHelper.closeWindow()
  })

  // Model Selector Window
  safeHandle("toggle-model-selector", (event, { x, y } = {}) => {
    appState.modelSelectorWindowHelper.toggleWindow(x, y)
  })

  // Transcript Window
  safeHandle("toggle-transcript-window", (event, { x, y } = {}) => {
    appState.transcriptWindowHelper.toggle(x, y)
  })

  // ==========================================
  // Screenshot Handlers
  // ==========================================

  safeHandle("delete-screenshot", async (event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string' || filePath.includes('..')) {
      return { success: false, error: 'Invalid file path' };
    }
    return appState.deleteScreenshot(filePath)
  })

  safeHandle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      throw error
    }
  })

  safeHandle("get-screenshots", async () => {
    try {
      let previews = []
      if (appState.getView() === "queue") {
        previews = await Promise.all(
          appState.getScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      } else {
        previews = await Promise.all(
          appState.getExtraScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      }
      return previews
    } catch (error) {
      throw error
    }
  })

  safeHandle("reset-queues", async () => {
    try {
      appState.clearQueues()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==========================================
  // App Lifecycle
  // ==========================================

  safeHandle("quit-app", () => {
    app.quit()
  })

  safeHandle("quit-and-install-update", () => {
    console.log('[IPC] quit-and-install-update handler called')
    appState.quitAndInstallUpdate()
  })

  safeHandle("check-for-updates", async () => {
    await appState.checkForUpdates()
  })

  safeHandle("download-update", async () => {
    appState.downloadUpdate()
  })

  safeHandle("set-open-at-login", async (_, openAtLogin: boolean) => {
    app.setLoginItemSettings({
      openAtLogin,
      openAsHidden: false,
      path: app.getPath('exe')
    });
    return { success: true };
  });

  safeHandle("get-open-at-login", async () => {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  });

  safeHandle("open-external", async (event, url: string) => {
    try {
      const parsed = new URL(url);
      if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        await shell.openExternal(url);
      } else {
        console.warn(`[IPC] Blocked potentially unsafe open-external: ${url}`);
      }
    } catch {
      console.warn(`[IPC] Invalid URL in open-external: ${url}`);
    }
  });

  // ==========================================
  // Native Audio Service Handlers
  // ==========================================

  safeHandle("native-audio-status", async () => {
    return { connected: true };
  });

  safeHandle("get-input-devices", async () => {
    return AudioDevices.getInputDevices();
  });

  safeHandle("get-output-devices", async () => {
    return AudioDevices.getOutputDevices();
  });

  safeHandle("start-audio-test", async (event, deviceId?: string) => {
    appState.startAudioTest(deviceId);
    return { success: true };
  });

  safeHandle("stop-audio-test", async () => {
    appState.stopAudioTest();
    return { success: true };
  });

  safeHandle("set-recognition-language", async (_, key: string) => {
    appState.setRecognitionLanguage(key);
    return { success: true };
  });

  // ==========================================
  // Meeting Lifecycle Handlers
  // ==========================================

  safeHandle("start-meeting", async (event, metadata?: any) => {
    try {
      await appState.startMeeting(metadata);
      return { success: true };
    } catch (error: any) {
      console.error("Error starting meeting:", error);
      return { success: false, error: error.message };
    }
  });

  safeHandle("end-meeting", async () => {
    try {
      await appState.endMeeting();
      return { success: true };
    } catch (error: any) {
      console.error("Error ending meeting:", error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // Meetings - proxy through ServerClient
  // ==========================================

  safeHandle("get-recent-meetings", async () => {
    const client = appState.getServerClient();
    if (!client) return [];
    return client.getMeetings(50);
  });

  safeHandle("get-meeting-details", async (_, id: string) => {
    const client = appState.getServerClient();
    if (!client) return null;
    return client.getMeeting(id);
  });

  safeHandle("update-meeting-title", async (_, { id, title }: { id: string; title: string }) => {
    const client = appState.getServerClient();
    if (!client) return false;
    return client.updateMeetingTitle(id, title);
  });

  safeHandle("update-meeting-summary", async (_, { id, updates }: { id: string; updates: any }) => {
    const client = appState.getServerClient();
    if (!client) return false;
    return client.updateMeetingSummary(id, updates);
  });

  safeHandle("delete-meeting", async (_, id: string) => {
    const client = appState.getServerClient();
    if (!client) return false;
    return client.deleteMeeting(id);
  });

  // ==========================================
  // Stored Credentials
  // ==========================================

  safeHandle("get-stored-credentials", async () => {
    const { CredentialsManager } = require('./services/CredentialsManager');
    const cm = CredentialsManager.getInstance();
    return {
      serverUrl: SERVER_URL,
      hasApiKey: !!cm.getApiKey(),
      isConnected: !!appState.getServerClient(),
    };
  });

  // ==========================================
  // Server Connection Handlers
  // ==========================================

  safeHandle("server-set-url", async () => {
    // No-op: server URL is hardcoded
    return { success: true };
  });

  safeHandle("server-set-api-key", async (_, key: string) => {
    const { CredentialsManager } = require('./services/CredentialsManager');
    const cm = CredentialsManager.getInstance();
    cm.setApiKey(key.trim());
    const client = appState.getServerClient();
    if (client) client.setApiKey(key.trim());
    return { success: true };
  });

  safeHandle("server-login", async (_, email: string, password: string) => {
    const client = appState.getServerClient();
    if (!client) return { success: false, error: 'Server not configured' };
    try {
      const tokens = await client.login(email, password);
      const { CredentialsManager } = require('./services/CredentialsManager');
      const cm = CredentialsManager.getInstance();
      cm.setAccessToken(tokens.access_token);
      cm.setRefreshToken(tokens.refresh_token);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  safeHandle("server-logout", async () => {
    const { CredentialsManager } = require('./services/CredentialsManager');
    const cm = CredentialsManager.getInstance();
    cm.setAccessToken('');
    cm.setRefreshToken('');
    cm.setApiKey('');
    return { success: true };
  });

  safeHandle("get-server-status", async () => {
    const client = appState.getServerClient();
    if (!client) return { connected: false };
    try {
      await client.healthCheck();
      return { connected: true };
    } catch {
      return { connected: false };
    }
  });

  // ==========================================
  // Billing Handlers
  // ==========================================

  safeHandle("get-billing-balance", async () => {
    const client = appState.getServerClient();
    if (!client) return { balance_minutes: 0 };
    try {
      return await client.getBalance();
    } catch {
      return { balance_minutes: 0 };
    }
  });

  safeHandle("get-billing-plan", async () => {
    const client = appState.getServerClient();
    if (!client) return null;
    return client.getPlan();
  });

  safeHandle("get-billing-usage", async (_, days?: number) => {
    const client = appState.getServerClient();
    if (!client) return [];
    return client.getUsage(days || 30);
  });

  // ==========================================
  // Intelligence Mode Handlers - proxy through IntelligenceClient
  // ==========================================

  safeHandle("generate-assist", async () => {
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) return { insight: null };
    try {
      const result = await client.streamAssist(sessionId);
      return { insight: result };
    } catch (e: any) {
      return { insight: null };
    }
  });

  safeHandle("generate-what-to-say", async (_, question?: string, imagePath?: string) => {
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) return { answer: null, question: question || 'unknown' };
    try {
      const result = await client.streamWhatToSay(sessionId, question, imagePath);
      return { answer: result, question: question || 'inferred from context' };
    } catch (e: any) {
      return { answer: null, question: question || 'unknown' };
    }
  });

  safeHandle("generate-follow-up", async (_, intent: string, userRequest?: string) => {
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) return { refined: null, intent };
    try {
      const result = await client.streamFollowUp(sessionId, intent, userRequest);
      return { refined: result, intent };
    } catch (e: any) {
      return { refined: null, intent };
    }
  });

  safeHandle("generate-recap", async () => {
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) return { summary: null };
    try {
      const result = await client.streamRecap(sessionId);
      return { summary: result };
    } catch (e: any) {
      return { summary: null };
    }
  });

  safeHandle("generate-follow-up-questions", async () => {
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) return { questions: null };
    try {
      const result = await client.streamFollowUpQuestions(sessionId);
      return { questions: result };
    } catch (e: any) {
      return { questions: null };
    }
  });

  safeHandle("submit-manual-question", async (_, question: string) => {
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) return { answer: null, question };
    try {
      const result = await client.streamChat(sessionId, question);
      return { answer: result, question };
    } catch (e: any) {
      return { answer: null, question };
    }
  });

  // Get current intelligence context (state is managed server-side)
  safeHandle("get-intelligence-context", async () => {
    return {
      context: '',
      lastAssistantMessage: null,
      activeMode: null
    };
  });

  // Reset intelligence state (state is managed server-side)
  safeHandle("reset-intelligence", async () => {
    const client = appState.getIntelligenceClient();
    if (client) {
      client.cancel();
    }
    return { success: true };
  });

  // ==========================================
  // Chat Handlers - proxy through IntelligenceClient
  // ==========================================

  safeHandle("gemini-chat", async (event, message: string, imagePath?: string, context?: string, options?: { skipSystemPrompt?: boolean }) => {
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) {
      return "I apologize, but I couldn't generate a response. Not connected to server.";
    }
    try {
      const result = await client.streamChat(sessionId, message, imagePath);
      if (!result || result.trim().length === 0) {
        return "I apologize, but I couldn't generate a response. Please try again.";
      }
      return result;
    } catch (error: any) {
      throw error;
    }
  });

  safeHandle("gemini-chat-stream", async (event, message: string, imagePath?: string, context?: string, options?: { skipSystemPrompt?: boolean }) => {
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) {
      event.sender.send("gemini-stream-error", "Not connected to server");
      return null;
    }
    try {
      const result = await client.streamChat(sessionId, message, imagePath);
      event.sender.send("gemini-stream-done");
      return null;
    } catch (e: any) {
      event.sender.send("gemini-stream-error", e.message);
      return null;
    }
  });

  // Generate suggestion from transcript
  safeHandle("generate-suggestion", async (event, context: string, lastQuestion: string) => {
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) return { suggestion: null };
    try {
      const suggestion = await client.streamChat(sessionId, lastQuestion);
      return { suggestion };
    } catch (error: any) {
      throw error;
    }
  });

  // IPC handler for analyzing image from file path
  safeHandle("analyze-image-file", async (event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string' || filePath.includes('..')) {
      throw new Error('Invalid file path');
    }
    const client = appState.getIntelligenceClient();
    const sessionId = appState.getCurrentSessionId();
    if (!client || !sessionId) {
      throw new Error('Not connected to server');
    }
    try {
      const result = await client.streamChat(sessionId, "Analyze this image", filePath);
      return result;
    } catch (error: any) {
      throw error;
    }
  });

  // ==========================================
  // Theme System Handlers
  // ==========================================

  safeHandle("theme:get-mode", () => {
    const tm = appState.getThemeManager();
    return {
      mode: tm.getMode(),
      resolved: tm.getResolvedTheme()
    };
  });

  safeHandle("theme:set-mode", (_, mode: 'system' | 'light' | 'dark') => {
    appState.getThemeManager().setMode(mode);
    return { success: true };
  });

  // ==========================================
  // Calendar Integration Handlers
  // ==========================================

  safeHandle("calendar-connect", async () => {
    try {
      const { CalendarManager } = require('./services/CalendarManager');
      await CalendarManager.getInstance().startAuthFlow();
      return { success: true };
    } catch (error: any) {
      console.error("Calendar auth error:", error);
      return { success: false, error: error.message };
    }
  });

  safeHandle("calendar-disconnect", async () => {
    const { CalendarManager } = require('./services/CalendarManager');
    await CalendarManager.getInstance().disconnect();
    return { success: true };
  });

  safeHandle("get-calendar-status", async () => {
    const { CalendarManager } = require('./services/CalendarManager');
    return CalendarManager.getInstance().getConnectionStatus();
  });

  safeHandle("get-upcoming-events", async () => {
    const { CalendarManager } = require('./services/CalendarManager');
    return CalendarManager.getInstance().getUpcomingEvents();
  });

  safeHandle("calendar-refresh", async () => {
    const { CalendarManager } = require('./services/CalendarManager');
    await CalendarManager.getInstance().refreshState();
    return { success: true };
  });

  // ==========================================
  // RAG (Retrieval-Augmented Generation) Handlers - proxy through server SSE
  // ==========================================

  safeHandle("rag:query-meeting", async (event, { meetingId, query }: { meetingId: string; query: string }) => {
    const cm = require('./services/CredentialsManager').CredentialsManager.getInstance();
    const apiKey = cm.getApiKey();
    if (!apiKey) return { fallback: true };

    try {
      const response = await fetch(`${SERVER_URL}/rag/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId, query }),
      });
      if (!response.ok) return { fallback: true };

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const block of lines) {
          if (block.startsWith('event: token')) {
            const data = block.split('\ndata: ')[1];
            if (data) event.sender.send("rag:stream-chunk", { meetingId, chunk: data.replace(/\\n/g, '\n') });
          } else if (block.startsWith('event: done')) {
            event.sender.send("rag:stream-complete", { meetingId });
          }
        }
      }
      return { success: true };
    } catch (e: any) {
      event.sender.send("rag:stream-error", { meetingId, error: e.message });
      return { success: false, error: e.message };
    }
  });

  safeHandle("rag:query-global", async (event, { query }: { query: string }) => {
    const cm = require('./services/CredentialsManager').CredentialsManager.getInstance();
    const apiKey = cm.getApiKey();
    if (!apiKey) return { fallback: true };

    try {
      const response = await fetch(`${SERVER_URL}/rag/query-global`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) return { fallback: true };

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const block of lines) {
          if (block.startsWith('event: token')) {
            const data = block.split('\ndata: ')[1];
            if (data) event.sender.send("rag:stream-chunk", { global: true, chunk: data.replace(/\\n/g, '\n') });
          } else if (block.startsWith('event: done')) {
            event.sender.send("rag:stream-complete", { global: true });
          }
        }
      }
      return { success: true };
    } catch (e: any) {
      event.sender.send("rag:stream-error", { global: true, error: e.message });
      return { success: false, error: e.message };
    }
  });

  safeHandle("rag:cancel-query", async (_, { meetingId, global }: { meetingId?: string; global?: boolean }) => {
    // Server-side cancellation is handled by closing the SSE connection
    // Client-side abort is managed by the renderer
    return { success: true };
  });

  safeHandle("rag:is-meeting-processed", async (_, meetingId: string) => {
    const client = appState.getServerClient();
    if (!client) return false;
    try {
      const meeting = await client.getMeeting(meetingId);
      return meeting?.is_processed || false;
    } catch {
      return false;
    }
  });

  safeHandle("rag:get-queue-status", async () => {
    // RAG queue status is managed server-side
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  });

  safeHandle("rag:retry-embeddings", async () => {
    // RAG embedding retry is managed server-side
    return { success: true };
  });

  // ==========================================
  // Panel Management Handlers
  // ==========================================

  safeHandle("get-panel-configs", async () => {
    try {
      const { CredentialsManager } = require('./services/CredentialsManager');
      const cm = CredentialsManager.getInstance();
      return cm.getCustomPanels();
    } catch (error: any) {
      console.error("Error getting panel configs:", error);
      return [];
    }
  });

  safeHandle("get-active-panel-ids", async () => {
    try {
      const { CredentialsManager } = require('./services/CredentialsManager');
      return CredentialsManager.getInstance().getActivePanelIds();
    } catch (error: any) {
      return [];
    }
  });

  safeHandle("set-active-panels", async (_, panelIds: string[]) => {
    try {
      const { CredentialsManager } = require('./services/CredentialsManager');
      CredentialsManager.getInstance().setActivePanelIds(panelIds);
      // Notify panel client if connected
      const panelClient = appState.getPanelClient();
      if (panelClient) {
        panelClient.configurePanels(panelIds);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  safeHandle("toggle-panel", async (_, panelId: string, active: boolean) => {
    try {
      const { CredentialsManager } = require('./services/CredentialsManager');
      const cm = CredentialsManager.getInstance();
      const current = new Set<string>(cm.getActivePanelIds());
      if (active) {
        current.add(panelId);
      } else {
        current.delete(panelId);
      }
      const ids = Array.from(current);
      cm.setActivePanelIds(ids);
      const panelClient = appState.getPanelClient();
      if (panelClient) {
        panelClient.configurePanels(ids);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  safeHandle("save-custom-panel", async (_, config: any) => {
    try {
      const { CredentialsManager } = require('./services/CredentialsManager');
      CredentialsManager.getInstance().saveCustomPanel(config);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  safeHandle("delete-custom-panel", async (_, id: string) => {
    try {
      const { CredentialsManager } = require('./services/CredentialsManager');
      CredentialsManager.getInstance().deleteCustomPanel(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // Speaker Rename Handlers
  // ==========================================

  // Speaker rename is managed server-side; local stubs for compatibility
  safeHandle("rename-speaker", async (_, { original, displayName }: { original: string; displayName: string }) => {
    // Speaker mapping is handled server-side now
    return { success: true };
  });

  safeHandle("get-speaker-mappings", async () => {
    return [];
  });
}
