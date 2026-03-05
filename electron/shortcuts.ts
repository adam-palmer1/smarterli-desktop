import { globalShortcut, app, BrowserWindow } from "electron"
import { AppState } from "./main" // Adjust the import path if necessary

export class ShortcutsHelper {
  private appState: AppState

  constructor(appState: AppState) {
    this.appState = appState
  }

  public registerGlobalShortcuts(): void {
    // Add global shortcut to show/center window
    globalShortcut.register("CommandOrControl+Shift+Space", () => {
      this.appState.centerAndShowWindow()
    })

    // Toggle DevTools on the focused window
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      const focused = BrowserWindow.getFocusedWindow()
      if (focused && !focused.isDestroyed()) {
        focused.webContents.toggleDevTools()
      }
    })

    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}
