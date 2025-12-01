import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clear loading fallback and render app with error handling
const rootElement = document.getElementById("root")!;

try {
  rootElement.innerHTML = '';
  createRoot(rootElement).render(<App />);
} catch (error) {
  console.error('Failed to initialize app:', error);
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, -apple-system, sans-serif;">
      <div style="text-align: center; padding: 2rem;">
        <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Failed to load application</h1>
        <p style="color: #666; margin-bottom: 1rem;">Please try refreshing the page.</p>
        <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; background: #000; color: #fff; border: none; border-radius: 0.25rem; cursor: pointer;">
          Refresh Page
        </button>
      </div>
    </div>
  `;
}
