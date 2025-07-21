// Test to verify webpack loader order and TypeScript line number handling
const loader = require('../lib/webpack-loader.js');

describe('Webpack Loader Order and TypeScript Line Numbers', () => {
    let mockContext;
    let originalCwd;
    
    beforeEach(() => {
        mockContext = {
            getOptions: jest.fn(() => ({})),
            resourcePath: '/test/project/src/test.ts'
        };
        
        // Mock process.cwd()
        originalCwd = process.cwd;
        process.cwd = jest.fn(() => '/test/project');
    });
    
    afterEach(() => {
        process.cwd = originalCwd;
    });
    
    test('should receive original TypeScript source before ts-loader compilation', () => {
        // This is what TypeWiz loader should receive (original TS with comments)
        const originalTsSource = `// Line 1: TypeScript header comment
// Line 2: Interface definition comment
interface TodoItem {
    id: string;
    description: string;
    completed: boolean;
}

// Line 8: Class definition comment
class TodoManager {
    // Line 10: Constructor comment
    constructor(
        private todos: TodoItem[] = [] // Line 12: Parameter with comment
    ) {}
    
    // Line 15: Method comment
    addTodo(description: string): void { // Line 16: Method definition
        const todo: TodoItem = {
            id: Math.random().toString(),
            description,
            completed: false
        };
        this.todos.push(todo);
    }
}`;
        
        const result = loader.call(mockContext, originalTsSource);
        
        // Should contain instrumentation with correct line numbers
        expect(result).toContain('$_$twiz');
        
        // Constructor parameter should be on line 13 (actual line where parameter is defined)
        const constructorMatch = result.match(/constructor_param_todos.*?lineNumber: (\d+)/);
        expect(constructorMatch).toBeTruthy();
        expect(parseInt(constructorMatch[1])).toBe(13);
        
        // Method parameter should be on line 17 (actual line where method is defined)
        const methodMatch = result.match(/addTodo_param_description.*?lineNumber: (\d+)/);
        expect(methodMatch).toBeTruthy();
        expect(parseInt(methodMatch[1])).toBe(17);
        
        console.log('✅ TypeScript source processed with correct line numbers before ts-loader');
    });
    
    test('should demonstrate what ts-loader would produce (comments stripped)', () => {
        // This is what would happen AFTER ts-loader (comments stripped, JS output)
        const compiledJsSource = `class TodoManager {
    constructor(todos = []) {
        this.todos = todos;
    }
    addTodo(description) {
        const todo = {
            id: Math.random().toString(),
            description,
            completed: false
        };
        this.todos.push(todo);
    }
}`;
        
        mockContext.resourcePath = '/test/project/src/test.js';
        const result = loader.call(mockContext, compiledJsSource);
        
        // Should still work but line numbers would be different (compressed)
        expect(result).toContain('$_$twiz');
        
        // Constructor parameter would be on line 2 (compressed)
        const constructorMatch = result.match(/constructor_param_todos.*?lineNumber: (\d+)/);
        expect(constructorMatch).toBeTruthy();
        expect(parseInt(constructorMatch[1])).toBe(2);
        
        // Method parameter would be on line 5 (compressed)
        const methodMatch = result.match(/addTodo_param_description.*?lineNumber: (\d+)/);
        expect(methodMatch).toBeTruthy();
        expect(parseInt(methodMatch[1])).toBe(5);
        
        console.log('⚠️  After ts-loader: Line numbers are compressed (comments removed)');
    });
    
    test('should verify current webpack config has correct loader order', () => {
        // Read the actual webpack config to verify loader order
        const webpackConfig = require('../examples/todo-app-ts/webpack.config.js');
        
        const tsRules = webpackConfig.module.rules.filter(rule => 
            rule.test && rule.test.toString().includes('tsx?')
        );
        
        expect(tsRules.length).toBe(2); // Should have two separate rules now
        
        // Find the pre-loader rule (TypeWiz)
        const preLoaderRule = tsRules.find(rule => rule.enforce === 'pre');
        expect(preLoaderRule).toBeTruthy();
        expect(preLoaderRule.use.loader).toContain('webpack-loader.js');
        
        // Find the main loader rule (ts-loader)
        const mainLoaderRule = tsRules.find(rule => !rule.enforce);
        expect(mainLoaderRule).toBeTruthy();
        expect(mainLoaderRule.use.loader).toBe('ts-loader');
        expect(mainLoaderRule.use.options.transpileOnly).toBe(true);
        
        console.log('✅ Webpack config has correct loader order: TypeWiz (pre) → ts-loader (main)');
    });
    
    test('should handle source maps correctly for line number mapping', () => {
        const tsSourceWithMap = `// Original TypeScript line 1
function test(param: string): string { // Original line 2
    return param; // Original line 3
}`;
        
        // Mock source map that would come from ts-loader
        const mockSourceMap = {
            version: 3,
            sources: ['test.ts'],
            names: ['test', 'param'],
            mappings: 'AAAA,SAAS,IAAI,CAAC,KAAa;IACvB,OAAO,KAAK,CAAC;AACjB,CAAC',
            sourcesContent: [tsSourceWithMap]
        };
        
        const result = loader.call(mockContext, tsSourceWithMap, mockSourceMap);
        
        expect(result).toContain('$_$twiz');
        expect(result).toContain('lineNumber: 2'); // Function on line 2
        
        console.log('✅ Source map integration preserves original line numbers');
    });
    
});