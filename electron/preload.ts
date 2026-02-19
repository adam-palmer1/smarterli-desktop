import { contextBridge, ipcRenderer } from "electron"

// Types for the exposed Electron API
interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onScreenshotAttached: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void

  onUnauthorized: (callback: () => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  takeScreenshot: () => Promise<void>
  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>

  analyzeImageFile: (path: string) => Promise<void>
  quitApp: () => Promise<void>

  // Server Connection
  getStoredCredentials: () => Promise<{ serverUrl: string; hasApiKey: boolean; isConnected: boolean }>
  serverSetApiKey: (key: string) => Promise<{ success: boolean; error?: string }>
  serverLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  serverLogout: () => Promise<{ success: boolean }>
  getServerStatus: () => Promise<{ connected: boolean }>

  // Billing
  getBillingBalance: () => Promise<{ balance_minutes: number }>
  getBillingPlan: () => Promise<any>
  getBillingUsage: (days?: number) => Promise<any[]>

  // Native Audio Service Events
  onNativeAudioTranscript: (callback: (transcript: { speaker: string; text: string; final: boolean }) => void) => () => void
  onNativeAudioSuggestion: (callback: (suggestion: { context: string; lastQuestion: string; confidence: number }) => void) => () => void
  onNativeAudioConnected: (callback: () => void) => () => void
  onNativeAudioDisconnected: (callback: () => void) => () => void
  onSuggestionGenerated: (callback: (data: { question: string; suggestion: string; confidence: number }) => void) => () => void
  onSuggestionProcessingStart: (callback: () => void) => () => void
  onSuggestionError: (callback: (error: { error: string }) => void) => () => void
  generateSuggestion: (context: string, lastQuestion: string) => Promise<{ suggestion: string }>
  getInputDevices: () => Promise<Array<{ id: string; name: string }>>
  getOutputDevices: () => Promise<Array<{ id: string; name: string }>>

  // Intelligence Mode IPC
  generateAssist: () => Promise<{ insight: string | null }>
  generateWhatToSay: (question?: string, imagePath?: string) => Promise<{ answer: string | null; question?: string; error?: string }>
  generateFollowUp: (intent: string, userRequest?: string) => Promise<{ refined: string | null; intent: string }>
  generateRecap: () => Promise<{ summary: string | null }>
  submitManualQuestion: (question: string) => Promise<{ answer: string | null; question: string }>
  getIntelligenceContext: () => Promise<{ context: string; lastAssistantMessage: string | null; activeMode: string }>
  resetIntelligence: () => Promise<{ success: boolean; error?: string }>

  // Meeting Lifecycle
  startMeeting: (metadata?: any) => Promise<{ success: boolean; error?: string }>
  endMeeting: () => Promise<{ success: boolean; error?: string }>
  getRecentMeetings: () => Promise<Array<{ id: string; title: string; date: string; duration: string; summary: string }>>
  getMeetingDetails: (id: string) => Promise<any>
  updateMeetingTitle: (id: string, title: string) => Promise<boolean>
  updateMeetingSummary: (id: string, updates: { overview?: string, actionItems?: string[], keyPoints?: string[], actionItemsTitle?: string, keyPointsTitle?: string }) => Promise<boolean>
  onMeetingsUpdated: (callback: () => void) => () => void

  // Intelligence Mode Events
  onIntelligenceAssistUpdate: (callback: (data: { insight: string }) => void) => () => void
  onIntelligenceSuggestedAnswer: (callback: (data: { answer: string; question: string; confidence: number }) => void) => () => void
  onIntelligenceRefinedAnswer: (callback: (data: { answer: string; intent: string }) => void) => () => void
  onIntelligenceRecap: (callback: (data: { summary: string }) => void) => () => void
  onIntelligenceManualStarted: (callback: () => void) => () => void
  onIntelligenceManualResult: (callback: (data: { answer: string; question: string }) => void) => () => void
  onIntelligenceModeChanged: (callback: (data: { mode: string }) => void) => () => void
  onIntelligenceError: (callback: (data: { error: string; mode: string }) => void) => () => void

  showWindow: () => Promise<void>
  hideWindow: () => Promise<void>
  onToggleExpand: (callback: () => void) => () => void
  toggleAdvancedSettings: () => Promise<void>

  // Streaming listeners
  streamGeminiChat: (message: string, imagePath?: string, context?: string, options?: { skipSystemPrompt?: boolean }) => Promise<void>
  onGeminiStreamToken: (callback: (token: string) => void) => () => void
  onGeminiStreamDone: (callback: () => void) => () => void
  onGeminiStreamError: (callback: (error: string) => void) => () => void
  onModelChanged: (callback: (modelId: string) => void) => () => void

  // Theme API
  getThemeMode: () => Promise<{ mode: 'system' | 'light' | 'dark', resolved: 'light' | 'dark' }>
  setThemeMode: (mode: 'system' | 'light' | 'dark') => Promise<void>
  onThemeChanged: (callback: (data: { mode: 'system' | 'light' | 'dark', resolved: 'light' | 'dark' }) => void) => () => void

  // Calendar
  calendarConnect: () => Promise<{ success: boolean; error?: string }>
  calendarDisconnect: () => Promise<{ success: boolean; error?: string }>
  getCalendarStatus: () => Promise<{ connected: boolean; email?: string }>
  getUpcomingEvents: () => Promise<Array<{ id: string; title: string; startTime: string; endTime: string; link?: string; source: 'google' }>>
  calendarRefresh: () => Promise<{ success: boolean; error?: string }>

  // Auto-Update
  onUpdateAvailable: (callback: (info: any) => void) => () => void
  onUpdateDownloaded: (callback: (info: any) => void) => () => void
  onUpdateChecking: (callback: () => void) => () => void
  onUpdateNotAvailable: (callback: (info: any) => void) => () => void
  onUpdateError: (callback: (err: string) => void) => () => void
  onDownloadProgress: (callback: (progressObj: any) => void) => () => void
  restartAndInstall: () => Promise<void>
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>

  // RAG (Retrieval-Augmented Generation) API
  ragQueryMeeting: (meetingId: string, query: string) => Promise<{ success?: boolean; fallback?: boolean; error?: string }>
  ragQueryGlobal: (query: string) => Promise<{ success?: boolean; fallback?: boolean; error?: string }>
  ragCancelQuery: (options: { meetingId?: string; global?: boolean }) => Promise<{ success: boolean }>
  ragIsMeetingProcessed: (meetingId: string) => Promise<boolean>
  ragGetQueueStatus: () => Promise<{ pending: number; processing: number; completed: number; failed: number }>
  ragRetryEmbeddings: () => Promise<{ success: boolean }>
  onRAGStreamChunk: (callback: (data: { meetingId?: string; global?: boolean; chunk: string }) => void) => () => void
  onRAGStreamComplete: (callback: (data: { meetingId?: string; global?: boolean }) => void) => () => void
  onRAGStreamError: (callback: (data: { meetingId?: string; global?: boolean; error: string }) => void) => () => void

  // Transcript Panel
  toggleTranscriptPanel: () => Promise<void>
}

