'use strict';

const defaults = require('./defaults');
const normalize = require('./normalize');
const accent = require('./accent');
const render = require('./render');
const fromSeoText = require('./from-seo-text');

module.exports = Object.assign({}, defaults, normalize, accent, render, fromSeoText);
