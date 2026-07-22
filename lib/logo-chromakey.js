'use strict';

/**
 * Logo chroma-key helpers — punch out a solid background colour to transparency.
 * Used by manage.html (inlined/adapted) and unit tests.
 */

var DEFAULT_TOLERANCE = 38;

function parseHex(hex) {
  var v = String(hex || '').trim();
  if (v.charAt(0) === '#') v = v.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    v = v.charAt(0) + v.charAt(0) + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2);
  }
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16)
  };
}

function colorDistance(r, g, b, kr, kg, kb) {
  var dr = r - kr;
  var dg = g - kg;
  var db = b - kb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Soft-edge chroma: within tolerance → fully transparent; feather to ~1.35× tolerance.
 * Mutates ImageData.data in place. Returns number of pixels touched.
 */
function applyChromaKey(imageData, keyRgb, tolerance) {
  if (!imageData || !imageData.data || !keyRgb) return 0;
  var tol = Math.max(0, Math.min(180, Number(tolerance)));
  if (isNaN(tol)) tol = DEFAULT_TOLERANCE;
  var soft = Math.max(1, tol * 1.35);
  var data = imageData.data;
  var kr = keyRgb.r;
  var kg = keyRgb.g;
  var kb = keyRgb.b;
  var touched = 0;
  for (var i = 0; i < data.length; i += 4) {
    var d = colorDistance(data[i], data[i + 1], data[i + 2], kr, kg, kb);
    if (d <= tol) {
      data[i + 3] = 0;
      touched++;
    } else if (d < soft) {
      var t = (d - tol) / (soft - tol);
      var a = Math.round(data[i + 3] * t);
      if (a < data[i + 3]) {
        data[i + 3] = a;
        touched++;
      }
    }
  }
  return touched;
}

module.exports = {
  DEFAULT_TOLERANCE: DEFAULT_TOLERANCE,
  parseHex: parseHex,
  colorDistance: colorDistance,
  applyChromaKey: applyChromaKey
};
