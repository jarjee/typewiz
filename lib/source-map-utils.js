// Source Map Integration for TypeScript Support
const { SourceMapConsumer } = require('source-map');
const path = require('path');

class SourceMapMapper {
    constructor() {
        this.sourceMaps = new Map();
    }
    
    async loadSourceMap(jsFilePath, sourceMapPath) {
        try {
            const fs = require('fs');
            const sourceMapContent = fs.readFileSync(sourceMapPath, 'utf8');
            const sourceMap = JSON.parse(sourceMapContent);
            
            const consumer = await new SourceMapConsumer(sourceMap);
            this.sourceMaps.set(jsFilePath, consumer);
            
            console.log(`[TypeWiz] Loaded source map for ${jsFilePath}`);
            return consumer;
        } catch (error) {
            console.warn(`[TypeWiz] Failed to load source map for ${jsFilePath}:`, error.message);
            return null;
        }
    }
    
    async loadSourceMapFromObject(jsFilePath, sourceMapObject) {
        try {
            // sourceMapObject is already parsed from webpack
            const consumer = await new SourceMapConsumer(sourceMapObject);
            this.sourceMaps.set(jsFilePath, consumer);
            
            console.log(`[TypeWiz] Loaded source map object for ${jsFilePath}`);
            return consumer;
        } catch (error) {
            console.warn(`[TypeWiz] Failed to load source map object for ${jsFilePath}:`, error.message);
            return null;
        }
    }
    
    mapToOriginalPosition(jsFilePath, jsLine, jsColumn = 0) {
        const consumer = this.sourceMaps.get(jsFilePath);
        if (!consumer) {
            return {
                source: jsFilePath,
                line: jsLine,
                column: jsColumn,
                name: null
            };
        }
        
        try {
            const originalPosition = consumer.originalPositionFor({
                line: jsLine,
                column: jsColumn
            });
            
            if (originalPosition.source) {
                return {
                    source: originalPosition.source,
                    line: originalPosition.line,
                    column: originalPosition.column,
                    name: originalPosition.name
                };
            }
        } catch (error) {
            console.warn(`[TypeWiz] Source map lookup failed:`, error.message);
        }
        
        // Fallback to JS position
        return {
            source: jsFilePath,
            line: jsLine,
            column: jsColumn,
            name: null
        };
    }
    
    enhanceTypeWizData(filename, offset, types, metadata) {
        // Calculate line/column from offset
        const jsLine = this.calculateLineFromOffset(filename, offset);
        const jsColumn = this.calculateColumnFromOffset(filename, offset);
        
        // Map to original TypeScript position
        const originalPos = this.mapToOriginalPosition(filename, jsLine, jsColumn);
        
        // Enhanced metadata with both JS and TS positions
        const enhancedMetadata = {
            ...metadata,
            javascript: {
                filename: filename,
                line: jsLine,
                column: jsColumn
            },
            typescript: {
                filename: originalPos.source,
                line: originalPos.line,
                column: originalPos.column,
                name: originalPos.name
            }
        };
        
        return [originalPos.source, originalPos.line, types, enhancedMetadata];
    }
    
    calculateLineFromOffset(filename, offset) {
        // This would need the actual file content to calculate line numbers
        // For now, return approximate line
        return Math.floor(offset / 50) + 1; // Rough estimate
    }
    
    calculateColumnFromOffset(filename, offset) {
        // This would need the actual file content to calculate column
        return offset % 50;
    }
    
    async autoDetectSourceMaps(webpackCompilation) {
        // Auto-detect source maps from webpack compilation
        for (const [filename, asset] of Object.entries(webpackCompilation.assets)) {
            if (filename.endsWith('.js')) {
                const sourceMapFile = filename + '.map';
                if (webpackCompilation.assets[sourceMapFile]) {
                    await this.loadSourceMap(filename, sourceMapFile);
                }
            }
        }
    }
}

module.exports = { SourceMapMapper };