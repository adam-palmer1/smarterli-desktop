/**
 * CredentialsManager - Secure storage for server credentials and local preferences
 * Uses Electron's safeStorage API for encryption at rest
 */

import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
export interface PanelConfig {
    id: string;
    name: string;
    icon: string;
    systemPrompt: string;
    instruction: string;
    isBuiltIn: boolean;
    color: string;
}

const CREDENTIALS_PATH = path.join(app.getPath('userData'), 'credentials.enc');

export interface StoredCredentials {
    serverUrl?: string;          // e.g., "https://app.smarter.li"
    apiKey?: string;             // ck_... API key for server auth
    accessToken?: string;        // JWT (cached)
    refreshToken?: string;       // JWT refresh
    // Local-only preferences:
    activePanelIds?: string[];
    customPanels?: PanelConfig[];
}

export class CredentialsManager {
    private static instance: CredentialsManager;
    private credentials: StoredCredentials = {};

    private constructor() {
        // Load on construction after app ready
    }

    public static getInstance(): CredentialsManager {
        if (!CredentialsManager.instance) {
            CredentialsManager.instance = new CredentialsManager();
        }
        return CredentialsManager.instance;
    }

    /**
     * Initialize - load credentials from disk
     * Must be called after app.whenReady()
     */
    public init(): void {
        this.loadCredentials();
        console.log('[CredentialsManager] Initialized');
    }

    // =========================================================================
    // Server Credentials
    // =========================================================================

    public getServerUrl(): string | undefined {
        return this.credentials.serverUrl;
    }

    public setServerUrl(url: string): void {
        this.credentials.serverUrl = url;
        this.saveCredentials();
        console.log('[CredentialsManager] Server URL updated');
    }

    public getApiKey(): string | undefined {
        return this.credentials.apiKey;
    }

    public setApiKey(key: string): void {
        this.credentials.apiKey = key;
        this.saveCredentials();
        console.log('[CredentialsManager] API Key updated');
    }

    public getAccessToken(): string | undefined {
        return this.credentials.accessToken;
    }

    public setAccessToken(token: string): void {
        this.credentials.accessToken = token;
        this.saveCredentials();
        console.log('[CredentialsManager] Access token updated');
    }

    public getRefreshToken(): string | undefined {
        return this.credentials.refreshToken;
    }

    public setRefreshToken(token: string): void {
        this.credentials.refreshToken = token;
        this.saveCredentials();
        console.log('[CredentialsManager] Refresh token updated');
    }

    public getAllCredentials(): StoredCredentials {
        return { ...this.credentials };
    }

    // =========================================================================
    // Panel Management
    // =========================================================================

    public getCustomPanels(): PanelConfig[] {
        return this.credentials.customPanels || [];
    }

    public saveCustomPanel(panel: PanelConfig): void {
        if (!this.credentials.customPanels) {
            this.credentials.customPanels = [];
        }
        const index = this.credentials.customPanels.findIndex(p => p.id === panel.id);
        if (index !== -1) {
            this.credentials.customPanels[index] = panel;
        } else {
            this.credentials.customPanels.push(panel);
        }
        this.saveCredentials();
        console.log(`[CredentialsManager] Custom Panel '${panel.name}' saved`);
    }

    public deleteCustomPanel(id: string): void {
        if (!this.credentials.customPanels) return;
        this.credentials.customPanels = this.credentials.customPanels.filter(p => p.id !== id);
        this.saveCredentials();
        console.log(`[CredentialsManager] Custom Panel '${id}' deleted`);
    }

    public getActivePanelIds(): string[] {
        return this.credentials.activePanelIds || [];
    }

    public setActivePanelIds(ids: string[]): void {
        this.credentials.activePanelIds = ids;
        this.saveCredentials();
        console.log(`[CredentialsManager] Active panel IDs updated: ${ids.join(', ')}`);
    }

    public clearAll(): void {
        this.credentials = {};
        if (fs.existsSync(CREDENTIALS_PATH)) {
            fs.unlinkSync(CREDENTIALS_PATH);
        }
        console.log('[CredentialsManager] All credentials cleared');
    }

    // =========================================================================
    // Storage (Encrypted)
    // =========================================================================

    private saveCredentials(): void {
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                console.error('[CredentialsManager] Encryption not available — credentials will NOT be saved to disk');
                return;
            }

            const data = JSON.stringify(this.credentials);
            const encrypted = safeStorage.encryptString(data);
            fs.writeFileSync(CREDENTIALS_PATH, encrypted);
        } catch (error) {
            console.error('[CredentialsManager] Failed to save credentials:', error);
        }
    }

    private loadCredentials(): void {
        try {
            // Try encrypted file first
            if (fs.existsSync(CREDENTIALS_PATH)) {
                if (!safeStorage.isEncryptionAvailable()) {
                    console.warn('[CredentialsManager] Encryption not available for load');
                    return;
                }

                const encrypted = fs.readFileSync(CREDENTIALS_PATH);
                const decrypted = safeStorage.decryptString(encrypted);
                this.credentials = JSON.parse(decrypted);
                console.log('[CredentialsManager] Loaded encrypted credentials');
                return;
            }

            // Migration: load plaintext file, re-save encrypted, then delete plaintext
            const plaintextPath = CREDENTIALS_PATH + '.json';
            if (fs.existsSync(plaintextPath)) {
                const data = fs.readFileSync(plaintextPath, 'utf-8');
                this.credentials = JSON.parse(data);
                console.warn('[CredentialsManager] Migrating plaintext credentials to encrypted storage');

                // Attempt to re-save as encrypted
                if (safeStorage.isEncryptionAvailable()) {
                    this.saveCredentials();
                    // Delete plaintext file after successful migration
                    try {
                        fs.unlinkSync(plaintextPath);
                        console.log('[CredentialsManager] Deleted plaintext credentials file after migration');
                    } catch (unlinkErr) {
                        console.warn('[CredentialsManager] Failed to delete plaintext file:', unlinkErr);
                    }
                }
                return;
            }

            console.log('[CredentialsManager] No stored credentials found');
        } catch (error) {
            console.error('[CredentialsManager] Failed to load credentials:', error);
            this.credentials = {};
        }
    }
}
