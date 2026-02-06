// rspack-typewiz-plugin - Main Entry Point
const { SQLiteTypewizPlugin, setupTypewizEndpoints } = require('./lib/webpack-sqlite-plugin');
const { SourceMapMapper } = require('./lib/source-map-utils');
const { createLLMApiServer } = require('./lib/llm-api-server');

module.exports = {
  SQLiteTypewizPlugin,
  setupTypewizEndpoints,

  // Source map support for TypeScript
  SourceMapMapper,

  // Standalone API server
  createLLMApiServer,

  // Loader paths
  loader: require.resolve('./lib/webpack-loader.js'),
  webpackLoader: require.resolve('./lib/webpack-loader.js'),

  // SQLite collector
  createSQLiteCollector: require('./lib/sqlite-collector').createSQLiteTypeCollectorMiddleware
};
