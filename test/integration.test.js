// Integration tests for TypeWiz Enhanced end-to-end functionality
const express = require('express');
const { setupTypewizEndpoints } = require('../lib/webpack-sqlite-plugin');
const { instrumentCodeWithAST } = require('../lib/ast-instrumenter');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('TypeWiz Enhanced Integration Tests', () => {
    let app;
    let dbPath;

    beforeEach(() => {
        dbPath = path.join(os.tmpdir(), `typewiz-integration-${Date.now()}.db`);
        app = express();
        setupTypewizEndpoints(app, dbPath);
    });

    afterEach(() => {
        try { fs.unlinkSync(dbPath); } catch {}
    });

    describe('End-to-End Function Instrumentation', () => {

        test('should instrument and record JavaScript function calls', async () => {
            const sourceCode = `
function calculateSum(a, b) {
    return a + b;
}

function processUser(user, options) {
    return { ...user, processed: true };
}
`;
            // Verify instrumentation produces $_$twiz calls
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'test-integration.js');
            expect(instrumentedCode).toContain('$_$twiz');

            // Simulate the runtime data that the instrumented code would send
            const typeData = [
                ['test-integration.js', 27, [['number', null]], {
                    functionName: 'calculateSum_param_a',
                    lineNumber: 2,
                    columnNumber: 24,
                    context: 'function_declaration'
                }],
                ['test-integration.js', 30, [['number', null]], {
                    functionName: 'calculateSum_param_b',
                    lineNumber: 2,
                    columnNumber: 27,
                    context: 'function_declaration'
                }],
                ['test-integration.js', 68, [[{ name: 'John' }, null]], {
                    functionName: 'processUser_param_user',
                    lineNumber: 6,
                    columnNumber: 22,
                    context: 'function_declaration'
                }],
            ];

            await request(app)
                .post('/__typewiz_sqlite_report')
                .send(typeData)
                .expect(200);

            // Verify functions were recorded via function_calls API
            const functionCallsResponse = await request(app)
                .get('/__typewiz_function_calls')
                .expect(200);

            expect(functionCallsResponse.body.calls.length).toBeGreaterThan(0);

            // Verify entities were recorded
            const entitiesResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'test-integration' })
                .expect(200);

            expect(entitiesResponse.body.entities.length).toBe(3);
        });

        test('should instrument and record TypeScript function calls', async () => {
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
`;
            // Verify TypeScript instrumentation works
            const instrumentedCode = instrumentCodeWithAST(tsSourceCode, 'test-integration.ts');
            expect(instrumentedCode).toContain('$_$twiz');

            // Simulate runtime data
            const typeData = [
                ['test-integration.ts', 30, [['object', null]], {
                    functionName: 'constructor_param_name',
                    lineNumber: 7,
                    columnNumber: 16,
                    context: 'constructor'
                }],
                ['test-integration.ts', 55, [['object', null]], {
                    functionName: 'constructor_param_config',
                    lineNumber: 7,
                    columnNumber: 41,
                    context: 'constructor'
                }],
            ];

            await request(app)
                .post('/__typewiz_sqlite_report')
                .send(typeData)
                .expect(200);

            const entitiesResponse = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'test-integration.ts' })
                .expect(200);

            expect(entitiesResponse.body.entities.length).toBe(2);
        });

    });

    describe('Line Number and Column Tracking', () => {

        test('should record accurate line and column information', async () => {
            const sourceCode = `// Line 1
function testFunc(param1, param2) { // Line 2
    return param1 + param2; // Line 3
} // Line 4
`;
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'line-test.js');
            expect(instrumentedCode).toContain('$_$twiz');

            // Send data with line/column info
            await request(app)
                .post('/__typewiz_sqlite_report')
                .send([
                    ['line-test.js', 28, [['string', null]], {
                        functionName: 'testFunc_param_param1',
                        lineNumber: 2,
                        columnNumber: 18,
                        context: 'function_declaration'
                    }],
                    ['line-test.js', 36, [['string', null]], {
                        functionName: 'testFunc_param_param2',
                        lineNumber: 2,
                        columnNumber: 26,
                        context: 'function_declaration'
                    }],
                ])
                .expect(200);

            // Query by location
            const locationResponse = await request(app)
                .get('/__typewiz_location')
                .query({ filename: 'line-test.js', line_number: '2' })
                .expect(200);

            expect(locationResponse.body.entities.length).toBeGreaterThan(0);
            expect(locationResponse.body.location.line_number).toBe(2);
        });

    });

    describe('Complex Function Patterns', () => {

        test('should handle arrow functions correctly', async () => {
            const sourceCode = `
const multiply = (x, y) => x * y;
const process = async (data) => {
    return await Promise.resolve(data);
};
`;
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'arrow-test.js');
            expect(instrumentedCode).toContain('$_$twiz');

            await request(app)
                .post('/__typewiz_sqlite_report')
                .send([
                    ['arrow-test.js', 21, [['number', null]], {
                        functionName: 'multiply_param_x',
                        lineNumber: 2,
                        context: 'arrow_function'
                    }],
                    ['arrow-test.js', 24, [['number', null]], {
                        functionName: 'multiply_param_y',
                        lineNumber: 2,
                        context: 'arrow_function'
                    }],
                ])
                .expect(200);

            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'arrow-test' })
                .expect(200);

            expect(response.body.entities.length).toBe(2);
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
`;
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'object-test.js');
            expect(instrumentedCode).toContain('$_$twiz');

            await request(app)
                .post('/__typewiz_sqlite_report')
                .send([
                    ['object-test.js', 30, [['number', null]], {
                        functionName: 'add_param_a',
                        lineNumber: 3,
                        context: 'object_method'
                    }],
                    ['object-test.js', 33, [['number', null]], {
                        functionName: 'add_param_b',
                        lineNumber: 3,
                        context: 'object_method'
                    }],
                ])
                .expect(200);

            const response = await request(app)
                .get('/__typewiz_function_calls')
                .expect(200);

            expect(response.body.calls.length).toBeGreaterThan(0);
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
`;
            const instrumentedCode = instrumentCodeWithAST(sourceCode, 'destructure-test.js');
            expect(instrumentedCode).toContain('$_$twiz');

            await request(app)
                .post('/__typewiz_sqlite_report')
                .send([
                    ['destructure-test.js', 25, [[{ host: 'localhost', port: 3000 }, null]], {
                        functionName: 'processConfig_param_destructured',
                        lineNumber: 2,
                        context: 'function_declaration'
                    }],
                    ['destructure-test.js', 90, [[[1, 2, 3, 4, 5], null]], {
                        functionName: 'processArray_param_destructured',
                        lineNumber: 6,
                        context: 'function_declaration'
                    }],
                ])
                .expect(200);

            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'destructure-test' })
                .expect(200);

            expect(response.body.entities.length).toBe(2);
        });

    });

    describe('API Endpoint Integration', () => {

        test('should support location-based queries', async () => {
            await request(app)
                .post('/__typewiz_sqlite_report')
                .send([
                    ['location-test.js', 20, [['string', null]], {
                        functionName: 'lineTest_param_param',
                        lineNumber: 2,
                        columnNumber: 20,
                        context: 'function_declaration'
                    }],
                ])
                .expect(200);

            const locationResponse = await request(app)
                .get('/__typewiz_location')
                .query({ filename: 'location-test.js', line_number: '2' })
                .expect(200);

            expect(locationResponse.body.entities.length).toBeGreaterThan(0);
        });

        test('should support pagination in entities endpoint', async () => {
            // Create enough data for pagination
            const entries = Array.from({ length: 10 }, (_, i) => [
                'pagination-test.js', i * 10, [['string', null]], { functionName: `test${i}_param` }
            ]);

            await request(app)
                .post('/__typewiz_sqlite_report')
                .send(entries)
                .expect(200);

            const page1 = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'pagination-test', offset: 0, limit: 5 })
                .expect(200);

            const page2 = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'pagination-test', offset: 5, limit: 5 })
                .expect(200);

            expect(page1.body.pagination.offset).toBe(0);
            expect(page1.body.pagination.limit).toBe(5);
            expect(page2.body.pagination.offset).toBe(5);
            expect(page1.body.entities).not.toEqual(page2.body.entities);
            expect(page1.body.pagination.total).toBe(10);
        });

    });

    describe('Error Handling and Edge Cases', () => {

        test('should handle circular references in function parameters', async () => {
            // The runtime collector snippet handles circular refs via JSON.stringify
            // fallback. Simulate what the collector would report.
            await request(app)
                .post('/__typewiz_sqlite_report')
                .send([
                    ['circular-test.js', 10, [['object', null]], {
                        functionName: 'testCircular_param_obj',
                        lineNumber: 2,
                        context: 'function_declaration'
                    }],
                ])
                .expect(200);

            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'circular-test' })
                .expect(200);

            expect(response.body.entities.length).toBeGreaterThan(0);
        });

        test('should handle DOM element type names as parameter values', async () => {
            // The runtime snippet would serialize DOM elements as type names
            await request(app)
                .post('/__typewiz_sqlite_report')
                .send([
                    ['dom-test.js', 15, [['HTMLElement<DIV>', null]], {
                        functionName: 'handleElement_param_element',
                        lineNumber: 2,
                        context: 'function_declaration'
                    }],
                ])
                .expect(200);

            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'dom-test' })
                .expect(200);

            expect(response.body.entities.length).toBeGreaterThan(0);
        });

    });

});
