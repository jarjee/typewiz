# TypeScript Integration Guide

This guide shows how to use TypeWiz Enhanced with TypeScript projects to discover actual runtime types for `any` annotations and improve type safety.

## 🎯 The TypeScript Challenge

TypeScript's `any` type bypasses type checking, but TypeWiz Enhanced can reveal the **actual runtime types**:

```typescript
// user.ts - Before analysis
function processUser(data: any): any {
  return {
    name: data.name.toUpperCase(),
    email: data.email.toLowerCase(),
    age: data.age + 1
  };
}
```

TypeWiz Enhanced discovers the real types and helps you refactor to:

```typescript
// user.ts - After TypeWiz analysis
interface UserInput {
  name: string;
  email: string; 
  age: number;
}

interface ProcessedUser {
  name: string;
  email: string;
  age: number;
}

function processUser(data: UserInput): ProcessedUser {
  return {
    name: data.name.toUpperCase(),
    email: data.email.toLowerCase(), 
    age: data.age + 1
  };
}
```

## ⚠️ Source Map Challenge

**Critical Issue**: Line numbers don't align between TypeScript and compiled JavaScript!

```typescript
// user.ts (TypeScript source)
1: import { UserRole } from './types';
2: 
3: export class User {
4:   constructor(private name: string) {}  // ← Line 4 in .ts
5: }
```

```javascript
// user.js (compiled JavaScript)  
1: "use strict";
2: Object.defineProperty(exports, "__esModule", { value: true });
3: var User = (function () {
4:     function User(name) {              // ← Line 4 in .js
5:         this.name = name;               // ← Line 5 in .js  
6:     }
7:     return User;
8: }());
```

TypeWiz reports `user.js:4` but you need `user.ts:4`!

## 🗺️ Solution: Source Map Integration

### 1. Enable Source Maps in TypeScript

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSourceMap": false,
    "inlineSources": true,
    "declaration": true,
    "outDir": "./dist"
  }
}
```

### 2. Enhanced Webpack Configuration

`webpack.config.js`:
```javascript
const path = require('path');
const { setupTypewizEndpoints } = require('typewiz-enhanced/webpack-sqlite-plugin');

module.exports = {
  mode: 'development',
  devtool: 'source-map', // Enable source maps
  
  module: {
    rules: [
      // TypeScript compilation first
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                sourceMap: true,
                inlineSourceMap: false
              }
            }
          }
        ],
        exclude: /node_modules/
      },
      // TypeWiz instrumentation on compiled JS
      {
        test: /\.js$/,
        include: [
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, 'dist') // Include compiled output
        ],
        use: {
          loader: 'typewiz-enhanced/webpack-loader.js',
          options: {
            enableProxyDecorators: true,
            enableSourceMaps: true, // Enable source map support
            preserveComments: true
          }
        }
      }
    ]
  },
  
  devServer: {
    onAfterSetupMiddleware: (devServer) => {
      setupTypewizEndpoints(devServer.app, './typewiz-collection.db');
    }
  }
};
```

### 3. TypeScript-Aware API Responses

With source map integration, TypeWiz Enhanced returns **both** locations:

```bash
curl "http://localhost:8080/__typewiz_function_calls?filepath=src/user.ts"
```

**Response with Source Map Support:**
```json
{
  "success": true,
  "data": [
    {
      "functionName": "processUser",
      "parameters": {
        "data": {
          "type": "object",
          "shape": "{name: string, email: string, age: number}",
          "observations": 47
        }
      },
      "location": {
        "typescript": {
          "filename": "src/user.ts",
          "line": 4,
          "column": 17
        },
        "javascript": {
          "filename": "dist/user.js", 
          "line": 8,
          "column": 23
        }
      }
    }
  ]
}
```

## 🎯 Practical TypeScript Workflow

### Step 1: Identify `any` Types
```bash
# Find functions with 'any' parameters that have runtime data
curl "http://localhost:8080/__typewiz_sql" -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT DISTINCT typescript_filename, typescript_line, entity_name, COUNT(*) as observations FROM entities WHERE typescript_filename LIKE \"%.ts\" GROUP BY typescript_filename, typescript_line ORDER BY observations DESC"
  }'
