// Unit tests for TypeWiz Enhanced Webpack SQLite Plugin
const { setupTypewizEndpoints } = require('../lib/webpack-sqlite-plugin');
const express = require('express');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('TypeWiz Enhanced Webpack SQLite Plugin', () => {
    let app;
    let dbPath;

    beforeEach(() => {
        // Use a temp DB so each test starts fresh
        dbPath = path.join(os.tmpdir(), `typewiz-test-${Date.now()}.db`);
        app = express();
        // Note: do NOT use express.json() globally - the typewiz endpoints
        // read the raw body stream themselves via req.on('data')
        setupTypewizEndpoints(app, dbPath);
    });

    afterEach(() => {
        try { fs.unlinkSync(dbPath); } catch {}
    });

    describe('API Endpoints', () => {

        test('should setup /__typewiz_stats endpoint', async () => {
            const response = await request(app)
                .get('/__typewiz_stats')
                .expect(200);

            expect(response.body).toHaveProperty('overview');
            expect(response.body.overview).toHaveProperty('total_entities');
        });

        test('should setup /__typewiz_function_calls endpoint', async () => {
            const response = await request(app)
                .get('/__typewiz_function_calls')
                .expect(200);

            expect(response.body).toHaveProperty('calls');
            expect(Array.isArray(response.body.calls)).toBe(true);
            expect(response.body).toHaveProperty('pagination');
        });

        test('should setup /__typewiz_location endpoint (GET with query params)', async () => {
            const response = await request(app)
                .get('/__typewiz_location')
                .query({ filename: 'test.js', line_number: '5' })
                .expect(200);

            expect(response.body).toHaveProperty('entities');
            expect(response.body).toHaveProperty('location');
        });

        test('should setup /__typewiz_entities endpoint', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .expect(200);

            expect(response.body).toHaveProperty('entities');
            expect(response.body).toHaveProperty('pagination');
        });

        test('should setup /__typewiz_sql endpoint for custom queries', async () => {
            const response = await request(app)
                .post('/__typewiz_sql')
                .send({ query: 'SELECT COUNT(*) as count FROM entities' })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data[0]).toHaveProperty('count');
        });

        test('should setup /__typewiz_sqlite_report endpoint for batch reporting', async () => {
            const batchData = [
                ['test.js', 100, [['string', null]], { functionName: 'test' }]
            ];

            const response = await request(app)
                .post('/__typewiz_sqlite_report')
                .send(batchData)
                .expect(200);

            expect(response.body).toHaveProperty('processed', 1);
        });

    });

    describe('Error Handling', () => {

        test('should handle missing parameters in location endpoint', async () => {
            // /__typewiz_location requires filename and line_number query params
            const response = await request(app)
                .get('/__typewiz_location')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should handle invalid SQL queries', async () => {
            const response = await request(app)
                .post('/__typewiz_sql')
                .send({ query: 'INVALID SQL QUERY' })
                .expect(500);

            expect(response.body).toHaveProperty('error');
            expect(response.body.success).toBe(false);
        });

        test('should handle malformed batch data', async () => {
            const response = await request(app)
                .post('/__typewiz_sqlite_report')
                .set('Content-Type', 'application/json')
                .send('not valid json')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

    });

    describe('Pagination', () => {

        beforeEach(async () => {
            // Insert some test data so pagination has something to work with
            const entries = Array.from({ length: 10 }, (_, i) => [
                'test.js', i * 10, [['string', null]], { functionName: `func${i}` }
            ]);

            await request(app)
                .post('/__typewiz_sqlite_report')
                .send(entries)
                .expect(200);
        });

        test('should handle pagination parameters correctly', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ offset: 2, limit: 3 })
                .expect(200);

            expect(response.body.pagination).toHaveProperty('offset', 2);
            expect(response.body.pagination).toHaveProperty('limit', 3);
        });

        test('should use default pagination values', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .expect(200);

            expect(response.body.pagination).toHaveProperty('offset', 0);
            expect(response.body.pagination).toHaveProperty('limit', 100);
        });

        test('should return correct total count', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .expect(200);

            expect(response.body.pagination.total).toBe(10);
        });

    });

    describe('Function Name and Filepath Filtering', () => {

        beforeEach(async () => {
            const entries = [
                ['src/utils.js', 10, [['number', null]], { functionName: 'add' }],
                ['src/utils.js', 20, [['string', null]], { functionName: 'format' }],
                ['src/components/Button.js', 30, [['object', null]], { functionName: 'render' }],
            ];

            await request(app)
                .post('/__typewiz_sqlite_report')
                .send(entries)
                .expect(200);
        });

        test('should filter by filename', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'utils' })
                .expect(200);

            expect(response.body).toHaveProperty('entities');
            expect(response.body.entities.length).toBe(2);
        });

        test('should return all entities when no filter', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .expect(200);

            expect(response.body.entities.length).toBe(3);
        });

        test('should handle URL-encoded parameters', async () => {
            const response = await request(app)
                .get('/__typewiz_entities')
                .query({ filename: 'src/components/Button.js' })
                .expect(200);

            expect(response.body).toHaveProperty('entities');
            expect(response.body.entities.length).toBe(1);
        });

    });

    describe('Database Integration', () => {

        test('should persist data across requests', async () => {
            // Insert data
            await request(app)
                .post('/__typewiz_sqlite_report')
                .send([['test.js', 100, [['string', null]], { functionName: 'hello' }]])
                .expect(200);

            // Query it back via function_calls
            const response = await request(app)
                .get('/__typewiz_function_calls')
                .expect(200);

            expect(response.body.calls.length).toBeGreaterThan(0);
        });

        test('should handle SQL queries against real data', async () => {
            await request(app)
                .post('/__typewiz_sqlite_report')
                .send([['test.js', 50, [['number', null]], { functionName: 'calc' }]])
                .expect(200);

            const response = await request(app)
                .post('/__typewiz_sql')
                .send({ query: 'SELECT * FROM entities WHERE filename = ?', params: ['test.js'] })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.count).toBeGreaterThan(0);
        });

    });

    describe('Security', () => {

        test('should handle multi-statement SQL safely', async () => {
            // better-sqlite3's .prepare() only handles a single statement,
            // so multi-statement injection attempts should throw an error
            const response = await request(app)
                .post('/__typewiz_sql')
                .send({ query: 'SELECT 1; DROP TABLE entities; --' })
                .expect(500);

            expect(response.body).toHaveProperty('error');

            // Verify entities table still exists
            const checkResponse = await request(app)
                .post('/__typewiz_sql')
                .send({ query: 'SELECT COUNT(*) as count FROM entities' })
                .expect(200);

            expect(checkResponse.body.success).toBe(true);
        });

        test('should require filename and line_number for location endpoint', async () => {
            const response = await request(app)
                .get('/__typewiz_location')
                .query({ filename: '../../../etc/passwd' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

    });

});