export const PROCESSING_EVENTS = {
  //global states
  UNAUTHORIZED: "procesing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",

  //states for generating the initial solution
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",

  //states for processing the debugging
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error"
} as const

/** Factory for creating IPC event listener bridges (reduces boilerplate) */
function createIpcListener<T = void>(channel: string) {
  return (callback: (data: T) => void) => {
    const subscription = (_: any, data: T) => callback(data);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  };
}

/** Factory for IPC event listeners that take no arguments */
function createIpcSignal(channel: string) {
  return (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  };
}

// Expose the Electron API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),

  // Event listeners
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string }) =>
      callback(data)
    ipcRenderer.on("screenshot-taken", subscription)
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription)
    }
  },
  onScreenshotAttached: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string }) =>
      callback(data)
    ipcRenderer.on("screenshot-attached", subscription)
    return () => {
      ipcRenderer.removeListener("screenshot-attached", subscription)
    }
  },
  onSolutionsReady: (callback: (solutions: string) => void) => {
    const subscription = (_: any, solutions: string) => callback(solutions)
    ipcRenderer.on("solutions-ready", subscription)
    return () => {
      ipcRenderer.removeListener("solutions-ready", subscription)
    }
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("reset-view", subscription)
    return () => {
      ipcRenderer.removeListener("reset-view", subscription)
    }
  },
  onSolutionStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, subscription)
    }
  },
  onDebugStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_START, subscription)
    }
  },

  onDebugSuccess: (callback: (data: any) => void) => {
    ipcRenderer.on("debug-success", (_event, data) => callback(data))
    return () => {
      ipcRenderer.removeListener("debug-success", (_event, data) =>
        callback(data)
      )
    }
  },
  onDebugError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    }
  },
  onSolutionError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        subscription
      )
    }
  },
  onProcessingNoScreenshots: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    }
  },

  onProblemExtracted: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.PROBLEM_EXTRACTED,
        subscription
      )
    }
  },
  onSolutionSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.SOLUTION_SUCCESS,
        subscription
      )
    }
  },
  onUnauthorized: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    }
  },
  moveWindowLeft: () => ipcRenderer.invoke("move-window-left"),
  moveWindowRight: () => ipcRenderer.invoke("move-window-right"),
  moveWindowUp: () => ipcRenderer.invoke("move-window-up"),
  moveWindowDown: () => ipcRenderer.invoke("move-window-down"),

  analyzeImageFile: (path: string) => ipcRenderer.invoke("analyze-image-file", path),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  toggleWindow: () => ipcRenderer.invoke("toggle-window"),
  showWindow: () => ipcRenderer.invoke("show-window"),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  toggleAdvancedSettings: () => ipcRenderer.invoke("toggle-advanced-settings"),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  setOpenAtLogin: (open: boolean) => ipcRenderer.invoke("set-open-at-login", open),
  getOpenAtLogin: () => ipcRenderer.invoke("get-open-at-login"),
  onSettingsVisibilityChange: (callback: (isVisible: boolean) => void) => {
    const subscription = (_: any, isVisible: boolean) => callback(isVisible)
    ipcRenderer.on("settings-visibility-changed", subscription)
    return () => {
      ipcRenderer.removeListener("settings-visibility-changed", subscription)
    }
  },

  onToggleExpand: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("toggle-expand", subscription)
    return () => {
      ipcRenderer.removeListener("toggle-expand", subscription)
    }
  },

  // Server Connection
  getStoredCredentials: () => ipcRenderer.invoke("get-stored-credentials"),
  serverSetApiKey: (key: string) => ipcRenderer.invoke("server-set-api-key", key),
  serverLogin: (email: string, password: string) => ipcRenderer.invoke("server-login", email, password),
  serverLogout: () => ipcRenderer.invoke("server-logout"),
  getServerStatus: () => ipcRenderer.invoke("get-server-status"),

  // Billing
  getBillingBalance: () => ipcRenderer.invoke("get-billing-balance"),
  getBillingPlan: () => ipcRenderer.invoke("get-billing-plan"),
  getBillingUsage: (days?: number) => ipcRenderer.invoke("get-billing-usage", days),

  // Native Audio Service Events
  onNativeAudioTranscript: createIpcListener<{ speaker: string; text: string; final: boolean }>("native-audio-transcript"),
  onNativeAudioSuggestion: createIpcListener<{ context: string; lastQuestion: string; confidence: number }>("native-audio-suggestion"),
  onNativeAudioConnected: createIpcSignal("native-audio-connected"),
  onNativeAudioDisconnected: createIpcSignal("native-audio-disconnected"),
  onSuggestionGenerated: createIpcListener<{ question: string; suggestion: string; confidence: number }>("suggestion-generated"),
  onSuggestionProcessingStart: createIpcSignal("suggestion-processing-start"),
  onSuggestionError: createIpcListener<{ error: string }>("suggestion-error"),
  generateSuggestion: (context: string, lastQuestion: string) =>
    ipcRenderer.invoke("generate-suggestion", context, lastQuestion),

  getNativeAudioStatus: () => ipcRenderer.invoke("native-audio-status"),
  getInputDevices: () => ipcRenderer.invoke("get-input-devices"),
  getOutputDevices: () => ipcRenderer.invoke("get-output-devices"),

  // Intelligence Mode IPC
  generateAssist: () => ipcRenderer.invoke("generate-assist"),
  generateWhatToSay: (question?: string, imagePath?: string) => ipcRenderer.invoke("generate-what-to-say", question, imagePath),
  generateFollowUp: (intent: string, userRequest?: string) => ipcRenderer.invoke("generate-follow-up", intent, userRequest),
  generateFollowUpQuestions: () => ipcRenderer.invoke("generate-follow-up-questions"),
  generateRecap: () => ipcRenderer.invoke("generate-recap"),
  submitManualQuestion: (question: string) => ipcRenderer.invoke("submit-manual-question", question),
  getIntelligenceContext: () => ipcRenderer.invoke("get-intelligence-context"),
  resetIntelligence: () => ipcRenderer.invoke("reset-intelligence"),

  // Meeting Lifecycle
  startMeeting: (metadata?: any) => ipcRenderer.invoke("start-meeting", metadata),
  endMeeting: () => ipcRenderer.invoke("end-meeting"),
  getRecentMeetings: () => ipcRenderer.invoke("get-recent-meetings"),
  getMeetingDetails: (id: string) => ipcRenderer.invoke("get-meeting-details", id),
  updateMeetingTitle: (id: string, title: string) => ipcRenderer.invoke("update-meeting-title", { id, title }),
  updateMeetingSummary: (id: string, updates: any) => ipcRenderer.invoke("update-meeting-summary", { id, updates }),
  deleteMeeting: (id: string) => ipcRenderer.invoke("delete-meeting", id),

  onMeetingsUpdated: createIpcSignal("meetings-updated"),

  // Window Mode
  setWindowMode: (mode: 'launcher' | 'overlay') => ipcRenderer.invoke("set-window-mode", mode),

  // Intelligence Mode Events
  onIntelligenceAssistUpdate: createIpcListener<{ insight: string }>("intelligence-assist-update"),
  onIntelligenceSuggestedAnswerToken: createIpcListener<{ token: string; question: string; confidence: number }>("intelligence-suggested-answer-token"),
  onIntelligenceSuggestedAnswer: createIpcListener<{ answer: string; question: string; confidence: number }>("intelligence-suggested-answer"),
  onIntelligenceRefinedAnswerToken: createIpcListener<{ token: string; intent: string }>("intelligence-refined-answer-token"),
  onIntelligenceRefinedAnswer: createIpcListener<{ answer: string; intent: string }>("intelligence-refined-answer"),
  onIntelligenceRecapToken: createIpcListener<{ token: string }>("intelligence-recap-token"),
  onIntelligenceRecap: createIpcListener<{ summary: string }>("intelligence-recap"),
  onIntelligenceFollowUpQuestionsToken: createIpcListener<{ token: string }>("intelligence-follow-up-questions-token"),
  onIntelligenceFollowUpQuestionsUpdate: createIpcListener<{ questions: string }>("intelligence-follow-up-questions-update"),
  onIntelligenceManualStarted: createIpcSignal("intelligence-manual-started"),
  onIntelligenceManualResult: createIpcListener<{ answer: string; question: string }>("intelligence-manual-result"),
  onIntelligenceModeChanged: createIpcListener<{ mode: string }>("intelligence-mode-changed"),
  onIntelligenceError: createIpcListener<{ error: string; mode: string }>("intelligence-error"),
  onSessionReset: createIpcSignal("session-reset"),


  // Streaming Chat
  streamGeminiChat: (message: string, imagePath?: string, context?: string, options?: { skipSystemPrompt?: boolean }) => ipcRenderer.invoke("gemini-chat-stream", message, imagePath, context, options),

  onGeminiStreamToken: (callback: (token: string) => void) => {
    const subscription = (_: any, token: string) => callback(token)
    ipcRenderer.on("gemini-stream-token", subscription)
    return () => {
      ipcRenderer.removeListener("gemini-stream-token", subscription)
    }
  },

  onGeminiStreamDone: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("gemini-stream-done", subscription)
    return () => {
      ipcRenderer.removeListener("gemini-stream-done", subscription)
    }
  },

  onGeminiStreamError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on("gemini-stream-error", subscription)
    return () => {
      ipcRenderer.removeListener("gemini-stream-error", subscription)
    }
  },

  onModelChanged: createIpcListener<string>("model-changed"),

  // Theme API
  getThemeMode: () => ipcRenderer.invoke('theme:get-mode'),
  setThemeMode: (mode: 'system' | 'light' | 'dark') => ipcRenderer.invoke('theme:set-mode', mode),
  onThemeChanged: (callback: (data: { mode: 'system' | 'light' | 'dark', resolved: 'light' | 'dark' }) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on('theme:changed', subscription)
    return () => {
      ipcRenderer.removeListener('theme:changed', subscription)
    }
  },

  // Calendar API
  calendarConnect: () => ipcRenderer.invoke('calendar-connect'),
  calendarDisconnect: () => ipcRenderer.invoke('calendar-disconnect'),
  getCalendarStatus: () => ipcRenderer.invoke('get-calendar-status'),
  getUpcomingEvents: () => ipcRenderer.invoke('get-upcoming-events'),
  calendarRefresh: () => ipcRenderer.invoke('calendar-refresh'),

  // Auto-Update
  onUpdateAvailable: createIpcListener<any>("update-available"),
  onUpdateDownloaded: createIpcListener<any>("update-downloaded"),
  onUpdateChecking: createIpcSignal("update-checking"),
  onUpdateNotAvailable: createIpcListener<any>("update-not-available"),
  onUpdateError: createIpcListener<string>("update-error"),
  onDownloadProgress: createIpcListener<any>("download-progress"),
  restartAndInstall: () => ipcRenderer.invoke("quit-and-install-update"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),

  // RAG API
  ragQueryMeeting: (meetingId: string, query: string) => ipcRenderer.invoke('rag:query-meeting', { meetingId, query }),
  ragQueryGlobal: (query: string) => ipcRenderer.invoke('rag:query-global', { query }),
  ragCancelQuery: (options: { meetingId?: string; global?: boolean }) => ipcRenderer.invoke('rag:cancel-query', options),
  ragIsMeetingProcessed: (meetingId: string) => ipcRenderer.invoke('rag:is-meeting-processed', meetingId),
  ragGetQueueStatus: () => ipcRenderer.invoke('rag:get-queue-status'),
  ragRetryEmbeddings: () => ipcRenderer.invoke('rag:retry-embeddings'),

  onRAGStreamChunk: createIpcListener<{ meetingId?: string; global?: boolean; chunk: string }>("rag:stream-chunk"),
  onRAGStreamComplete: createIpcListener<{ meetingId?: string; global?: boolean }>("rag:stream-complete"),
  onRAGStreamError: createIpcListener<{ meetingId?: string; global?: boolean; error: string }>("rag:stream-error"),

  // Transcript Panel
  toggleTranscriptPanel: () => ipcRenderer.invoke('toggle-transcript-window'),

  // Panel Management
  getPanelConfigs: () => ipcRenderer.invoke('get-panel-configs'),
  getActivePanelIds: () => ipcRenderer.invoke('get-active-panel-ids'),
  setActivePanels: (panelIds: string[]) => ipcRenderer.invoke('set-active-panels', panelIds),
  togglePanel: (panelId: string, active: boolean) => ipcRenderer.invoke('toggle-panel', panelId, active),
  saveCustomPanel: (config: any) => ipcRenderer.invoke('save-custom-panel', config),
  deleteCustomPanel: (id: string) => ipcRenderer.invoke('delete-custom-panel', id),
  onPanelToken: createIpcListener<{ panelId: string; token: string; isStart?: boolean }>('panel-token'),
  onPanelComplete: createIpcListener<{ panelId: string; content: string }>('panel-complete'),
  onPanelError: createIpcListener<{ panelId: string; error: string }>('panel-error'),

  // Speaker Rename
  renameSpeaker: (original: string, displayName: string) => ipcRenderer.invoke('rename-speaker', { original, displayName }),
  getSpeakerMappings: () => ipcRenderer.invoke('get-speaker-mappings'),
  onSpeakerMappingsUpdated: createIpcListener<Array<{ original: string; displayName: string }>>('speaker-mappings-updated'),

  // Generic invoke passthrough (used by SmarterliInterface for settings, model-selector, etc.)
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
} as ElectronAPI)
