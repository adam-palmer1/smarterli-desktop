/**
 * IntelligenceClient - SSE client for intelligence mode streaming.
 *
 * Communicates with the server's intelligence endpoints which return
 * Server-Sent Events (SSE) with format:
 *   event: token\ndata: <token_text>\n\n
 *   event: done\ndata: \n\n
 *   event: error\ndata: <error_message>\n\n
 *
 * Each method streams tokens via events and returns the full assembled response.
 *
 * For image-based requests, reads the file as base64 and includes it in
 * the request body as `image_base64`.
 */

import { EventEmitter } from 'events';
import fs from 'fs';

const DEBUG_NET = process.env.SMARTERLI_DEBUG_NET === '1';

export interface IntelligenceTokenEvent {
  mode: string;
  token: string;
}

export interface IntelligenceDoneEvent {
  mode: string;
  fullResponse: string;
}

export interface IntelligenceErrorEvent {
  mode: string;
  error: string;
}

export interface IntelligenceClientEvents {
  'token': (data: IntelligenceTokenEvent) => void;
  'done': (data: IntelligenceDoneEvent) => void;
  'error': (data: IntelligenceErrorEvent) => void;
}

export class IntelligenceClient extends EventEmitter {
  private serverUrl: string;
  private apiKey: string;
  private activeAbortController: AbortController | null = null;

