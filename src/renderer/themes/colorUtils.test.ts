import { describe, expect, it } from 'vitest';
import {
  adjustBrightness,
  deriveBackgroundColors,
  deriveBrightColor,
  deriveTextColors,
  generateAccentColors,
  hexToRgb,
  isLightColor,
  rgbToHex,
} from './colorUtils';

describe('hexToRgb', () => {
  it('parses black', () => expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 }));
  it('parses white', () => expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 }));
  it('parses mid-range', () => expect(hexToRgb('#1a2b3c')).toEqual({ r: 26, g: 43, b: 60 }));
});

describe('rgbToHex', () => {
  it('converts black', () => expect(rgbToHex(0, 0, 0)).toBe('#000000'));
  it('converts white', () => expect(rgbToHex(255, 255, 255)).toBe('#ffffff'));
  it('rounds fractional values', () => expect(rgbToHex(0.4, 0.6, 1.4)).toBe('#000101'));
  it('round-trips hex→rgb→hex', () => {
    const hex = '#4a90e2';
    const { r, g, b } = hexToRgb(hex);
    expect(rgbToHex(r, g, b)).toBe(hex);
  });
});

describe('adjustBrightness', () => {
  it('darkens with negative amount', () => {
    const result = adjustBrightness('#ffffff', -50);
    const { r } = hexToRgb(result);
    expect(r).toBeLessThan(255);
  });
  it('lightens with positive amount', () => {
    const result = adjustBrightness('#000000', 50);
    const { r } = hexToRgb(result);
    expect(r).toBeGreaterThan(0);
  });
  it('clamps to 0 at -100 from black', () => {
    expect(adjustBrightness('#000000', -100)).toBe('#000000');
  });
  it('clamps to 255 at +100 from white', () => {
    expect(adjustBrightness('#ffffff', 100)).toBe('#ffffff');
  });
  it('zero amount is identity', () => {
    expect(adjustBrightness('#4a90e2', 0)).toBe('#4a90e2');
  });
});

describe('isLightColor', () => {
  it('white is light', () => expect(isLightColor('#ffffff')).toBe(true));
  it('black is dark', () => expect(isLightColor('#000000')).toBe(false));
  it('yellow is light', () => expect(isLightColor('#ffff00')).toBe(true));
  it('dark blue is dark', () => expect(isLightColor('#00008b')).toBe(false));
});

describe('deriveBackgroundColors', () => {
  it('returns 8 keys', () => {
    const result = deriveBackgroundColors('#1a1a2e', false);
    expect(Object.keys(result)).toHaveLength(8);
    expect(result.bgBase).toBe('#1a1a2e');
  });
  it('dark background uses rgba(255,...) borders', () => {
    const result = deriveBackgroundColors('#1a1a2e', false);
    expect(result.borderSubtle).toContain('255, 255, 255');
  });
  it('light background uses rgba(0,...) borders', () => {
    const result = deriveBackgroundColors('#f5f5f5', true);
    expect(result.borderSubtle).toContain('0, 0, 0');
  });
});

describe('deriveTextColors', () => {
  it('returns 4 keys including textPrimary', () => {
    const result = deriveTextColors('#ffffff', '#1a1a2e');
    expect(result.textPrimary).toBe('#ffffff');
    expect(Object.keys(result)).toHaveLength(4);
  });
  it('works on light background', () => {
    const result = deriveTextColors('#000000', '#ffffff');
    expect(result.textPrimary).toBe('#000000');
  });
});

describe('deriveBrightColor', () => {
  it('lightens a dark color', () => {
    const result = deriveBrightColor('#333333');
    const { r } = hexToRgb(result);
    expect(r).toBeGreaterThan(0x33);
  });
});

describe('generateAccentColors', () => {
  it('returns accent = input hex', () => {
    const result = generateAccentColors('#4a90e2');
    expect(result.accent).toBe('#4a90e2');
  });
  it('accentSubtle is rgba with 0.15 alpha', () => {
    const result = generateAccentColors('#4a90e2');
    expect(result.accentSubtle).toMatch(/rgba\(\d+, \d+, \d+, 0\.15\)/);
  });
  it('accentGlow is rgba with 0.4 alpha', () => {
    const result = generateAccentColors('#ff0000');
    expect(result.accentGlow).toBe('rgba(255, 0, 0, 0.4)');
  });
  it('accentHover is lighter than base', () => {
    const { accentHover } = generateAccentColors('#000000');
    const { r } = hexToRgb(accentHover);
    expect(r).toBeGreaterThan(0);
  });
});
