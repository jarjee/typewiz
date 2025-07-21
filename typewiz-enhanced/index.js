// TypeWiz Enhanced - Main Entry Point
const { setupTypewizEndpoints } = require('./lib/webpack-sqlite-plugin');
const { SourceMapMapper } = require('./lib/source-map-utils');
const { createLLMApiServer } = require('./lib/llm-api-server');

module.exports = {
  // Main webpack integration
  setupTypewizEndpoints,
  
  // Source map support for TypeScript
  SourceMapMapper,
  
  // Standalone API server
  createLLMApiServer,
  
  // Webpack loader path
  webpackLoader: require.resolve('./lib/webpack-loader.js'),
  
  // SQLite collector
  createSQLiteCollector: require('./lib/sqlite-collector').createSQLiteTypeCollectorMiddleware
};