  constructor(serverUrl: string, apiKey: string) {
    super();
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  // =========================================================================
  // Public Streaming Methods
  // =========================================================================

  /**
   * Stream "What to Say" suggestions based on current session context.
   * Optionally includes a screenshot for visual context.
   */
  async streamWhatToSay(sessionId: string, imagePath?: string, model?: string): Promise<string> {
    const body: any = {};
    if (imagePath) {
      body.image_base64 = await this.readFileAsBase64(imagePath);
    }
    if (model) {
      body.model = model;
    }
    return this.streamSSE(sessionId, 'what-to-say', body);
  }

  /**
   * Stream a follow-up refinement on the last assistant response.
   */
  async streamFollowUp(sessionId: string, intent: string, userRequest?: string): Promise<string> {
    const body: any = { intent };
    if (userRequest) {
      body.user_request = userRequest;
    }
    return this.streamSSE(sessionId, 'follow-up', body);
  }

  /**
   * Stream a recap/summary of the current session.
   */
  async streamRecap(sessionId: string): Promise<string> {
    return this.streamSSE(sessionId, 'recap');
  }

  /**
   * Stream follow-up question suggestions.
   */
  async streamFollowUpQuestions(sessionId: string): Promise<string> {
    return this.streamSSE(sessionId, 'follow-up-questions');
  }

  /**
   * Stream a free-form chat response.
   * Optionally includes a screenshot for visual context.
   */
  async streamChat(sessionId: string, message: string, imagePath?: string): Promise<string> {
    const body: any = { message };
    if (imagePath) {
      body.image_base64 = await this.readFileAsBase64(imagePath);
    }
    return this.streamSSE(sessionId, 'chat', body);
  }

  /**
   * Stream passive assist insights.
   */
  async streamAssist(sessionId: string): Promise<string> {
    return this.streamSSE(sessionId, 'assist');
  }

  /**
   * Cancel the currently active streaming request.
   */
  cancel(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  // =========================================================================
  // Private SSE Implementation
  // =========================================================================

  /**
   * Generic SSE consumer. Makes a POST request to the intelligence endpoint
   * and parses the SSE stream, emitting 'token' events for each token received.
   *
   * @param sessionId - The active session ID
   * @param mode - The intelligence mode (maps to endpoint path)
   * @param body - Optional request body
   * @returns The full assembled response string
   */
  private async streamSSE(sessionId: string, mode: string, body?: any): Promise<string> {
    // Cancel any previous active stream
    this.cancel();

    const abortController = new AbortController();
    this.activeAbortController = abortController;

    const url = `${this.serverUrl}/intelligence/${sessionId}/${mode}`;

    if (DEBUG_NET) {
      console.log(`[NET] → SSE POST ${url}${body ? ' ' + JSON.stringify(body).substring(0, 200) : ''}`);
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : JSON.stringify({}),
        signal: abortController.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return '';
      }
      const errorMsg = `Network error: ${err.message}`;
      if (DEBUG_NET) console.log(`[NET] ✗ SSE ${url} — ${errorMsg}`);
      this.emit('error', { mode, error: errorMsg } as IntelligenceErrorEvent);
      throw new Error(errorMsg);
    }

    if (DEBUG_NET) {
      console.log(`[NET] ← SSE ${url} ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      let errorDetail: string;
      try {
        const errorBody = await response.json();
        errorDetail = errorBody.detail || JSON.stringify(errorBody);
      } catch {
        errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      }
      if (DEBUG_NET) console.log(`[NET] ✗ SSE ${url} — ${errorDetail}`);
      this.emit('error', { mode, error: errorDetail } as IntelligenceErrorEvent);
      throw new Error(errorDetail);
    }

    if (!response.body) {
      const errorMsg = 'Response has no body';
      this.emit('error', { mode, error: errorMsg } as IntelligenceErrorEvent);
      throw new Error(errorMsg);
    }

    // Parse the SSE stream
    let fullResponse = '';

    try {
      fullResponse = await this.parseSSEStream(response.body, mode, abortController.signal);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return fullResponse;
      }
      throw err;
    } finally {
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null;
      }
    }

    this.emit('done', { mode, fullResponse } as IntelligenceDoneEvent);
    return fullResponse;
  }

  /**
   * Parse an SSE stream from a ReadableStream, emitting token events.
   *
   * SSE format:
   *   event: token
   *   data: <token_text>
   *
   *   event: done
   *   data:
   *
   *   event: error
   *   data: <error_message>
   */
  private async parseSSEStream(
    body: ReadableStream<Uint8Array>,
    mode: string,
    signal: AbortSignal,
  ): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    try {
      while (true) {
        if (signal.aborted) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by double newlines)
        const events = buffer.split('\n\n');
        // Keep the last potentially incomplete chunk in the buffer
        buffer = events.pop() || '';

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;

          const parsed = this.parseSSEEvent(eventBlock);
          if (!parsed) continue;

          switch (parsed.event) {
            case 'token': {
              // Unescape newlines that were escaped for SSE transport
              const token = parsed.data.replace(/\\n/g, '\n');
              fullResponse += token;
              this.emit('token', { mode, token } as IntelligenceTokenEvent);
              break;
            }

            case 'done':
              // Stream complete
              return fullResponse;

            case 'error': {
              const errorMsg = parsed.data || 'Unknown server error';
              this.emit('error', { mode, error: errorMsg } as IntelligenceErrorEvent);
              throw new Error(errorMsg);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullResponse;
  }

  /**
   * Parse a single SSE event block into event name and data.
   *
   * Input format:
   *   event: token
   *   data: Hello world
   *
   * Returns: { event: 'token', data: 'Hello world' }
   */
  private parseSSEEvent(block: string): { event: string; data: string } | null {
    let eventName = '';
    let dataLines: string[] = [];

    const lines = block.split('\n');
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        // SSE spec: skip exactly one optional space after "data:"
        const rest = line.substring(5);
        dataLines.push(rest.startsWith(' ') ? rest.substring(1) : rest);
      }
      // Ignore lines starting with ':' (comments) or other fields
    }

    if (!eventName && dataLines.length === 0) {
      return null;
    }

    return {
      event: eventName || 'message',
      data: dataLines.join('\n'),
    };
  }

  /**
   * Read a file from disk and encode it as base64.
   */
  private async readFileAsBase64(filePath: string): Promise<string> {
    try {
      const data = await fs.promises.readFile(filePath);
      return data.toString('base64');
    } catch (err: any) {
      console.error(`[IntelligenceClient] Failed to read image file: ${err.message}`);
      throw new Error(`Failed to read image file: ${err.message}`);
    }
  }
}
