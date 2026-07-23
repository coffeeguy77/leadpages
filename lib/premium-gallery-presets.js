'use strict';

/**
 * Premium Gallery smart-auto presets + mosaic helpers.
 * Used by defaults, Website Studio adapters, and mirrored in the client renderer.
 */

const SMART_PRESETS = {
  clean: {
    label: 'Clean',
    layout: 'grid',
    density: 'airy',
    ratio: 'square',
    hover: 'none',
    radius: 8,
    gap: 18,
    headerLayout: 'centred',
    imageSize: 'standard',
    mosaicLocked: true
  },
  editorial: {
    label: 'Editorial',
    layout: 'editorial',
    density: 'editorial',
    ratio: 'original',
    hover: 'caption',
    radius: 4,
    gap: 20,
    headerLayout: 'split',
    imageSize: 'large',
    mosaicLocked: true
  },
  dynamic: {
    label: 'Dynamic',
    layout: 'smart-mosaic',
    density: 'balanced',
    ratio: 'original',
    hover: 'zoom',
    radius: 12,
    gap: 12,
    headerLayout: 'centred',
    imageSize: 'standard',
    mosaicLocked: false,
    mosaicRandomize: 'once'
  },
  minimal: {
    label: 'Minimal',
    layout: 'grid',
    density: 'compact',
    ratio: 'original',
    hover: 'none',
    radius: 0,
    gap: 8,
    headerLayout: 'minimal',
    imageSize: 'compact',
    mosaicLocked: true
  },
  cinematic: {
    label: 'Cinematic',
    layout: 'feature-grid',
    density: 'edge',
    ratio: '21:9',
    hover: 'zoom',
    radius: 0,
    gap: 4,
    headerLayout: 'hero',
    imageSize: 'showcase',
    lightboxStyle: 'dark',
    mosaicLocked: true
  },
  collage: {
    label: 'Collage',
    layout: 'collage',
    density: 'balanced',
    ratio: 'original',
    hover: 'lift',
    radius: 10,
    gap: 10,
    headerLayout: 'centred',
    mosaicLocked: true,
    collageRotation: 4,
    collageOverlap: 12
  }
};

/**
 * @param {string} presetId
 * @returns {object|null}
 */
function getSmartPreset(presetId) {
  const id = String(presetId || '')
    .trim()
    .toLowerCase();
  return SMART_PRESETS[id] ? Object.assign({}, SMART_PRESETS[id]) : null;
}

/**
 * Apply a smart preset onto a gallery section config (mutates a shallow copy).
 * @param {object} section
 * @param {string} presetId
 */
function applySmartPreset(section, presetId) {
  const base = section && typeof section === 'object' ? Object.assign({}, section) : {};
  const preset = getSmartPreset(presetId);
  if (!preset) {
    base.smartPreset = String(presetId || '') || base.smartPreset || '';
    return base;
  }
  Object.keys(preset).forEach((k) => {
    if (k === 'label') return;
    base[k] = preset[k];
  });
  base.smartPreset = String(presetId).toLowerCase();
  return base;
}

/**
 * Deterministic mosaic size assignment.
 * @param {object} image
 * @param {number} seed
 * @param {number} idx
 */
function mosaicSizeForImage(image, seed, idx) {
  const it = image || {};
  if (it.size && ['standard', 'wide', 'tall', 'large', 'feature', 'full'].indexOf(it.size) >= 0) {
    return it.size === 'feature' ? 'large' : it.size;
  }
  const o = String(it.orientation || '');
  if (o === 'panoramic' || (it.ratio && it.ratio >= 2)) return 'full';
  if (o === 'portrait' || (it.ratio && it.ratio < 0.9)) return 'tall';
  if (o === 'landscape' && it.featured) return 'wide';
  const n = (((seed || 7) * 31 + idx * 17) % 10 + 10) % 10;
  if (n === 0) return 'large';
  if (n === 1 || n === 2) return 'wide';
  if (n === 3 || n === 4) return 'tall';
  return 'standard';
}

/**
 * Regenerate a locked mosaic layout map for images.
 * @param {object[]} images
 * @param {number} [seed]
 */
function regenerateMosaicLayout(images, seed) {
  const list = Array.isArray(images) ? images : [];
  const s = seed != null ? seed : Math.floor(Math.random() * 9999) + 1;
  return {
    mosaicSeed: s,
    mosaicLocked: true,
    mosaicLayout: list.map((im, idx) => ({
      id: im && im.id ? im.id : 'img-' + idx,
      size: mosaicSizeForImage(im, s, idx)
    }))
  };
}

module.exports = {
  SMART_PRESETS,
  getSmartPreset,
  applySmartPreset,
  mosaicSizeForImage,
  regenerateMosaicLayout
};
