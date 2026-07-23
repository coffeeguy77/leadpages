'use strict';

module.exports = {
  providers: require('./providers/gateway'),
  types: require('./providers/types'),
  scoring: require('./scoring/opportunity-value'),
  recipes: require('./recipes/registry'),
  overview: require('./overview')
};
