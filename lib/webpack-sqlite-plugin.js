// JavaScript version of SQLite TypeWiz Plugin
const { createSQLiteTypeCollectorMiddleware } = require('./sqlite-collector');
const { SourceMapMapper } = require('./source-map-utils');

// Enhanced reporter that works with SQLite backend
function reporterSnippet(url = '/__typewiz_sqlite_report', interval = 1000) {
    return `
        console.log('[TypeWiz] Setting up reporter with URL: ${url}');
        if (!$_$twiz.timer) {
            $_$twiz.timer = setInterval(function() {
                var data = $_$twiz.get();
                console.log('[TypeWiz] Timer tick, collected data length:', data ? data.length : 0);
                if (data && data.length > 0) {
                    console.log('[TypeWiz] Sending data:', data);
                    var xhr = new XMLHttpRequest();
                    // Use current host and port for requests
                    var reportUrl = window.location.protocol + '//' + window.location.host + ${JSON.stringify(url)};
                    xhr.open('post', reportUrl);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.onload = function() {
                        if (xhr.status === 200) {
                            try {
                                var response = JSON.parse(xhr.responseText);
                                console.log('[TypeWiz SQLite] ✅ Processed', response.processed, 'entries in', response.processingTimeMs, 'ms');
                            } catch (e) {
                                console.log('[TypeWiz SQLite] ✅ Data sent successfully');
                            }
                        } else {
                            console.warn('[TypeWiz SQLite] ❌ Failed to send data:', xhr.status, xhr.statusText, xhr.responseText);
                        }
                    };
                    xhr.onerror = function() {
                        console.warn('[TypeWiz SQLite] ❌ Network error sending type data');
                    };
                    xhr.send(JSON.stringify(data));
                    
                    // Clear collected data after sending
                    $_$twiz.clear();
                } else {
                    console.log('[TypeWiz] No data to send yet');
                }
            }, ${interval});
            console.log('[TypeWiz] Reporter timer started with interval:', ${interval});
        }
    `;
}

