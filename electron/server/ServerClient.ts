/**
 * ServerClient - Central REST client replacing direct LLM/STT/DB calls with server proxies.
 *
 * Handles authentication (JWT + API key), meetings CRUD, billing, health checks,
 * and model listing via the Smarter.li server API.
 *
 * Auth header format:
 *   API key:  Authorization: Bearer ck_...
 *   JWT:      Authorization: Bearer <jwt_token>
 */

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface BalanceResponse {
  balance_minutes: number;
  updated_at?: string;
}

export interface PlanInfo {
  id: string;
  name: string;
  monthly_price_cents: number;
  monthly_credit_allowance: number;
  allowed_models?: Record<string, any>;
  feature_flags?: Record<string, any>;
}

export interface UsageItem {
  date: string;
  minutes_used: number;
  type: string;
}

export interface MeetingListItem {
  id: string;
  title: string | null;
  start_time: string;
  duration_ms: number | null;
  source: string | null;
  is_processed: boolean;
  transcript_count: number;
}

export interface MeetingDetail {
  id: string;
  title: string | null;
  start_time: string;
  duration_ms: number | null;
  summary_json: any | null;
  calendar_event_id: string | null;
  source: string | null;
  is_processed: boolean;
  speaker_mappings_json: any | null;
  transcripts: Array<{
    id: number;
    speaker: string;
    content: string;
    timestamp_ms: number;
    is_final: boolean;
    confidence: number | null;
  }>;
  ai_interactions: Array<{
    id: number;
    type: string;
    timestamp_ms: number;
    user_query: string | null;
    ai_response: string | null;
    model_used: string | null;
  }>;
}

export interface HealthResponse {
  status: string;
}

export interface UserInfo {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_admin: boolean;
}

export class ServerClientError extends Error {
  public statusCode: number;
  public responseBody: any;

