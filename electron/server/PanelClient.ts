/**
 * PanelClient - WebSocket client for real-time panel updates.
 *
 * Connects to: WS /ws/panels/{session_id}?api_key=ck_...
 *
 * Server -> Client messages:
 *   { "type": "panel.token",    "panelId": str, "token": str }
 *   { "type": "panel.complete", "panelId": str, "content": str }
 *   { "type": "panel.error",    "panelId": str, "error": str }
 *   { "type": "panels.configured", "panel_ids": [str, ...] }
 *
 * Client -> Server messages:
 *   { "type": "panels.configure", "panel_ids": [str, ...] }
 *
 * Replaces the local PanelManager's direct LLM streaming with server-proxied
 * panel generation.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

export interface PanelTokenEvent {
  panelId: string;
  token: string;
  isStart?: boolean;
}

export interface PanelCompleteEvent {
  panelId: string;
  content: string;
}

export interface PanelErrorEvent {
  panelId: string;
  error: string;
}

export interface PanelClientEvents {
  'panel-token': (data: PanelTokenEvent) => void;
  'panel-complete': (data: PanelCompleteEvent) => void;
  'panel-error': (data: PanelErrorEvent) => void;
  'panels-configured': (panelIds: string[]) => void;
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: Error) => void;
}

export class PanelClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private apiKey: string;
  private sessionId: string;
  private shouldReconnect: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnected: boolean = false;

  // Store the last configured panel IDs for re-sending after reconnect
  private lastConfiguredPanelIds: string[] | null = null;

  constructor(serverUrl: string, apiKey: string, sessionId: string) {
    super();
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.sessionId = sessionId;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Open the WebSocket connection to the panels endpoint.
   */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.shouldReconnect = true;
      this.reconnectAttempts = 0;

      const wsUrl = this.buildWsUrl();
      console.log(`[PanelClient] Connecting to ${wsUrl}`);

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err: any) {
        reject(new Error(`Failed to create WebSocket: ${err.message}`));
        return;
      }

      const connectTimeout = setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Panel WebSocket connection timeout (30s)'));
          this.ws?.close();
        }
      }, 30000);

      this.ws.on('open', () => {
        console.log('[PanelClient] WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        clearTimeout(connectTimeout);
        this.emit('connected');

        // Re-send panel configuration if we had one before reconnect
        if (this.lastConfiguredPanelIds) {
          this.configurePanels(this.lastConfiguredPanelIds);
        }

        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (err: Error) => {
        console.error('[PanelClient] WebSocket error:', err.message);
        this.emit('error', err);
        if (!this.isConnected) {
          clearTimeout(connectTimeout);
          reject(err);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        console.log(`[PanelClient] WebSocket closed (code=${code}, reason=${reason.toString()})`);

        if (wasConnected) {
          this.emit('disconnected');
        }

        // Reconnect unless explicitly disconnected
        if (this.shouldReconnect && code !== 1000) {
          this.reconnect();
        }
      });
    });
  }

  /**
   * Send a panels.configure message to the server to set which panels are active.
   */
  configurePanels(panelIds: string[]): void {
    this.lastConfiguredPanelIds = panelIds;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[PanelClient] Cannot configure panels: WebSocket not connected');
      return;
    }

    const message = {
      type: 'panels.configure',
      panel_ids: panelIds,
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log(`[PanelClient] Configured panels: ${panelIds.join(', ')}`);
    } catch (err: any) {
      console.error('[PanelClient] Failed to send panels.configure:', err.message);
    }
  }

  /**
   * Gracefully disconnect the WebSocket.
   */
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Check if the client is currently connected.
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

    if (wsBase.startsWith('https://')) {
      wsBase = 'wss://' + wsBase.substring(8);
    } else if (wsBase.startsWith('http://')) {
      wsBase = 'ws://' + wsBase.substring(7);
    } else if (!wsBase.startsWith('ws://') && !wsBase.startsWith('wss://')) {
      wsBase = 'ws://' + wsBase;
    }

    return `${wsBase}/panels/ws/${this.sessionId}?api_key=${encodeURIComponent(this.apiKey)}`;
  }

  /**
   * Handle incoming WebSocket messages from the server.
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      const msgType = message.type;

      switch (msgType) {
        case 'panel.token':
          this.emit('panel-token', {
            panelId: message.panelId,
            token: message.token,
            isStart: message.isStart,
          } as PanelTokenEvent);
          break;

        case 'panel.complete':
          this.emit('panel-complete', {
            panelId: message.panelId,
            content: message.content,
          } as PanelCompleteEvent);
          break;

        case 'panel.error':
          this.emit('panel-error', {
            panelId: message.panelId,
            error: message.error,
          } as PanelErrorEvent);
          break;

        case 'panels.configured':
          this.emit('panels-configured', message.panel_ids || []);
          break;

        default:
          // Unknown message type
          if (message.error) {
            this.emit('error', new Error(message.error));
          }
          break;
      }
    } catch (err: any) {
      console.error('[PanelClient] Failed to parse message:', err.message);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  private reconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[PanelClient] Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts++;

    console.log(`[PanelClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      if (!this.shouldReconnect) return;

      try {
        await this.connect();
      } catch (err: any) {
        console.error(`[PanelClient] Reconnection attempt ${this.reconnectAttempts} failed: ${err.message}`);
        this.reconnect();
      }
    }, delay);
  }
}
