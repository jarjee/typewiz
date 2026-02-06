# TypeWiz Enhanced

Runtime type collection system that instruments JavaScript and TypeScript code to capture parameter types, function signatures, object shapes, and higher-order function relationships. Designed for large-scale JS-to-TS migrations where static analysis alone can't determine types.

## How It Works

TypeWiz has four stages:

1. **Instrument** -- At build time, a loader parses each source file's AST and injects `$_$twiz()` calls at the top of every function body, one per parameter. These calls record the parameter's runtime value each time the function is invoked.
2. **Collect** -- At runtime, the injected code batches observations and POSTs them to a collector endpoint every 2 seconds.
3. **Store** -- The collector receives batches and upserts them into structured SQLite tables (`entities`, `value_observations`, `string_literals`, `object_shapes`, `hof_relationships`).
4. **Query** -- REST endpoints and a standalone LLM API server expose the collected data for annotation generation, enum detection, interface extraction, and custom SQL queries.

```
Source File                   Runtime                       Collector
-----------                   -------                       ---------
              AST parse                    POST batch
  .js/.ts  ──────────>  $_$twiz() calls  ──────────>  SQLite DB
              inject                       every 2s       │
                                                          │
                                                     REST API / LLM API
```

### Browser vs Server

The AST instrumentation itself is environment-agnostic -- it just injects function calls. There are two runtimes that define what `$_$twiz` does:

- **Inline runtime** (injected by the AST instrumenter per-file via `createTypeWizRuntime`): Uses `window` globals and `fetch()` with a relative URL. Activates only when `typeof window !== 'undefined'`. Suitable for browser code bundled with webpack/rspack.
- **Plugin runtime** (injected by `SQLiteTypewizPlugin` via `getEnhancedTypeCollectorSnippet`): Uses `typeof self !== 'undefined' ? self : this` as the host object, which resolves to `globalThis` in Node.js. Works in browsers, web workers, and server-side Node.js (Node 18+ provides `fetch` globally).

For **browser apps**, use the webpack loader + plugin together with the dev server collector endpoint. For **server-side code**, the plugin runtime works if the collector endpoint is reachable (e.g., an Express app that also mounts the collector middleware). Alternatively, you can call `instrumentCodeWithAST()` directly as a build step and define your own `$_$twiz` function in your server bootstrap.

## Installation

```bash
npm install better-sqlite3 express cors source-map micromatch
```

## Quick Start

### 1. Add the Webpack Loader

The loader instruments source files at build time. It must run **before** `ts-loader` (loaders execute right-to-left in webpack):

```javascript
// webpack.config.js
const path = require('path');
const { setupTypewizEndpoints } = require('typewiz-enhanced/lib/webpack-sqlite-plugin');

module.exports = {
  module: {
    rules: [
      {
        test: /\.(js|ts|tsx)$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /node_modules/,
        use: [
          'ts-loader',  // runs second
          {
            // runs first -- instruments original source for accurate line numbers
            loader: require.resolve('typewiz-enhanced/lib/webpack-loader.js'),
            options: {
              includePatterns: ['src/**/*.js', 'src/**/*.ts'],
              excludePatterns: ['**/*.test.*', '**/*.spec.*']
            }
          }
        ]
      }
    ]
  },

  devServer: {
    setupMiddlewares: (middlewares, devServer) => {
      setupTypewizEndpoints(devServer.app, './typewiz-collection.db');
      return middlewares;
    }
  }
};
```

For plain JavaScript projects, omit `ts-loader` -- the typewiz loader works standalone.

### 2. Use the App

Start the dev server and interact with your application normally. TypeWiz collects type observations in the background with no visible changes to behavior.

### 3. Query Collected Data

```bash
# Overview statistics
curl http://localhost:8080/__typewiz_stats

# Entities for a specific file
curl "http://localhost:8080/__typewiz_entities?filename=src/todos.js"

# Function call analysis
curl "http://localhost:8080/__typewiz_function_calls?filepath=src/todos.js&functionName=addTodo"

# Type data at a specific source location
curl "http://localhost:8080/__typewiz_location?filename=src/todos.js&line_number=55"

# Custom SQL
curl -X POST http://localhost:8080/__typewiz_sql \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM entities WHERE entity_name LIKE ?", "params": ["%addTodo%"]}'
```

