import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAccentColor, applyBackgroundColor, applyGlobalStyling, applyTerminalColors, applyTextColor } from './applyTheme';

const setProperty = vi.fn();
const setAttribute = vi.fn();
const dispatchEvent = vi.fn();

beforeEach(() => {
  vi.stubGlobal('document', {
    documentElement: { style: { setProperty }, setAttribute },
  });
  vi.stubGlobal('window', { dispatchEvent });
  setProperty.mockClear();
  setAttribute.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyAccentColor', () => {
  it('sets accent CSS variables from hex', () => {
    applyAccentColor('#4a90e2');
    expect(setProperty).toHaveBeenCalledWith('--accent', '#4a90e2');
    expect(setProperty).toHaveBeenCalledWith(expect.stringContaining('accent-hover'), expect.any(String));
    expect(setProperty).toHaveBeenCalledWith('--accent-subtle', expect.stringContaining('rgba'));
    expect(setProperty).toHaveBeenCalledWith('--terminal-cursor', '#4a90e2');
  });
});

describe('applyBackgroundColor', () => {
  it('sets bg and border CSS variables', () => {
    applyBackgroundColor('#1a1a2e');
    expect(setProperty).toHaveBeenCalledWith('--bg-base', '#1a1a2e');
    expect(setProperty).toHaveBeenCalledWith(expect.stringContaining('bg-elevated'), expect.any(String));
    expect(setProperty).toHaveBeenCalledWith(expect.stringContaining('border-subtle'), expect.any(String));
  });
});

describe('applyTextColor', () => {
  it('sets text CSS variables', () => {
    applyTextColor('#ffffff', '#1a1a2e');
    expect(setProperty).toHaveBeenCalledWith('--text-primary', '#ffffff');
    expect(setProperty).toHaveBeenCalledWith(expect.stringContaining('text-secondary'), expect.any(String));
    expect(setProperty).toHaveBeenCalledWith(expect.stringContaining('text-muted'), expect.any(String));
  });
});

describe('applyTerminalColors', () => {
  const baseTheme = { id: 'dark', colors: {}, terminal: {} } as any;

  it('skips unset color keys', () => {
    applyTerminalColors({}, baseTheme);
    expect(setProperty).not.toHaveBeenCalled();
  });

  it('sets red and bright-red when red provided', () => {
    applyTerminalColors({ red: '#ff0000' }, baseTheme);
    expect(setProperty).toHaveBeenCalledWith('--terminal-red', '#ff0000');
    expect(setProperty).toHaveBeenCalledWith('--terminal-bright-red', expect.any(String));
  });

  it('sets all color channels when all provided', () => {
    applyTerminalColors({
      red: '#f00', green: '#0f0', yellow: '#ff0',
      blue: '#00f', magenta: '#f0f', cyan: '#0ff',
      white: '#fff', black: '#000',
    }, baseTheme);
    expect(setProperty).toHaveBeenCalledWith('--terminal-green', '#0f0');
    expect(setProperty).toHaveBeenCalledWith('--terminal-cyan', '#0ff');
  });
});

describe('applyGlobalStyling', () => {
  it('sets codex-blue and glow variables', () => {
    applyGlobalStyling('#ccff00', true);
    expect(setProperty).toHaveBeenCalledWith('--codex-blue', '#ccff00');
    expect(setProperty).toHaveBeenCalledWith('--codex-glow', expect.stringContaining('rgba'));
  });

  it('sets glow to transparent when disabled', () => {
    applyGlobalStyling('#ccff00', false);
    expect(setProperty).toHaveBeenCalledWith('--codex-glow', 'transparent');
  });
});
