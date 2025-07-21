// Unit tests for TypeWiz Enhanced Webpack Loader
const loader = require('../lib/webpack-loader.js');

// Mock the instrumentCodeWithAST function
jest.mock('../lib/ast-instrumenter', () => ({
    instrumentCodeWithAST: jest.fn((source, filename, options) => {
        // Mock instrumentation adds a simple comment
        return `// TypeWiz instrumented: ${filename}\n${source}`;
    })
}));

// Mock the SourceMapMapper
jest.mock('../lib/source-map-utils', () => ({
    SourceMapMapper: jest.fn().mockImplementation(() => ({
        loadSourceMapFromObject: jest.fn()
    }))
}));

describe('TypeWiz Enhanced Webpack Loader', () => {
    let mockContext;
    let originalCwd;
    
    beforeEach(() => {
        mockContext = {
            getOptions: jest.fn(() => ({})),
            resourcePath: '/test/project/src/test.js'
        };
        
        // Mock process.cwd()
        originalCwd = process.cwd;
        process.cwd = jest.fn(() => '/test/project');
    });
    
    afterEach(() => {
        // Restore process.cwd
        process.cwd = originalCwd;
    });
    
    describe('JavaScript Files', () => {
        
        test('should instrument JavaScript files by default', () => {
            const source = 'function test(param) { return param; }';
            mockContext.resourcePath = '/test/project/src/test.js';
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('TypeWiz instrumented');
            expect(result).toContain('src/test.js');
        });
        
        test('should instrument TypeScript files', () => {
            const source = 'function test(param: string): string { return param; }';
            mockContext.resourcePath = '/test/project/src/test.ts';
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('TypeWiz instrumented');
            expect(result).toContain('src/test.ts');
        });
        
        test('should skip non-JS/TS files', () => {
            const source = '.test { color: red; }';
            mockContext.resourcePath = '/test/project/src/test.css';
            
            const result = loader.call(mockContext, source);
            
            expect(result).toBe(source);
            expect(result).not.toContain('TypeWiz instrumented');
        });
        
    });
    
    describe('Options Handling', () => {
        
        test('should always instrument JS/TS files (no longer has enableProxyDecorators option)', () => {
            const source = 'function test(param) { return param; }';
            mockContext.resourcePath = '/test/project/src/test.js';
            mockContext.getOptions = jest.fn(() => ({}));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toBe(source); // Should always be instrumented
            expect(result).toContain('TypeWiz instrumented'); // Should contain instrumentation marker
        });
        
        test('should pass options to instrumenter', () => {
            const { instrumentCodeWithAST } = require('../lib/ast-instrumenter');
            const source = 'function test(param) { return param; }';
            const options = { customOption: 'test' };
            
            mockContext.resourcePath = '/test/project/src/test.js';
            mockContext.getOptions = jest.fn(() => options);
            
            loader.call(mockContext, source);
            
            expect(instrumentCodeWithAST).toHaveBeenCalledWith(
                source,
                'src/test.js',
                options
            );
        });
        
        test('should handle missing options gracefully', () => {
            const source = 'function test(param) { return param; }';
            mockContext.resourcePath = '/test/project/src/test.js';
            mockContext.getOptions = jest.fn(() => null);
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('TypeWiz instrumented');
        });
        
    });
    
    describe('Source Map Support', () => {
        
        test('should handle source maps when provided', () => {
            const { SourceMapMapper } = require('../lib/source-map-utils');
            const source = 'function test(param) { return param; }';
            const sourceMap = { version: 3, sources: ['test.js'] };
            
            mockContext.resourcePath = '/test/project/src/test.js';
            
            const result = loader.call(mockContext, source, sourceMap);
            
            expect(SourceMapMapper).toHaveBeenCalled();
            expect(result).toContain('TypeWiz instrumented');
        });
        
        test('should handle source map loading errors gracefully', () => {
            const { SourceMapMapper } = require('../lib/source-map-utils');
            const mockMapper = new SourceMapMapper();
            mockMapper.loadSourceMapFromObject.mockImplementation(() => {
                throw new Error('Source map loading failed');
            });
            
            const source = 'function test(param) { return param; }';
            const sourceMap = { version: 3, sources: ['test.js'] };
            
            mockContext.resourcePath = '/test/project/src/test.js';
            
            // Should not throw an error
            const result = loader.call(mockContext, source, sourceMap);
            
            expect(result).toContain('TypeWiz instrumented');
        });
        
        test('should respect enableSourceMaps option', () => {
            const source = 'function test(param) { return param; }';
            const sourceMap = { version: 3, sources: ['test.js'] };
            
            mockContext.resourcePath = '/test/project/src/test.js';
            mockContext.getOptions = jest.fn(() => ({ enableSourceMaps: false }));
            
            const result = loader.call(mockContext, source, sourceMap);
            
            // Should still instrument the file even with source maps disabled
            expect(result).toContain('TypeWiz instrumented');
        });
        
    });
    
    describe('Error Handling', () => {
        
        test('should handle instrumentation errors gracefully', () => {
            const { instrumentCodeWithAST } = require('../lib/ast-instrumenter');
            instrumentCodeWithAST.mockImplementationOnce(() => {
                throw new Error('Instrumentation failed');
            });
            
            const source = 'function test(param) { return param; }';
            mockContext.resourcePath = '/test/project/src/test.js';
            
            // Should not throw an error and return original source
            const result = loader.call(mockContext, source);
            
            expect(result).toBe(source);
        });
        
    });
    
    describe('File Path Processing', () => {
        
        test('should correctly calculate relative paths', () => {
            const { instrumentCodeWithAST } = require('../lib/ast-instrumenter');
            const source = 'function test(param) { return param; }';
            
            mockContext.resourcePath = '/test/project/src/components/Button.js';
            
            loader.call(mockContext, source);
            
            expect(instrumentCodeWithAST).toHaveBeenCalledWith(
                source,
                'src/components/Button.js',
                {}
            );
        });
        
        test('should handle absolute paths outside project', () => {
            const { instrumentCodeWithAST } = require('../lib/ast-instrumenter');
            const source = 'function test(param) { return param; }';
            
            mockContext.resourcePath = '/usr/lib/node_modules/some-package/index.js';
            
            loader.call(mockContext, source);
            
            // Should still work with relative path calculation
            expect(instrumentCodeWithAST).toHaveBeenCalledWith(
                source,
                expect.stringContaining('index.js'),
                {}
            );
        });
        
    });
    
});