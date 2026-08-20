// Tentry design system — calm dark desk, loud only on alarm.
// Screens use scale() from SettingsContext for type/icon size.

export const COLORS = {
  bg: '#05070d',
  surface: '#10131f',
  surface2: '#161a2c',
  border: '#232a45',
  edge: '#2e3660',
  text: '#f5f6fb',
  white: '#ffffff',
  dim: '#9ba3c4',
  faint: '#6b728a',
  muted: '#5c6488',
  buy: '#3ddc84',
  sell: '#ff4d6d',
  warn: '#ffb020',
  iconActive: '#ffffff',
  iconInactive: '#8a90a8',
  labelInactive: '#6b728a',
};

/** Spacing scale — use only these values */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  full: 999,
};

/** Shared layout helpers */
export const LAYOUT = {
  screenPadH: SPACE.md, // 12
  screenPadBottom: SPACE.xxl, // 24
  cardPad: SPACE.md, // 12
  cardGap: SPACE.sm, // 8
  rowMinH: 48,
  headerPadV: SPACE.sm,
  tabIconActive: 18,
  tabIconInactive: 16,
};

export const ACCENTS = {
  signal: { name: 'Signal', from: '#ff3b5c', to: '#ff2d9e' },
  amber: { name: 'Amber', from: '#ff9a3c', to: '#ff3b5c' },
  volt: { name: 'Volt', from: '#3ddc84', to: '#22b8ff' },
  violet: { name: 'Violet', from: '#7c5cff', to: '#ff2d9e' },
  ice: { name: 'Ice', from: '#22b8ff', to: '#7c5cff' },
};

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

export const VIBRATION_PATTERNS = {
  pulse: { label: 'Pulse', pattern: [0, 400, 300, 400, 300, 400] },
  sos: {
    label: 'SOS burst',
    pattern: [0, 150, 100, 150, 100, 150, 300, 400, 200, 400, 200, 400, 300, 150, 100, 150, 100, 150],
  },
  long: { label: 'Long buzz', pattern: [0, 1200, 400, 1200] },
  off: { label: 'Off', pattern: [0] },
};

export const SNOOZE_OPTIONS = [1, 3, 5, 10, 15];
export const AUTO_DISMISS_OPTIONS = [0, 1, 2, 5, 10];
