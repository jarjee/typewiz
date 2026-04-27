const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const express = require('express');
const { JSDOM, ResourceLoader } = require('jsdom');
const { rspack } = require('@rspack/core');
const webpack = require('webpack');
const request = require('supertest');

const { setupTypewizEndpoints, SQLiteTypewizPlugin } = require('../lib/webpack-sqlite-plugin');

jest.setTimeout(30000);

const fixtureEntry = path.resolve(__dirname, 'fixtures/dual-bundler/entry.js');
const loaderPath = require.resolve('../lib/webpack-loader.js');

function buildConfig(outputDir, dbPath) {
    return {
        mode: 'development',
        target: 'web',
        entry: fixtureEntry,
        output: {
            path: outputDir,
            filename: 'bundle.js',
            clean: true,
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: loaderPath,
                        options: {},
                    },
                },
            ],
        },
        plugins: [new SQLiteTypewizPlugin({ dbPath })],
        devtool: false,
    };
}

function compile(bundler, config) {
    return new Promise((resolve, reject) => {
        bundler(config, (err, stats) => {
            if (err) return reject(err);
            if (stats.hasErrors()) {
                return reject(new Error(stats.toString({ errorDetails: true })));
            }
            resolve(stats);
        });
    });
}

function startCollector(dbPath) {
    return new Promise((resolve) => {
        const app = express();
        setupTypewizEndpoints(app, dbPath);
        const server = app.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ server, app, port });
        });
    });
}

function stopServer(server) {
    return new Promise((resolve) => server.close(() => resolve()));
}

async function pollUntil(fn, { timeoutMs = 8000, intervalMs = 200 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const result = await fn();
        if (result) return result;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
}

describe.each([
    ['rspack', rspack],
    ['webpack', webpack],
])('TypeWiz integration with %s', (label, bundler) => {
    let workDir;
    let outputDir;
    let dbPath;
    let server;
    let port;
    let dom;

    beforeEach(async () => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), `typewiz-${label}-`));
        outputDir = path.join(workDir, 'dist');
        fs.mkdirSync(outputDir, { recursive: true });
        dbPath = path.join(workDir, 'collection.db');
        ({ server, port } = await startCollector(dbPath));
    });

    afterEach(async () => {
        if (dom) {
            try { dom.window.close(); } catch {}
            dom = null;
        }
        if (server) {
            await stopServer(server);
            server = null;
        }
        try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
    });

    test('loader instruments the fixture and plugin injects the collector snippet', async () => {
        await compile(bundler, buildConfig(outputDir, dbPath));

        const bundlePath = path.join(outputDir, 'bundle.js');
        expect(fs.existsSync(bundlePath)).toBe(true);
        const bundleSource = fs.readFileSync(bundlePath, 'utf8');

        // Loader applied: instrumented calls present
        expect(bundleSource).toContain('$_$twiz');
        expect(bundleSource).toContain('add_param_a');
        expect(bundleSource).toContain('greet_param_name');

        // Plugin prepended its enhanced collector snippet
        expect(bundleSource).toContain('function $_$twiz(name, value, pos, filename, optsJson)');
        // Plugin reporter snippet is also present
        expect(bundleSource).toContain('__typewiz_sqlite_report');
    });

    test('runs the bundle in jsdom and reports trapped types to the collector', async () => {
        await compile(bundler, buildConfig(outputDir, dbPath));

        const bundleSource = fs.readFileSync(path.join(outputDir, 'bundle.js'), 'utf8');

        const collectorOrigin = `http://127.0.0.1:${port}`;

        dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
            url: `${collectorOrigin}/`,
            runScripts: 'dangerously',
            resources: new ResourceLoader(),
            pretendToBeVisual: true,
        });

        // Evaluate the bundle in the jsdom window context
        dom.window.eval(bundleSource);

        // Trigger fixture functions so $_$twiz captures argument types
        expect(typeof dom.window.__runFixture).toBe('function');
        dom.window.__runFixture();

        // Sanity check that $_$twiz captured the calls into its in-page log
        expect(typeof dom.window.$_$twiz).toBe('function');
        expect(typeof dom.window.$_$twiz.get).toBe('function');
        const inPageData = dom.window.$_$twiz.get();
        expect(inPageData.length).toBeGreaterThan(0);

        // The plugin's reporter setInterval flushes every 1s; poll the
        // collector until entities for our fixture appear.
        const entities = await pollUntil(async () => {
            const res = await request(`http://127.0.0.1:${port}`)
                .get('/__typewiz_entities')
                .query({ filename: 'entry.js' });
            if (res.status === 200 && res.body.entities && res.body.entities.length > 0) {
                return res.body.entities;
            }
            return null;
        }, { timeoutMs: 10000 });

        expect(entities).not.toBeNull();
        expect(entities.length).toBeGreaterThan(0);
        for (const entity of entities) {
            expect(entity.filename).toMatch(/entry\.js$/);
        }

        // Verify recorded value observations contain the literals we passed in.
        const sqlRes = await request(`http://127.0.0.1:${port}`)
            .post('/__typewiz_sql')
            .send({
                query: `
                    SELECT vo.literal_value, vo.value_type
                    FROM entities e
                    JOIN value_observations vo ON e.id = vo.entity_id
                    WHERE e.filename LIKE ?
                `,
                params: ['%entry.js%'],
            })
            .expect(200);

        expect(sqlRes.body.success).toBe(true);
        const literals = sqlRes.body.data.map((row) => String(row.literal_value));
        // add(1, 2) → 1 and 2; greet('Ada', { greeting: 'Hello' }) → 'Ada' and the object
        expect(literals.some((v) => v === '1' || v === '2')).toBe(true);
        expect(literals.some((v) => v.includes('Ada'))).toBe(true);
    });
});
