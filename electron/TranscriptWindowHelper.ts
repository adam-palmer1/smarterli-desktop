import { BrowserWindow, screen } from "electron"
import path from "node:path"

const isDev = process.env.NODE_ENV === "development"

const startUrl = isDev
    ? "http://localhost:5180"
    : `file://${path.join(__dirname, "../dist/index.html")}`

export class TranscriptWindowHelper {
    private transcriptWindow: BrowserWindow | null = null

    private offsetX: number = 0
    private offsetY: number = 0
    private contentProtection: boolean = false

    constructor() { }

    public getWindow(): BrowserWindow | null {
        return this.transcriptWindow
    }

    public setWindowDimensions(win: BrowserWindow, width: number, height: number): void {
        if (!win || win.isDestroyed() || !win.isVisible()) return

        const currentBounds = win.getBounds()
        if (currentBounds.width === width && currentBounds.height === height) return

        win.setSize(width, height)
    }

    public preloadWindow(): void {
        if (!this.transcriptWindow || this.transcriptWindow.isDestroyed()) {
            this.createWindow(-10000, -10000, false)
        }
    }

    public toggle(x?: number, y?: number): void {
        if (this.transcriptWindow && !this.transcriptWindow.isDestroyed()) {
            if (this.transcriptWindow.isVisible()) {
                this.hide()
            } else {
                this.show(x, y)
            }
        } else {
            this.createWindow(x, y)
        }
    }

    public show(x?: number, y?: number): void {
        if (!this.transcriptWindow || this.transcriptWindow.isDestroyed()) {
            this.createWindow(x, y)
            return
        }

        if (x !== undefined && y !== undefined) {
            this.transcriptWindow.setPosition(Math.round(x), Math.round(y))
        }

        this.ensureVisibleOnScreen()
        this.transcriptWindow.show()
    }

    public hide(): void {
        if (this.transcriptWindow && !this.transcriptWindow.isDestroyed()) {
            this.transcriptWindow.hide()
        }
    }

    public close(): void {
        if (this.transcriptWindow && !this.transcriptWindow.isDestroyed()) {
            this.transcriptWindow.close()
            this.transcriptWindow = null
        }
    }

    public isVisible(): boolean {
        return !!(this.transcriptWindow && !this.transcriptWindow.isDestroyed() && this.transcriptWindow.isVisible())
    }

    public reposition(mainBounds: Electron.Rectangle): void {
        if (!this.transcriptWindow || !this.transcriptWindow.isVisible() || this.transcriptWindow.isDestroyed()) return

        const newX = mainBounds.x + this.offsetX
        const newY = mainBounds.y + mainBounds.height + this.offsetY

        this.transcriptWindow.setPosition(Math.round(newX), Math.round(newY))
    }

    /**
     * Sync visibility with overlay: hide when overlay hides, show when it shows.
     */
    public syncWithOverlay(visible: boolean): void {
        if (!this.transcriptWindow || this.transcriptWindow.isDestroyed()) return

        if (!visible) {
            this.hide()
        }
    }

    public sendTranscript(payload: { speaker: string; text: string; final: boolean; timestamp?: number; confidence?: number; person_id?: string; person_name?: string }): void {
        if (this.transcriptWindow && !this.transcriptWindow.isDestroyed()) {
            this.transcriptWindow.webContents.send('native-audio-transcript', payload)
        }
    }

    public setContentProtection(enable: boolean): void {
        this.contentProtection = enable

        if (this.transcriptWindow && !this.transcriptWindow.isDestroyed()) {
            this.transcriptWindow.setContentProtection(enable)
        }
    }

    private createWindow(x?: number, y?: number, showWhenReady: boolean = true): void {
        const windowSettings: Electron.BrowserWindowConstructorOptions = {
            width: 300,
            height: 420,
            frame: false,
            transparent: true,
            resizable: false,
            fullscreenable: false,
            hasShadow: false,
            alwaysOnTop: true,
            backgroundColor: "#00000000",
            show: false,
            skipTaskbar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "preload.js"),
                backgroundThrottling: false
            }
        }

        if (x !== undefined && y !== undefined) {
            windowSettings.x = Math.round(x)
            windowSettings.y = Math.round(y)
        }

        this.transcriptWindow = new BrowserWindow(windowSettings)

        if (process.platform === "darwin") {
            this.transcriptWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            this.transcriptWindow.setHiddenInMissionControl(true)
            this.transcriptWindow.setAlwaysOnTop(true, "floating")
        }

        this.transcriptWindow.setContentProtection(this.contentProtection)

        const transcriptUrl = isDev
            ? `${startUrl}?window=transcript`
            : `${startUrl}?window=transcript`

        this.transcriptWindow.loadURL(transcriptUrl)

        this.transcriptWindow.once('ready-to-show', () => {
            if (showWhenReady) {
                this.transcriptWindow?.show()
            }
        })

        // No blur-to-close — panel stays open until explicitly toggled
    }

    private ensureVisibleOnScreen(): void {
        if (!this.transcriptWindow) return
        const { x, y, width, height } = this.transcriptWindow.getBounds()
        const display = screen.getDisplayNearestPoint({ x, y })
        const bounds = display.workArea

        let newX = x
        let newY = y

        if (x + width > bounds.x + bounds.width) {
            newX = bounds.x + bounds.width - width
        }
        if (y + height > bounds.y + bounds.height) {
            newY = bounds.y + bounds.height - height
        }

        this.transcriptWindow.setPosition(newX, newY)
    }
}