### Server-Side Collection

For instrumenting server-side Node.js code (e.g., an Express API), mount the collector middleware on your app:

```javascript
const { setupTypewizEndpoints } = require('typewiz-enhanced/lib/webpack-sqlite-plugin');
const { instrumentCodeWithAST } = require('typewiz-enhanced/lib/ast-instrumenter');

// Option A: Use as Express middleware alongside your app
const app = express();
setupTypewizEndpoints(app, './typewiz-collection.db');

// Option B: Instrument files programmatically at build time
const fs = require('fs');
const source = fs.readFileSync('src/server.js', 'utf8');
const instrumented = instrumentCodeWithAST(source, 'src/server.js');
fs.writeFileSync('dist/server.js', instrumented);
```

When running instrumented server code, `$_$twiz` must be defined in the global scope. The plugin runtime handles this automatically for webpack builds. For standalone instrumented files, define `$_$twiz` in your entry point before any instrumented code runs, or use a `require()` hook.

## What Gets Instrumented

The AST instrumenter (`lib/ast-instrumenter.js`) adds `$_$twiz()` calls for every parameter in these constructs:

| Construct | Example | Instrumented Name |
|---|---|---|
| Function declarations | `function greet(name) {}` | `greet_param_name` |
| Arrow functions assigned to variables | `const fn = (x) => x` | `fn_param_x` |
| Class methods | `class C { method(a) {} }` | `method_param_a` |
| Constructors | `constructor(id) {}` | `constructor_param_id` |
| Object methods | `{ divide(x, y) {} }` | `divide_param_x` |
| Callback arguments | `createRoutine('T', (p) => ...)` | `createRoutine_arg1_param_p` |

### Callback Arguments

Any arrow function or function expression passed as an argument to a call is instrumented. The naming convention is `calleeName_argN_param_paramName`, and each observation includes `calleeName` and `calleeArgIndex` in its metadata. A corresponding row is stored in the `hof_relationships` table linking the callback entity to its enclosing call.

This covers common patterns like:

```javascript
// Factory functions
createRoutine('TYPE', (payload) => ({ ...payload }))
//                     ^^^^^^^^^ createRoutine_arg1_param_payload

// React-Redux
connect(
    (state) => ({ user: state.user }),  // connect_arg0_param_state
    { fetchUser }
)(MyComponent);

// Reselect
createSelector(
    (state) => state.todos,             // createSelector_arg0_param_state
    (state) => state.filter,            // createSelector_arg1_param_state
    (todos, filter) => ...              // createSelector_arg2_param_todos
);

// Array methods, promises, event handlers
items.map((item) => item.id)            // items.map_arg0_param_item
promise.then((val) => ..., (err) => ...)  // promise.then_arg0_param_val
app.get('/path', (req, res) => ...)     // app.get_arg1_param_req
```

## Components

### `lib/webpack-loader.js` -- Webpack Loader

Entry point for build-time instrumentation. Receives source code from webpack, calls the AST instrumenter, and returns the instrumented result.

**Options:**

