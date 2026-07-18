'use strict';

const constants = require('./constants');
const permissions = require('./permissions');
const cache = require('./cache');
const imageBrief = require('./image-brief');
const resolve = require('./resolve');
const cloudinary = require('./providers/cloudinary');
const pexels = require('./providers/pexels');
const aiImages = require('./providers/ai-images');

module.exports = {
  ...constants,
  ...permissions,
  createImageBrief: imageBrief.createImageBrief,
  validateImageBrief: imageBrief.validateImageBrief,
  buildSearchQueries: imageBrief.buildSearchQueries,
  resolveImageBrief: resolve.resolveImageBrief,
  resolveImageBriefs: resolve.resolveImageBriefs,
  defaultProvider: resolve.defaultProvider,
  clearCache: cache.clearCache,
  cacheSize: cache.cacheSize,
  cloudinary,
  pexels,
  aiImages,
  buildCloudinaryImportPlan: cloudinary.buildImportPlan,
  importRemoteAssetToCloudinary: cloudinary.importRemoteAsset,
  clearCloudinaryImportDedupe: cloudinary.clearImportDedupeCache
};
