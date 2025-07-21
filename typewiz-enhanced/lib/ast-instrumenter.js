// AST-based TypeWiz Enhanced instrumentation with TypeScript compatibility
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function instrumentCodeWithAST(source, filename, options = {}) {
    try {
        const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
        
        // Parse the source code into an AST
        const parserOptions = {
            sourceType: 'module',
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
            plugins: [
                'jsx',
                'decorators-legacy',
                'classProperties',
                'objectRestSpread',
                'functionBind',
                'exportDefaultFrom',
                'exportNamespaceFrom',
                'dynamicImport',
                'nullishCoalescingOperator',
                'optionalChaining'
            ]
        };

        // Add TypeScript-specific plugins for .ts files
        if (isTypeScript) {
            parserOptions.plugins.push(
                'typescript',
                'decorators-legacy'
            );
        }

        const ast = parser.parse(source, parserOptions);

        // Track instrumentation to avoid duplicates
        const instrumentedFunctions = new Set();

        // Traverse the AST and add instrumentation
        traverse(ast, {
            // Handle function declarations: function myFunc(param1, param2) {}
            FunctionDeclaration(path) {
                const node = path.node;
                const funcName = node.id ? node.id.name : 'anonymous';
                const key = `${funcName}_${path.node.start}`;
                
                if (instrumentedFunctions.has(key)) return;
                instrumentedFunctions.add(key);

                instrumentFunction(path, funcName, filename, 'function_declaration', isTypeScript);
            },

            // Handle method definitions: methodName(param1, param2) {}
            ClassMethod(path) {
                const node = path.node;
                const methodName = node.key.name || 'anonymous';
                const key = `${methodName}_${path.node.start}`;
                
                if (instrumentedFunctions.has(key)) return;
                instrumentedFunctions.add(key);

                const context = node.kind === 'constructor' ? 'constructor' : 'class_method';
                instrumentFunction(path, methodName, filename, context, isTypeScript);
            },

            // Handle object method definitions: { methodName(param1, param2) {} }
            ObjectMethod(path) {
                const node = path.node;
                const methodName = node.key.name || node.key.value || 'anonymous';
                const key = `${methodName}_${path.node.start}`;
                
                if (instrumentedFunctions.has(key)) return;
                instrumentedFunctions.add(key);

                instrumentFunction(path, methodName, filename, 'object_method', isTypeScript);
            },

            // Handle arrow functions: const myFunc = (param1, param2) => {}
            VariableDeclarator(path) {
                const node = path.node;
                if (t.isArrowFunctionExpression(node.init)) {
                    const funcName = node.id.name;
                    const key = `${funcName}_${path.node.start}`;
                    
                    if (instrumentedFunctions.has(key)) return;
                    instrumentedFunctions.add(key);

                    instrumentArrowFunction(path, funcName, filename, isTypeScript);
                }
            }
        });

        // Add the TypeWiz runtime at the beginning
        const runtimeCode = createTypeWizRuntime(isTypeScript);
        const runtimeAST = parser.parse(runtimeCode, { sourceType: 'script' });
        
        ast.program.body.unshift(...runtimeAST.program.body);

        // Generate the instrumented code with custom comment injection for TypeScript
        let result = generate(ast, {
            retainLines: true,
            compact: false,
            comments: true
        });
        
        // Add @ts-expect-error comments for TypeScript files via string replacement
        if (isTypeScript) {
            result.code = result.code.replace(/try \{\$_\$twiz\(/g, '// @ts-expect-error TypeWiz runtime injection\n      try {$_$twiz(');
        }

        return result.code;

    } catch (error) {
        console.warn(`[TypeWiz AST] Failed to instrument ${filename}:`, error.message);
        return source; // Return original source if instrumentation fails
    }
}

function instrumentFunction(path, funcName, filename, context, isTypeScript) {
    const node = path.node;
    const params = node.params;
    const funcLocation = getLocationInfo(node);
    
    if (params.length === 0) {
        // Just add entry instrumentation for parameterless functions
        const entryCall = createTypeWizCall(
            `${funcName}_entry`,
            t.stringLiteral(funcName),
            node.start || 0,
            filename,
            {
                functionName: funcName,
                context: context + '_entry',
                hasParameters: false,
                lineNumber: funcLocation.line,
                columnNumber: funcLocation.column
            },
            isTypeScript
        );
        
        if (t.isBlockStatement(node.body)) {
            node.body.body.unshift(entryCall);
        }
        return;
    }

    // Create instrumentation for each parameter
    const instrumentationStatements = [];
    
    params.forEach((param, index) => {
        const paramInfo = extractParameterInfo(param);
        if (paramInfo && paramInfo.name) {
            const paramLocation = getLocationInfo(param);
            const call = createTypeWizCall(
                `${funcName}_param_${paramInfo.name}`,
                t.identifier(paramInfo.name),
                param.start || 0,
                filename,
                {
                    functionName: funcName,
                    parameterName: paramInfo.name,
                    parameterIndex: index,
                    parameterType: paramInfo.typeAnnotation || 'untyped',
                    hasDefault: paramInfo.hasDefault || false,
                    isDestructured: paramInfo.isDestructured || false,
                    isRest: paramInfo.isRest || false,
                    accessibility: paramInfo.accessibility || null,
                    context: context + '_parameter',
                    lineNumber: paramLocation.line,
                    columnNumber: paramLocation.column
                },
                isTypeScript
            );
            instrumentationStatements.push(call);
        }
    });
    
    // Add entry instrumentation
    const entryCall = createTypeWizCall(
        `${funcName}_entry`,
        t.stringLiteral(funcName),
        node.start || 0,
        filename,
        {
            functionName: funcName,
            context: context + '_entry',
            hasParameters: true,
            parameterCount: params.length,
            lineNumber: funcLocation.line,
            columnNumber: funcLocation.column
        },
        isTypeScript
    );
    instrumentationStatements.unshift(entryCall);
    
    // Insert instrumentation at the beginning of the function body
    if (t.isBlockStatement(node.body)) {
        node.body.body.unshift(...instrumentationStatements);
    }
}

// Extract parameter information, handling TypeScript annotations and destructuring
function extractParameterInfo(param) {
    // Handle TypeScript parameter properties: public id: string
    if (param.type === 'TSParameterProperty' && param.parameter) {
        const innerParam = param.parameter;
        
        // Handle TypeScript parameter property with default value: public completed: boolean = false
        if (t.isAssignmentPattern(innerParam) && t.isIdentifier(innerParam.left)) {
            return {
                name: innerParam.left.name,
                typeAnnotation: innerParam.left.typeAnnotation ? 'annotated' : null,
                hasDefault: true,
                accessibility: param.accessibility || null
            };
        } else if (t.isIdentifier(innerParam)) {
            // Handle TypeScript parameter property without default: public id: string
            return {
                name: innerParam.name,
                typeAnnotation: innerParam.typeAnnotation ? 'annotated' : null,
                accessibility: param.accessibility || null
            };
        }
    } else if (t.isIdentifier(param)) {
        return {
            name: param.name,
            typeAnnotation: param.typeAnnotation ? 'annotated' : null
        };
    } else if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
        // Handle default parameters: param = defaultValue
        return {
            name: param.left.name,
            typeAnnotation: param.left.typeAnnotation ? 'annotated' : null,
            hasDefault: true
        };
    } else if (t.isAssignmentPattern(param) && param.left.type === 'TSParameterProperty') {
        // Handle TypeScript parameter properties with default values: public id: string = 'default'
        const innerParam = param.left.parameter;
        return {
            name: innerParam.name,
            typeAnnotation: innerParam.typeAnnotation ? 'annotated' : null,
            hasDefault: true,
            accessibility: param.left.accessibility || null
        };
    } else if (t.isObjectPattern(param)) {
        // Handle object destructuring: { prop1, prop2 }
        return {
            name: 'destructured_object',
            typeAnnotation: param.typeAnnotation ? 'annotated' : null,
            isDestructured: true
        };
    } else if (t.isArrayPattern(param)) {
        // Handle array destructuring: [item1, item2]
        return {
            name: 'destructured_array',
            typeAnnotation: param.typeAnnotation ? 'annotated' : null,
            isDestructured: true
        };
    } else if (t.isRestElement(param) && t.isIdentifier(param.argument)) {
        // Handle rest parameters: ...args
        return {
            name: param.argument.name,
            typeAnnotation: param.argument.typeAnnotation ? 'annotated' : null,
            isRest: true
        };
    }
    
    return null;
}

function instrumentArrowFunction(path, funcName, filename, isTypeScript) {
    const arrowFunc = path.node.init;
    const params = arrowFunc.params;
    
    if (params.length === 0) return;
    
    // Create instrumentation for each parameter
    const instrumentationStatements = [];
    
    params.forEach((param, index) => {
        const paramInfo = extractParameterInfo(param);
        if (paramInfo && paramInfo.name) {
            const paramLocation = getLocationInfo(param);
            const call = createTypeWizCall(
                `${funcName}_param_${paramInfo.name}`,
                t.identifier(paramInfo.name),
                param.start || 0,
                filename,
                {
                    functionName: funcName,
                    parameterName: paramInfo.name,
                    parameterIndex: index,
                    parameterType: paramInfo.typeAnnotation || 'untyped',
                    hasDefault: paramInfo.hasDefault || false,
                    isDestructured: paramInfo.isDestructured || false,
                    isRest: paramInfo.isRest || false,
                    accessibility: paramInfo.accessibility || null,
                    context: 'arrow_function_parameter',
                    lineNumber: paramLocation.line,
                    columnNumber: paramLocation.column
                },
                isTypeScript
            );
            instrumentationStatements.push(call);
        }
    });
    
    // Ensure the arrow function has a block statement body
    if (!t.isBlockStatement(arrowFunc.body)) {
        const returnStatement = t.returnStatement(arrowFunc.body);
        arrowFunc.body = t.blockStatement([...instrumentationStatements, returnStatement]);
    } else {
        arrowFunc.body.body.unshift(...instrumentationStatements);
    }
}

// Helper function to extract line and column information from AST nodes
function getLocationInfo(node) {
    // Handle TypeScript parameter properties which have nested location info
    if (node.type === 'TSParameterProperty' && node.parameter) {
        node = node.parameter;
        if (t.isAssignmentPattern(node) && node.left) {
            node = node.left;
        }
    }
    
    // Extract location from AST node
    if (node.loc && node.loc.start) {
        return {
            line: node.loc.start.line,
            column: node.loc.start.column
        };
    }
    
    // Fallback to default values if no location info available
    return {
        line: 1,
        column: 0
    };
}


function createTypeWizCall(name, value, offset, filename, metadata, isTypeScript) {
    const callExpression = t.callExpression(
        t.identifier('$_$twiz'),
        [
            t.stringLiteral(name),
            value,
            t.numericLiteral(offset),
            t.stringLiteral(filename),
            t.objectExpression(
                Object.entries(metadata).map(([key, val]) =>
                    t.objectProperty(
                        t.identifier(key),
                        typeof val === 'string' ? t.stringLiteral(val) :
                        typeof val === 'number' ? t.numericLiteral(val) :
                        typeof val === 'boolean' ? t.booleanLiteral(val) :
                        t.stringLiteral(String(val))
                    )
                )
            )
        ]
    );
    
    const tryStatement = t.tryStatement(
        t.blockStatement([t.expressionStatement(callExpression)]),
        t.catchClause(t.identifier('e'), t.blockStatement([]))
    );
    
    return tryStatement;
}

function createTypeWizRuntime(isTypeScript = false) {
    const tsComment = isTypeScript ? '// @ts-expect-error TypeWiz runtime injection\n' : '';
    return `${tsComment}
// TypeWiz Enhanced Runtime with AST-based instrumentation
if (typeof window !== 'undefined' && typeof $_$twiz === 'undefined') {
    window.__typewiz_logs = {};
    window.__typewiz_batch = [];
    window.__typewiz_batch_timer = null;
    
    // Safe JSON stringify that handles circular references
    window.__typewiz_safe_stringify = function(obj) {
        try {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj !== 'object') return obj;
            
            const seen = new WeakSet();
            return JSON.parse(JSON.stringify(obj, function(key, val) {
                if (val != null && typeof val === 'object') {
                    if (seen.has(val)) return '[Circular Reference]';
                    seen.add(val);
                    
                    if (val.nodeType) return '[DOM Element: ' + (val.tagName || 'unknown') + ']';
                    if (val instanceof Event) return '[Event: ' + val.type + ']';
                    if (val instanceof HTMLCollection) return '[HTMLCollection]';
                    if (val instanceof NodeList) return '[NodeList]';
                }
                return val;
            }));
        } catch (e) {
            return '[Serialization Error: ' + e.message + ']';
        }
    };
    
    window.$_$twiz = function(name, value, offset, filename, metadata) {
        try {
            // Store data locally for .get() method
            const key = filename + ':' + offset;
            if (!window.__typewiz_logs[key]) {
                window.__typewiz_logs[key] = [];
            }
            
            const safeValue = window.__typewiz_safe_stringify(value);
            window.__typewiz_logs[key].push([safeValue, null]);
            
            // Add to batch instead of sending immediately
            const typeData = [filename, offset, [[safeValue, null]], metadata];
            window.__typewiz_batch.push(typeData);
            
            // Start batch timer if not already running
            if (!window.__typewiz_batch_timer) {
                window.__typewiz_batch_timer = setTimeout(() => {
                    if (window.__typewiz_batch.length > 0 && typeof fetch !== 'undefined') {
                        console.log('[TypeWiz] Sending batch of', window.__typewiz_batch.length, 'entries');
                        try {
                            fetch('/__typewiz_sqlite_report', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(window.__typewiz_batch)
                            }).catch(e => console.warn('[TypeWiz] Batch collection failed:', e));
                        } catch (e) {
                            console.warn('[TypeWiz] Failed to stringify batch:', e);
                        }
                        
                        // Clear batch
                        window.__typewiz_batch = [];
                    }
                    window.__typewiz_batch_timer = null;
                }, 2000);
            }
        } catch (e) {
            console.warn('[TypeWiz] $_$twiz error:', e);
        }
    };
    
    // Add get method for compatibility with tests
    window.$_$twiz.get = function() {
        return Object.keys(window.__typewiz_logs).map(key => {
            const [filename, offset] = key.split(':');
            return [filename, parseInt(offset), window.__typewiz_logs[key], {}];
        });
    };
    
    // Add clear method for compatibility with tests
    window.$_$twiz.clear = function() {
        window.__typewiz_logs = {};
        window.__typewiz_batch = [];
        if (window.__typewiz_batch_timer) {
            clearTimeout(window.__typewiz_batch_timer);
            window.__typewiz_batch_timer = null;
        }
    };
    
    console.log('[TypeWiz Enhanced] 🚀 AST-based function argument instrumentation active');
}
`;
}

module.exports = { instrumentCodeWithAST };