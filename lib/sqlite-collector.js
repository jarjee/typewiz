// JavaScript version of SQLite Type Collector
const Database = require('better-sqlite3');
const crypto = require('crypto');

class SQLiteTypeCollector {
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.initializeSchema();
    }
    
    initializeSchema() {
        const schema = `
            -- Core entity tracking
            CREATE TABLE IF NOT EXISTS entities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                entity_name TEXT,
                entity_type TEXT NOT NULL DEFAULT 'unknown',
                offset_position INTEGER,
                line_number INTEGER,
                column_number INTEGER,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                observation_count INTEGER DEFAULT 1,
                UNIQUE(filename, offset_position)
            );
            
            -- Literal value observations (stores actual values, not just types)
            CREATE TABLE IF NOT EXISTS value_observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id INTEGER REFERENCES entities(id),
                value_type TEXT NOT NULL,
                literal_value TEXT,
                value_hash TEXT,
                context TEXT DEFAULT 'inferred',
                observation_count INTEGER DEFAULT 1,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                source_location TEXT,
                UNIQUE(entity_id, value_hash, context)
            );
            
            -- String literal analysis (for enum detection)
            CREATE TABLE IF NOT EXISTS string_literals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id INTEGER REFERENCES entities(id),
                string_value TEXT NOT NULL,
                observation_count INTEGER DEFAULT 1,
                context TEXT DEFAULT 'parameter',
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(entity_id, string_value, context)
            );
            
            -- Object shape analysis
            CREATE TABLE IF NOT EXISTS object_shapes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id INTEGER REFERENCES entities(id),
                shape_signature TEXT NOT NULL,
                property_names TEXT NOT NULL,
                property_types TEXT NOT NULL,
                observation_count INTEGER DEFAULT 1,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(entity_id, shape_signature)
            );
            
            -- HOF (Higher-Order Function) relationship tracking
            -- Records when a callback is passed to a known factory/HOF call,
            -- linking the callback entity to the enclosing call expression.
            CREATE TABLE IF NOT EXISTS hof_relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                callback_entity_id INTEGER REFERENCES entities(id),
                callee_name TEXT NOT NULL,
                callee_arg_index INTEGER NOT NULL,
                source_filename TEXT,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                observation_count INTEGER DEFAULT 1,
                UNIQUE(callback_entity_id, callee_name, callee_arg_index)
            );

            -- Performance indexes
            CREATE INDEX IF NOT EXISTS idx_entities_file ON entities(filename);
            CREATE INDEX IF NOT EXISTS idx_entities_offset ON entities(offset_position);
            CREATE INDEX IF NOT EXISTS idx_values_entity ON value_observations(entity_id);
            CREATE INDEX IF NOT EXISTS idx_values_type ON value_observations(value_type);
            CREATE INDEX IF NOT EXISTS idx_values_hash ON value_observations(value_hash);
            CREATE INDEX IF NOT EXISTS idx_strings_entity ON string_literals(entity_id);
            CREATE INDEX IF NOT EXISTS idx_strings_value ON string_literals(string_value);
            CREATE INDEX IF NOT EXISTS idx_shapes_entity ON object_shapes(entity_id);
            CREATE INDEX IF NOT EXISTS idx_hof_callback ON hof_relationships(callback_entity_id);
            CREATE INDEX IF NOT EXISTS idx_hof_callee ON hof_relationships(callee_name);
        `;
        
        this.db.exec(schema);
    }
    
    processTypeData(entries) {
        const upsertEntity = this.db.prepare(`
            INSERT INTO entities (filename, offset_position, observation_count, last_seen)
            VALUES (?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(filename, offset_position) DO UPDATE SET
                observation_count = observation_count + 1,
                last_seen = CURRENT_TIMESTAMP
            RETURNING id
        `);
        
        const upsertValueObservation = this.db.prepare(`
            INSERT INTO value_observations (entity_id, value_type, literal_value, value_hash, context, observation_count, last_seen, source_location)
            VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(entity_id, value_hash, context) DO UPDATE SET
                observation_count = observation_count + 1,
                last_seen = CURRENT_TIMESTAMP
        `);
        
        const upsertStringLiteral = this.db.prepare(`
            INSERT INTO string_literals (entity_id, string_value, context, observation_count, last_seen)
            VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(entity_id, string_value, context) DO UPDATE SET
                observation_count = observation_count + 1,
                last_seen = CURRENT_TIMESTAMP
        `);
        
        const upsertObjectShape = this.db.prepare(`
            INSERT INTO object_shapes (entity_id, shape_signature, property_names, property_types, observation_count, last_seen)
            VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(entity_id, shape_signature) DO UPDATE SET
                observation_count = observation_count + 1,
                last_seen = CURRENT_TIMESTAMP
        `);

        const upsertHofRelationship = this.db.prepare(`
            INSERT INTO hof_relationships (callback_entity_id, callee_name, callee_arg_index, source_filename, observation_count, last_seen)
            VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(callback_entity_id, callee_name, callee_arg_index) DO UPDATE SET
                observation_count = observation_count + 1,
                last_seen = CURRENT_TIMESTAMP
        `);
        
        this.db.transaction(() => {
            for (const entry of entries) {
                try {
                    // Handle both array format [filename, offset, types, metadata] and object format
                    const filename = Array.isArray(entry) ? entry[0] : entry.filename;
                    const offset = Array.isArray(entry) ? entry[1] : entry.offset;
                    const types = Array.isArray(entry) ? entry[2] : entry.types;
                    const metadata = Array.isArray(entry) ? entry[3] : entry.metadata;
                    
                    if (!filename) {
                        console.warn('Skipping entry with missing filename:', entry);
                        continue;
                    }
                    
                    // Extract enhanced context information
                    let functionName = null;
                    let lineNumber = null;
                    let columnNumber = null;
                    let context = 'unknown';
                    
                    // Parse metadata if available
                    if (metadata && typeof metadata === 'object') {
                        functionName = metadata.functionName || null;
                        lineNumber = metadata.lineNumber || null;
                        columnNumber = metadata.columnNumber || null;
                        context = metadata.context || 'unknown';
                    }
                    
                    // Update entity with enhanced information
                    const entityResult = upsertEntity.get(filename, offset);
                    const entityId = entityResult.id;
                    
                    // Update entity_name and line/column info if we have it
                    if (functionName || lineNumber !== null) {
                        const updateEntity = this.db.prepare(`
                            UPDATE entities
                            SET entity_name = COALESCE(?, entity_name),
                                line_number = COALESCE(?, line_number),
                                column_number = COALESCE(?, column_number),
                                entity_type = ?
                            WHERE id = ?
                        `);
                        updateEntity.run(functionName, lineNumber, columnNumber, context, entityId);
                    }

                    // Record HOF relationship if this entity is a callback argument
                    if (metadata && metadata.calleeName && metadata.calleeArgIndex !== undefined) {
                        upsertHofRelationship.run(
                            entityId,
                            metadata.calleeName,
                            metadata.calleeArgIndex,
                            filename
                        );
                    }

                    for (const [rawValue, sourceLocation] of types) {
                        if (rawValue !== undefined && rawValue !== null) {
                            const sourceLocationStr = sourceLocation ? 
                                `${sourceLocation[0]}:${sourceLocation[1]}` : 
                                (lineNumber !== null ? `${lineNumber}:${columnNumber || 0}` : null);
                            
                            this.processLiteralValue(
                                entityId, 
                                rawValue, 
                                sourceLocationStr,
                                upsertValueObservation,
                                upsertStringLiteral,
                                upsertObjectShape,
                                functionName,
                                context
                            );
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to process entry:`, entry, error);
                }
            }
        })();
    }
    
    processLiteralValue(entityId, value, sourceLocation, upsertValueObservation, upsertStringLiteral, upsertObjectShape, functionName = null, context = 'unknown') {
        const valueType = this.getValueType(value);
        const literalValue = this.serializeLiteralValue(value, valueType);
        const valueHash = this.hashValue(literalValue);
        
        // Enhanced context for value observations
        const enhancedContext = functionName ? `${context}_in_${functionName}` : context;
        
        // Store the literal value observation
        upsertValueObservation.run(
            entityId,
            valueType,
            literalValue,
            valueHash,
            enhancedContext,
            sourceLocation
        );
        
        // Special processing for strings (enum detection)
        if (valueType === 'string' && typeof value === 'string') {
            if (this.isEnumCandidateString(value)) {
                upsertStringLiteral.run(entityId, value, 'parameter');
            }
        }
        
        // Special processing for objects (shape analysis)
        if (valueType === 'object' && value && typeof value === 'object') {
            const shape = this.analyzeObjectShape(value);
            if (shape) {
                upsertObjectShape.run(
                    entityId,
                    shape.signature,
                    shape.propertyNames,
                    shape.propertyTypes
                );
            }
        }
    }
    
    getValueType(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'Date';
        if (value instanceof RegExp) return 'RegExp';
        return typeof value;
    }
    
    serializeLiteralValue(value, valueType) {
        try {
            switch (valueType) {
                case 'string':
                case 'number':
                case 'boolean':
                case 'null':
                case 'undefined':
                    return JSON.stringify(value);
                
                case 'object':
                    return JSON.stringify(value, null, 0).slice(0, 1000);
                
                case 'array':
                    const arr = value;
                    const limited = arr.slice(0, 10);
                    return JSON.stringify(limited);
                
                case 'Date':
                    return JSON.stringify({ _type: 'Date', value: value.toISOString() });
                
                case 'RegExp':
                    return JSON.stringify({ _type: 'RegExp', value: value.toString() });
                
                case 'function':
                    return JSON.stringify({ _type: 'Function', name: value.name || 'anonymous' });
                
                default:
                    return JSON.stringify({ _type: valueType, value: String(value) });
            }
        } catch (error) {
            return JSON.stringify({ _error: 'serialization_failed', type: valueType });
        }
    }
    
    hashValue(literalValue) {
        return crypto.createHash('md5').update(literalValue).digest('hex').slice(0, 8);
    }
    
    isEnumCandidateString(value) {
        if (value.length === 0 || value.length > 50) return false;
        if (value.includes('/') || value.includes('\\')) return false;
        if (value.includes('http')) return false;
        if (/^\d+$/.test(value)) return false;
        if (value.includes(' ') && value.split(' ').length > 3) return false;
        return true;
    }
    
    analyzeObjectShape(obj) {
        try {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
            
            const keys = Object.keys(obj);
            if (keys.length === 0 || keys.length > 20) return null;
            
            const propertyTypes = {};
            const sortedKeys = keys.sort();
            
            for (const key of sortedKeys) {
                const valueType = this.getValueType(obj[key]);
                propertyTypes[key] = valueType;
            }
            
            const signature = sortedKeys.map(key => `${key}:${propertyTypes[key]}`).join(',');
            
            return {
                signature,
                propertyNames: sortedKeys.join(','),
                propertyTypes: JSON.stringify(propertyTypes)
            };
        } catch (error) {
            return null;
        }
    }
    
    middleware() {
        return (req, res) => {
            console.log('[SQLite Collector] Received request to:', req.url);
            let body = '';
            req.on('data', chunk => {
                body += chunk;
                console.log('[SQLite Collector] Received data chunk, total length:', body.length);
            });
            req.on('end', () => {
                console.log('[SQLite Collector] Request body:', body);
                try {
                    const typeData = JSON.parse(body);
                    console.log('[SQLite Collector] Parsed data entries:', typeData.length);
                    const startTime = Date.now();
                    
                    this.processTypeData(typeData);
                    
                    const processingTime = Date.now() - startTime;
                    const result = { 
                        status: 'success', 
                        processed: typeData.length,
                        processingTimeMs: processingTime
                    };
                    console.log('[SQLite Collector] Processing complete:', result);
                    res.json(result);
                } catch (error) {
                    console.error('[SQLite Collector] Error processing type data:', error);
                    res.status(400).json({ error: error.message });
                }
            });
        };
    }
    
    getStats() {
        const stats = this.db.prepare(`
            SELECT 
                COUNT(*) as total_entities,
                COUNT(DISTINCT filename) as unique_files,
                SUM(observation_count) as total_observations,
                AVG(observation_count) as avg_observations_per_entity
            FROM entities
        `).get();
        
        const valueTypeStats = this.db.prepare(`
            SELECT 
                value_type,
                COUNT(*) as unique_values,
                SUM(observation_count) as total_observations
            FROM value_observations
            GROUP BY value_type
            ORDER BY total_observations DESC
        `).all();
        
        const enumCandidates = this.db.prepare(`
            SELECT 
                COUNT(DISTINCT entity_id) as entities_with_strings,
                COUNT(*) as total_string_literals,
                SUM(observation_count) as total_string_observations
            FROM string_literals
        `).get();
        
        const objectShapes = this.db.prepare(`
            SELECT 
                COUNT(DISTINCT entity_id) as entities_with_objects,
                COUNT(*) as unique_object_shapes,
                SUM(observation_count) as total_object_observations
            FROM object_shapes
        `).get();
        
        return {
            overview: stats,
            valueTypes: valueTypeStats,
            enumAnalysis: enumCandidates,
            objectAnalysis: objectShapes
        };
    }
    
    close() {
        this.db.close();
    }
}

function createSQLiteTypeCollectorMiddleware(dbPath) {
    const collector = new SQLiteTypeCollector(dbPath);
    
    return {
        middleware: collector.middleware(),
        collector,
        stats: () => collector.getStats()
    };
}

module.exports = {
    SQLiteTypeCollector,
    createSQLiteTypeCollectorMiddleware
};