// TypeWiz Enhanced Webpack Loader - AST-based instrumentation for JavaScript and TypeScript
const path = require('path');
const micromatch = require('micromatch');
const { SourceMapMapper } = require('./source-map-utils');
const { instrumentCodeWithAST } = require('./ast-instrumenter');

// Enhanced instrumentation using AST parsing (supports both JavaScript and TypeScript)
function instrumentCode(source, filename, options = {}) {
    try {
        console.log(`[TypeWiz AST] 🚀 Processing ${filename} with AST-based instrumentation`);
        return instrumentCodeWithAST(source, filename, options);
    } catch (error) {
        console.warn(`[TypeWiz AST] ⚠️  Failed to instrument ${filename}, using original source:`, error.message);
        return source; // Fallback to original source if AST parsing fails
    }
}

// Global source map mapper instance  
const sourceMapper = new SourceMapMapper();

// Check if file should be processed based on include/exclude patterns
function shouldProcessFile(filename, options) {
    // If include patterns are specified, file must match at least one
    if (options.includePatterns && options.includePatterns.length > 0) {
        if (!micromatch.isMatch(filename, options.includePatterns)) {
            return false;
        }
    }
    
    // If exclude patterns are specified, file must not match any
    if (options.excludePatterns && options.excludePatterns.length > 0) {
        if (micromatch.isMatch(filename, options.excludePatterns)) {
            return false;
        }
    }
    
    return true;
}

// Enhanced webpack loader function with source map support
module.exports = function(source, sourceMap) {
    const options = this.getOptions() || {};
    const filename = path.relative(process.cwd(), this.resourcePath);
    
    // Load source map if available (sourceMap is webpack's source map object, not a file path)
    if (sourceMap && options.enableSourceMaps !== false) {
        try {
            // sourceMap is already parsed object from webpack
            sourceMapper.loadSourceMapFromObject(filename, sourceMap);
        } catch (err) {
            console.warn(`[TypeWiz] Source map loading failed for ${filename}:`, err.message);
        }
    }
    
    // Instrument JavaScript and TypeScript files based on patterns
    if (filename.endsWith('.js') || filename.endsWith('.ts')) {
        // Check include/exclude patterns
        if (!shouldProcessFile(filename, options)) {
            console.log(`[TypeWiz Auto-Loader] ⏭️  Skipping (excluded by patterns): ${filename}`);
            return source;
        }
        
        console.log(`[TypeWiz Auto-Loader] 🚀 Instrumenting with AST-based decorators: ${filename}`);
        const instrumentedCode = instrumentCode(source, filename, options);
        return instrumentedCode;
    }
    
    return source;
};

// Enable source map processing
module.exports.raw = false;