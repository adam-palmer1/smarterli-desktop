import { BrowserWindow, screen } from "electron"
import path from "node:path"

const isDev = process.env.NODE_ENV === "development"

const startUrl = isDev
    ? "http://localhost:5180"
    : `file://${path.join(__dirname, "../dist/index.html")}`

export class LiveFeedbackWindowHelper {
    private feedbackWindow: BrowserWindow | null = null
    private contentProtection: boolean = false

    constructor() { }

    public getWindow(): BrowserWindow | null {
        return this.feedbackWindow
    }

    public toggle(x?: number, y?: number): void {
        if (this.feedbackWindow && !this.feedbackWindow.isDestroyed()) {
            if (this.feedbackWindow.isVisible()) {
                this.hide()
            } else {
                this.show(x, y)
            }
        } else {
            this.createWindow(x, y)
        }
    }

    public show(x?: number, y?: number): void {
        if (!this.feedbackWindow || this.feedbackWindow.isDestroyed()) {
            this.createWindow(x, y)
            return
        }

        if (x !== undefined && y !== undefined) {
            this.feedbackWindow.setPosition(Math.round(x), Math.round(y))
        }

        this.ensureVisibleOnScreen()
        this.feedbackWindow.show()
    }

    public hide(): void {
        if (this.feedbackWindow && !this.feedbackWindow.isDestroyed()) {
            this.feedbackWindow.hide()
        }
    }

    public close(): void {
        if (this.feedbackWindow && !this.feedbackWindow.isDestroyed()) {
            this.feedbackWindow.close()
            this.feedbackWindow = null
        }
    }

    public isVisible(): boolean {
        return !!(this.feedbackWindow && !this.feedbackWindow.isDestroyed() && this.feedbackWindow.isVisible())
    }

    public sendToken(token: string, isStart?: boolean): void {
        if (this.feedbackWindow && !this.feedbackWindow.isDestroyed()) {
            this.feedbackWindow.webContents.send('live-feedback-token', { token, isStart })
        }
    }

    public sendComplete(content: string): void {
        if (this.feedbackWindow && !this.feedbackWindow.isDestroyed()) {
            this.feedbackWindow.webContents.send('live-feedback-complete', { content })
        }
    }

    public sendThinking(topic: string): void {
        if (this.feedbackWindow && !this.feedbackWindow.isDestroyed()) {
            this.feedbackWindow.webContents.send('live-feedback-thinking', { topic })
        }
    }

    public sendError(error: string): void {
        if (this.feedbackWindow && !this.feedbackWindow.isDestroyed()) {
            this.feedbackWindow.webContents.send('live-feedback-error', { error })
        }
    }

    public setContentProtection(enable: boolean): void {
        this.contentProtection = enable

        if (this.feedbackWindow && !this.feedbackWindow.isDestroyed()) {
            this.feedbackWindow.setContentProtection(enable)
        }
    }

    private createWindow(x?: number, y?: number): void {
        const windowSettings: Electron.BrowserWindowConstructorOptions = {
            width: 380,
            height: 500,
            frame: false,
            transparent: true,
            resizable: true,
            fullscreenable: false,
            hasShadow: false,
            alwaysOnTop: true,
            backgroundColor: "#00000000",
            show: false,
            skipTaskbar: true,
            minWidth: 300,
            minHeight: 200,
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

        this.feedbackWindow = new BrowserWindow(windowSettings)

        if (process.platform === "darwin") {
            this.feedbackWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
            this.feedbackWindow.setHiddenInMissionControl(true)
            this.feedbackWindow.setAlwaysOnTop(true, "floating")
        }

        this.feedbackWindow.setContentProtection(this.contentProtection)

        const feedbackUrl = `${startUrl}?window=live-feedback`
        this.feedbackWindow.loadURL(feedbackUrl)

        this.feedbackWindow.once('ready-to-show', () => {
            this.feedbackWindow?.show()
        })
    }

    private ensureVisibleOnScreen(): void {
        if (!this.feedbackWindow) return
        const { x, y, width, height } = this.feedbackWindow.getBounds()
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

        this.feedbackWindow.setPosition(newX, newY)
    }
}
