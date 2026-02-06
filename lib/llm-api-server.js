// JavaScript version of LLM API Server
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

class LLMQueryInterface {
    constructor(db) {
        this.db = db;
    }
    
    getEntitySummary(filename, limit = 100) {
        const query = `
            SELECT 
                e.filename,
                e.entity_name,
                e.entity_type,
                e.offset_position,
                e.observation_count,
                GROUP_CONCAT(DISTINCT v.value_type) as value_types,
                GROUP_CONCAT(DISTINCT CASE 
                    WHEN LENGTH(v.literal_value) > 100 THEN 
                        SUBSTR(v.literal_value, 1, 100) || '...'
                    ELSE v.literal_value 
                END, ' | ') as literal_examples,
                e.last_seen
            FROM entities e
            LEFT JOIN value_observations v ON e.id = v.entity_id
            ${filename ? 'WHERE e.filename = ?' : ''}
            GROUP BY e.id
            ORDER BY e.observation_count DESC
            LIMIT ?
        `;
        
        const params = filename ? [filename, limit] : [limit];
        return this.db.prepare(query).all(...params);
    }
    
    findEnumCandidates(minObservations = 3, minUniqueStrings = 2) {
        const query = `
            SELECT 
                e.filename,
                e.offset_position,
                e.entity_name,
                GROUP_CONCAT(s.string_value, ' | ') as string_values,
                SUM(s.observation_count) as total_observations,
                COUNT(DISTINCT s.string_value) as unique_strings
            FROM entities e
            JOIN string_literals s ON e.id = s.entity_id
            GROUP BY e.id
            HAVING total_observations >= ? AND unique_strings >= ? AND unique_strings <= 20
            ORDER BY total_observations DESC, unique_strings DESC
        `;
        
        const results = this.db.prepare(query).all(minObservations, minUniqueStrings);
        
        return results.map(candidate => ({
            ...candidate,
            suggested_enum_name: this.generateEnumName(candidate.filename, candidate.string_values)
        }));
    }
    
    findObjectShapes(minObservations = 3) {
        const query = `
            SELECT 
                e.filename,
                e.offset_position,
                e.entity_name,
                o.shape_signature,
                o.property_names,
                o.property_types,
                o.observation_count
            FROM entities e
            JOIN object_shapes o ON e.id = o.entity_id
            WHERE o.observation_count >= ?
            ORDER BY o.observation_count DESC
        `;
        
        const results = this.db.prepare(query).all(minObservations);
        
        return results.map(shape => ({
            ...shape,
            suggested_interface: this.generateInterfaceDefinition(shape)
        }));
    }
    
    getAnnotationCandidates(minObservations = 5) {
        const query = `
            SELECT 
                e.filename,
                e.offset_position,
                e.entity_name,
                v.value_type,
                COUNT(DISTINCT v.literal_value) as unique_values,
                SUM(v.observation_count) as total_observations,
                GROUP_CONCAT(DISTINCT CASE 
                    WHEN LENGTH(v.literal_value) > 40 THEN 
                        SUBSTR(v.literal_value, 1, 40) || '...'
                    ELSE v.literal_value 
                END, ' | ') as example_values,
                CASE 
                    WHEN v.value_type = 'string' AND COUNT(DISTINCT v.literal_value) BETWEEN 2 AND 10 THEN 'ENUM_CANDIDATE'
                    WHEN v.value_type = 'object' THEN 'INTERFACE_CANDIDATE'
                    WHEN v.value_type = 'number' AND COUNT(DISTINCT v.literal_value) < 10 THEN 'LITERAL_TYPE_CANDIDATE'
                    WHEN COUNT(DISTINCT v.value_type) > 1 THEN 'UNION_CANDIDATE'
                    ELSE 'SIMPLE_TYPE'
                END as annotation_type
            FROM entities e
            JOIN value_observations v ON e.id = v.entity_id
            WHERE v.value_type != 'undefined'
            GROUP BY e.id, v.value_type
            HAVING total_observations >= ?
            ORDER BY 
                CASE annotation_type 
                    WHEN 'ENUM_CANDIDATE' THEN 1
                    WHEN 'INTERFACE_CANDIDATE' THEN 2  
                    WHEN 'UNION_CANDIDATE' THEN 3
                    WHEN 'LITERAL_TYPE_CANDIDATE' THEN 4
                    ELSE 5
                END,
                total_observations DESC
        `;
        
        return this.db.prepare(query).all(minObservations);
    }
    
    generateEnumName(filename, stringValues) {
        const baseName = filename.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'Unknown';
        const values = stringValues.split(' | ').slice(0, 3);
        
        if (values.some(v => v.includes('success') || v.includes('error'))) {
            return `${baseName}Status`;
        }
        if (values.some(v => v.includes('read') || v.includes('write'))) {
            return `${baseName}Mode`;
        }
        if (values.every(v => v.length <= 3)) {
            return `${baseName}Code`;
        }
        
        return `${baseName}Type`;
    }
    