```

### Step 2: Analyze Runtime Patterns
```typescript
// Original code with 'any'
function handleApiResponse(response: any): any {
  return response.data.map(item => ({
    id: item.id,
    title: item.title,
    completed: item.completed
  }));
}
```

Query the runtime data:
```bash
curl "http://localhost:8080/__typewiz_location?filename=src/api.ts&line_number=15"
```

### Step 3: Generate Type Definitions
Based on TypeWiz data, create proper interfaces:

```typescript
interface ApiResponseItem {
  id: string;
  title: string;
  completed: boolean;
}

interface ApiResponse {
  data: ApiResponseItem[];
}

function handleApiResponse(response: ApiResponse): ApiResponseItem[] {
  return response.data.map(item => ({
    id: item.id,
    title: item.title,
    completed: item.completed
  }));
}
```

## 🔧 Advanced TypeScript Features

### 1. Union Type Discovery
```typescript
// TypeWiz discovers this is actually a union type
function setStatus(status: any): void {
  // Runtime analysis shows: 'pending' | 'completed' | 'failed'
}

// Refactor to:
type Status = 'pending' | 'completed' | 'failed';
function setStatus(status: Status): void {
  // Now type-safe!
}
```

### 2. Generic Type Inference
```typescript
// Before: Generic with any
function processArray<T = any>(items: T[]): T[] {
  return items.filter(item => item != null);
}

// TypeWiz reveals T is always {id: string, name: string}
interface Item {
  id: string;
  name: string;
}

function processArray<T extends Item>(items: T[]): T[] {
  return items.filter(item => item != null);
}
```

### 3. Conditional Type Guards
```typescript
// Generate type guards from runtime data
function isValidUser(obj: any): obj is User {
  return obj && 
         typeof obj.name === 'string' &&
         typeof obj.email === 'string' &&
         typeof obj.age === 'number';
}
```

## 🚀 Automated Type Migration

### 1. CLI Tool Integration
```bash
# Generate TypeScript definitions from TypeWiz data
npx typewiz-ts-generator --input ./typewiz-collection.db --output ./generated-types.ts
```

### 2. VS Code Extension
Create a VS Code extension that:
- Queries TypeWiz Enhanced API
- Shows type hints for `any` parameters
- Offers "Replace any with inferred type" code actions

### 3. ESLint Plugin
```javascript
// eslint-plugin-typewiz-enhanced
module.exports = {
  rules: {
    'no-uninferred-any': {
      create(context) {
        return {
          TSAnyKeyword(node) {
            // Query TypeWiz API for this location
            // Suggest specific type if data available
          }
        };
      }
    }
  }
};
```

## 📊 Example: Todo App Migration

### Before (with `any`)
```typescript
// todos.ts
class TodoManager {
  addTodo(todo: any): void {
    this.todos.push(todo);
  }
  
  updateTodo(id: any, updates: any): any {
    const todo = this.todos.find(t => t.id === id);
    return Object.assign(todo, updates);
  }
}
```

### After TypeWiz Analysis
```bash
# Query runtime data
curl "http://localhost:8080/__typewiz_function_calls?filepath=src/todos.ts&functionName=addTodo"
```

### After Migration
```typescript
// todos.ts - Type-safe version
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

interface TodoUpdate {
  title?: string;
  completed?: boolean;
}

class TodoManager {
  private todos: Todo[] = [];
  
  addTodo(todo: Todo): void {
    this.todos.push(todo);
  }
  
  updateTodo(id: string, updates: TodoUpdate): Todo | undefined {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      return Object.assign(todo, updates);
    }
    return undefined;
  }
}
```

## ⚡ Performance Considerations

### Source Map Loading
- Source maps are loaded **once** per compilation
- Cached in memory for fast lookups
- Graceful fallback to JS locations if source maps fail

### Build Integration
```json
{
  "scripts": {
    "dev": "concurrently \"tsc --watch\" \"webpack serve\"",
    "analyze-types": "npm run dev && node scripts/analyze-types.js",
    "migrate-any": "node scripts/migrate-any-types.js"
  }
}
```

## 🎯 Best Practices

1. **Start with High-Traffic Functions**: Focus on functions with many observations
2. **Validate Generated Types**: Always review TypeWiz suggestions before applying
3. **Gradual Migration**: Replace `any` incrementally, not all at once  
4. **Keep Source Maps**: Essential for accurate line number mapping
5. **Monitor Bundle Size**: Source maps increase bundle size in development

TypeWiz Enhanced transforms TypeScript development by revealing the **actual runtime behavior** behind `any` types, enabling confident migration to proper type safety! 🚀