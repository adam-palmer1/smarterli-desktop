export interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  onToggleExpand: (callback: () => void) => () => void
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (callback: (data: { path: string; preview: string }) => void) => () => void
  onScreenshotAttached: (callback: (data: { path: string; preview: string }) => void) => () => void
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

  quitApp: () => Promise<void>
  toggleWindow: () => Promise<void>
  showWindow: () => Promise<void>
  hideWindow: () => Promise<void>
  openExternal: (url: string) => Promise<void>
  setOpenAtLogin: (open: boolean) => Promise<{ success: boolean; error?: string }>
  getOpenAtLogin: () => Promise<boolean>
  onSettingsVisibilityChange: (callback: (isVisible: boolean) => void) => () => void
  toggleSettingsWindow: (coords?: { x: number; y: number }) => Promise<void>
  closeSettingsWindow: () => Promise<void>
  toggleAdvancedSettings: () => Promise<void>
  closeAdvancedSettings: () => Promise<void>

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
  onNativeAudioTranscript: (callback: (transcript: { speaker: string; text: string; final: boolean; person_id?: string; person_name?: string }) => void) => () => void
  onNativeAudioSuggestion: (callback: (suggestion: { context: string; lastQuestion: string; confidence: number }) => void) => () => void
  onNativeAudioConnected: (callback: () => void) => () => void
  onNativeAudioDisconnected: (callback: () => void) => () => void
  onSuggestionGenerated: (callback: (data: { question: string; suggestion: string; confidence: number }) => void) => () => void
  onSuggestionProcessingStart: (callback: () => void) => () => void
  onSuggestionError: (callback: (error: { error: string }) => void) => () => void
  generateSuggestion: (context: string, lastQuestion: string) => Promise<{ suggestion: string }>
  getInputDevices: () => Promise<Array<{ id: string; name: string }>>
  getOutputDevices: () => Promise<Array<{ id: string; name: string }>>
  startAudioTest: (inputDeviceId?: string, outputDeviceId?: string) => Promise<{ success: boolean }>
  stopAudioTest: () => Promise<{ success: boolean }>
  onAudioLevel: (callback: (data: { channel: string; level: number }) => void) => () => void

  getNativeAudioStatus: () => Promise<{ connected: boolean }>

  // Intelligence Mode IPC
  generateAssist: () => Promise<{ insight: string | null }>
  generateWhatToSay: (imagePath?: string, model?: string) => Promise<{ answer: string | null; error?: string }>
  generateFollowUp: (intent: string, userRequest?: string) => Promise<{ refined: string | null; intent: string }>
  generateFollowUpQuestions: () => Promise<{ questions: string | null }>
  generateRecap: () => Promise<{ summary: string | null }>
  submitManualQuestion: (question: string) => Promise<{ answer: string | null; question: string }>
  getIntelligenceContext: () => Promise<{ context: string; lastAssistantMessage: string | null; activeMode: string }>
  resetIntelligence: () => Promise<{ success: boolean; error?: string }>

  // Meeting Lifecycle
  startMeeting: (metadata?: any) => Promise<{ success: boolean; error?: string }>
  endMeeting: () => Promise<{ success: boolean; error?: string }>
  pauseMeeting: () => Promise<{ success: boolean; error?: string }>
  resumeMeeting: () => Promise<{ success: boolean; error?: string }>
  reconfigureAudioMidMeeting: (config?: { inputDeviceId?: string; outputDeviceId?: string }) => Promise<{ success: boolean; error?: string }>
  setInputStreaming: (enabled: boolean) => Promise<{ success: boolean }>
  setOutputStreaming: (enabled: boolean) => Promise<{ success: boolean }>
  onMeetingPaused: (callback: () => void) => () => void
  onMeetingResumed: (callback: () => void) => () => void
  getRecentMeetings: () => Promise<Array<{ id: string; title: string; date: string; duration: string; summary: string }>>
  getMeetingDetails: (id: string) => Promise<any>
  updateMeetingTitle: (id: string, title: string) => Promise<boolean>
  updateMeetingSummary: (id: string, updates: { overview?: string, actionItems?: string[], keyPoints?: string[], actionItemsTitle?: string, keyPointsTitle?: string }) => Promise<boolean>
  deleteMeeting: (id: string) => Promise<boolean>
  setWindowMode: (mode: 'launcher' | 'overlay') => Promise<void>

  // Intelligence Mode Events
  onIntelligenceAssistUpdate: (callback: (data: { insight: string }) => void) => () => void
  onIntelligenceSuggestedAnswerToken: (callback: (data: { token: string; question: string; confidence: number }) => void) => () => void
  onIntelligenceSuggestedAnswer: (callback: (data: { answer: string; question: string; confidence: number }) => void) => () => void
  onIntelligenceRefinedAnswerToken: (callback: (data: { token: string; intent: string }) => void) => () => void
  onIntelligenceRefinedAnswer: (callback: (data: { answer: string; intent: string }) => void) => () => void
  onIntelligenceFollowUpQuestionsUpdate: (callback: (data: { questions: string }) => void) => () => void
  onIntelligenceFollowUpQuestionsToken: (callback: (data: { token: string }) => void) => () => void
  onIntelligenceRecap: (callback: (data: { summary: string }) => void) => () => void
  onIntelligenceRecapToken: (callback: (data: { token: string }) => void) => () => void
  onIntelligenceManualStarted: (callback: () => void) => () => void
  onIntelligenceManualResult: (callback: (data: { answer: string; question: string }) => void) => () => void
  onIntelligenceModeChanged: (callback: (data: { mode: string }) => void) => () => void
  onIntelligenceError: (callback: (data: { error: string, mode: string }) => void) => () => void;
  // Session Management
  onSessionReset: (callback: () => void) => () => void;

  // Streaming listeners
  streamGeminiChat: (message: string, imagePath?: string, context?: string, options?: { skipSystemPrompt?: boolean }) => Promise<void>
  onGeminiStreamToken: (callback: (token: string) => void) => () => void
  onGeminiStreamDone: (callback: () => void) => () => void
  onGeminiStreamError: (callback: (error: string) => void) => () => void;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;

  onModelChanged: (callback: (modelId: string) => void) => () => void;

  onMeetingsUpdated: (callback: () => void) => () => void
  onMeetingIdUpdated: (callback: (meetingId: string) => void) => () => void

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

  invoke: (channel: string, ...args: any[]) => Promise<any>

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

  // Live Feedback
  toggleLiveFeedback: () => Promise<void>

  // Panel Management
  getPanelConfigs: () => Promise<Array<{ id: string; name: string; icon: string; systemPrompt: string; instruction: string; isBuiltIn: boolean; color: string }>>
  getActivePanelIds: () => Promise<string[]>
  setActivePanels: (panelIds: string[]) => Promise<{ success: boolean; error?: string }>
  togglePanel: (panelId: string, active: boolean) => Promise<{ success: boolean; error?: string }>
  saveCustomPanel: (config: { id: string; name: string; icon: string; systemPrompt: string; instruction: string; isBuiltIn: boolean; color: string }) => Promise<{ success: boolean; error?: string }>
  deleteCustomPanel: (id: string) => Promise<{ success: boolean; error?: string }>
  onPanelToken: (callback: (data: { panelId: string; token: string; isStart?: boolean }) => void) => () => void
  onPanelComplete: (callback: (data: { panelId: string; content: string }) => void) => () => void
  onPanelError: (callback: (data: { panelId: string; error: string }) => void) => () => void

  // Speaker Management
  getMeetingSpeakers: (meetingId: string) => Promise<Array<{ id: string; channel_label: string; display_name: string | null; person_id: string | null; person_name: string | null; is_self: boolean }>>
  renameSpeaker: (meetingId: string, speakerId: string, displayName?: string, personId?: string) => Promise<{ success: boolean; error?: string }>
  unlinkSpeakerPerson: (meetingId: string, speakerId: string) => Promise<{ success: boolean }>
  getSpeakerMappings: () => Promise<Array<{ original: string; displayName: string }>>
  onSpeakerMappingsUpdated: (callback: (mappings: Array<{ original: string; displayName: string }>) => void) => () => void

  // Person Management
  searchPersons: (search?: string, limit?: number) => Promise<Array<{ id: string; name: string; email: string | null }>>
  createPerson: (name: string, email?: string) => Promise<{ id: string; name: string } | null>
  updatePerson: (id: string, updates: { name?: string; email?: string; notes?: string }) => Promise<{ id: string; name: string; email: string | null } | null>
  deletePerson: (id: string) => Promise<boolean>

  // Voiceprint Management
  getPersonVoiceprints: (personId: string) => Promise<Array<{ id: string; person_id: string; meeting_id: string | null; speaker_label: string | null; created_at: string }>>
  enrollVoiceprint: (personId: string, meetingId: string, speakerLabel: string) => Promise<{ id: string; person_id: string; meeting_id: string | null; speaker_label: string | null; created_at: string } | null>
  deleteVoiceprint: (voiceprintId: string) => Promise<boolean>

  // User Profile
  updateUserProfile: (updates: { display_name?: string }) => Promise<any>
  getUserProfile: () => Promise<{ id: string; email: string; display_name: string | null; is_active: boolean } | null>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