    generateInterfaceDefinition(shape) {
        try {
            const propertyTypes = JSON.parse(shape.property_types);
            const properties = Object.entries(propertyTypes)
                .map(([key, type]) => `  ${key}: ${type};`)
                .join('\n');
            
            const baseName = shape.filename.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'Unknown';
            const interfaceName = `${this.capitalize(baseName)}${shape.entity_name ? this.capitalize(shape.entity_name) : 'Object'}`;
            
            return `interface ${interfaceName} {\n${properties}\n}`;
        } catch (error) {
            return `// Could not generate interface: ${error.message}`;
        }
    }
    
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    customQuery(sqlQuery, params = []) {
        try {
            return this.db.prepare(sqlQuery).all(...params);
        } catch (error) {
            throw new Error(`SQL query failed: ${error.message}`);
        }
    }
}

class LLMApiServer {
    constructor(dbPath, port = 4000) {
        this.app = express();
        this.db = new Database(dbPath);
        this.queryInterface = new LLMQueryInterface(this.db);
        
        this.setupMiddleware();
        this.setupRoutes();
        
        this.app.listen(port, () => {
            console.log(`🚀 TypeWiz LLM API Server running on port ${port}`);
            console.log(`📊 Database: ${dbPath}`);
            console.log(`🤖 LLM-ready endpoints available`);
            this.logAvailableEndpoints();
        });
    }
    
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                database: 'connected' 
            });
        });
        
        // Statistics
        this.app.get('/__typewiz_stats', (req, res) => {
            try {
                const stats = this.getStats();
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Entity Summary
        this.app.get('/api/entities', (req, res) => {
            try {
                const filename = req.query.filename;
                const limit = parseInt(req.query.limit) || 100;
                
                const entities = this.queryInterface.getEntitySummary(filename, limit);
                res.json({
                    success: true,
                    count: entities.length,
                    data: entities
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // Enum Candidates
        this.app.get('/api/enum-candidates', (req, res) => {
            try {
                const minObservations = parseInt(req.query.min_observations) || 3;
                const minUniqueStrings = parseInt(req.query.min_unique_strings) || 2;
                
                const candidates = this.queryInterface.findEnumCandidates(minObservations, minUniqueStrings);
                res.json({
                    success: true,
                    count: candidates.length,
                    data: candidates
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // Object Shapes
        this.app.get('/api/object-shapes', (req, res) => {
            try {
                const minObservations = parseInt(req.query.min_observations) || 3;
                
                const shapes = this.queryInterface.findObjectShapes(minObservations);
                res.json({
                    success: true,
                    count: shapes.length,
                    data: shapes
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // Annotation Candidates
        this.app.get('/api/annotation-candidates', (req, res) => {
            try {
                const minObservations = parseInt(req.query.min_observations) || 5;
                
                const candidates = this.queryInterface.getAnnotationCandidates(minObservations);
                res.json({
                    success: true,
                    count: candidates.length,
                    data: candidates
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // Custom SQL
        this.app.post('/api/sql', (req, res) => {
            try {
                const { query, params = [] } = req.body;
                
                if (!query || typeof query !== 'string') {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'SQL query is required' 
                    });
                }
                
                const result = this.queryInterface.customQuery(query, params);
                res.json({
                    success: true,
                    count: result.length,
                    data: result
                });
            } catch (error) {
                res.status(400).json({ 
                    success: false, 
                    error: error.message
                });
            }
        });
    }
    
    getStats() {
        const stats = this.db.prepare(`
            SELECT 
                COUNT(*) as total_entities,
                COUNT(DISTINCT filename) as unique_files,
                SUM(observation_count) as total_observations
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
        
        return {
            overview: stats,
            valueTypes: valueTypeStats
        };
    }
    
    logAvailableEndpoints() {
        console.log('\n📡 Available LLM API Endpoints:');
        console.log('  GET  /health - Health check');
        console.log('  GET  /__typewiz_stats - Collection statistics');
        console.log('  GET  /api/entities?filename=&limit= - Entity summary');
        console.log('  GET  /api/enum-candidates?min_observations=&min_unique_strings= - Enum detection');
        console.log('  GET  /api/object-shapes?min_observations= - Object analysis');
        console.log('  GET  /api/annotation-candidates?min_observations= - Smart suggestions');
        console.log('  POST /api/sql - Custom SQL queries');
        console.log('');
    }
    
    close() {
        this.db.close();
    }
}

function createLLMApiServer(dbPath, port = 4000) {
    return new LLMApiServer(dbPath, port);
}

module.exports = {
    LLMApiServer,
    LLMQueryInterface,
    createLLMApiServer
};