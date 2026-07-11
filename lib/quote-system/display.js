/**
 * Online Quote — choice display modes (text / icon / image) and image sizing.
 * Images live at leadpages/{siteId}/onlineQuote/… and are removed when the site
 * is deleted via the standard cwDeletePrefix('leadpages/{siteId}/') flow.
 */

const IMAGE_SIZES = {
  compact: 56,
  standard: 80,
  large: 120,
  hero: 180
};

const IMAGE_SIZE_OPTIONS = [
  { id: 'compact', label: 'Compact (56px)' },
  { id: 'standard', label: 'Standard (80px)' },
  { id: 'large', label: 'Large (120px)' },
  { id: 'hero', label: 'Hero (180px)' }
];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function inferDisplayMode(item) {
  if (!item || typeof item !== 'object') return 'text';
  if (item.displayMode === 'text' || item.displayMode === 'icon' || item.displayMode === 'image') {
    return item.displayMode;
  }
  if (item.imageUrl) return 'image';
  if (item.icon) return 'icon';
  return 'text';
}

function normalizeImageScale(scale) {
  var n = parseInt(scale, 10);
  if (isNaN(n)) return 100;
  return clamp(n, 50, 250);
}

function normalizeImageSize(size) {
  return IMAGE_SIZES[size] ? size : 'standard';
}

function displayPx(size, scale) {
  var base = IMAGE_SIZES[normalizeImageSize(size)] || IMAGE_SIZES.standard;
  return Math.round(base * normalizeImageScale(scale) / 100);
}

function normalizeChoiceDisplay(item) {
  var it = item || {};
  return {
    displayMode: inferDisplayMode(it),
    icon: it.icon || null,
    imageUrl: it.imageUrl || null,
    imagePid: it.imagePid || null,
    imageSize: normalizeImageSize(it.imageSize),
    imageScale: normalizeImageScale(it.imageScale)
  };
}

function publicChoiceFields(item) {
  var d = normalizeChoiceDisplay(item);
  return {
    displayMode: d.displayMode,
    icon: d.displayMode === 'icon' ? d.icon : null,
    imageUrl: d.displayMode === 'image' ? d.imageUrl : null,
    imageSize: d.displayMode === 'image' ? d.imageSize : null,
    imageScale: d.displayMode === 'image' ? d.imageScale : null
  };
}

module.exports = {
  IMAGE_SIZES,
  IMAGE_SIZE_OPTIONS,
  inferDisplayMode,
  normalizeImageScale,
  normalizeImageSize,
  displayPx,
  normalizeChoiceDisplay,
  publicChoiceFields
};