| Option | Type | Description |
|---|---|---|
| `includePatterns` | `string[]` | Glob patterns -- file must match at least one. Uses [micromatch](https://github.com/micromatch/micromatch). |
| `excludePatterns` | `string[]` | Glob patterns -- file must not match any. |
| `enableSourceMaps` | `boolean` | Process source maps from upstream loaders (default: `true`). |

### `lib/ast-instrumenter.js` -- AST Instrumenter

Parses source with `@babel/parser`, traverses the AST to find functions and callback arguments, and injects `$_$twiz()` calls. Supports TypeScript syntax (type annotations, generics, decorators, parameter properties). Also injects a runtime definition of `$_$twiz` at the top of each file (guarded by `typeof window !== 'undefined'`; see "Browser vs Server" above).

Key functions:
- `instrumentCodeWithAST(source, filename, options)` -- main entry point
- `instrumentFunction()` -- instruments regular functions/methods
- `instrumentArrowFunction()` -- instruments `const x = () => ...` patterns
- `instrumentInlineArrowFunction()` -- instruments callbacks passed as call arguments
- `getCalleeName()` -- extracts readable name from call expression callee (`foo.bar.baz`)

### `lib/webpack-sqlite-plugin.js` -- Webpack Plugin & Endpoints

Dual-purpose module:

1. **Webpack plugin** (`SQLiteTypewizPlugin`): Wraps compiled chunks with the enhanced type collector runtime and reporter snippet that POSTs batches to the collector endpoint.
2. **Endpoint setup** (`setupTypewizEndpoints`): Registers all REST API routes on an Express app.

The enhanced runtime (`getEnhancedTypeCollectorSnippet()`) includes:
- `$_$twiz(name, value, pos, filename, opts)` -- main collection function
- `$_$twiz.get()` / `$_$twiz.clear()` -- access/clear collected data
- `$_$twiz.track(value, filename, offset)` -- object provenance tracking (marks an object so that when it later appears as a parameter, its origin is recorded)

### `lib/sqlite-collector.js` -- SQLite Data Collector

Server-side module that receives batched observations via HTTP POST and upserts them into SQLite. Handles:
- Entity creation/update with line/column correlation
- Value observation storage with deduplication (by content hash)
- String literal tracking for enum candidate detection
- Object shape analysis (property names and types)
- HOF relationship recording (callback-to-factory linkage)

### `lib/llm-api-server.js` -- Standalone LLM API Server

Independent Express server for querying collected data after a collection session. Start it against an existing database:

```javascript
const { createLLMApiServer } = require('typewiz-enhanced/lib/llm-api-server');
createLLMApiServer('./typewiz-collection.db', 4000);
```

**Endpoints:**

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/__typewiz_stats` | GET | Collection statistics |
| `/api/entities` | GET | Entity summary. Params: `filename`, `limit` |
| `/api/enum-candidates` | GET | String parameters that look like enums. Params: `min_observations`, `min_unique_strings` |
| `/api/object-shapes` | GET | Recurring object shapes with suggested interface definitions. Params: `min_observations` |
| `/api/annotation-candidates` | GET | Smart annotation suggestions (enum, interface, union, literal type candidates). Params: `min_observations` |
| `/api/sql` | POST | Custom SQL queries. Body: `{ "query": "...", "params": [] }` |

### `lib/source-map-utils.js` -- Source Map Utilities

Maps compiled JavaScript positions back to original TypeScript source positions using the `source-map` library. Used by the webpack loader when `enableSourceMaps` is true.

## Database Schema

```sql
-- Every instrumented parameter/entry point
CREATE TABLE entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    entity_name TEXT,          -- e.g. "addTodo_param_todo"
    entity_type TEXT,          -- e.g. "function_declaration_parameter", "callback_argument_parameter"
    offset_position INTEGER,
    line_number INTEGER,
    column_number INTEGER,
    observation_count INTEGER,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    UNIQUE(filename, offset_position)
);

-- Observed runtime values for each entity
CREATE TABLE value_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER REFERENCES entities(id),
    value_type TEXT,            -- "string", "number", "object", etc.
    literal_value TEXT,         -- JSON-serialized value (truncated for large objects)
    value_hash TEXT,            -- MD5 hash for deduplication
    context TEXT,               -- e.g. "function_declaration_parameter_in_addTodo"
    observation_count INTEGER,
    UNIQUE(entity_id, value_hash, context)
);

-- String values that may represent enum members
CREATE TABLE string_literals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER REFERENCES entities(id),
    string_value TEXT NOT NULL,
    observation_count INTEGER,
    UNIQUE(entity_id, string_value, context)
);

-- Recurring object property structures
CREATE TABLE object_shapes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER REFERENCES entities(id),
    shape_signature TEXT,       -- "completed:boolean,description:string,id:string"
    property_names TEXT,        -- "completed,description,id"
    property_types TEXT,        -- JSON: {"completed":"boolean","description":"string",...}
    observation_count INTEGER,
    UNIQUE(entity_id, shape_signature)
);

