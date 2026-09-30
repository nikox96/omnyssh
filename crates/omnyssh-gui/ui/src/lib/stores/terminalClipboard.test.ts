// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

// Same shape as the streamer-mode pref: a fake Tauri store, a fresh module per test to
// reset the singleton, and the localStorage mirror seeding the initial value.
const backend = { get: vi.fn(), set: vi.fn(), save: vi.fn() };
vi.mock('@tauri-apps/plugin-store', () => ({ load: vi.fn(async () => backend) }));

async function fresh() {
  vi.resetModules();
  return (await import('./terminalClipboard')).terminalCtrlClipboard;
}

describe('terminal Ctrl clipboard pref', () => {
  beforeEach(() => {
    localStorage.clear();
    backend.get.mockReset();
    backend.set.mockReset().mockResolvedValue(undefined);
    backend.save.mockReset().mockResolvedValue(undefined);
  });

  it('defaults to on and mirrors a toggle to localStorage', async () => {
    const pref = await fresh();
    expect(get(pref)).toBe(true);
    pref.toggle();
    expect(get(pref)).toBe(false);
    expect(localStorage.getItem('omnyssh-terminal-ctrl-clipboard')).toBe('false');
  });

  it('starts off when the mirror says so', async () => {
    localStorage.setItem('omnyssh-terminal-ctrl-clipboard', 'false');
    expect(get(await fresh())).toBe(false);
  });

  it('writes the canonical tauri-plugin-store on a user flip', async () => {
    const pref = await fresh();
    pref.set(false);
    await vi.waitFor(() => {
      expect(backend.set).toHaveBeenCalledWith('terminalCtrlClipboard', false);
      expect(backend.save).toHaveBeenCalled();
    });
  });

  it('hydrate applies the stored value without clobbering a fresh user flip', async () => {
    backend.get.mockResolvedValue(true); // stale persisted value
    const pref = await fresh();
    pref.set(false); // user acts before hydrate resolves
    await pref.hydrate();
    expect(get(pref)).toBe(false);
  });

  it('hydrate applies the stored value when the user has not acted', async () => {
    backend.get.mockResolvedValue(false);
    const pref = await fresh();
    await pref.hydrate();
    expect(get(pref)).toBe(false);
  });
});
