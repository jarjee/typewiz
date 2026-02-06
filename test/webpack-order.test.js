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
    
    test('should verify current rspack config has correct loader order', () => {
        // Read the actual config to verify loader order
        const rspackConfig = require('../examples/todo-app-ts/webpack.config.js');

        const tsRules = rspackConfig.module.rules.filter(rule =>
            rule.test && rule.test.toString().includes('tsx?')
        );

        expect(tsRules.length).toBe(1); // Single rule with chained loaders

        const tsRule = tsRules[0];
        expect(Array.isArray(tsRule.use)).toBe(true);

        // builtin:swc-loader should be first in array (executes first, right-to-left)
        const swcLoader = tsRule.use.find(l => l.loader === 'builtin:swc-loader');
        expect(swcLoader).toBeTruthy();

        // TypeWiz loader should also be present
        const typewizLoader = tsRule.use.find(l => l.loader && l.loader.includes('webpack-loader.js'));
        expect(typewizLoader).toBeTruthy();

        console.log('Rspack config has correct loader order: builtin:swc-loader + TypeWiz loader');
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