  constructor(message: string, statusCode: number, responseBody?: any) {
    super(message);
    this.name = 'ServerClientError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class ServerClient {
  private baseUrl: string;
  private apiKey: string | null;
  private accessToken: string | null;
  private refreshToken: string | null;

  constructor(baseUrl: string, apiKey?: string, accessToken?: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey || null;
    this.accessToken = accessToken || null;
    this.refreshToken = null;
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  public setApiKey(key: string): void {
    this.apiKey = key;
  }

  public setAccessToken(token: string): void {
    this.accessToken = token;
  }

  public setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getApiKey(): string | null {
    return this.apiKey;
  }

  // =========================================================================
  // Auth
  // =========================================================================

  /**
   * Login with email and password. Returns JWT tokens.
   * Automatically stores the access and refresh tokens.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const result = await this.request('POST', '/auth/login', { email, password }, false);
    this.accessToken = result.access_token;
    this.refreshToken = result.refresh_token;
    return result;
  }

  /**
   * Register a new account. Returns JWT tokens.
   */
  async register(email: string, password: string, displayName?: string): Promise<RegisterResponse> {
    const body: any = { email, password };
    if (displayName) {
      body.display_name = displayName;
    }
    const result = await this.request('POST', '/auth/register', body, false);
    this.accessToken = result.access_token;
    this.refreshToken = result.refresh_token;
    return result;
  }

  /**
   * Refresh the access token using a refresh token.
   * Automatically updates stored tokens.
   */
  async refresh(refreshToken?: string): Promise<RefreshResponse> {
    const token = refreshToken || this.refreshToken;
    if (!token) {
      throw new ServerClientError('No refresh token available', 0);
    }
    const result = await this.request('POST', '/auth/refresh', { refresh_token: token }, false);
    this.accessToken = result.access_token;
    this.refreshToken = result.refresh_token;
    return result;
  }

  /**
   * Logout by clearing stored tokens.
   * (Server is stateless JWT, so no server-side logout endpoint needed.)
   */
  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Get the current authenticated user's info.
   * Useful for validating an API key or JWT is working.
   */
  async validateApiKey(key?: string): Promise<UserInfo> {
    // Temporarily use the provided key if given
    const prevKey = this.apiKey;
    const prevToken = this.accessToken;
    if (key) {
      this.apiKey = key;
      this.accessToken = null;
    }
    try {
      return await this.request('GET', '/auth/me');
    } finally {
      if (key) {
        this.apiKey = prevKey;
        this.accessToken = prevToken;
      }
    }
  }

  /**
   * Get current user info.
   */
  async getMe(): Promise<UserInfo> {
    return await this.request('GET', '/auth/me');
  }

  // =========================================================================
  // Meetings
  // =========================================================================

  /**
   * Get list of recent meetings.
   */
  async getMeetings(limit: number = 50, offset: number = 0): Promise<MeetingListItem[]> {
    return await this.request('GET', `/meetings?limit=${limit}&offset=${offset}`);
  }

  /**
   * Get full meeting detail including transcripts and AI interactions.
   */
  async getMeeting(id: string): Promise<MeetingDetail> {
    return await this.request('GET', `/meetings/${id}`);
  }

  /**
   * Update a meeting's title.
   */
  async updateMeetingTitle(id: string, title: string): Promise<boolean> {
    try {
      await this.request('PUT', `/meetings/${id}`, { title });
      return true;
    } catch (err) {
      console.error(`[ServerClient] Failed to update meeting title: ${err}`);
      return false;
    }
  }

  /**
   * Update a meeting's summary data.
   */
  async updateMeetingSummary(id: string, updates: any): Promise<boolean> {
    try {
      await this.request('PUT', `/meetings/${id}`, { summary_json: updates });
      return true;
    } catch (err) {
      console.error(`[ServerClient] Failed to update meeting summary: ${err}`);
      return false;
    }
  }

  /**
   * Delete a meeting by ID.
   */
  async deleteMeeting(id: string): Promise<boolean> {
    try {
      await this.request('DELETE', `/meetings/${id}`);
      return true;
    } catch (err) {
      console.error(`[ServerClient] Failed to delete meeting: ${err}`);
      return false;
    }
  }

  /**
   * Import meetings from local database to server.
   */
  async importMeetings(items: Array<{
    title?: string;
    start_time?: string;
    duration_ms?: number;
    summary_json?: any;
    source?: string;
    transcripts?: Array<{ speaker: string; text: string; timestamp: number }>;
  }>): Promise<{ imported: number }> {
    return await this.request('POST', '/meetings/import', items);
  }

  // =========================================================================
  // Billing
  // =========================================================================

  /**
   * Get current credit balance.
   */
  async getBalance(): Promise<BalanceResponse> {
    return await this.request('GET', '/billing/balance');
  }

  /**
   * Get current plan and subscription info.
   */
  async getPlan(): Promise<any> {
    return await this.request('GET', '/billing/plan');
  }

  /**
   * Get usage history for the given number of days.
   */
  async getUsage(days: number = 30): Promise<UsageItem[]> {
    return await this.request('GET', `/billing/usage?days=${days}`);
  }

  /**
   * List all available plans.
   */
  async getPlans(): Promise<PlanInfo[]> {
    return await this.request('GET', '/billing/plans');
  }

  // =========================================================================
  // Health
  // =========================================================================

  /**
   * Check server health.
   */
  async healthCheck(): Promise<HealthResponse> {
    return await this.request('GET', '/health', undefined, false);
  }

  // =========================================================================
  // Models
  // =========================================================================

  /**
   * Get available AI models for the current user/plan.
   */
  async getAvailableModels(): Promise<any[]> {
    try {
      // The server may expose this through the plan's allowed_models
      const planData = await this.getPlan();
      if (planData?.plan?.allowed_models) {
        return Object.entries(planData.plan.allowed_models).map(([id, config]) => ({
          id,
          ...(typeof config === 'object' ? config : {}),
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  // =========================================================================
  // API Keys Management
  // =========================================================================

  /**
   * Create a new API key.
   */
  async createApiKey(name: string = 'Default'): Promise<{ id: string; key_prefix: string; name: string; raw_key: string }> {
    return await this.request('POST', '/auth/api-keys', { name });
  }

  /**
   * List all API keys for the current user.
   */
  async listApiKeys(): Promise<Array<{ id: string; key_prefix: string; name: string; created_at: string; last_used_at: string | null }>> {
    return await this.request('GET', '/auth/api-keys');
  }

  /**
   * Revoke (delete) an API key.
   */
  async revokeApiKey(keyId: string): Promise<boolean> {
    try {
      await this.request('DELETE', `/auth/api-keys/${keyId}`);
      return true;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // Private HTTP Helpers
  // =========================================================================

  /**
   * Build the Authorization header based on available credentials.
   * API key takes precedence if both are available.
   */
  private getAuthHeader(): Record<string, string> {
    if (this.apiKey) {
      return { Authorization: `Bearer ${this.apiKey}` };
    }
    if (this.accessToken) {
      return { Authorization: `Bearer ${this.accessToken}` };
    }
    return {};
  }

  /**
   * Make an authenticated HTTP request to the server.
   *
   * @param method - HTTP method
   * @param path - URL path (relative to baseUrl)
   * @param body - Optional request body (will be JSON-serialized)
   * @param authenticated - Whether to include auth headers (default: true)
   * @returns Parsed JSON response
   * @throws ServerClientError on non-2xx responses
   */
  private async request(
    method: string,
    path: string,
    body?: any,
    authenticated: boolean = true,
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (authenticated) {
      const authHeaders = this.getAuthHeader();
      Object.assign(headers, authHeaders);
    }

    const init: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err: any) {
      throw new ServerClientError(
        `Network error connecting to ${url}: ${err.message}`,
        0,
      );
    }

    // Handle 204 No Content (e.g., DELETE responses)
    if (response.status === 204) {
      return null;
    }

    // Try to parse response body
    let responseBody: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }
    } else {
      responseBody = await response.text();
    }

    if (!response.ok) {
      const detail = responseBody?.detail || responseBody || response.statusText;
      throw new ServerClientError(
        `HTTP ${response.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
        response.status,
        responseBody,
      );
    }

    return responseBody;
  }
}
