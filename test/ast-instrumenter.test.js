// Unit tests for AST-based TypeWiz Enhanced instrumentation
const { instrumentCodeWithAST } = require('../lib/ast-instrumenter');

describe('TypeWiz Enhanced AST Instrumentation', () => {
    
    describe('JavaScript Function Declarations', () => {
        
        test('should instrument simple function declaration', () => {
            const source = `
function greet(name) {
    return 'Hello ' + name;
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('$_$twiz');
            expect(result).toContain('greet_param_name');
            expect(result).toContain('greet_entry');
            expect(result).toContain('functionName: "greet"');
            expect(result).toContain('parameterName: "name"');
        });
        
        test('should instrument function with multiple parameters', () => {
            const source = `
function calculate(x, y, operation) {
    return operation(x, y);
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('calculate_param_x');
            expect(result).toContain('calculate_param_y');
            expect(result).toContain('calculate_param_operation');
            expect(result).toContain('parameterIndex: 0');
            expect(result).toContain('parameterIndex: 1');
            expect(result).toContain('parameterIndex: 2');
        });
        
        test('should instrument function with no parameters', () => {
            const source = `
function getCurrentTime() {
    return new Date();
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('getCurrentTime_entry');
            expect(result).toContain('hasParameters: false');
            expect(result).not.toContain('_param_');
        });
        
    });
    
    describe('JavaScript Arrow Functions', () => {
        
        test('should instrument arrow function with parameters', () => {
            const source = `
const multiply = (a, b) => {
    return a * b;
};
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('multiply_param_a');
            expect(result).toContain('multiply_param_b');
            expect(result).toContain('functionName: "multiply"');
            expect(result).toContain('context: "arrow_function_parameter"');
        });
        
        test('should instrument arrow function with single parameter', () => {
            const source = `
const square = x => {
    return x * x;
};
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('square_param_x');
            expect(result).toContain('parameterName: "x"');
        });
        
    });
    
    describe('JavaScript Class Methods', () => {
        
        test('should instrument class constructor', () => {
            const source = `
class User {
    constructor(name, email) {
        this.name = name;
        this.email = email;
    }
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('constructor_param_name');
            expect(result).toContain('constructor_param_email');
            expect(result).toContain('constructor_entry');
            expect(result).toContain('context: "constructor_parameter"');
        });
        
        test('should instrument class methods', () => {
            const source = `
class Calculator {
    add(x, y) {
        return x + y;
    }
    
    multiply(a, b) {
        return a * b;
    }
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('add_param_x');
            expect(result).toContain('add_param_y');
            expect(result).toContain('multiply_param_a');
            expect(result).toContain('multiply_param_b');
            expect(result).toContain('context: "class_method_parameter"');
        });
        
    });
    
    describe('JavaScript Object Methods', () => {
        
        test('should instrument object method shorthand', () => {
            const source = `
const mathUtils = {
    divide(x, y) {
        return x / y;
    },
    
    power(base, exponent) {
        return Math.pow(base, exponent);
    }
};
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('divide_param_x');
            expect(result).toContain('divide_param_y');
            expect(result).toContain('power_param_base');
            expect(result).toContain('power_param_exponent');
            expect(result).toContain('context: "object_method_parameter"');
        });
        
    });
    
    describe('TypeScript Functions', () => {
        
        test('should instrument TypeScript function with type annotations', () => {
            const source = `
function processUser(user: User, options: ProcessOptions): ProcessedUser {
    return { ...user, processed: true };
}
`;
            const result = instrumentCodeWithAST(source, 'test.ts');
            
            expect(result).toContain('processUser_param_user');
            expect(result).toContain('processUser_param_options');
            expect(result).toContain('parameterType: "annotated"');
            expect(result).toContain('functionName: "processUser"');
        });
        
        test('should instrument TypeScript arrow function with generics', () => {
            const source = `
const mapArray = <T, U>(items: T[], mapper: (item: T) => U): U[] => {
    return items.map(mapper);
};
`;
            const result = instrumentCodeWithAST(source, 'test.ts');
            
            expect(result).toContain('mapArray_param_items');
            expect(result).toContain('mapArray_param_mapper');
            expect(result).toContain('parameterType: "annotated"');
        });
        
        test('should instrument TypeScript class with typed constructor', () => {
            const source = `
class TodoItem {
    constructor(
        public id: string,
        public description: string,
        public completed: boolean = false
    ) {}
    
    toggle(): void {
        this.completed = !this.completed;
    }
}
`;
            const result = instrumentCodeWithAST(source, 'test.ts');
            
            expect(result).toContain('constructor_param_id');
            expect(result).toContain('constructor_param_description');
            expect(result).toContain('constructor_param_completed');
            expect(result).toContain('toggle_entry');
            expect(result).toContain('parameterType: "annotated"');
        });
        
    });
    
    describe('Parameter Destructuring', () => {
        
        test('should handle object destructuring parameters', () => {
            const source = `
function createUser({ name, email, age }) {
    return { name, email, age, id: Math.random() };
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('createUser_param_destructured_object');
            expect(result).toContain('isDestructured: true');
        });
        
        test('should handle array destructuring parameters', () => {
            const source = `
function getCoordinates([x, y, z]) {
    return { x, y, z };
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('getCoordinates_param_destructured_array');
            expect(result).toContain('isDestructured: true');
        });
        
        test('should handle rest parameters', () => {
            const source = `
function sum(...numbers) {
    return numbers.reduce((a, b) => a + b, 0);
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('sum_param_numbers');
            expect(result).toContain('isRest: true');
        });
        
        test('should handle default parameters', () => {
            const source = `
function greet(name, greeting = 'Hello') {
    return greeting + ' ' + name;
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('greet_param_name');
            expect(result).toContain('greet_param_greeting');
            expect(result).toContain('hasDefault: true');
        });
        
    });
    
    describe('TypeWiz Runtime Injection', () => {
        
        test('should inject TypeWiz runtime at the beginning', () => {
            const source = `
function test() {
    return 'test';
}
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('if (typeof window !== \'undefined\' && typeof $_$twiz === \'undefined\')');
            expect(result).toContain('window.__typewiz_batch = []');
            expect(result).toContain('window.$_$twiz = function');
            expect(result).toContain('__typewiz_safe_stringify');
        });
        
        test('should include batch processing logic', () => {
            const source = `function test() {}`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('window.__typewiz_batch_timer');
            expect(result).toContain('setTimeout');
            expect(result).toContain('fetch(\'/__typewiz_sqlite_report\'');
            expect(result).toContain('JSON.stringify(window.__typewiz_batch)');
        });
        
    });
    
    describe('Error Handling', () => {
        
        test('should handle malformed JavaScript gracefully', () => {
            const source = `
function incomplete(
// This is intentionally broken
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            // Should return original source if parsing fails
            expect(result).toBe(source);
        });
        
        test('should handle empty source', () => {
            const source = '';
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('TypeWiz Enhanced');
        });
        
        test('should handle source with no functions', () => {
            const source = `
const x = 5;
const message = 'Hello World';
console.log(message);
`;
            const result = instrumentCodeWithAST(source, 'test.js');
            
            expect(result).toContain('TypeWiz Enhanced');
            expect(result).not.toContain('_param_');
        });
        
    });
    
    describe('TypeScript vs JavaScript Detection', () => {
        
        test('should detect TypeScript files by extension', () => {
            const jsSource = `
function test(param) {
    return param;
}
`;
            const tsSource = `
function test(param: string): string {
    return param;
}
`;
            
            const jsResult = instrumentCodeWithAST(jsSource, 'test.js');
            const tsResult = instrumentCodeWithAST(tsSource, 'test.ts');
            
            // Both should work, but TypeScript should handle type annotations
            expect(jsResult).toContain('$_$twiz');
            expect(tsResult).toContain('$_$twiz');
            expect(tsResult).toContain('parameterType: "annotated"');
        });
        
    });
    
    describe('Line Number Accuracy', () => {
        
        test('should correctly track line numbers in JavaScript with comments', () => {
            const source = `// Line 1: Header comment
// Line 2: Another comment
function testFunc(param1, param2) { // Line 3: Function definition
    // Line 4: Internal comment
    return param1 + param2; // Line 5: Return statement
} // Line 6: End brace

// Line 8: Call comment
testFunc('hello', 'world'); // Line 9: Function call
`;
            
            const result = instrumentCodeWithAST(source, 'test.js');
            
            // Function should be on line 3
            expect(result).toContain('lineNumber: 3');
            
            // Parameters should also be on line 3
            const param1Match = result.match(/testFunc_param_param1.*?lineNumber: (\d+)/);
            const param2Match = result.match(/testFunc_param_param2.*?lineNumber: (\d+)/);
            
            expect(param1Match).toBeTruthy();
            expect(param2Match).toBeTruthy();
            expect(parseInt(param1Match[1])).toBe(3);
            expect(parseInt(param2Match[1])).toBe(3);
        });
        
        test('should correctly track line numbers in TypeScript with comments', () => {
            const source = `// Line 1: TypeScript header comment  
// Line 2: Type definitions
interface User { // Line 3: Interface definition
    name: string; // Line 4: Property
}

// Line 7: Function comment
function processUser(user: User, options: ProcessOptions): void { // Line 8: Function
    // Line 9: Implementation comment
    console.log(user.name); // Line 10: Implementation
} // Line 11: End function

// Line 13: Call comment
const testUser: User = { name: 'John' }; // Line 14: Variable
processUser(testUser, {}); // Line 15: Function call
`;
            
            const result = instrumentCodeWithAST(source, 'test.ts');
            
            // Function should be on line 8
            expect(result).toContain('lineNumber: 8');
            
            // Parameters should also be on line 8
            const userMatch = result.match(/processUser_param_user.*?lineNumber: (\d+)/);
            const optionsMatch = result.match(/processUser_param_options.*?lineNumber: (\d+)/);
            
            expect(userMatch).toBeTruthy();
            expect(optionsMatch).toBeTruthy();
            expect(parseInt(userMatch[1])).toBe(8);
            expect(parseInt(optionsMatch[1])).toBe(8);
        });
        
        test('should handle multiline function declarations correctly', () => {
            const jsSource = `// Header comment
function complexFunction(
    firstParam, // Line 3: First parameter
    secondParam, // Line 4: Second parameter  
    thirdParam // Line 5: Third parameter
) { // Line 6: Function body start
    return firstParam + secondParam + thirdParam;
}`;
            
            const tsSource = `// TypeScript header comment
function complexFunction(
    firstParam: string, // Line 3: First parameter with type
    secondParam: number, // Line 4: Second parameter with type
    thirdParam: boolean // Line 5: Third parameter with type
): string { // Line 6: Function body start with return type
    return String(firstParam + secondParam + thirdParam);
}`;
            
            const jsResult = instrumentCodeWithAST(jsSource, 'multiline.js');
            const tsResult = instrumentCodeWithAST(tsSource, 'multiline.ts');
            
            // Check JavaScript parameter line numbers
            const jsFirstMatch = jsResult.match(/complexFunction_param_firstParam.*?lineNumber: (\d+)/);
            const jsSecondMatch = jsResult.match(/complexFunction_param_secondParam.*?lineNumber: (\d+)/);
            const jsThirdMatch = jsResult.match(/complexFunction_param_thirdParam.*?lineNumber: (\d+)/);
            
            expect(jsFirstMatch && parseInt(jsFirstMatch[1])).toBe(3);
            expect(jsSecondMatch && parseInt(jsSecondMatch[1])).toBe(4);
            expect(jsThirdMatch && parseInt(jsThirdMatch[1])).toBe(5);
            
            // Check TypeScript parameter line numbers  
            const tsFirstMatch = tsResult.match(/complexFunction_param_firstParam.*?lineNumber: (\d+)/);
            const tsSecondMatch = tsResult.match(/complexFunction_param_secondParam.*?lineNumber: (\d+)/);
            const tsThirdMatch = tsResult.match(/complexFunction_param_thirdParam.*?lineNumber: (\d+)/);
            
            expect(tsFirstMatch && parseInt(tsFirstMatch[1])).toBe(3);
            expect(tsSecondMatch && parseInt(tsSecondMatch[1])).toBe(4);
            expect(tsThirdMatch && parseInt(tsThirdMatch[1])).toBe(5);
        });
        
        test('should handle complex TypeScript class with comments correctly', () => {
            const source = `// Line 1: Class header comment
/**  
 * Line 2-4: JSDoc comment block
 * This is a complex class
 */
class TodoManager { // Line 6: Class declaration
    // Line 7: Constructor comment
    constructor(
        public name: string, // Line 9: First constructor param
        private config: Config // Line 10: Second constructor param  
    ) { // Line 11: Constructor body
        // Line 12: Constructor implementation
    }
    
    // Line 15: Method comment
    addTodo(
        description: string, // Line 17: Method param 1
        priority: Priority = 'normal' // Line 18: Method param 2 with default
    ): Todo { // Line 19: Method return type
        // Line 20: Method implementation
        return { description, priority };
    }
}`;
            
            const result = instrumentCodeWithAST(source, 'complex.ts');
            
            // Constructor parameters should be on lines 9 and 10
            const nameMatch = result.match(/constructor_param_name.*?lineNumber: (\d+)/);
            const configMatch = result.match(/constructor_param_config.*?lineNumber: (\d+)/);
            
            expect(nameMatch && parseInt(nameMatch[1])).toBe(9);
            expect(configMatch && parseInt(configMatch[1])).toBe(10);
            
            // Method parameters should be on lines 17 and 18
            const descMatch = result.match(/addTodo_param_description.*?lineNumber: (\d+)/);
            const priorityMatch = result.match(/addTodo_param_priority.*?lineNumber: (\d+)/);
            
            expect(descMatch && parseInt(descMatch[1])).toBe(17);
            expect(priorityMatch && parseInt(priorityMatch[1])).toBe(18);
        });
        
        test('should verify line numbers match original source exactly', () => {
            const source = `/* Block comment line 1
   Block comment line 2 */
// Single line comment line 3
 
function testLineNumbers(param) { // Line 5: This should be line 5
    return param;
}

const arrow = (param) => { // Line 9: This should be line 9  
    return param;
};

class TestClass { // Line 13: This should be line 13
    method(param) { // Line 14: This should be line 14
        return param;
    }
}`;
            
            const result = instrumentCodeWithAST(source, 'line-test.js');
            
            // Extract all line numbers from the instrumented code
            const lineMatches = [...result.matchAll(/lineNumber: (\d+)/g)];
            const lineNumbers = lineMatches.map(match => parseInt(match[1]));
            
            // Should contain line 5 (function), line 9 (arrow), line 13 (class), line 14 (method)
            expect(lineNumbers).toContain(5);  // testLineNumbers function
            expect(lineNumbers).toContain(9);  // arrow function
            expect(lineNumbers).toContain(14); // class method
            
            console.log('📍 Extracted line numbers:', lineNumbers.sort((a,b) => a-b));
        });
        
    });
    
});

// Helper to run tests
if (require.main === module) {
    console.log('Running TypeWiz Enhanced AST Instrumentation Tests...');
    
    // Run a simple test
    const source = `
function testFunction(param1, param2) {
    return param1 + param2;
}
`;
    
    const result = instrumentCodeWithAST(source, 'test.js');
    console.log('✅ Basic instrumentation test passed');
    console.log('Instrumented code preview:');
    console.log(result.slice(0, 500) + '...');
}