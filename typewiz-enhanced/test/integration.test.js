// Integration tests for TypeWiz Enhanced end-to-end functionality
const express = require('express');
const { setupTypewizEndpoints } = require('../lib/webpack-sqlite-plugin');
const { instrumentCodeWithAST } = require('../lib/ast-instrumenter');
const request = require('supertest');
const { JSDOM } = require('jsdom');

describe('TypeWiz Enhanced Integration Tests', () => {
    let app;
    let server;
    let dom;
    let window;
    
    beforeAll(async () => {
        // Setup express server with TypeWiz endpoints
        app = express();
        app.use(express.json());
        setupTypewizEndpoints(app);
        
        // Start server
        server = app.listen(0); // Use random available port
        const port = server.address().port;
        
        // Setup JSDOM environment for testing instrumented code
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <head><title>TypeWiz Test</title></head>
                <body>
                    <div id="app"></div>
                </body>
            </html>
        `, {
            url: `http://localhost:${port}`,
            resources: 'usable',
            runScripts: 'dangerously'
        });
        
        window = dom.window;
        global.window = window;
        global.document = window.document;
        global.fetch = require('node-fetch');
    });
    
    afterAll(async () => {
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
        if (dom) {
            dom.window.close();
        }
    });
    
    describe('End-to-End Function Instrumentation', () => {
        
        test('should instrument and record JavaScript function calls', async () => {
            // Create test JavaScript code
            const sourceCode = `
function calculateSum(a, b) {
    return a + b;
}

function processUser(user, options) {
    return { ...user, processed: true };
}

// Call the functions to trigger instrumentation
calculateSum(5, 10);
processUser({ name: 'John' }, { validate: true });
`;
            
            // Instrument the code
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'test-integration.js');
            
            // Execute the instrumented code in JSDOM
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            // Wait for batching to complete (TypeWiz batches every 2 seconds)
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            // Verify functions were recorded via API
            const functionCallsResponse = await request(app)
                .get('/__typewiz_function_calls')
                .expect(200);
            
            expect(functionCallsResponse.body.functionCalls).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        functionName: 'calculateSum',
                        context: expect.stringContaining('function_declaration')
                    }),
                    expect.objectContaining({
                        functionName: 'processUser',
                        context: expect.stringContaining('function_declaration')
                    })
                ])
            );
            
            // Verify parameter recordings
            const entitiesResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'calculateSum' })
                .expect(200);
            
            expect(entitiesResponse.body.entities).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        parameterName: 'a',
                        parameterIndex: 0
                    }),
                    expect.objectContaining({
                        parameterName: 'b',
                        parameterIndex: 1
                    })
                ])
            );
        });
        
        test('should instrument and record TypeScript function calls', async () => {
            // Create test TypeScript code
            const tsSourceCode = `
function processData<T>(items: T[], processor: (item: T) => T): T[] {
    return items.map(processor);
}

class DataManager {
    constructor(public name: string, private config: any) {}
    
    process(data: any[]): any[] {
        return data.filter(item => item.valid);
    }
}

// Execute the code
const manager = new DataManager('test', { debug: true });
processData([1, 2, 3], x => x * 2);
manager.process([{ valid: true }, { valid: false }]);
`;
            
            // Instrument the TypeScript code
            const instrumentedCode = instrumentCodeWithAST(tsSourceCode, 'test-integration.ts');
            
            // Execute the instrumented code
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            // Wait for batching
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            // Verify TypeScript class constructor was recorded
            const constructorResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'constructor' })
                .expect(200);
            
            expect(constructorResponse.body.entities).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        parameterName: 'name',
                        parameterType: 'annotated',
                        accessibility: 'public'
                    }),
                    expect.objectContaining({
                        parameterName: 'config',
                        accessibility: 'private'
                    })
                ])
            );
            
            // Verify generic function was recorded
            const genericResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'processData' })
                .expect(200);
            
            expect(genericResponse.body.entities).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        parameterName: 'items',
                        parameterType: 'annotated'
                    }),
                    expect.objectContaining({
                        parameterName: 'processor',
                        parameterType: 'annotated'
                    })
                ])
            );
        });
        
    });
    
    describe('Line Number and Column Tracking', () => {
        
        test('should record accurate line and column information', async () => {
            const sourceCode = `// Line 1
function testFunc(param1, param2) { // Line 2
    return param1 + param2; // Line 3
} // Line 4

testFunc('hello', 'world'); // Line 6
`;
            
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'line-test.js');
            
            // Execute the code
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            // Check line numbers in recorded data
            const entitiesResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'testFunc' })
                .expect(200);
            
            const functionEntry = entitiesResponse.body.entities.find(
                e => e.context && e.context.includes('entry')
            );
            
            expect(functionEntry).toEqual(
                expect.objectContaining({
                    lineNumber: 2,
                    columnNumber: expect.any(Number)
                })
            );
            
            const paramEntries = entitiesResponse.body.entities.filter(
                e => e.parameterName
            );
            
            paramEntries.forEach(param => {
                expect(param).toEqual(
                    expect.objectContaining({
                        lineNumber: expect.any(Number),
                        columnNumber: expect.any(Number)
                    })
                );
                expect(param.lineNumber).toBeGreaterThan(0);
                expect(param.columnNumber).toBeGreaterThanOrEqual(0);
            });
        });
        
    });
    
    describe('Complex Function Patterns', () => {
        
        test('should handle arrow functions correctly', async () => {
            const sourceCode = `
const multiply = (x, y) => x * y;
const process = async (data) => {
    return await Promise.resolve(data);
};

multiply(3, 4);
process('test data');
`;
            
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'arrow-test.js');
            
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            const arrowResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'multiply' })
                .expect(200);
            
            expect(arrowResponse.body.entities).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        parameterName: 'x',
                        context: expect.stringContaining('arrow_function')
                    }),
                    expect.objectContaining({
                        parameterName: 'y',
                        context: expect.stringContaining('arrow_function')
                    })
                ])
            );
        });
        
        test('should handle object methods correctly', async () => {
            const sourceCode = `
const mathUtils = {
    add(a, b) {
        return a + b;
    },
    
    multiply(x, y) {
        return x * y;
    }
};

mathUtils.add(1, 2);
mathUtils.multiply(3, 4);
`;
            
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'object-test.js');
            
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            const methodResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'add' })
                .expect(200);
            
            expect(methodResponse.body.entities).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        parameterName: 'a',
                        context: expect.stringContaining('object_method')
                    })
                ])
            );
        });
        
    });
    
    describe('Parameter Destructuring', () => {
        
        test('should handle destructured parameters', async () => {
            const sourceCode = `
function processConfig({ host, port, ssl = false }) {
    return { host, port, ssl };
}

function processArray([first, second, ...rest]) {
    return { first, second, rest };
}

processConfig({ host: 'localhost', port: 3000 });
processArray([1, 2, 3, 4, 5]);
`;
            
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'destructure-test.js');
            
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            const configResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'processConfig' })
                .expect(200);
            
            expect(configResponse.body.entities).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        parameterName: 'destructured_object',
                        isDestructured: true
                    })
                ])
            );
            
            const arrayResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'processArray' })
                .expect(200);
            
            expect(arrayResponse.body.entities).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        parameterName: 'destructured_array',
                        isDestructured: true
                    })
                ])
            );
        });
        
    });
    
    describe('API Endpoint Integration', () => {
        
        test('should support location-based queries', async () => {
            const sourceCode = `
function lineTest(param) { return param; } // Line 2
`;
            
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'location-test.js');
            
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            const locationResponse = await request(app)
                .post('/__typewiz_location')
                .send({ filename: 'location-test.js', lineNumber: 2 })
                .expect(200);
            
            expect(locationResponse.body.results).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        functionName: 'lineTest'
                    })
                ])
            );
        });
        
        test('should support pagination in entities endpoint', async () => {
            // First create enough data
            const sourceCode = Array.from({ length: 10 }, (_, i) => 
                `function test${i}(param${i}) { return param${i}; } test${i}('value');`
            ).join('\n');
            
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'pagination-test.js');
            
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            // Test pagination
            const page1Response = await request(app)
                .get('/__typewiz_entities')
                .query({ offset: 0, pageSize: 5 })
                .expect(200);
            
            const page2Response = await request(app)
                .get('/__typewiz_entities')
                .query({ offset: 5, pageSize: 5 })
                .expect(200);
            
            expect(page1Response.body.pagination).toEqual(
                expect.objectContaining({
                    offset: 0,
                    pageSize: 5
                })
            );
            
            expect(page2Response.body.pagination).toEqual(
                expect.objectContaining({
                    offset: 5,
                    pageSize: 5
                })
            );
            
            // Verify different results
            expect(page1Response.body.entities).not.toEqual(page2Response.body.entities);
        });
        
    });
    
    describe('Error Handling and Edge Cases', () => {
        
        test('should handle circular references in function parameters', async () => {
            const sourceCode = `
function testCircular(obj) {
    return obj;
}

const circular = { name: 'test' };
circular.self = circular;
testCircular(circular);
`;
            
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'circular-test.js');
            
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            // Should not crash and should record the function call
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'testCircular' })
                .expect(200);
            
            expect(response.body.entities.length).toBeGreaterThan(0);
        });
        
        test('should handle DOM elements as parameters', async () => {
            const sourceCode = `
function handleElement(element) {
    return element.tagName;
}

const div = document.createElement('div');
handleElement(div);
`;
            
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'dom-test.js');
            
            const script = window.document.createElement('script');
            script.textContent = instrumentedCode;
            window.document.head.appendChild(script);
            
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'handleElement' })
                .expect(200);
            
            expect(response.body.entities.length).toBeGreaterThan(0);
        });
        
    });
    
});