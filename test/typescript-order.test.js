const { rspack } = require('@rspack/core');
const path = require('path');
const fs = require('fs');

describe('TypeWiz with TypeScript without enforce:pre', () => {
    const testDir = path.join(__dirname, 'typescript-order-test');

    beforeAll(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    afterAll(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    it('should work with TypeWiz first in loader array (without enforce:pre)', (done) => {
        jest.setTimeout(15000);

        const testTsFile = path.join(testDir, 'test.ts');
        const outputDir = path.join(testDir, 'output');

        // Create a TypeScript file
        fs.writeFileSync(testTsFile, `
interface User {
    name: string;
    age: number;
}

function greetUser(user: User): string {
    return \`Hello, \${user.name}! You are \${user.age} years old.\`;
}

const myUser: User = { name: "John", age: 25 };
console.log(greetUser(myUser));
        `);

        fs.mkdirSync(outputDir, { recursive: true });

        const rspackConfig = {
            mode: 'development',
            entry: testTsFile,
            output: {
                path: outputDir,
                filename: 'bundle.js'
            },
            resolve: {
                extensions: ['.ts', '.js']
            },
            module: {
                rules: [
                    {
                        test: /\.ts$/,
                        use: [
                            // TypeWiz loader first (executes last after builtin:swc-loader)
                            {
                                loader: path.resolve(__dirname, '../lib/webpack-loader.js'),
                                options: {
                                    enableProxyDecorators: true,
                                }
                            },
                            // builtin:swc-loader second (executes first)
                            {
                                loader: 'builtin:swc-loader',
                                options: {
                                    jsc: {
                                        parser: {
                                            syntax: 'typescript',
                                        },
                                        target: 'es2015',
                                    },
                                },
                            }
                        ]
                    }
                ]
            }
        };

        console.log('Testing TypeWiz + builtin:swc-loader without enforce:pre...');

        rspack(rspackConfig, (err, stats) => {
            if (err) {
                console.error('Rspack error:', err);
                return done(err);
            }

            if (stats.hasErrors()) {
                const errors = stats.toJson().errors;
                console.log('TypeScript compilation errors:', errors);

                // Check if the errors are related to TypeWiz instrumentation
                const typeWizRelatedErrors = errors.filter(error =>
                    error.message.includes('$_$twiz') ||
                    error.message.includes('__typewiz')
                );

                if (typeWizRelatedErrors.length > 0) {
                    console.log('TypeWiz-related errors found:', typeWizRelatedErrors);
                } else {
                    console.log('Errors are not related to TypeWiz instrumentation');
                }

                return done(new Error('TypeScript compilation failed'));
            }

            // Read the generated bundle
            const bundlePath = path.join(outputDir, 'bundle.js');
            const bundleContent = fs.readFileSync(bundlePath, 'utf8');

            console.log('Compilation successful!');
            console.log('Bundle contains $_$twiz:', bundleContent.includes('$_$twiz'));
            console.log('Bundle contains TypeWiz runtime:', bundleContent.includes('__typewiz_logs'));

            done();
        });
    });

    it('should work with TypeWiz + builtin:swc-loader', (done) => {
        jest.setTimeout(15000);

        const testTsFile = path.join(testDir, 'test-transpile-only.ts');
        const outputDir = path.join(testDir, 'output-transpile-only');

        fs.writeFileSync(testTsFile, `
interface User {
    name: string;
    age: number;
}

function greetUser(user: User): string {
    return \`Hello, \${user.name}! You are \${user.age} years old.\`;
}

const myUser: User = { name: "John", age: 25 };
console.log(greetUser(myUser));
        `);

        fs.mkdirSync(outputDir, { recursive: true });

        const rspackConfig = {
            mode: 'development',
            entry: testTsFile,
            output: {
                path: outputDir,
                filename: 'bundle.js'
            },
            resolve: {
                extensions: ['.ts', '.js']
            },
            module: {
                rules: [
                    {
                        test: /\.ts$/,
                        use: [
                            {
                                loader: path.resolve(__dirname, '../lib/webpack-loader.js'),
                                options: {
                                    enableProxyDecorators: true,
                                }
                            },
                            {
                                loader: 'builtin:swc-loader',
                                options: {
                                    jsc: {
                                        parser: {
                                            syntax: 'typescript',
                                        },
                                        target: 'es2015',
                                    },
                                },
                            }
                        ]
                    }
                ]
            }
        };

        rspack(rspackConfig, (err, stats) => {
            if (err || stats.hasErrors()) {
                console.error('Rspack compilation failed:', err || stats.toJson().errors);
                return done(err || new Error('Rspack compilation failed'));
            }

            const bundlePath = path.join(outputDir, 'bundle.js');
            const bundleContent = fs.readFileSync(bundlePath, 'utf8');

            console.log('Compilation with builtin:swc-loader successful!');
            console.log('Bundle contains $_$twiz:', bundleContent.includes('$_$twiz'));

            done();
        });
    });
});
