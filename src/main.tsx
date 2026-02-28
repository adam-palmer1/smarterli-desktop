import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

// Initialize Theme
// Overlay window is always dark mode; other windows follow system/user preference
const isOverlayWindow = new URLSearchParams(window.location.search).get('window') === 'overlay';

if (isOverlayWindow) {
  // Force dark mode by removing any light theme attribute
  document.documentElement.removeAttribute('data-theme');
} else if (window.electronAPI && window.electronAPI.getThemeMode) {
  window.electronAPI.getThemeMode().then(({ resolved }) => {
    document.documentElement.setAttribute('data-theme', resolved);
  });

  // Listen for changes
  window.electronAPI.onThemeChanged(({ resolved }) => {
    document.documentElement.setAttribute('data-theme', resolved);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
