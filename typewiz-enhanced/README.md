# TypeWiz Enhanced - Advanced Runtime Type Collection & Analysis

🚀 **Enhanced TypeWiz** is a powerful runtime type collection system that automatically instruments JavaScript code to capture detailed type information, function signatures, and usage patterns. Perfect for adding JSDoc comments, TypeScript definitions, or understanding complex codebases.

## ✨ Features

- **🔧 Auto-Instrumentation**: Automatically wraps variables, functions, and constructors with type collectors
- **📊 SQLite Storage**: Stores all collected data in structured SQLite database  
- **🌐 REST API**: Complete API suite for querying type data with LLM-friendly endpoints
- **🎯 Function Context**: Captures function names, line numbers, and parameter types
- **🏗️ Constructor Coverage**: Enhanced instrumentation for class constructors and initialization patterns
- **💾 localStorage Integration**: Tracks localStorage operations and JSON parsing patterns
- **📍 Location-Based Queries**: Precise line/column correlation for targeted analysis
- **🔍 Smart Detection**: Automatically identifies enum candidates, object shapes, and union types

## 📦 Installation

```bash
npm install better-sqlite3 express cors
```

## 🚀 Quick Start

### 1. Webpack Integration

#### TypeScript Projects

For TypeScript projects with full type checking:

```javascript
const path = require('path');
const { setupTypewizEndpoints } = require('./typewiz-enhanced');

module.exports = {
  // ... your existing config
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  devtool: 'source-map',
  
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,  // TypeScript compilation
              configFile: path.resolve(__dirname, 'tsconfig.json')
            }
          },
          {
            loader: require.resolve('typewiz-enhanced/lib/webpack-loader.js'),
            options: {
              // Optional: Control which files to process
              includePatterns: ['src/**/*.ts'],
              excludePatterns: ['**/*.test.ts', '**/*.spec.ts']
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

#### JavaScript Projects

For JavaScript projects:

```javascript
const path = require('path');
const { setupTypewizEndpoints } = require('./typewiz-enhanced');

