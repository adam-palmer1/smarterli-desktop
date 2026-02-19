/**
 * AudioStreamer - WebSocket client for streaming audio to/from the Smarter.li server.
 *
 * Connects to: WS /ws/audio/{session_id}?api_key=ck_...
 *
 * Protocol:
 * - Client sends session.start JSON with config
 * - Client sends binary frames: byte 0 = channel (0x01=system, 0x02=mic), bytes 1..N = PCM
 * - Server sends back transcript events, credit updates, session events
 * - Client sends session.end to gracefully terminate
 *
 * Includes automatic reconnection with exponential backoff and audio buffering
 * during reconnection gaps.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

export interface TranscriptEvent {
  speaker: string;
  text: string;
  is_final: boolean;
  confidence: number;
  timestamp: number;
}

export interface CreditUpdateEvent {
  balance_minutes: number;
  session_minutes: number;
}

export interface SessionStartedEvent {
  session_id: string;
  meeting_id: string;
}

export interface SessionTerminatedEvent {
  meeting_id: string;
  total_seconds: number;
}

export interface AudioStreamerEvents {
  'transcript': (data: TranscriptEvent) => void;
  'credit-update': (data: CreditUpdateEvent) => void;
  'credit-exhausted': () => void;
  'session-started': (data: SessionStartedEvent) => void;
  'session-terminated': (data: SessionTerminatedEvent) => void;
  'error': (error: Error) => void;
  'connected': () => void;
  'disconnected': () => void;
}

export class AudioStreamer extends EventEmitter {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private serverUrl: string;
  private apiKey: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect: boolean = false;
  private isConnected: boolean = false;
  private sessionStartSent: boolean = false;

  // Audio buffer for reconnection gaps
  private audioBuffer: Buffer[] = [];
  private maxBufferSize: number = 5 * 16000 * 2; // 5 seconds of 16kHz 16-bit mono PCM
  private currentBufferSize: number = 0;

  // Audio config
  private sampleRate: number = 16000;

  constructor(serverUrl: string, apiKey: string, sessionId: string) {
    super();
    // Strip trailing slash from server URL
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.sessionId = sessionId;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Open the WebSocket connection and send session.start.
   */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.shouldReconnect = true;
      this.reconnectAttempts = 0;

      const wsUrl = this.buildWsUrl();
      console.log(`[AudioStreamer] Connecting to ${wsUrl}`);

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err: any) {
        reject(new Error(`Failed to create WebSocket: ${err.message}`));
        return;
      }

      const connectTimeout = setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('WebSocket connection timeout (30s)'));
          this.ws?.close();
        }
      }, 30000);

      this.ws.on('open', () => {
        console.log('[AudioStreamer] WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        clearTimeout(connectTimeout);

        // Send session.start
        this.sendSessionStart();
        this.emit('connected');

        // Flush any buffered audio
        this.flushAudioBuffer();

        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (err: Error) => {
        console.error('[AudioStreamer] WebSocket error:', err.message);
        this.emit('error', err);
        if (!this.isConnected) {
          clearTimeout(connectTimeout);
          reject(err);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.sessionStartSent = false;
        console.log(`[AudioStreamer] WebSocket closed (code=${code}, reason=${reason.toString()})`);

        if (wasConnected) {
          this.emit('disconnected');
        }

        // Reconnect unless explicitly closed
        if (this.shouldReconnect && code !== 1000 && code !== 4001 && code !== 4002) {
          this.reconnect();
        }
      });
    });
  }

  /**
   * Send system audio PCM data (prepends 0x01 channel byte).
   */
  sendSystemAudio(pcm: Buffer): void {
    this.sendAudio(0x01, pcm);
  }

  /**
   * Send microphone audio PCM data (prepends 0x02 channel byte).
   */
  sendMicAudio(pcm: Buffer): void {
    this.sendAudio(0x02, pcm);
  }

  /**
   * Gracefully end the session. Sends session.end and closes the WebSocket.
   */
  async end(): Promise<void> {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        // Send session.end message
        this.ws.send(JSON.stringify({ type: 'session.end' }));

        // Wait briefly for the server to send session.terminated
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 3000);

          const onTerminated = () => {
            clearTimeout(timeout);
            resolve();
          };

          this.once('session-terminated', onTerminated);
        });

        this.ws.close(1000, 'Session ended');
      } catch (err: any) {
        console.error('[AudioStreamer] Error during end:', err.message);
        this.ws.close();
      }
    }

    this.ws = null;
    this.isConnected = false;
    this.sessionStartSent = false;
    this.audioBuffer = [];
    this.currentBufferSize = 0;
  }

  /**
   * Set the sample rate for audio (must be called before connect).
   */
  setSampleRate(rate: number): void {
    this.sampleRate = rate;
  }

  /**
   * Check if the streamer is currently connected.
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  // =========================================================================
  // Private Implementation
  // =========================================================================

  /**
   * Build the WebSocket URL, converting http(s) to ws(s).
   */
  private buildWsUrl(): string {
    let wsBase = this.serverUrl;

    // Convert http(s) to ws(s)
    if (wsBase.startsWith('https://')) {
      wsBase = 'wss://' + wsBase.substring(8);
    } else if (wsBase.startsWith('http://')) {
      wsBase = 'ws://' + wsBase.substring(7);
    } else if (!wsBase.startsWith('ws://') && !wsBase.startsWith('wss://')) {
      wsBase = 'ws://' + wsBase;
    }

    return `${wsBase}/ws/audio/${this.sessionId}?api_key=${encodeURIComponent(this.apiKey)}`;
  }

  /**
   * Send the session.start message with audio configuration.
   */
  private sendSessionStart(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.sessionStartSent) {
      return;
    }

    const startMessage = {
      type: 'session.start',
      config: {
        sample_rate: this.sampleRate,
      },
    };

    try {
      this.ws.send(JSON.stringify(startMessage));
      this.sessionStartSent = true;
      console.log('[AudioStreamer] Sent session.start');
    } catch (err: any) {
      console.error('[AudioStreamer] Failed to send session.start:', err.message);
    }
  }

  /**
   * Send audio data with a channel prefix byte.
   * If disconnected, buffers the audio for later delivery.
   */
  private sendAudio(channel: number, pcm: Buffer): void {
    // Prepend channel byte
    const frame = Buffer.allocUnsafe(1 + pcm.length);
    frame[0] = channel;
    pcm.copy(frame, 1);

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.sessionStartSent) {
      try {
        this.ws.send(frame);
      } catch (err: any) {
        console.error('[AudioStreamer] Failed to send audio:', err.message);
        this.bufferAudio(frame);
      }
    } else {
      // Buffer audio during reconnection
      this.bufferAudio(frame);
    }
  }

  /**
   * Buffer audio data, maintaining a rolling window to prevent memory issues.
   */
  private bufferAudio(frame: Buffer): void {
    this.audioBuffer.push(frame);
    this.currentBufferSize += frame.length;

    // Evict oldest frames if buffer exceeds max size
    while (this.currentBufferSize > this.maxBufferSize && this.audioBuffer.length > 0) {
      const evicted = this.audioBuffer.shift()!;
      this.currentBufferSize -= evicted.length;
    }
  }

  /**
   * Flush buffered audio after reconnection.
   */
  private flushAudioBuffer(): void {
    if (this.audioBuffer.length === 0) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sessionStartSent) return;

    console.log(`[AudioStreamer] Flushing ${this.audioBuffer.length} buffered audio frames`);

    for (const frame of this.audioBuffer) {
      try {
        this.ws.send(frame);
      } catch (err: any) {
        console.error('[AudioStreamer] Failed to send buffered audio:', err.message);
        break;
      }
    }

    this.audioBuffer = [];
    this.currentBufferSize = 0;
  }

  /**
   * Handle incoming WebSocket messages from the server.
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      const msgType = message.type;

      switch (msgType) {
        case 'transcript':
          this.emit('transcript', {
            speaker: message.speaker,
            text: message.text,
            is_final: message.is_final,
            confidence: message.confidence ?? 1.0,
            timestamp: message.timestamp ?? Date.now(),
          } as TranscriptEvent);
          break;

        case 'credit.update':
          this.emit('credit-update', {
            balance_minutes: message.balance_minutes,
            session_minutes: message.session_minutes,
          } as CreditUpdateEvent);
          break;

        case 'credit.exhausted':
          this.emit('credit-exhausted');
          break;

        case 'session.started':
          this.emit('session-started', {
            session_id: message.session_id,
            meeting_id: message.meeting_id,
          } as SessionStartedEvent);
          break;

        case 'session.terminated':
          this.emit('session-terminated', {
            meeting_id: message.meeting_id,
            total_seconds: message.total_seconds,
          } as SessionTerminatedEvent);
          break;

        case 'error':
          this.emit('error', new Error(message.message || 'Server error'));
          break;

        case 'keepalive':
          // Server keepalive, no action needed
          break;

        default:
          if (message.error) {
            this.emit('error', new Error(message.error));
          }
          break;
      }
    } catch (err: any) {
      console.error('[AudioStreamer] Failed to parse message:', err.message);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   * Backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
   */
  private reconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[AudioStreamer] Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts++;

    console.log(`[AudioStreamer] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      if (!this.shouldReconnect) return;

      try {
        await this.connect();
      } catch (err: any) {
        console.error(`[AudioStreamer] Reconnection attempt ${this.reconnectAttempts} failed: ${err.message}`);
        // connect() resets reconnectAttempts on success, so we need to restore it for the next try
        this.reconnect();
      }
    }, delay);
  }
}
