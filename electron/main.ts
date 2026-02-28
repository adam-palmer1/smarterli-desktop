import { app, BrowserWindow, Tray, Menu, nativeImage, shell } from "electron"
import path from "path"
import fs from "fs"
import { autoUpdater } from "electron-updater"
if (!app.isPackaged) {
  require('dotenv').config();
}

// Handle stdout/stderr errors at the process level to prevent EIO crashes
// This is critical for Electron apps that may have their terminal detached
process.stdout?.on?.('error', () => { });
process.stderr?.on?.('error', () => { });

const logFile = path.join(app.getPath('documents'), 'smarterli_debug.log');

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const isDev = process.env.NODE_ENV === "development";

function logToFile(msg: string) {
  // Only log to file in development
  if (!isDev) return;

  try {
    require('fs').appendFileSync(logFile, new Date().toISOString() + ' ' + msg + '\n');
  } catch (e) {
    // Ignore logging errors
  }
}

function createConsoleWrapper(original: (...args: any[]) => void, prefix: string) {
  return (...args: any[]) => {
    const msg = args.map(a => (a instanceof Error) ? a.stack || a.message : (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logToFile(`[${prefix}] ${msg}`);
    try {
      original.apply(console, args);
    } catch { }
  };
}

console.log = createConsoleWrapper(originalLog, 'LOG');
console.warn = createConsoleWrapper(originalWarn, 'WARN');
console.error = createConsoleWrapper(originalError, 'ERROR');

import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { SettingsWindowHelper } from "./SettingsWindowHelper"
import { ModelSelectorWindowHelper } from "./ModelSelectorWindowHelper"
import { TranscriptWindowHelper } from "./TranscriptWindowHelper"
import { LiveFeedbackWindowHelper } from "./LiveFeedbackWindowHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"

import { ServerClient } from "./server/ServerClient"
import { AudioStreamer } from "./server/AudioStreamer"
import { IntelligenceClient } from "./server/IntelligenceClient"
import { PanelClient } from "./server/PanelClient"

import { SystemAudioCapture } from "./audio/SystemAudioCapture"
import { MicrophoneCapture } from "./audio/MicrophoneCapture"
import { ThemeManager } from "./ThemeManager"
import { CredentialsManager } from "./services/CredentialsManager"
import { SERVER_URL } from "./config/constants"
import crypto from "crypto"

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  public settingsWindowHelper: SettingsWindowHelper
  public modelSelectorWindowHelper: ModelSelectorWindowHelper
  public transcriptWindowHelper: TranscriptWindowHelper
  public liveFeedbackWindowHelper: LiveFeedbackWindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper

  private serverClient: ServerClient | null = null
  private audioStreamer: AudioStreamer | null = null
  private intelligenceClient: IntelligenceClient | null = null
  private panelClient: PanelClient | null = null
  private currentSessionId: string | null = null

  private themeManager: ThemeManager
  private tray: Tray | null = null
  private updateAvailable: boolean = false
  // View management
  private view: "queue" | "solutions" = "queue"

  private problemInfo: {
    problem_statement: string
    input_format: Record<string, any>
    output_format: Record<string, any>
    constraints: Array<Record<string, any>>
    test_cases: Array<Record<string, any>>
  } | null = null // Allow null

  private hasDebugged: boolean = false
  private isMeetingActive: boolean = false; // Guard for session state leaks
  private isMeetingTransitioning: boolean = false; // Mutex for start/end lifecycle
  private isMeetingPaused: boolean = false; // Pause state (audio stopped, session alive)
  private isInputStreamingEnabled: boolean = true;
  private isOutputStreamingEnabled: boolean = true;
  private currentInputDeviceId: string | undefined;
  private currentOutputDeviceId: string | undefined;

  // Live Feedback engine
  private liveFeedbackClient: IntelligenceClient | null = null;
  private liveFeedbackDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private liveFeedbackLastTrigger: number = 0;
  private liveFeedbackTranscriptBuffer: string = '';

  // Processing events
  public readonly PROCESSING_EVENTS = {
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

  // Audio capture (local Rust NAPI)
  private systemAudioCapture: SystemAudioCapture | null = null;
  private microphoneCapture: MicrophoneCapture | null = null;
  private audioTestCapture: MicrophoneCapture | null = null; // For audio settings test
  private audioTestOutputCapture: SystemAudioCapture | null = null; // For output level test

  constructor() {
    // Initialize WindowHelper with this
    this.windowHelper = new WindowHelper(this)
    this.settingsWindowHelper = new SettingsWindowHelper()
    this.modelSelectorWindowHelper = new ModelSelectorWindowHelper()
    this.transcriptWindowHelper = new TranscriptWindowHelper()
    this.liveFeedbackWindowHelper = new LiveFeedbackWindowHelper()

    // Initialize ScreenshotHelper
    this.screenshotHelper = new ScreenshotHelper(this.view)

    // Initialize ShortcutsHelper
    this.shortcutsHelper = new ShortcutsHelper(this)

    // Initialize ServerClient with hardcoded server URL
    const cm = CredentialsManager.getInstance();
    const apiKey = cm.getApiKey();
    const accessToken = cm.getAccessToken();
    this.serverClient = new ServerClient(SERVER_URL, apiKey, accessToken);
    const refreshToken = cm.getRefreshToken();
    if (refreshToken) this.serverClient.setRefreshToken(refreshToken);
    this.serverClient.onUnauthorized(() => {
      console.log('[AppState] 401 Unauthorized — notifying renderer');
      this.sendToWindow(this.getWindowHelper().getLauncherWindow(), this.PROCESSING_EVENTS.UNAUTHORIZED);
    });
    console.log('[AppState] ServerClient initialized with URL:', SERVER_URL);

    // Initialize ThemeManager
    this.themeManager = ThemeManager.getInstance()

    // Initialize Auto-Updater
    this.setupAutoUpdater()
  }

  private setupAutoUpdater(): void {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false  // Manual install only via button

    autoUpdater.on("checking-for-update", () => {
      console.log("[AutoUpdater] Checking for update...")
      this.sendToWindow(this.getMainWindow(), "update-checking")
    })

    autoUpdater.on("update-available", (info) => {
      console.log("[AutoUpdater] Update available:", info.version)
      this.updateAvailable = true
      // Notify renderer that an update is available (for optional UI signal)
      this.sendToWindow(this.getMainWindow(), "update-available", info)
    })

    autoUpdater.on("update-not-available", (info) => {
      console.log("[AutoUpdater] Update not available:", info.version)
      this.sendToWindow(this.getMainWindow(), "update-not-available", info)
    })

    autoUpdater.on("error", (err) => {
      console.error("[AutoUpdater] Error:", err)
      this.sendToWindow(this.getMainWindow(), "update-error", err.message)
    })

    autoUpdater.on("download-progress", (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond
      log_message = log_message + " - Downloaded " + progressObj.percent + "%"
      log_message = log_message + " (" + progressObj.transferred + "/" + progressObj.total + ")"
      console.log("[AutoUpdater] " + log_message)
      this.sendToWindow(this.getMainWindow(), "download-progress", progressObj)
    })

    autoUpdater.on("update-downloaded", (info) => {
      console.log("[AutoUpdater] Update downloaded:", info.version)
      // Notify renderer that update is ready to install
      this.sendToWindow(this.getMainWindow(), "update-downloaded", info)
    })

    // Only skip the automatic check in development
    if (process.env.NODE_ENV === "development") {
      console.log("[AutoUpdater] Skipping automatic update check in development mode")
      return
    }

    // Start checking for updates
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error("[AutoUpdater] Failed to check for updates:", err)
    })
  }


  public async quitAndInstallUpdate(): Promise<void> {
    console.log('[AutoUpdater] quitAndInstall called - applying update...')

    // On macOS, unsigned apps can't auto-restart via quitAndInstall
    // Workaround: Open the folder containing the downloaded update so user can install manually
    if (process.platform === 'darwin') {
      try {
        // Get the downloaded update file path (e.g., .../Smarter.li-1.0.9-mac.zip)
        const updateFile = (autoUpdater as any).downloadedUpdateHelper?.file
        console.log('[AutoUpdater] Downloaded update file:', updateFile)

        if (updateFile) {
          const updateDir = path.dirname(updateFile)
          // Open the directory containing the update in Finder
          await shell.openPath(updateDir)
          console.log('[AutoUpdater] Opened update directory:', updateDir)

          // Quit the app so user can install new version
          setTimeout(() => app.quit(), 1000)
          return
        }
      } catch (err) {
        console.error('[AutoUpdater] Failed to open update directory:', err)
      }
    }

    // Fallback to standard quitAndInstall (works on Windows/Linux or if signed)
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true)
      } catch (err) {
        console.error('[AutoUpdater] quitAndInstall failed:', err)
        app.exit(0)
      }
    })
  }

  public async checkForUpdates(): Promise<void> {
    await autoUpdater.checkForUpdatesAndNotify()
  }

  public downloadUpdate(): void {
    autoUpdater.downloadUpdate()
  }

  private setupSystemAudioPipeline(): void {
    try {
      // 1. Initialize System Audio Capture if missing
      if (!this.systemAudioCapture) {
        this.systemAudioCapture = new SystemAudioCapture();
        this.systemAudioCapture.on('data', (chunk: Buffer) => {
          this.audioStreamer?.sendSystemAudio(chunk);
        });
        this.systemAudioCapture.on('error', (err: Error) => {
          console.error('[Main] SystemAudioCapture Error:', err);
        });
      }

      // 2. Initialize Microphone Capture if missing
      if (!this.microphoneCapture) {
        this.microphoneCapture = new MicrophoneCapture();
        this.microphoneCapture.on('data', (chunk: Buffer) => {
          this.audioStreamer?.sendMicAudio(chunk);
        });
        this.microphoneCapture.on('error', (err: Error) => {
          console.error('[Main] MicrophoneCapture Error:', err);
        });
      }

      console.log('[Main] Audio Pipeline (System + Mic) Initialized (Ready)');

    } catch (err) {
      console.error('[Main] Failed to setup System Audio Pipeline:', err);
    }
  }

  private async reconfigureAudio(inputDeviceId?: string, outputDeviceId?: string): Promise<void> {
    console.log(`[Main] Reconfiguring Audio: Input=${inputDeviceId}, Output=${outputDeviceId}`);
    this.currentInputDeviceId = inputDeviceId;
    this.currentOutputDeviceId = outputDeviceId;

    // 1. System Audio (Output Capture)
    if (this.systemAudioCapture) {
      this.systemAudioCapture.stop();
      this.systemAudioCapture.removeAllListeners();
      this.systemAudioCapture = null;
    }

    try {
      console.log('[Main] Initializing SystemAudioCapture...');
      this.systemAudioCapture = new SystemAudioCapture(outputDeviceId || undefined);

      this.systemAudioCapture.on('data', (chunk: Buffer) => {
        this.audioStreamer?.sendSystemAudio(chunk);
      });
      this.systemAudioCapture.on('error', (err: Error) => {
        console.error('[Main] SystemAudioCapture Error:', err);
      });
      console.log('[Main] SystemAudioCapture initialized.');
    } catch (err) {
      console.warn('[Main] Failed to initialize SystemAudioCapture with preferred ID. Falling back to default.', err);
      try {
        this.systemAudioCapture = new SystemAudioCapture(); // Default
        this.systemAudioCapture.on('data', (chunk: Buffer) => {
          this.audioStreamer?.sendSystemAudio(chunk);
        });
        this.systemAudioCapture.on('error', (err: Error) => {
          console.error('[Main] SystemAudioCapture (Default) Error:', err);
        });
      } catch (err2) {
        console.error('[Main] Failed to initialize SystemAudioCapture (Default):', err2);
      }
    }

    // 2. Microphone (Input Capture)
    if (this.microphoneCapture) {
      this.microphoneCapture.stop();
      this.microphoneCapture.removeAllListeners();
      this.microphoneCapture = null;
    }

    try {
      console.log('[Main] Initializing MicrophoneCapture...');
      this.microphoneCapture = new MicrophoneCapture(inputDeviceId || undefined);

      this.microphoneCapture.on('data', (chunk: Buffer) => {
        this.audioStreamer?.sendMicAudio(chunk);
      });
      this.microphoneCapture.on('error', (err: Error) => {
        console.error('[Main] MicrophoneCapture Error:', err);
      });
      console.log('[Main] MicrophoneCapture initialized.');
    } catch (err) {
      console.warn('[Main] Failed to initialize MicrophoneCapture with preferred ID. Falling back to default.', err);
      try {
        this.microphoneCapture = new MicrophoneCapture(); // Default
        this.microphoneCapture.on('data', (chunk: Buffer) => {
          this.audioStreamer?.sendMicAudio(chunk);
        });
        this.microphoneCapture.on('error', (err: Error) => {
          console.error('[Main] MicrophoneCapture (Default) Error:', err);
        });
      } catch (err2) {
        console.error('[Main] Failed to initialize MicrophoneCapture (Default):', err2);
      }
    }
  }


  public startAudioTest(inputDeviceId?: string, outputDeviceId?: string): void {
    console.log(`[Main] Starting Audio Test: input=${inputDeviceId || 'default'}, output=${outputDeviceId || 'default'}`);
    this.stopAudioTest(); // Stop any existing test

    const sendLevel = (channel: string, chunk: Buffer) => {
      const win = this.getWindowHelper().getLauncherWindow();
      if (!win || win.isDestroyed()) return;
      let sum = 0;
      const step = 10;
      const len = chunk.length;
      for (let i = 0; i < len; i += 2 * step) {
        const val = chunk.readInt16LE(i);
        sum += val * val;
      }
      const count = len / (2 * step);
      if (count > 0) {
        const rms = Math.sqrt(sum / count);
        const level = Math.min(rms / 10000, 1.0);
        this.sendToWindow(win, 'audio-level', { channel, level });
      }
    };

    // Start input (microphone) monitoring
    try {
      this.audioTestCapture = new MicrophoneCapture(inputDeviceId || undefined);
      this.audioTestCapture.start();
      this.audioTestCapture.on('data', (chunk: Buffer) => sendLevel('input', chunk));
      this.audioTestCapture.on('error', (err: Error) => {
        console.error('[Main] AudioTest Input Error:', err);
      });
    } catch (err) {
      console.error('[Main] Failed to start input audio test:', err);
    }

    // Start output (system audio) monitoring
    try {
      this.audioTestOutputCapture = new SystemAudioCapture(outputDeviceId || undefined);
      this.audioTestOutputCapture.start();
      this.audioTestOutputCapture.on('data', (chunk: Buffer) => sendLevel('output', chunk));
      this.audioTestOutputCapture.on('error', (err: Error) => {
        console.error('[Main] AudioTest Output Error:', err);
      });
    } catch (err) {
      console.error('[Main] Failed to start output audio test:', err);
    }
  }

  public stopAudioTest(): void {
    if (this.audioTestCapture) {
      console.log('[Main] Stopping Audio Test (input)');
      this.audioTestCapture.stop();
      this.audioTestCapture = null;
    }
    if (this.audioTestOutputCapture) {
      console.log('[Main] Stopping Audio Test (output)');
      this.audioTestOutputCapture.stop();
      this.audioTestOutputCapture = null;
    }
  }

  public async startMeeting(metadata?: any): Promise<void> {
    if (this.isMeetingActive || this.isMeetingTransitioning) {
      console.warn('[Main] Meeting already active or transitioning, ignoring duplicate startMeeting call');
      return;
    }
    this.isMeetingTransitioning = true;
    console.log('[Main] Starting Meeting...', metadata);

    try {
      this.isMeetingActive = true;
      // Reset streaming flags to ON for every new meeting
      this.isInputStreamingEnabled = true;
      this.isOutputStreamingEnabled = true;

      const cm = CredentialsManager.getInstance();
      const apiKey = cm.getApiKey();
      if (!apiKey) {
        this.isMeetingActive = false;
        throw new Error('API key not configured');
      }

      this.currentSessionId = crypto.randomUUID();

      // Reset UI
      this.sendToWindow(this.getWindowHelper().getOverlayWindow(), 'session-reset');
      this.sendToWindow(this.getWindowHelper().getLauncherWindow(), 'session-reset');

      // Setup audio pipeline
      if (metadata?.audio) {
        await this.reconfigureAudio(metadata.audio.inputDeviceId, metadata.audio.outputDeviceId);
      }
      this.setupSystemAudioPipeline();

      // Connect to server
      this.audioStreamer = new AudioStreamer(SERVER_URL, apiKey, this.currentSessionId);
      this.intelligenceClient = new IntelligenceClient(SERVER_URL, apiKey);
      this.panelClient = new PanelClient(SERVER_URL, apiKey, this.currentSessionId);

      // Set audio sample rates on the streamer from local capture devices
      const sysRate = this.systemAudioCapture?.getSampleRate() || 16000;
      this.audioStreamer.setSampleRate(sysRate);

      // Wire audio streamer events
      this.audioStreamer.on('transcript', (data) => {
        const payload = {
          speaker: data.speaker,
          text: data.text,
          timestamp: data.timestamp,
          final: data.is_final,
          confidence: data.confidence,
          person_id: data.person_id,
          person_name: data.person_name,
        };
        this.sendToWindow(this.getWindowHelper().getLauncherWindow(), 'native-audio-transcript', payload);
        this.sendToWindow(this.getWindowHelper().getOverlayWindow(), 'native-audio-transcript', payload);
        this.transcriptWindowHelper.sendTranscript(payload);

        // Feed live feedback engine
        if (data.is_final && this.liveFeedbackWindowHelper.isVisible()) {
          this.feedLiveFeedback(data.text);
        }
      });

      this.audioStreamer.on('session-started', (data) => {
        console.log('[Main] Audio session started:', data.session_id, 'meeting:', data.meeting_id);
        const meetingId = data.meeting_id;
        this.broadcastToAllWindows('meeting-id-updated', meetingId);
      });

      this.audioStreamer.on('session-terminated', (data) => {
        console.log('[Main] Audio session terminated, total seconds:', data.total_seconds);
        this.broadcastToAllWindows('session-terminated', data);
      });

      this.audioStreamer.on('credit-update', (data) => {
        this.broadcastToAllWindows('credit-update', data);
      });

      this.audioStreamer.on('credit-exhausted', () => {
        this.broadcastToAllWindows('credit-exhausted');
      });

      // Wire intelligence client events
      this.intelligenceClient.on('token', (data) => {
        const win = this.getMainWindow();
        if (!win) return;

        // Map mode to IPC channel
        const modeChannelMap: Record<string, string> = {
          'what-to-say': 'intelligence-suggested-answer-token',
          'follow-up': 'intelligence-refined-answer-token',
          'recap': 'intelligence-recap-token',
          'follow-up-questions': 'intelligence-follow-up-questions-token',
          'chat': 'gemini-stream-token',
          'assist': 'intelligence-assist-update',
        };

        const channel = modeChannelMap[data.mode];
        if (channel) {
          if (data.mode === 'what-to-say') {
            this.sendToWindow(win, channel, { token: data.token, question: '', confidence: 0.8 });
          } else if (data.mode === 'follow-up') {
            this.sendToWindow(win, channel, { token: data.token, intent: '' });
          } else if (data.mode === 'recap') {
            this.sendToWindow(win, channel, { token: data.token });
          } else if (data.mode === 'follow-up-questions') {
            this.sendToWindow(win, channel, { token: data.token });
          } else if (data.mode === 'chat') {
            this.sendToWindow(win, channel, data.token);
          } else if (data.mode === 'assist') {
            this.sendToWindow(win, channel, { insight: data.token });
          }
        }
      });

      // Wire panel client events
      this.panelClient.on('panel-token', (data) => {
        this.broadcastToAllWindows('panel-token', data);
      });

      this.panelClient.on('panel-complete', (data) => {
        this.broadcastToAllWindows('panel-complete', data);
      });

      this.panelClient.on('panel-error', (data) => {
        this.broadcastToAllWindows('panel-error', data);
      });

      // Connect WebSocket clients
      await this.audioStreamer.connect();
      await this.panelClient.connect();

      // Configure active panels on the server
      const savedPanelIds = cm.getActivePanelIds();
      if (savedPanelIds.length > 0) {
        this.panelClient.configurePanels(savedPanelIds);
      }

      // Start local audio captures (data flows to audioStreamer via event wiring above)
      // Respect streaming toggle state
      if (this.isOutputStreamingEnabled) {
        this.systemAudioCapture?.start();
      }
      if (this.isInputStreamingEnabled) {
        this.microphoneCapture?.start();
      }
    } catch (err) {
      this.isMeetingActive = false;
      throw err;
    } finally {
      this.isMeetingTransitioning = false;
    }
  }

  public async endMeeting(): Promise<void> {
    if (this.isMeetingTransitioning) {
      console.warn('[Main] Meeting is transitioning, ignoring endMeeting call');
      return;
    }
    console.log('[Main] Ending Meeting...');
    this.isMeetingTransitioning = true;
    this.isMeetingActive = false; // Block new data immediately
    this.isMeetingPaused = false;

    try {
      // Stop local audio captures
      this.systemAudioCapture?.stop();
      this.microphoneCapture?.stop();

      // End audio streaming session
      if (this.audioStreamer) {
        try {
          await this.audioStreamer.end();
        } catch (err) {
          console.error('[Main] Error ending audio streamer:', err);
        }
        this.audioStreamer.removeAllListeners();
        this.audioStreamer = null;
      }

      // Disconnect panel client
      if (this.panelClient) {
        try {
          await this.panelClient.disconnect();
        } catch (err) {
          console.error('[Main] Error disconnecting panel client:', err);
        }
        this.panelClient.removeAllListeners();
        this.panelClient = null;
      }

      // Clean up intelligence client
      if (this.intelligenceClient) {
        this.intelligenceClient.cancel();
        this.intelligenceClient.removeAllListeners();
        this.intelligenceClient = null;
      }

      // Close meeting-related windows (transcript, model selector, live feedback)
      this.transcriptWindowHelper.close();
      this.modelSelectorWindowHelper.closeWindow();
      this.liveFeedbackWindowHelper.close();

      // Clean up live feedback engine
      if (this.liveFeedbackDebounceTimer) {
        clearTimeout(this.liveFeedbackDebounceTimer);
        this.liveFeedbackDebounceTimer = null;
      }
      this.liveFeedbackClient?.cancel();
      this.liveFeedbackClient = null;
      this.liveFeedbackTranscriptBuffer = '';

      // Reset UI (clear transcript, panels, etc.)
      this.sendToWindow(this.getWindowHelper().getOverlayWindow(), 'session-reset');
      this.sendToWindow(this.getWindowHelper().getLauncherWindow(), 'session-reset');

      // Reset session
      this.currentSessionId = null;
    } finally {
      this.isMeetingTransitioning = false;
    }
  }


  public async pauseMeeting(): Promise<void> {
    if (!this.isMeetingActive || this.isMeetingPaused || this.isMeetingTransitioning) {
      console.warn('[Main] Cannot pause: not active, already paused, or transitioning');
      return;
    }
    console.log('[Main] Pausing Meeting...');
    this.isMeetingPaused = true;

    // Stop local audio captures but keep WebSocket connections alive
    this.systemAudioCapture?.stop();
    this.microphoneCapture?.stop();

    this.broadcastToAllWindows('meeting-paused');
  }

  public async resumeMeeting(): Promise<void> {
    if (!this.isMeetingActive || !this.isMeetingPaused || this.isMeetingTransitioning) {
      console.warn('[Main] Cannot resume: not active, not paused, or transitioning');
      return;
    }
    console.log('[Main] Resuming Meeting...');
    this.isMeetingPaused = false;

    // Recreate audio captures — native Rust monitors use single-use consumers
    // that can't restart after stop, so we must destroy and recreate them.
    if (this.isInputStreamingEnabled) {
      if (this.microphoneCapture) {
        this.microphoneCapture.destroy();
        this.microphoneCapture.removeAllListeners();
      }
      this.microphoneCapture = new MicrophoneCapture(this.currentInputDeviceId);
      this.microphoneCapture.on('data', (chunk: Buffer) => {
        this.audioStreamer?.sendMicAudio(chunk);
      });
      this.microphoneCapture.on('error', (err: Error) => {
        console.error('[Main] MicrophoneCapture Error:', err);
      });
      this.microphoneCapture.start();
    }
    if (this.isOutputStreamingEnabled) {
      if (this.systemAudioCapture) {
        this.systemAudioCapture.stop();
        this.systemAudioCapture.removeAllListeners();
      }
      this.systemAudioCapture = new SystemAudioCapture(this.currentOutputDeviceId);
      this.systemAudioCapture.on('data', (chunk: Buffer) => {
        this.audioStreamer?.sendSystemAudio(chunk);
      });
      this.systemAudioCapture.on('error', (err: Error) => {
        console.error('[Main] SystemAudioCapture Error:', err);
      });
      this.systemAudioCapture.start();
    }

    this.broadcastToAllWindows('meeting-resumed');
  }

  public async reconfigureMidMeeting(config?: { inputDeviceId?: string; outputDeviceId?: string }): Promise<void> {
    if (!this.isMeetingActive) {
      console.warn('[Main] Cannot reconfigure: no active meeting');
      return;
    }
    console.log('[Main] Reconfiguring audio mid-meeting:', config);

    await this.reconfigureAudio(config?.inputDeviceId, config?.outputDeviceId);

    // If not paused, start the new captures immediately (respecting streaming flags)
    if (!this.isMeetingPaused) {
      if (this.isOutputStreamingEnabled) {
        this.systemAudioCapture?.start();
      }
      if (this.isInputStreamingEnabled) {
        this.microphoneCapture?.start();
      }
    }
  }

  public setInputStreaming(enabled: boolean): void {
    console.log(`[Main] Input streaming: ${enabled}`);
    this.isInputStreamingEnabled = enabled;
    if (!this.isMeetingActive || this.isMeetingPaused) return;
    if (enabled) {
      // Recreate mic capture if it was destroyed (native monitor can't restart after stop)
      if (this.microphoneCapture) {
        this.microphoneCapture.destroy();
        this.microphoneCapture.removeAllListeners();
      }
      this.microphoneCapture = new MicrophoneCapture(this.currentInputDeviceId);
      this.microphoneCapture.on('data', (chunk: Buffer) => {
        this.audioStreamer?.sendMicAudio(chunk);
      });
      this.microphoneCapture.on('error', (err: Error) => {
        console.error('[Main] MicrophoneCapture Error:', err);
      });
      this.microphoneCapture.start();
    } else {
      this.microphoneCapture?.stop();
    }
  }

  public setOutputStreaming(enabled: boolean): void {
    console.log(`[Main] Output streaming: ${enabled}`);
    this.isOutputStreamingEnabled = enabled;
    if (!this.isMeetingActive || this.isMeetingPaused) return;
    if (enabled) {
      // Recreate system audio capture (SCK needs fresh stream after stop)
      if (this.systemAudioCapture) {
        this.systemAudioCapture.stop();
        this.systemAudioCapture.removeAllListeners();
      }
      this.systemAudioCapture = new SystemAudioCapture(this.currentOutputDeviceId);
      this.systemAudioCapture.on('data', (chunk: Buffer) => {
        this.audioStreamer?.sendSystemAudio(chunk);
      });
      this.systemAudioCapture.on('error', (err: Error) => {
        console.error('[Main] SystemAudioCapture Error:', err);
      });
      this.systemAudioCapture.start();
    } else {
      this.systemAudioCapture?.stop();
    }
  }

  // =========================================================================
  // Live Feedback Engine
  // =========================================================================

  /**
   * Feed transcript text into the live feedback engine.
   * Uses debouncing to avoid flooding — waits for a pause in speech, then triggers.
   * Minimum interval: 8 seconds between triggers to avoid overlapping streams.
   */
  private feedLiveFeedback(text: string): void {
    this.liveFeedbackTranscriptBuffer += ' ' + text;

    // Clear existing debounce timer
    if (this.liveFeedbackDebounceTimer) {
      clearTimeout(this.liveFeedbackDebounceTimer);
    }

    // Debounce: wait 2 seconds of silence after last final transcript before triggering
    this.liveFeedbackDebounceTimer = setTimeout(() => {
      this.triggerLiveFeedback();
    }, 2000);
  }

  private async triggerLiveFeedback(): Promise<void> {
    const now = Date.now();
    const MIN_INTERVAL = 8000; // Minimum 8s between triggers

    if (now - this.liveFeedbackLastTrigger < MIN_INTERVAL) {
      return;
    }

    if (!this.currentSessionId || !this.liveFeedbackClient) {
      return;
    }

    if (!this.liveFeedbackWindowHelper.isVisible()) {
      return;
    }

    const bufferText = this.liveFeedbackTranscriptBuffer.trim();
    if (bufferText.length < 15) {
      // Too short to generate meaningful feedback
      return;
    }

    this.liveFeedbackLastTrigger = now;
    this.liveFeedbackTranscriptBuffer = '';

    console.log('[LiveFeedback] Triggering feedback generation...');

    // Send thinking state
    const words = bufferText.split(/\s+/).slice(-6).join(' ');
    this.liveFeedbackWindowHelper.sendThinking(words.length > 30 ? words.substring(0, 30) + '...' : words);

    try {
      // Use the dedicated live feedback client (separate from main intelligence client)
      // This calls 'what-to-say' which provides contextual suggestions
      const feedbackClient = this.liveFeedbackClient;
      let isFirst = true;

      // Temporarily wire token events to the live feedback window
      const tokenHandler = (data: { mode: string; token: string }) => {
        this.liveFeedbackWindowHelper.sendToken(data.token, isFirst);
        isFirst = false;
      };

      feedbackClient.on('token', tokenHandler);

      try {
        const result = await feedbackClient.streamWhatToSay(this.currentSessionId);
        this.liveFeedbackWindowHelper.sendComplete(result);
      } finally {
        feedbackClient.removeListener('token', tokenHandler);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[LiveFeedback] Error:', err.message);
        this.liveFeedbackWindowHelper.sendError(err.message);
      }
    }
  }

  public toggleLiveFeedback(): void {
    this.liveFeedbackWindowHelper.toggle();

    // Initialize the dedicated feedback client if needed
    if (!this.liveFeedbackClient && this.intelligenceClient) {
      const creds = CredentialsManager.getInstance().getAllCredentials();
      if (creds?.apiKey) {
        this.liveFeedbackClient = new IntelligenceClient(SERVER_URL, creds.apiKey);
      }
    }
  }

  /** No-op -- language detection handled server-side */
  public setRecognitionLanguage(_key: string): void { }

  /** Safely send IPC message to a window, catching errors if window is destroyed */
  private sendToWindow(win: BrowserWindow | null | undefined, channel: string, ...args: any[]): void {
    try {
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    } catch (err) {
      // Window was destroyed between check and send - safe to ignore
    }
  }

  /** Safely broadcast IPC message to all windows */
  private broadcastToAllWindows(channel: string, ...args: any[]): void {
    BrowserWindow.getAllWindows().forEach(w => {
      this.sendToWindow(w, channel, ...args);
    });
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  // Getters and Setters
  public getMainWindow(): BrowserWindow | null {
    return this.windowHelper.getMainWindow()
  }

  public getWindowHelper(): WindowHelper {
    return this.windowHelper
  }

  public getServerClient(): ServerClient | null {
    return this.serverClient;
  }

  public getIntelligenceClient(): IntelligenceClient | null {
    return this.intelligenceClient;
  }

  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  public getPanelClient(): PanelClient | null {
    return this.panelClient;
  }

  public getThemeManager(): ThemeManager {
    return this.themeManager
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
    this.screenshotHelper.setView(view)
  }

  public isVisible(): boolean {
    return this.windowHelper.isVisible()
  }

  public getScreenshotHelper(): ScreenshotHelper {
    return this.screenshotHelper
  }



  public getProblemInfo(): any {
    return this.problemInfo
  }

  public setProblemInfo(problemInfo: any): void {
    this.problemInfo = problemInfo
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotHelper.getScreenshotQueue()
  }

  public getExtraScreenshotQueue(): string[] {
    return this.screenshotHelper.getExtraScreenshotQueue()
  }

  // Window management methods
  public createWindow(): void {
    this.windowHelper.createWindow()
  }

  public hideMainWindow(): void {
    this.windowHelper.hideMainWindow()
  }

  public showMainWindow(): void {
    this.windowHelper.showMainWindow()
  }

  public toggleMainWindow(): void {
    console.log(
      "Screenshots: ",
      this.screenshotHelper.getScreenshotQueue().length,
      "Extra screenshots: ",
      this.screenshotHelper.getExtraScreenshotQueue().length
    )
    this.windowHelper.toggleMainWindow()
  }

  public setWindowDimensions(width: number, height: number): void {
    this.windowHelper.setWindowDimensions(width, height)
  }

  public clearQueues(): void {
    this.screenshotHelper.clearQueues()

    // Clear problem info
    this.problemInfo = null

    // Reset view to initial state
    this.setView("queue")
  }

  // Screenshot management methods
  public async takeScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available")

    const wasOverlayVisible = this.windowHelper.getOverlayWindow()?.isVisible() ?? false

    const screenshotPath = await this.screenshotHelper.takeScreenshot(
      () => this.hideMainWindow(),
      () => {
        if (wasOverlayVisible) {
          this.windowHelper.switchToOverlay()
        } else {
          this.showMainWindow()
        }
      }
    )

    return screenshotPath
  }

  public async takeSelectiveScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available")

    const wasOverlayVisible = this.windowHelper.getOverlayWindow()?.isVisible() ?? false

    const screenshotPath = await this.screenshotHelper.takeSelectiveScreenshot(
      () => this.hideMainWindow(),
      () => {
        if (wasOverlayVisible) {
          this.windowHelper.switchToOverlay()
        } else {
          this.showMainWindow()
        }
      }
    )

    return screenshotPath
  }

  public async getImagePreview(filepath: string): Promise<string> {
    return this.screenshotHelper.getImagePreview(filepath)
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.screenshotHelper.deleteScreenshot(path)
  }

  // New methods to move the window
  public moveWindowLeft(): void {
    this.windowHelper.moveWindowLeft()
  }

  public moveWindowRight(): void {
    this.windowHelper.moveWindowRight()
  }
  public moveWindowDown(): void {
    this.windowHelper.moveWindowDown()
  }
  public moveWindowUp(): void {
    this.windowHelper.moveWindowUp()
  }

  public centerAndShowWindow(): void {
    this.windowHelper.centerAndShowWindow()
  }

  public createTray(): void {
    this.showTray();
  }

  public showTray(): void {
    if (this.tray) return;

    // Try to find a template image first for macOS
    const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');

    // Potential paths for tray icon
    const templatePath = path.join(resourcesPath, 'assets', 'iconTemplate.png');
    const defaultIconPath = app.isPackaged
      ? path.join(resourcesPath, 'src/components/icon.png')
      : path.join(__dirname, '../src/components/icon.png');

    let iconToUse = defaultIconPath;

    // Check if template exists (sync check is fine for startup/rare toggle)
    try {
      if (require('fs').existsSync(templatePath)) {
        iconToUse = templatePath;
        console.log('[Tray] Using template icon:', templatePath);
      } else {
        // Also check src/components for dev
        const devTemplatePath = path.join(__dirname, '../src/components/iconTemplate.png');
        if (require('fs').existsSync(devTemplatePath)) {
          iconToUse = devTemplatePath;
          console.log('[Tray] Using dev template icon:', devTemplatePath);
        } else {
          console.log('[Tray] Template icon not found, using default:', defaultIconPath);
        }
      }
    } catch (e) {
      console.error('[Tray] Error checking for icon:', e);
    }

    const trayIcon = nativeImage.createFromPath(iconToUse).resize({ width: 16, height: 16 });
    // IMPORTANT: specific template settings for macOS if needed, but 'Template' in name usually suffices
    trayIcon.setTemplateImage(iconToUse.endsWith('Template.png'));

    this.tray = new Tray(trayIcon)

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Smarter.li',
        click: () => {
          this.centerAndShowWindow()
        }
      },
      {
        label: 'Toggle Window',
        click: () => {
          this.toggleMainWindow()
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Take Screenshot (Cmd+H)',
        click: async () => {
          try {
            const screenshotPath = await this.takeScreenshot()
            const preview = await this.getImagePreview(screenshotPath)
            const mainWindow = this.getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send("screenshot-taken", {
                path: screenshotPath,
                preview
              })
            }
          } catch (error) {
            console.error("Error taking screenshot from tray:", error)
          }
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: () => {
          app.quit()
        }
      }
    ])

    this.tray.setToolTip('Smarter.li - Press Cmd+Shift+Space to show')
    this.tray.setContextMenu(contextMenu)

    // Double-click to show window
    this.tray.on('double-click', () => {
      this.centerAndShowWindow()
    })
  }

  public hideTray(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  public setHasDebugged(value: boolean): void {
    this.hasDebugged = value
  }

  public getHasDebugged(): boolean {
    return this.hasDebugged
  }

}

