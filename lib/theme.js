// Central design tokens. Screens read sizes through the SettingsContext's
// `scale()` helper (see context/SettingsContext.js) rather than importing
// SCALE_STEPS directly, so every font size and icon size in the app moves
// together when the user changes "Display size" in Settings.

export const COLORS = {
  bg: '#05070d',
  surface: '#10131f',
  surface2: '#161a2c',
  border: '#232a45',
  edge: '#2e3660',
  text: '#f5f6fb',
  dim: '#9ba3c4',
  faint: '#5c6488',
  buy: '#3ddc84',
  sell: '#ff4d6d',
  warn: '#ffb020',
};

// Named accent gradients the user can pick in Settings > Appearance.
// Every one is a two-stop gradient so the "extraordinary" look (glow
// buttons, ring-screen background, tab bar indicator) stays consistent
// no matter which the user picks.
export const ACCENTS = {
  signal: { name: 'Signal', from: '#ff3b5c', to: '#ff2d9e' },
  amber: { name: 'Amber', from: '#ff9a3c', to: '#ff3b5c' },
  volt: { name: 'Volt', from: '#3ddc84', to: '#22b8ff' },
  violet: { name: 'Violet', from: '#7c5cff', to: '#ff2d9e' },
  ice: { name: 'Ice', from: '#22b8ff', to: '#7c5cff' },
};

// Multiplier steps for the "Display size" setting — applied to every
// font size and icon size via the scale() helper. Kept subtle (0.9–1.3x)
// so layouts don't break, but noticeable enough to matter for anyone who
// wants bigger text/icons at a glance (e.g. checking the phone quickly).
export const SCALE_STEPS = {
  small: 0.9,
  medium: 1.0,
  large: 1.15,
  xl: 1.3,
};

export const SCALE_LABELS = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xl: 'Extra Large',
};

// Vibration patterns, in the [wait, buzz, wait, buzz, ...] ms format
// Vibration.vibrate() expects. "off" still lets sound-only ring through.
export const VIBRATION_PATTERNS = {
  pulse: { label: 'Pulse', pattern: [0, 400, 300, 400, 300, 400] },
  sos: { label: 'SOS burst', pattern: [0, 150, 100, 150, 100, 150, 300, 400, 200, 400, 200, 400, 300, 150, 100, 150, 100, 150] },
  long: { label: 'Long buzz', pattern: [0, 1200, 400, 1200] },
  off: { label: 'Off', pattern: [0] },
};

export const SNOOZE_OPTIONS = [1, 3, 5, 10, 15];
export const AUTO_DISMISS_OPTIONS = [0, 1, 2, 5, 10]; // minutes, 0 = never auto-dismiss
