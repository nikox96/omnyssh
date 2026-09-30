import { writable } from 'svelte/store';

// Ctrl+C / Ctrl+V clipboard in the terminal (Windows and Linux): Ctrl+C copies when text
// is selected and is ^C otherwise, Ctrl+V pastes. On by default; turning it off gives the
// remote a literal ^V again (vim visual-block, bash quoted-insert). Ctrl+Shift+C/V work
// either way. The pref persists like the other UI-chrome prefs (tauri-plugin-store + a
// localStorage mirror for first paint), matching the streamer-mode shape.
const LOCAL_KEY = 'omnyssh-terminal-ctrl-clipboard';
const STORE_FILE = 'settings.json';
const STORE_KEY = 'terminalCtrlClipboard';

function mirrored(): boolean {
  try {
    return localStorage.getItem(LOCAL_KEY) !== 'false';
  } catch {
    return true; // localStorage unavailable: default to on.
  }
}

function mirrorLocal(on: boolean): void {
  try {
    localStorage.setItem(LOCAL_KEY, String(on));
  } catch {
    // localStorage unavailable (hardened webview): the store copy is canonical.
  }
}

async function persistStore(on: boolean): Promise<void> {
  try {
    const { load } = await import('@tauri-apps/plugin-store');
    const store = await load(STORE_FILE);
    await store.set(STORE_KEY, on);
    await store.save();
  } catch {
    // Not under Tauri (tests, vite preview): the localStorage mirror suffices.
  }
}

function createTerminalCtrlClipboard() {
  const initial = mirrored();
  const { subscribe, set: setStore } = writable<boolean>(initial);
  let current = initial;
  let interacted = false;

  function apply(on: boolean, user: boolean): void {
    current = on;
    setStore(on);
    mirrorLocal(on);
    if (user) {
      interacted = true;
      void persistStore(on);
    }
  }

  return {
    subscribe,
    set: (on: boolean) => apply(on, true),
    toggle: () => apply(!current, true),
    /** Reconcile with the canonical tauri-plugin-store value once Tauri is reachable. */
    async hydrate(): Promise<void> {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load(STORE_FILE);
        const saved = await store.get<boolean>(STORE_KEY);
        if (!interacted && typeof saved === 'boolean') apply(saved, false);
      } catch {
        // Store unreachable: keep the mirrored value.
      }
    }
  };
}

export const terminalCtrlClipboard = createTerminalCtrlClipboard();