-- Links callback entities to their enclosing call expression
CREATE TABLE hof_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    callback_entity_id INTEGER REFERENCES entities(id),
    callee_name TEXT NOT NULL,      -- "createRoutine", "connect", "items.map"
    callee_arg_index INTEGER NOT NULL,  -- which argument position (0-based)
    source_filename TEXT,
    observation_count INTEGER,
    UNIQUE(callback_entity_id, callee_name, callee_arg_index)
);
```

## Example: What Instrumented Code Looks Like

Given this source:

```javascript
function addTodo(todo) {
    this.list.push(todo);
}
```

The instrumenter produces:

```javascript
function addTodo(todo) {
    try { $_$twiz('addTodo_entry', 'addTodo', 0, 'todos.js', {
        functionName: 'addTodo', context: 'function_declaration_entry',
        hasParameters: true, parameterCount: 1, lineNumber: 1, columnNumber: 0
    }); } catch(e) {}
    try { $_$twiz('addTodo_param_todo', todo, 19, 'todos.js', {
        functionName: 'addTodo', parameterName: 'todo', parameterIndex: 0,
        parameterType: 'untyped', context: 'function_declaration_parameter',
        lineNumber: 1, columnNumber: 19
    }); } catch(e) {}
    this.list.push(todo);
}
```

For callback arguments:

```javascript
// Source
createRoutine('DASHBOARDS/READ', (payload) => ({ ...payload }));

// Instrumented -- the concise arrow body is expanded to a block
createRoutine('DASHBOARDS/READ', (payload) => {
    try { $_$twiz('createRoutine_arg1_param_payload', payload, 42, 'actions.js', {
        functionName: 'createRoutine_arg1', parameterName: 'payload', parameterIndex: 0,
        parameterType: 'untyped', context: 'callback_argument_parameter',
        calleeName: 'createRoutine', calleeArgIndex: 1, lineNumber: 1, columnNumber: 42
    }); } catch(e) {}
    return { ...payload };
});
```

## Useful Queries

```bash
# Find all callbacks passed to a specific factory
curl -X POST http://localhost:8080/__typewiz_sql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT e.entity_name, e.filename, e.line_number, h.callee_name, h.callee_arg_index FROM hof_relationships h JOIN entities e ON h.callback_entity_id = e.id WHERE h.callee_name = ?",
    "params": ["createRoutine"]
  }'

# HOF patterns grouped by factory
curl -X POST http://localhost:8080/__typewiz_sql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT callee_name, COUNT(*) as callback_count, GROUP_CONCAT(DISTINCT source_filename) as files FROM hof_relationships GROUP BY callee_name ORDER BY callback_count DESC"
  }'

# Enum candidates (parameters that receive a small set of distinct strings)
curl "http://localhost:4000/api/enum-candidates?min_observations=3&min_unique_strings=2"

# Object shape interfaces
curl "http://localhost:4000/api/object-shapes?min_observations=5"

# Annotation candidates ranked by type (enum > interface > union > literal > simple)
curl "http://localhost:4000/api/annotation-candidates?min_observations=5"
```

## Loader Order for TypeScript

The loader order matters. TypeWiz must process the original TypeScript source to report accurate line numbers:

```javascript
// Correct -- TypeWiz runs first (right-to-left), gets original .ts source
use: ['ts-loader', 'typewiz-loader']

// Wrong -- TypeWiz gets compiled .js, line numbers will be offset
use: ['typewiz-loader', 'ts-loader']
```

## Running Tests

```bash
npx jest test/ast-instrumenter.test.js
```

## Notes

- TypeWiz is a **development-only** tool. Do not include it in production builds.
- All injected `$_$twiz` calls are wrapped in try/catch so instrumentation failures never break application behavior.
- The SQLite database grows with usage. For long collection sessions, monitor its size.
- The batch reporter POSTs every 2 seconds. Adjust the interval via `reportInterval` in the plugin constructor.