// Enhanced type collector snippet that captures literal values
function getEnhancedTypeCollectorSnippet() {
    return `
        (function(host) {
            var logs = {};
            var trackedObjects = new WeakMap();
            
            function getTypeName(value, nest) {
                nest = nest || 0;
                if (nest > 5) return null;
                
                if (value === null) return 'null';
                if (['undefined', 'number', 'string', 'boolean'].indexOf(typeof value) >= 0) {
                    return typeof value;
                }
                if (value instanceof Array) {
                    var itemTypes = [];
                    for (var i = 0; i < Math.min(value.length, 10); i++) {
                        var itemType = getTypeName(value[i], nest + 1);
                        if (itemType && itemTypes.indexOf(itemType) === -1) {
                            itemTypes.push(itemType);
                        }
                    }
                    return itemTypes.length === 1 ? itemTypes[0] + '[]' : 'Array<' + itemTypes.sort().join('|') + '>';
                }
                if (typeof value === 'function') {
                    return value.name ? 'Function<' + value.name + '>' : 'Function';
                }
                if (typeof value === 'object' && value !== null) {
                    // Handle DOM elements and built-in objects better
                    if (value.nodeType) {
                        return 'HTMLElement<' + (value.tagName || 'unknown') + '>';
                    }
                    if (value instanceof HTMLCollection) return 'HTMLCollection';
                    if (value instanceof NodeList) return 'NodeList';
                    if (value instanceof Event) return 'Event<' + value.type + '>';
                    if (value instanceof Date) return 'Date';
                    if (value instanceof RegExp) return 'RegExp';
                    if (value instanceof Error) return 'Error<' + value.constructor.name + '>';
                    if (value.constructor && value.constructor.name !== 'Object') {
                        return value.constructor.name;
                    }
                    
                    // Handle plain objects
                    var keys = Object.keys(value).slice(0, 5);
                    if (keys.length === 0) {
                        // Check if it's really empty or just non-enumerable
                        var proto = Object.getPrototypeOf(value);
                        if (proto && proto !== Object.prototype) {
                            return proto.constructor ? proto.constructor.name : 'Object';
                        }
                        return 'EmptyObject';
                    }
                    var keyTypes = [];
                    for (var i = 0; i < keys.length; i++) {
                        var key = keys[i];
                        var keyType = getTypeName(value[key], nest + 1);
                        keyTypes.push(key + ': ' + (keyType || 'any'));
                    }
                    return '{ ' + keyTypes.join(', ') + (keys.length < Object.keys(value).length ? ', ...' : '') + ' }';
                }
                return typeof value;
            }
            
            function $_$twiz(name, value, pos, filename, optsJson) {
                console.log('[TypeWiz Enhanced] $_$twiz called:', { name, value, pos, filename, optsJson });
                var opts;
                try {
                    opts = JSON.parse(optsJson);
                } catch (e) {
                    opts = {};
                }
                
                var objectDeclaration = trackedObjects.get(value);
                var index = JSON.stringify({ filename: filename, pos: pos, opts: opts });
                
                try {
                    // Check if value can be meaningfully serialized
                    var shouldUseType = false;
                    var serializedValue = null;
                    
                    try {
                        serializedValue = JSON.stringify(value);
                        // If serialization results in empty object or circular reference, use type instead
                        if (serializedValue === '{}' || serializedValue === '[]' || serializedValue.length > 500) {
                            shouldUseType = true;
                        }
                    } catch (e) {
                        shouldUseType = true;
                    }
                    
                    if (!logs[index]) {
                        logs[index] = new Set();
                    }
                    
                    var valueToStore;
                    if (shouldUseType) {
                        var typeName = getTypeName(value);
                        valueToStore = typeName || typeof value;
                        console.log('[TypeWiz Enhanced] Using type name for:', name, '→', valueToStore);
                    } else {
                        valueToStore = value;
                        console.log('[TypeWiz Enhanced] Using actual value for:', name);
                    }
                    
                    var valueSpec = JSON.stringify([valueToStore, objectDeclaration]);
                    logs[index].add(valueSpec);
                    
                } catch (e) {
                    console.log('[TypeWiz Enhanced] Serialization failed, trying fallback:', e.message);
                    // Fallback to type name if value can't be serialized
                    try {
                        var typeName = getTypeName(value);
                        var typeSpec = JSON.stringify([typeName, objectDeclaration]);
                        logs[index].add(typeSpec);
                        console.log('[TypeWiz Enhanced] Fallback successful:', { name, typeName });
                    } catch (e2) {
                        console.log('[TypeWiz Enhanced] Complete failure:', e2.message);
                        // Complete failure - skip this value
                    }
                }
            }
            
            $_$twiz.get = function() {
                return Object.keys(logs).map(function(key) {
                    var parsed = JSON.parse(key);
                    var typeOptions = Array.from(logs[key]).map(function(v) { return JSON.parse(v); });
                    // Enhanced format: [filename, pos, typeOptions, metadata]
                    return [parsed.filename, parsed.pos, typeOptions, parsed.opts];
                });
            };
            
            $_$twiz.clear = function() {
                logs = {};
            };
            
            $_$twiz.track = function(value, filename, offset) {
                if (value && (typeof value === 'object' || typeof value === 'function')) {
                    trackedObjects.set(value, [filename, offset]);
                }
                return value;
            };
            
            host.$_$twiz = host.$_$twiz || $_$twiz;
        })(typeof self !== 'undefined' ? self : this);
    `;
}

class SQLiteTypewizPlugin {
    constructor(options = {}) {
        this.dbPath = options.dbPath || './typewiz-collection.db';
        this.reportUrl = options.reportUrl || '/__typewiz_sqlite_report';
        this.reportInterval = options.reportInterval || 1000;
        this.middlewareInstance = null;
    }
    
    apply(compiler) {
        this.compiler = compiler;
        compiler.hooks.compilation.tap('SQLiteTypewizPlugin', (compilation) => {
            compilation.hooks.processAssets.tap({
                name: 'SQLiteTypewizPlugin',
                stage: compilation.constructor.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE
            }, (assets) => {
                this.wrapChunks(compilation, this.getChunks(compilation));
            });
        });
    }
    
