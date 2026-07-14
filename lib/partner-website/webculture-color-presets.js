/**
 * Culture partner page colour presets.
 * Eight creatively named palettes — partners pick by vibe, not audience labels.
 * Custom override is stored as cultureColorPreset: 'custom' + theme/accent hexes.
 */

const CULTURE_COLOR_PRESETS = [
  {
    id: 'culture',
    name: 'Culture Lime',
    blurb: 'The signature forest and lime look.',
    primary: '#C5E13F',
    ink: '#0B2114',
    bg: '#FDFCF0',
    surface: '#F5F2E6',
    muted: '#5C6B60',
    glow: '#C5E13F'
  },
  {
    id: 'basalt',
    name: 'Basalt',
    blurb: 'Charcoal ground with a copper spark.',
    primary: '#D97706',
    ink: '#141414',
    bg: '#F7F4EF',
    surface: '#EDE8E1',
    muted: '#6B6560',
    glow: '#F59E0B'
  },
  {
    id: 'rivet',
    name: 'Rivet',
    blurb: 'Deep navy with a sharp signal accent.',
    primary: '#F97316',
    ink: '#0B1C33',
    bg: '#F4F7FB',
    surface: '#E8EEF5',
    muted: '#5A6B7D',
    glow: '#FB923C'
  },
  {
    id: 'tarmac',
    name: 'Tarmac',
    blurb: 'Near-black with an electric teal edge.',
    primary: '#14B8A6',
    ink: '#0A0F14',
    bg: '#F3F6F7',
    surface: '#E6ECEE',
    muted: '#5C6A70',
    glow: '#2DD4BF'
  },
  {
    id: 'petal',
    name: 'Petal',
    blurb: 'Soft rose warmth on cream.',
    primary: '#E8A0A8',
    ink: '#3D2A32',
    bg: '#FFF8F7',
    surface: '#F8ECEC',
    muted: '#7A646A',
    glow: '#F0B7BD'
  },
  {
    id: 'willow',
    name: 'Willow',
    blurb: 'Calm sage and soft daylight green.',
    primary: '#8FAE6B',
    ink: '#243028',
    bg: '#F7F9F3',
    surface: '#EBEEE4',
    muted: '#66705F',
    glow: '#A8C285'
  },
  {
    id: 'orchid',
    name: 'Orchid',
    blurb: 'Quiet mauve with a polished finish.',
    primary: '#B28BB8',
    ink: '#2C2130',
    bg: '#FBF7FC',
    surface: '#F1EAF3',
    muted: '#6F6274',
    glow: '#C9A5CE'
  },
  {
    id: 'dune',
    name: 'Dune',
    blurb: 'Warm sand and terracotta.',
    primary: '#C47A4A',
    ink: '#2B2118',
    bg: '#FBF6EF',
    surface: '#F1E7DA',
    muted: '#736557',
    glow: '#D49264'
  }
];

const PRESET_BY_ID = CULTURE_COLOR_PRESETS.reduce(function(acc, p) {
  acc[p.id] = p;
  return acc;
}, {});

function hexOr(v, fallback) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(v || '')) ? String(v) : fallback;
}

function getCultureColorPreset(id) {
  return PRESET_BY_ID[String(id || '').trim().toLowerCase()] || PRESET_BY_ID.culture;
}

/**
 * Resolve Culture palette from showcase_config.
 * Presets supply the full look; custom uses partner theme/accent overrides.
 */
function resolveCulturePalette(cfg) {
  cfg = cfg || {};
  const presetId = String(cfg.cultureColorPreset || 'culture').trim().toLowerCase();
  const base = getCultureColorPreset(presetId === 'custom' ? 'culture' : presetId);
  const theme = cfg.theme || {};

  if (presetId === 'custom') {
    const primary = hexOr(cfg.accent, hexOr(theme.hivis, base.primary));
    const ink = hexOr(theme.steel, base.ink);
    const bg = hexOr(theme.lightBg, base.bg);
    const glow = hexOr(theme.safety, primary);
    const surface = hexOr(theme.pipe, base.surface);
    return {
      presetId: 'custom',
      name: 'Custom',
      primary: primary,
      ink: ink,
      bg: bg,
      surface: surface,
      muted: base.muted,
      glow: glow,
      custom: true
    };
  }

  return {
    presetId: base.id,
    name: base.name,
    primary: base.primary,
    ink: base.ink,
    bg: base.bg,
    surface: base.surface,
    muted: base.muted,
    glow: base.glow,
    custom: false
  };
}

function culturePresetPublicList() {
  return CULTURE_COLOR_PRESETS.map(function(p) {
    return {
      id: p.id,
      name: p.name,
      blurb: p.blurb,
      primary: p.primary,
      ink: p.ink,
      bg: p.bg,
      surface: p.surface
    };
  });
}

module.exports = {
  CULTURE_COLOR_PRESETS,
  getCultureColorPreset,
  resolveCulturePalette,
  culturePresetPublicList
};