// Application initialization

// Canonical Dock Icon Setup (dev + prod safe) - MUST be called before any window is created
function setMacDockIcon() {
  if (process.platform !== "darwin") return;

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "smarterli.icns")
    : path.resolve(__dirname, "../assets/smarterli.icns");

  console.log("[DockIcon] Using:", iconPath);
  app.dock.setIcon(nativeImage.createFromPath(iconPath));
}

async function initializeApp() {
  await app.whenReady()

  // Initialize CredentialsManager and load keys explicitly
  CredentialsManager.getInstance().init();

  const appState = AppState.getInstance()

  // Initialize IPC handlers before window creation
  initializeIpcHandlers(appState)

  app.whenReady().then(() => {
    app.setName("Smarter.li"); // Fix App Name in Menu

    try {
      setMacDockIcon(); // MUST be first, before any window
    } catch (e) {
      console.error("Failed to set dock icon:", e);
    }

    console.log("App is ready")

    appState.createWindow()

    if (process.platform === 'darwin') {
      app.setActivationPolicy('regular');
    } else {
      appState.showTray();
    }
    // Register global shortcuts using ShortcutsHelper
    appState.shortcutsHelper.registerGlobalShortcuts()

    // Pre-create settings window in background for faster first open
    appState.settingsWindowHelper.preloadWindow()

    // Initialize CalendarManager
    try {
      const { CalendarManager } = require('./services/CalendarManager');
      const calMgr = CalendarManager.getInstance();
      calMgr.init();

      calMgr.on('start-meeting-requested', (event: any) => {
        console.log('[Main] Start meeting requested from calendar notification', event);
        appState.centerAndShowWindow();
        appState.startMeeting({
          title: event.title,
          calendarEventId: event.id,
          source: 'calendar'
        });
      });

      calMgr.on('open-requested', () => {
        appState.centerAndShowWindow();
      });

      console.log('[Main] CalendarManager initialized');
    } catch (e) {
      console.error('[Main] Failed to initialize CalendarManager:', e);
    }

    // Note: We do NOT force dock show here anymore, respecting stealth mode.
  })

  app.on("activate", () => {
    console.log("App activated")
    if (appState.getMainWindow() === null) {
      appState.createWindow()
    }
  })

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })



  // app.dock?.hide() // REMOVED: User wants Dock icon visible
  app.commandLine.appendSwitch("disable-background-timer-throttling")
}

// Start the application
initializeApp().catch(console.error)
