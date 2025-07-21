// Unit tests for TypeWiz Enhanced Webpack SQLite Plugin
const { setupTypewizEndpoints } = require('../lib/webpack-sqlite-plugin');
const express = require('express');
const request = require('supertest');

// Mock the SQLite collector
jest.mock('../lib/sqlite-collector', () => ({
    createSQLiteTypeCollectorMiddleware: jest.fn(() => {
        return {
            middleware: (req, res, next) => {
                res.locals.typewizDb = {
                    query: jest.fn(() => []),
                    insert: jest.fn(),
                    close: jest.fn()
                };
                next();
            },
            db: {
                query: jest.fn(() => []),
                insert: jest.fn(),
                close: jest.fn()
            }
        };
    })
}));

describe('TypeWiz Enhanced Webpack SQLite Plugin', () => {
    let app;
    
    beforeEach(() => {
        app = express();
        app.use(express.json());
        setupTypewizEndpoints(app);
    });
    
    describe('API Endpoints', () => {
        
        test('should setup /__typewiz_stats endpoint', async () => {
            const response = await request(app)
                .get('/__typewiz_stats')
                .expect(200);
            
            expect(response.body).toHaveProperty('status');
            expect(response.body.status).toBe('TypeWiz Enhanced SQLite collector active');
        });
        
        test('should setup /__typewiz_function_calls endpoint', async () => {
            const response = await request(app)
                .get('/__typewiz_function_calls')
                .expect(200);
            
            expect(response.body).toHaveProperty('functionCalls');
            expect(Array.isArray(response.body.functionCalls)).toBe(true);
        });
        
        test('should setup /__typewiz_location endpoint', async () => {
            const response = await request(app)
                .post('/__typewiz_location')
                .send({ filename: 'test.js', lineNumber: 5 })
                .expect(200);
            
            expect(response.body).toHaveProperty('results');
            expect(Array.isArray(response.body.results)).toBe(true);
        });
        
        test('should setup /__typewiz_entities endpoint with paging', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filepath: 'test.js', functionName: 'testFunc', offset: 0, pageSize: 10 })
                .expect(200);
            
            expect(response.body).toHaveProperty('entities');
            expect(response.body).toHaveProperty('pagination');
        });
        
        test('should setup /__typewiz_sql endpoint for custom queries', async () => {
            const response = await request(app)
                .post('/__typewiz_sql')
                .send({ query: 'SELECT COUNT(*) as count FROM type_observations' })
                .expect(200);
            
            expect(response.body).toHaveProperty('results');
        });
        
        test('should setup /__typewiz_sqlite_report endpoint for batch reporting', async () => {
            const batchData = [
                ['test.js', 100, [['string', null]], { functionName: 'test' }]
            ];
            
            const response = await request(app)
                .post('/__typewiz_sqlite_report')
                .send(batchData)
                .expect(200);
            
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('processed');
        });
        
    });
    
    describe('Error Handling', () => {
        
        test('should handle missing parameters in location endpoint', async () => {
            const response = await request(app)
                .post('/__typewiz_location')
                .send({})
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
        });
        
        test('should handle invalid SQL queries', async () => {
            const response = await request(app)
                .post('/__typewiz_sql')
                .send({ query: 'INVALID SQL QUERY' })
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
        });
        
        test('should handle malformed batch data', async () => {
            const response = await request(app)
                .post('/__typewiz_sqlite_report')
                .send('invalid json')
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
        });
        
    });
    
    describe('CORS Support', () => {
        
        test('should include CORS headers', async () => {
            const response = await request(app)
                .get('/__typewiz_stats')
                .expect(200);
            
            expect(response.headers).toHaveProperty('access-control-allow-origin');
        });
        
        test('should handle OPTIONS requests', async () => {
            await request(app)
                .options('/__typewiz_stats')
                .expect(200);
        });
        
    });
    
    describe('Pagination', () => {
        
        test('should handle pagination parameters correctly', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ 
                    filepath: 'test.js', 
                    functionName: 'testFunc',
                    offset: 20,
                    pageSize: 5
                })
                .expect(200);
            
            expect(response.body.pagination).toHaveProperty('offset', 20);
            expect(response.body.pagination).toHaveProperty('pageSize', 5);
        });
        
        test('should use default pagination values', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filepath: 'test.js', functionName: 'testFunc' })
                .expect(200);
            
            expect(response.body.pagination).toHaveProperty('offset', 0);
            expect(response.body.pagination).toHaveProperty('pageSize', 50);
        });
        
        test('should validate pagination parameters', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ 
                    filepath: 'test.js', 
                    functionName: 'testFunc',
                    offset: -1,
                    pageSize: 1000
                })
                .expect(200);
            
            // Should clamp values to reasonable ranges
            expect(response.body.pagination.offset).toBeGreaterThanOrEqual(0);
            expect(response.body.pagination.pageSize).toBeLessThanOrEqual(100);
        });
        
    });
    
    describe('Function Name and Filepath Filtering', () => {
        
        test('should filter by filepath only', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filepath: 'test.js' })
                .expect(200);
            
            expect(response.body).toHaveProperty('entities');
        });
        
        test('should filter by functionName only', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ functionName: 'testFunc' })
                .expect(200);
            
            expect(response.body).toHaveProperty('entities');
        });
        
        test('should handle URL-encoded parameters', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filepath: 'src/components/Button.js' })
                .expect(200);
            
            expect(response.body).toHaveProperty('entities');
        });
        
    });
    
    describe('Database Integration', () => {
        
        test('should pass database queries to SQLite collector', async () => {
            const { createSQLiteTypeCollectorMiddleware } = require('../lib/sqlite-collector');
            const mockCollector = createSQLiteTypeCollectorMiddleware();
            
            await request(app)
                .get('/__typewiz_function_calls')
                .expect(200);
            
            expect(mockCollector.db.query).toHaveBeenCalled();
        });
        
        test('should handle database connection errors', async () => {
            const { createSQLiteTypeCollectorMiddleware } = require('../lib/sqlite-collector');
            const mockCollector = createSQLiteTypeCollectorMiddleware();
            mockCollector.db.query.mockImplementation(() => {
                throw new Error('Database connection failed');
            });
            
            const response = await request(app)
                .get('/__typewiz_function_calls')
                .expect(500);
            
            expect(response.body).toHaveProperty('error');
        });
        
    });
    
    describe('Security', () => {
        
        test('should sanitize SQL queries', async () => {
            const maliciousQuery = "SELECT * FROM type_observations; DROP TABLE type_observations; --";
            
            const response = await request(app)
                .post('/__typewiz_sql')
                .send({ query: maliciousQuery })
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
        });
        
        test('should validate input parameters', async () => {
            const response = await request(app)
                .post('/__typewiz_location')
                .send({ 
                    filename: '../../../etc/passwd',
                    lineNumber: 'not-a-number'
                })
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
        });
        
    });
    
});