// Test include/exclude patterns functionality
const loader = require('../lib/webpack-loader.js');

describe('TypeWiz Include/Exclude Patterns', () => {
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
        process.cwd = originalCwd;
    });
    
    describe('No Patterns (Default Behavior)', () => {
        test('should process all JS/TS files when no patterns specified', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.getOptions = jest.fn(() => ({}));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented
        });
    });
    
    describe('Include Patterns', () => {
        test('should process files matching include patterns', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.js']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented
        });
        
        test('should skip files not matching include patterns', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/lib/test.js';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.js'] // Only process src files
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toContain('$_$twiz');
            expect(result).toBe(source); // Should not be instrumented
        });
        
        test('should handle multiple include patterns', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/components/test.js';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.js', 'components/**/*.js']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented
        });
        
        test('should work with TypeScript include patterns', () => {
            const source = 'function test(): void { console.log("test"); }';
            mockContext.resourcePath = '/test/project/src/test.ts';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.ts']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented
        });
    });
    
    describe('Exclude Patterns', () => {
        test('should skip files matching exclude patterns', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/src/test.spec.js';
            mockContext.getOptions = jest.fn(() => ({
                excludePatterns: ['**/*.spec.js']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toContain('$_$twiz');
            expect(result).toBe(source); // Should not be instrumented
        });
        
        test('should process files not matching exclude patterns', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.getOptions = jest.fn(() => ({
                excludePatterns: ['**/*.spec.js', '**/*.test.js']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented
        });
        
        test('should handle multiple exclude patterns', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/node_modules/lib/test.js';
            mockContext.getOptions = jest.fn(() => ({
                excludePatterns: ['node_modules/**', '**/*.spec.js', '**/*.test.js']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toContain('$_$twiz');
            expect(result).toBe(source); // Should not be instrumented
        });
        
        test('should exclude test directories', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/test/helper.js';
            mockContext.getOptions = jest.fn(() => ({
                excludePatterns: ['test/**', '__tests__/**']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toContain('$_$twiz');
            expect(result).toBe(source); // Should not be instrumented
        });
    });
    
    describe('Combined Include and Exclude Patterns', () => {
        test('should process files that match include AND do not match exclude', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/src/components/Button.js';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.js'],
                excludePatterns: ['**/*.spec.js', '**/*.test.js']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented
        });
        
        test('should skip files that match include BUT also match exclude', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/src/components/Button.spec.js';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.js'],
                excludePatterns: ['**/*.spec.js', '**/*.test.js']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toContain('$_$twiz');
            expect(result).toBe(source); // Should not be instrumented (excluded)
        });
        
        test('should skip files that do not match include patterns', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/lib/utils.js';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.js'],
                excludePatterns: ['**/*.spec.js']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toContain('$_$twiz');
            expect(result).toBe(source); // Should not be instrumented (not included)
        });
    });
    
    describe('Edge Cases', () => {
        test('should handle empty pattern arrays', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: [],
                excludePatterns: []
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented (no restrictions)
        });
        
        test('should handle pattern arrays with null/undefined', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: null,
                excludePatterns: undefined
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented (no restrictions)
        });
        
        test('should handle complex glob patterns', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/src/deep/nested/folder/component.js';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/component.js'],
                excludePatterns: ['**/node_modules/**']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented
        });
        
        test('should work with negation patterns', () => {
            const source = 'function test() { console.log("test"); }';
            mockContext.resourcePath = '/test/project/src/component.js';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.js'],
                excludePatterns: ['!src/important.js', 'src/component.js'] // Exclude component.js but not important.js
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toContain('$_$twiz');
            expect(result).toBe(source); // Should not be instrumented (excluded)
        });
    });
    
    describe('File Extension Handling', () => {
        test('should still respect JS/TS file extension filtering', () => {
            const source = 'body { color: red; }';
            mockContext.resourcePath = '/test/project/src/style.css';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*'] // Include all files in src
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toContain('$_$twiz');
            expect(result).toBe(source); // Should not be instrumented (not JS/TS)
        });
        
        test('should work with mixed JS and TS patterns', () => {
            const source = 'function test(): void { console.log("test"); }';
            mockContext.resourcePath = '/test/project/src/test.ts';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.{js,ts}'],
                excludePatterns: ['**/*.d.ts'] // Exclude TypeScript declaration files
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).toContain('$_$twiz');
            expect(result).not.toBe(source); // Should be instrumented
        });
        
        test('should exclude TypeScript declaration files', () => {
            const source = 'declare module "test" { export const test: string; }';
            mockContext.resourcePath = '/test/project/src/types.d.ts';
            mockContext.getOptions = jest.fn(() => ({
                includePatterns: ['src/**/*.ts'],
                excludePatterns: ['**/*.d.ts']
            }));
            
            const result = loader.call(mockContext, source);
            
            expect(result).not.toContain('$_$twiz');
            expect(result).toBe(source); // Should not be instrumented (declaration file)
        });
    });
});