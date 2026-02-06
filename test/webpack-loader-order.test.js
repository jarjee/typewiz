const { rspack } = require('@rspack/core');
const path = require('path');
const fs = require('fs');

describe('Rspack Loader Execution Order Tests', () => {
    jest.setTimeout(15000);

    const testDir = path.join(__dirname, 'webpack-order-test');
    const outputDir = path.join(testDir, 'dist');

    beforeAll(() => {
        // Create test directory structure
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    });

    beforeEach(() => {
        // Clean up output directory
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
            fs.mkdirSync(outputDir, { recursive: true });
        }
    });

    it('should execute loaders right-to-left (bottom-to-top)', (done) => {

        const testFile = path.join(testDir, 'test-source.js');
        const outputFile = path.join(outputDir, 'bundle.js');

        // Create a simple test file
        fs.writeFileSync(testFile, `
function testFunction(param) {
    return param + 1;
}
export default testFunction;
        `);

        // Create loaders that add comments to track execution order
        const loader1Path = path.join(testDir, 'loader1.js');
        const loader2Path = path.join(testDir, 'loader2.js');
        const loader3Path = path.join(testDir, 'loader3.js');

        fs.writeFileSync(loader1Path, `
module.exports = function(source) {
    console.log('LOADER1 executed');
    return '/* LOADER1 executed */\\n' + source;
};
        `);

        fs.writeFileSync(loader2Path, `
module.exports = function(source) {
    console.log('LOADER2 executed');
    return '/* LOADER2 executed */\\n' + source;
};
        `);

        fs.writeFileSync(loader3Path, `
module.exports = function(source) {
    console.log('LOADER3 executed');
    return '/* LOADER3 executed */\\n' + source;
};
        `);

        const rspackConfig = {
            mode: 'development',
            entry: testFile,
            output: {
                path: outputDir,
                filename: 'bundle.js'
            },
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: /node_modules/,
                        use: [
                            loader1Path, // Should execute FIRST (rightmost/bottom)
                            loader2Path, // Should execute SECOND (middle)
                            loader3Path  // Should execute LAST (leftmost/top)
                        ]
                    }
                ]
            }
        };

        rspack(rspackConfig, (err, stats) => {
            try {
                if (err || stats.hasErrors()) {
                    console.error('Rspack compilation failed:', err || stats.toJson().errors);
                    return done(err || new Error('Rspack compilation failed'));
                }

                // Read the output file
                const bundleContent = fs.readFileSync(outputFile, 'utf8');

                // Check the order of comments - they should appear in execution order
                const loader1Index = bundleContent.indexOf('/* LOADER1 executed */');
                const loader2Index = bundleContent.indexOf('/* LOADER2 executed */');
                const loader3Index = bundleContent.indexOf('/* LOADER3 executed */');

                console.log('Loader1 index:', loader1Index);
                console.log('Loader2 index:', loader2Index);
                console.log('Loader3 index:', loader3Index);

                // All loader comments should be present
                expect(loader1Index).toBeGreaterThan(-1);
                expect(loader2Index).toBeGreaterThan(-1);
                expect(loader3Index).toBeGreaterThan(-1);

                // Loaders execute right-to-left: loader3 first, loader2 second, loader1 last.
                // Each prepends its comment, so loader1 (last to run) has its comment first.
                expect(loader1Index).toBeLessThan(loader2Index);
                expect(loader2Index).toBeLessThan(loader3Index);

                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it('should demonstrate TypeWiz loader without enforce:pre vs with enforce:pre', (done) => {

        const testFile = path.join(testDir, 'typewiz-test.js');

        fs.writeFileSync(testFile, `
function add(a, b) {
    return a + b;
}

const multiply = (x, y) => x * y;

export { add, multiply };
        `);

        // Test without enforce: 'pre'
        const configWithoutEnforce = {
            mode: 'development',
            entry: testFile,
            output: {
                path: path.join(outputDir, 'without-enforce'),
                filename: 'bundle.js'
            },
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: /node_modules/,
                        use: [
                            // TypeWiz first in array (should execute last)
                            {
                                loader: path.resolve(__dirname, '../lib/webpack-loader.js'),
                                options: {
                                    enableProxyDecorators: true,
                                }
                            },
                            // Mock transpiler loader (should execute first)
                            path.join(testDir, 'mock-transpiler.js')
                        ]
                    }
                ]
            }
        };

        // Create mock transpiler loader
        fs.writeFileSync(path.join(testDir, 'mock-transpiler.js'), `
module.exports = function(source) {
    console.log('Mock transpiler executed on:', source.substring(0, 100));
    return '/* TRANSPILED */\\n' + source;
};
        `);

        fs.mkdirSync(path.join(outputDir, 'without-enforce'), { recursive: true });

        rspack(configWithoutEnforce, (err, stats) => {
            try {
                if (err || stats.hasErrors()) {
                    console.error('Rspack compilation failed:', err || stats.toJson().errors);
                    return done(err || new Error('Rspack compilation failed'));
                }

                const bundleContent = fs.readFileSync(
                    path.join(outputDir, 'without-enforce', 'bundle.js'),
                    'utf8'
                );

                // Check if TypeWiz runtime was added and if transpiler comment exists
                const hasTypeWizRuntime = bundleContent.includes('$_$twiz');
                const hasTranspilerComment = bundleContent.includes('/* TRANSPILED */');

                console.log('Has TypeWiz runtime:', hasTypeWizRuntime);
                console.log('Has transpiler comment:', hasTranspilerComment);

                done();
            } catch (e) {
                done(e);
            }
        });
    });

    afterAll(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });
});