    registerAllEndpoints(app) {
        try {
            const { createSQLiteTypeCollectorMiddleware } = require('./sqlite-collector');
            const { middleware, collector, stats } = createSQLiteTypeCollectorMiddleware(this.dbPath);
            
            // Core TypeWiz endpoints
            app.post('/__typewiz_sqlite_report', (req, res) => {
                console.log('[TypeWiz Plugin] Handling data collection request');
                middleware(req, res);
            });
            
            app.get('/__typewiz_stats', (req, res) => {
                console.log('[TypeWiz Plugin] Handling stats request');
                try {
                    const statistics = stats();
                    res.json(statistics);
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });
            
            // Enhanced LLM endpoints
            this.registerLLMEndpoints(app, collector);
            
            console.log('✅ [TypeWiz Plugin] All endpoints configured:');
            console.log('   📊 POST /__typewiz_sqlite_report - Data collection');
            console.log('   📈 GET  /__typewiz_stats - Statistics');
            console.log('   🔍 GET  /__typewiz_function_calls - Function call analysis');
            console.log('   💾 GET  /__typewiz_sql - Direct SQL queries');
            console.log('   📁 GET  /__typewiz_entities - Entity browser');
            
        } catch (error) {
            console.error('❌ [TypeWiz Plugin] Failed to setup endpoints:', error.message);
        }
    }
    
    registerLLMEndpoints(app, collector) {
        // Function-specific call analysis with paging
        app.get('/__typewiz_function_calls', (req, res) => {
            const { filepath, functionName, offset = 0, pageSize = 50 } = req.query;
            
            console.log('[TypeWiz Plugin] Function calls request:', { filepath, functionName, offset, pageSize });
            
            try {
                const result = this.getFunctionCalls(collector, filepath, functionName, parseInt(offset), parseInt(pageSize));
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Direct SQL query endpoint
        app.post('/__typewiz_sql', (req, res) => {
            console.log('[TypeWiz Plugin] SQL query request');
            
            let body = '';
            req.on('data', chunk => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    const { query, params = [] } = JSON.parse(body);
                    console.log('[TypeWiz Plugin] Executing SQL:', { query, params });
                    const result = collector.db.prepare(query).all(...params);
                    res.json({ success: true, data: result, count: result.length });
                } catch (error) {
                    console.error('[TypeWiz Plugin] SQL error:', error.message);
                    res.status(500).json({ error: error.message, success: false });
                }
            });
        });
        
        // Entity browser endpoint
        app.get('/__typewiz_entities', (req, res) => {
            const { filename, limit = 100, offset = 0 } = req.query;
            
            console.log('[TypeWiz Plugin] Entities request:', { filename, limit, offset });
            
            try {
                let query = `
                    SELECT e.*, COUNT(vo.id) as value_count 
                    FROM entities e 
                    LEFT JOIN value_observations vo ON e.id = vo.entity_id
                `;
                let params = [];
                
                if (filename) {
                    query += ' WHERE e.filename LIKE ?';
                    params.push(`%${filename}%`);
                }
                
                query += ` 
                    GROUP BY e.id 
                    ORDER BY e.last_seen DESC 
                    LIMIT ? OFFSET ?
                `;
                params.push(parseInt(limit), parseInt(offset));
                
                const entities = collector.db.prepare(query).all(...params);
                const totalQuery = filename ? 
                    'SELECT COUNT(*) as total FROM entities WHERE filename LIKE ?' :
                    'SELECT COUNT(*) as total FROM entities';
                const totalParams = filename ? [`%${filename}%`] : [];
                const total = collector.db.prepare(totalQuery).get(...totalParams).total;
                
                res.json({
                    entities,
                    pagination: {
                        offset: parseInt(offset),
                        limit: parseInt(limit),
                        total,
                        hasMore: parseInt(offset) + parseInt(limit) < total
                    }
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    getFunctionCalls(collector, filepath, functionName, offset, pageSize) {
        let query = `
            SELECT 
                e.filename,
                e.entity_name,
                e.offset_position,
                e.line_number,
                e.column_number,
                e.observation_count,
                e.first_seen,
                e.last_seen,
                vo.value_type,
                vo.literal_value,
                COUNT(*) as call_count
            FROM entities e
            JOIN value_observations vo ON e.id = vo.entity_id
            WHERE 1=1
        `;
        
        let params = [];
        
        if (filepath) {
            query += ' AND e.filename LIKE ?';
            params.push(`%${filepath}%`);
        }
        
        if (functionName) {
            query += ' AND (e.entity_name LIKE ? OR vo.literal_value LIKE ?)';
            params.push(`%${functionName}%`, `%${functionName}%`);
        }
        
        query += `
            GROUP BY e.id, vo.value_type, vo.literal_value
            ORDER BY e.last_seen DESC, call_count DESC
            LIMIT ? OFFSET ?
        `;
        
        params.push(pageSize, offset);
        
        const calls = collector.db.prepare(query).all(...params);
        
        // Get total count
        let countQuery = `
            SELECT COUNT(DISTINCT e.id) as total
            FROM entities e
            JOIN value_observations vo ON e.id = vo.entity_id
            WHERE 1=1
        `;
        let countParams = [];
        
        if (filepath) {
            countQuery += ' AND e.filename LIKE ?';
            countParams.push(`%${filepath}%`);
        }
        
        if (functionName) {
            countQuery += ' AND (e.entity_name LIKE ? OR vo.literal_value LIKE ?)';
            countParams.push(`%${functionName}%`, `%${functionName}%`);
        }
        
        const total = collector.db.prepare(countQuery).get(...countParams).total;
        
        return {
            calls,
            pagination: {
                offset,
                pageSize,
                total,
                hasMore: offset + pageSize < total
            },
            filters: {
                filepath: filepath || null,
                functionName: functionName || null
            }
        };
    }
    
    getChunks(compilation) {
        return Array.from(compilation.chunks);
    }
    
    wrapFile(compilation, fileName) {
        const typeCollectorSnippet = getEnhancedTypeCollectorSnippet();
        const reporter = reporterSnippet(this.reportUrl, this.reportInterval);
        
        const { ConcatSource } = this.compiler.webpack.sources;

        compilation.assets[fileName] = new ConcatSource(
            typeCollectorSnippet,
            reporter,
            compilation.assets[fileName],
        );
    }
    
    wrapChunks(compilation, chunks) {
        chunks.forEach((chunk) => {
            chunk.files.forEach((fileName) => {
                if (/\.js$/i.test(fileName)) {
                    this.wrapFile(compilation, fileName);
                }
            });
        });
    }
    
    static createMiddleware(dbPath) {
        const path = require('path');
        const resolvedDbPath = path.resolve(dbPath || './typewiz-collection.db');
        const { middleware, collector, stats } = createSQLiteTypeCollectorMiddleware(resolvedDbPath);
        
        return {
            middleware: (app) => {
                // Follow original TypeWiz pattern: direct route registration  
                app.post('/__typewiz_sqlite_report', (req, res) => {
                    console.log('[SQLite Plugin] Handling TypeWiz POST request');
                    middleware(req, res);
                });
                
                app.get('/__typewiz_stats', (req, res) => {
                    console.log('[SQLite Plugin] Handling TypeWiz stats request');
                    try {
                        const statistics = stats();
                        res.json(statistics);
                    } catch (error) {
                        res.status(500).json({ error: error.message });
                    }
                });
                
                console.log(`[TypeWiz SQLite] Database: ${resolvedDbPath}`);
                console.log(`[TypeWiz SQLite] Endpoints: /__typewiz_sqlite_report, /__typewiz_stats`);
            },
            collector,
            stats
        };
    }
}

function sqliteTypewizCollectorMiddleware(app, dbPath) {
    const { middleware } = SQLiteTypewizPlugin.createMiddleware(dbPath);
    middleware(app);
}

// Simple direct function for easy webpack setup
function setupTypewizEndpoints(app, dbPath) {
    console.log('🔧 [TypeWiz] Setting up all endpoints...');
    try {
        const { createSQLiteTypeCollectorMiddleware } = require('./sqlite-collector');
        const { middleware, collector, stats } = createSQLiteTypeCollectorMiddleware(dbPath);
        
        // Core TypeWiz endpoints
        app.post('/__typewiz_sqlite_report', (req, res) => {
            console.log('[TypeWiz] Handling data collection request');
            middleware(req, res);
        });
        
        app.get('/__typewiz_stats', (req, res) => {
            console.log('[TypeWiz] Handling stats request');
            try {
                const statistics = stats();
                res.json(statistics);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Enhanced LLM endpoints
        registerLLMEndpoints(app, collector);
        
        console.log('✅ [TypeWiz] All endpoints configured:');
        console.log('   📊 POST /__typewiz_sqlite_report - Data collection');
        console.log('   📈 GET  /__typewiz_stats - Statistics');  
        console.log('   🔍 GET  /__typewiz_function_calls - Function call analysis');
        console.log('   📍 GET  /__typewiz_location - Location-specific type data');
        console.log('   💾 POST /__typewiz_sql - Direct SQL queries');
        console.log('   📁 GET  /__typewiz_entities - Entity browser');
        
    } catch (error) {
        console.error('❌ [TypeWiz] Failed to setup endpoints:', error.message);
    }
}

// Move the LLM endpoints registration to a separate function for reuse
function registerLLMEndpoints(app, collector) {
    // Function-specific call analysis with paging
    app.get('/__typewiz_function_calls', (req, res) => {
        const { filepath, functionName, offset = 0, pageSize = 50 } = req.query;
        
        console.log('[TypeWiz] Function calls request:', { filepath, functionName, offset, pageSize });
        
        try {
            const result = getFunctionCalls(collector, filepath, functionName, parseInt(offset), parseInt(pageSize));
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // Location-specific type data endpoint
    app.get('/__typewiz_location', (req, res) => {
        const { filename, line_number, column_number, offset = 0, pageSize = 100 } = req.query;
        
        if (!filename || !line_number) {
            return res.status(400).json({ 
                error: 'filename and line_number are required parameters',
                usage: '/__typewiz_location?filename=src/index.js&line_number=26&column_number=10&pageSize=50'
            });
        }
        
        console.log('[TypeWiz] Location request:', { filename, line_number, column_number, offset, pageSize });
        
        try {
            const result = getLocationData(collector, filename, parseInt(line_number), column_number ? parseInt(column_number) : null, parseInt(offset), parseInt(pageSize));
            res.json(result);
        } catch (error) {
            console.error('[TypeWiz] Location query error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
    
    // Direct SQL query endpoint  
    app.post('/__typewiz_sql', (req, res) => {
        console.log('[TypeWiz] SQL query request');
        
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                const { query, params = [] } = JSON.parse(body);
                console.log('[TypeWiz] Executing SQL:', { query, params });
                const result = collector.db.prepare(query).all(...params);
                res.json({ success: true, data: result, count: result.length });
            } catch (error) {
                console.error('[TypeWiz] SQL error:', error.message);
                res.status(500).json({ error: error.message, success: false });
            }
        });
    });
    
    // Entity browser endpoint
    app.get('/__typewiz_entities', (req, res) => {
        const { filename, limit = 100, offset = 0 } = req.query;
        
        console.log('[TypeWiz] Entities request:', { filename, limit, offset });
        
        try {
            let query = `
                SELECT e.*, COUNT(vo.id) as value_count 
                FROM entities e 
                LEFT JOIN value_observations vo ON e.id = vo.entity_id
            `;
            let params = [];
            
            if (filename) {
                query += ' WHERE e.filename LIKE ?';
                params.push(`%${filename}%`);
            }
            
            query += ` 
                GROUP BY e.id 
                ORDER BY e.last_seen DESC 
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), parseInt(offset));
            
            const entities = collector.db.prepare(query).all(...params);
            const totalQuery = filename ? 
                'SELECT COUNT(*) as total FROM entities WHERE filename LIKE ?' :
                'SELECT COUNT(*) as total FROM entities';
            const totalParams = filename ? [`%${filename}%`] : [];
            const total = collector.db.prepare(totalQuery).get(...totalParams).total;
            
            res.json({
                entities,
                pagination: {
                    offset: parseInt(offset),
                    limit: parseInt(limit),
                    total,
                    hasMore: parseInt(offset) + parseInt(limit) < total
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

function getFunctionCalls(collector, filepath, functionName, offset, pageSize) {
    let query = `
        SELECT 
            e.filename,
            e.entity_name,
            e.offset_position,
            e.line_number,
            e.column_number,
            e.observation_count,
            e.first_seen,
            e.last_seen,
            vo.value_type,
            vo.literal_value,
            COUNT(*) as call_count
        FROM entities e
        JOIN value_observations vo ON e.id = vo.entity_id
        WHERE 1=1
    `;
    
    let params = [];
    
    if (filepath) {
        query += ' AND e.filename LIKE ?';
        params.push(`%${filepath}%`);
    }
    
    if (functionName) {
        query += ' AND (e.entity_name LIKE ? OR vo.literal_value LIKE ?)';
        params.push(`%${functionName}%`, `%${functionName}%`);
    }
    
    query += `
        GROUP BY e.id, vo.value_type, vo.literal_value
        ORDER BY e.last_seen DESC, call_count DESC
        LIMIT ? OFFSET ?
    `;
    
    params.push(pageSize, offset);
    
    const calls = collector.db.prepare(query).all(...params);
    
    // Get total count
    let countQuery = `
        SELECT COUNT(DISTINCT e.id) as total
        FROM entities e
        JOIN value_observations vo ON e.id = vo.entity_id
        WHERE 1=1
    `;
    let countParams = [];
    
    if (filepath) {
        countQuery += ' AND e.filename LIKE ?';
        countParams.push(`%${filepath}%`);
    }
    
    if (functionName) {
        countQuery += ' AND (e.entity_name LIKE ? OR vo.literal_value LIKE ?)';
        countParams.push(`%${functionName}%`, `%${functionName}%`);
    }
    
    const total = collector.db.prepare(countQuery).get(...countParams).total;
    
    return {
        calls,
        pagination: {
            offset,
            pageSize,
            total,
            hasMore: offset + pageSize < total
        },
        filters: {
            filepath: filepath || null,
            functionName: functionName || null
        }
    };
}

function getLocationData(collector, filename, lineNumber, columnNumber, offset, pageSize) {
    // Build query for location-specific data
    let query = `
        SELECT 
            e.id,
            e.filename,
            e.entity_name,
            e.entity_type,
            e.offset_position,
            e.line_number,
            e.column_number,
            e.observation_count,
            e.first_seen,
            e.last_seen,
            vo.value_type,
            vo.literal_value,
            vo.context,
            vo.observation_count as value_observation_count,
            vo.first_seen as value_first_seen,
            vo.last_seen as value_last_seen
        FROM entities e
        LEFT JOIN value_observations vo ON e.id = vo.entity_id
        WHERE e.filename LIKE ?
        AND e.line_number = ?
    `;
    
    let params = [`%${filename}%`, lineNumber];
    
    // Add column number filter if specified
    if (columnNumber !== null) {
        query += ' AND e.column_number = ?';
        params.push(columnNumber);
    }
    
    query += `
        ORDER BY e.offset_position ASC, vo.value_type ASC
        LIMIT ? OFFSET ?
    `;
    
    params.push(pageSize, offset);
    
    const locationData = collector.db.prepare(query).all(...params);
    
    // Get total count for pagination
    let countQuery = `
        SELECT COUNT(*) as total
        FROM entities e
        LEFT JOIN value_observations vo ON e.id = vo.entity_id
        WHERE e.filename LIKE ?
        AND e.line_number = ?
    `;
    
    let countParams = [`%${filename}%`, lineNumber];
    
    if (columnNumber !== null) {
        countQuery += ' AND e.column_number = ?';
        countParams.push(columnNumber);
    }
    
    const total = collector.db.prepare(countQuery).get(...countParams).total;
    
    // Group results by entity for better structure
    const entitiesByLocation = {};
    locationData.forEach(row => {
        const entityKey = `${row.filename}_${row.offset_position}`;
        
        if (!entitiesByLocation[entityKey]) {
            entitiesByLocation[entityKey] = {
                entity: {
                    id: row.id,
                    filename: row.filename,
                    entity_name: row.entity_name,
                    entity_type: row.entity_type,
                    offset_position: row.offset_position,
                    line_number: row.line_number,
                    column_number: row.column_number,
                    observation_count: row.observation_count,
                    first_seen: row.first_seen,
                    last_seen: row.last_seen
                },
                value_observations: []
            };
        }
        
        // Add value observation if it exists
        if (row.value_type) {
            entitiesByLocation[entityKey].value_observations.push({
                value_type: row.value_type,
                literal_value: row.literal_value,
                context: row.context,
                observation_count: row.value_observation_count,
                first_seen: row.value_first_seen,
                last_seen: row.value_last_seen
            });
        }
    });
    
    return {
        location: {
            filename,
            line_number: lineNumber,
            column_number: columnNumber
        },
        entities: Object.values(entitiesByLocation),
        pagination: {
            offset,
            pageSize,
            total,
            hasMore: offset + pageSize < total
        },
        summary: {
            total_entities: Object.keys(entitiesByLocation).length,
            total_observations: locationData.filter(row => row.value_type).length
        }
    };
}

module.exports = {
    SQLiteTypewizPlugin,
    sqliteTypewizCollectorMiddleware,
    setupTypewizEndpoints
};