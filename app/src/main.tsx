import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Si le stockage local est bloqué (navigation privée, aperçu), on bascule sur une mémoire temporaire.
try { localStorage.setItem('aq.test', '1'); localStorage.removeItem('aq.test'); } catch {
  const mem = new Map<string, string>();
  const shim = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
  try { Object.defineProperty(window, 'localStorage', { value: shim }); Object.defineProperty(window, 'sessionStorage', { value: shim }); } catch { /* rien */ }
}

// Demande au navigateur de ne pas effacer les données locales (Android libère parfois l'espace).
navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