module.exports = {
  // ... your existing config
  
  module: {
    rules: [
      {
        test: /\.js$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /node_modules/,
        use: {
          loader: require.resolve('typewiz-enhanced/lib/webpack-loader.js')
          // No configuration needed - TypeWiz Enhanced works out of the box!
        }
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

> **🎯 Accurate Line Numbers**: TypeWiz processes the original TypeScript source before compilation, ensuring perfect line number accuracy. The `reindexTodos` function at line 90 in your source will be correctly reported as line 90, not some offset number.
>
> **⚠️ CRITICAL: Webpack Loader Order**: The loader order is essential for accurate line numbers. If you put TypeWiz after `ts-loader`, it will receive compiled JavaScript instead of original TypeScript source, causing line number misalignment (e.g., reporting line 75 instead of actual line 90).

### 2. Start Collection

```bash
npm start  # Starts webpack dev server with TypeWiz instrumentation
```

### 3. Query Type Data

Use the built-in REST API endpoints:

```bash
# Get statistics
curl http://localhost:8080/__typewiz_stats

# Get function calls for specific file
curl "http://localhost:8080/__typewiz_function_calls?filepath=src/todos.js"

# Get location-specific data
curl "http://localhost:8080/__typewiz_location?filename=src/todos.js&line_number=55"

# Get entity overview
curl http://localhost:8080/__typewiz_entities
```

## 🛠️ API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/__typewiz_stats` | GET | Collection statistics and overview |
| `/__typewiz_function_calls` | GET | Function call analysis with parameters `filepath`, `functionName`, `offset`, `pageSize` |
| `/__typewiz_location` | GET | Location-specific type data with `filename`, `line_number`, `column_number` |
| `/__typewiz_entities` | GET | Browse all collected entities |
| `/__typewiz_sql` | POST | Execute custom SQL queries |
| `/__typewiz_sqlite_report` | POST | Submit collected type data |

### Query Parameters

**Function Calls Endpoint:**
- `filepath` - Target file path (e.g., "src/todos.js")
- `functionName` - Specific function name (optional)
- `offset` - Pagination offset (optional, default: 0)
- `pageSize` - Results per page (optional, default: 50)

**Location Endpoint:**
- `filename` - File path
- `line_number` - Line number
- `column_number` - Column number (optional)

## 🏗️ Architecture

### Components

1. **Webpack Loader** (`webpack-loader.js`)
   - Instruments JavaScript files with type collectors
   - Enhanced constructor and initialization coverage
   - localStorage and JSON operation tracking

2. **SQLite Plugin** (`webpack-sqlite-plugin.js`)
   - Sets up REST API endpoints
   - Manages SQLite database operations
   - Provides LLM-friendly data formatting

3. **Data Collector** (`sqlite-collector.js`)
   - Processes collected type data
   - Handles database insertions
   - Manages schema and relationships

### Database Schema

```sql
-- Main entities table
CREATE TABLE entities (
    id INTEGER PRIMARY KEY,
    filename TEXT,
    offset_position INTEGER,
    entity_name TEXT,
    entity_type TEXT,
    observation_count INTEGER,
    last_seen DATETIME
);

-- Value observations
CREATE TABLE value_observations (
    id INTEGER PRIMARY KEY,
    entity_id INTEGER,
    value_type TEXT,
    literal_value TEXT,
    observation_count INTEGER,
    FOREIGN KEY (entity_id) REFERENCES entities (id)
);

-- Object shape analysis
CREATE TABLE object_shapes (
    id INTEGER PRIMARY KEY,
    entity_id INTEGER,
    shape_signature TEXT,
    property_names TEXT,
    property_types TEXT,
    observation_count INTEGER,
    FOREIGN KEY (entity_id) REFERENCES entities (id)
);
```

## 🎯 Use Cases

### 1. Adding JSDoc Comments

Use the API to automatically generate JSDoc comments:

```javascript
// Query function data
const response = await fetch('/___typewiz_function_calls?filepath=src/todos.js&functionName=addTodo');
const data = await response.json();

// Generate JSDoc from collected types
/**
 * @param {TodoItem} todo - Object with properties: {completed: boolean, description: string, id: string, index: number}
 * @returns {void}
 */
function addTodo(todo) { /* ... */ }
```

### 2. TypeScript Definition Generation

Extract interface definitions from runtime data:

```typescript
interface TodoItem {
  completed: boolean;
  description: string;
  id: string;
  index: number;
}
```

### 3. Code Analysis & Understanding

Analyze complex codebases by understanding actual runtime behavior:

```bash
# Find all enum-like string patterns
curl "http://localhost:8080/__typewiz_sql" -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT entity_name, GROUP_CONCAT(literal_value) FROM value_observations WHERE value_type = \"string\" GROUP BY entity_name HAVING COUNT(DISTINCT literal_value) BETWEEN 2 AND 5"}'
```

## 🔧 Configuration

### Zero Configuration

TypeWiz Enhanced works out of the box with no configuration required! Simply add the loader to your webpack configuration and it will automatically:

- ✅ **Instrument all functions** with parameter and return type collection
- ✅ **Handle TypeScript and JavaScript** with perfect syntax support
- ✅ **Preserve accurate line numbers** for debugging
- ✅ **Process source maps** automatically when available

### Advanced Configuration

#### Include/Exclude Patterns

Control which files TypeWiz processes using glob patterns:

```javascript
{
  loader: require.resolve('typewiz-enhanced/lib/webpack-loader.js'),
  options: {
    includePatterns: ['src/**/*.js', 'components/**/*.ts'], // Only process these
    excludePatterns: ['**/*.spec.js', '**/*.test.ts', 'node_modules/**'] // Skip these
  }
}
```

**Pattern Examples:**
- `src/**/*.js` - All JS files in src directory and subdirectories
- `**/*.spec.js` - All spec files anywhere
- `components/**/*.{js,ts}` - JS and TS files in components directory
- `!src/important.js` - Negation pattern (exclude this specific file)

**How it works:**
1. If `includePatterns` is specified, files must match at least one pattern
2. If `excludePatterns` is specified, files must NOT match any pattern
3. Both can be used together (file must be included AND not excluded)
4. Uses [micromatch](https://github.com/micromatch/micromatch) for fast, reliable pattern matching

#### Other Options

```javascript
{
  loader: require.resolve('typewiz-enhanced/lib/webpack-loader.js'),
  options: {
    enableSourceMaps: false,  // Disable source map processing (rarely needed)
    includePatterns: ['src/**/*.js'],
    excludePatterns: ['**/*.test.js']
  }
}
```

### Database Configuration

The SQLite database (`typewiz-collection.db`) is automatically created and managed. No manual setup required.

## 📊 Examples

### Basic Usage with Todo App

1. **Instrument the code** - Webpack loader automatically adds collectors
2. **Interact with app** - Runtime data gets collected
3. **Query results** - Use API endpoints to extract type information

```javascript
// Original code
function addTodo(todo) {
  this.list.push(todo);
}

// After instrumentation (automatic)
function addTodo(todo) {
  try { $_$twiz('addTodo_param_todo', todo, 123, 'todos.js', '{"functionName":"addTodo","parameterName":"todo","context":"function_parameter"}'); } catch(e) {}
  this.list.push(todo);
}
```

### Advanced Queries

```javascript
// Find all constructor patterns
const constructors = await fetch('/__typewiz_sql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      SELECT filename, entity_name, literal_value 
      FROM entities e
      JOIN value_observations v ON e.id = v.entity_id 
      WHERE entity_name LIKE '%constructor%'
    `
  })
});

// Get enum candidates
const enums = await fetch('/__typewiz_entities?type=enum_candidates');
```

## 🤖 LLM Integration

Perfect for AI-powered code analysis and annotation. The API returns structured JSON data that's optimized for LLM consumption:

```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "functionName": "addTodo",
      "parameters": {
        "todo": {
          "type": "object",
          "shape": "{completed: boolean, description: string, id: string, index: number}",
          "observations": 7
        }
      },
      "location": {
        "filename": "src/todos.js",
        "line": 55,
        "column": 3
      }
    }
  ]
}
```

## ⚠️ Important Configuration Notes

### Webpack Loader Order for TypeScript

**CRITICAL**: For accurate line numbers in TypeScript projects, ensure TypeWiz processes the original TypeScript source **before** `ts-loader` compilation:

```javascript
// ✅ CORRECT - TypeWiz gets original TypeScript source
use: [
  'ts-loader',       // Runs second (left-to-right)
  'typewiz-loader'   // Runs first (right-to-left execution)
]

// ❌ WRONG - TypeWiz gets compiled JavaScript  
use: [
  'typewiz-loader',  // Gets compiled JS (comments stripped, wrong line numbers)
  'ts-loader'        // Compiles first
]
```

**Why this matters**: If TypeWiz runs after `ts-loader`, it receives compiled JavaScript instead of original TypeScript:
- ❌ **Wrong**: Function at line 90 reported as line 75 (15-line offset from stripped comments/types)
- ✅ **Correct**: Function at line 90 reported as line 90 (perfect accuracy)

## 🛡️ Production Notes

- **Performance**: Instrumentation adds minimal overhead (~2-5% in development)
- **Security**: Only runs in development mode by default
- **Storage**: SQLite database grows with usage - monitor size in long-running collections
- **Memory**: Type data is stored in database, not memory, for efficient large-scale collection

## 🔗 Related Projects

- [TypeWiz](https://github.com/urish/typewiz) - Original TypeWiz project
- [TypeScript](https://www.typescriptlang.org/) - Static type checking
- [JSDoc](https://jsdoc.app/) - JavaScript documentation generator

---

**TypeWiz Enhanced** - Making JavaScript type inference smarter, one runtime observation at a time. 🚀
