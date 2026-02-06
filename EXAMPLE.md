# TypeWiz Enhanced - Example Usage

This document shows practical examples of using TypeWiz Enhanced for runtime type collection and analysis.

## 📋 Prerequisites

```bash
npm install better-sqlite3 express cors concurrently
```

## 🚀 Getting Started

### 1. Basic Setup

Create `webpack.config.js`:

```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { setupTypewizEndpoints } = require('typewiz-enhanced/webpack-sqlite-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: path.resolve(__dirname, 'src'),
        use: {
          loader: path.resolve(__dirname, 'node_modules/typewiz-enhanced/webpack-loader.js'),
          options: {
            enableProxyDecorators: true
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    })
  ],
  devServer: {
    static: './dist',
    port: 8080,
    hot: true,
    onAfterSetupMiddleware: (devServer) => {
      // Setup TypeWiz Enhanced endpoints
      setupTypewizEndpoints(devServer.app, './typewiz-collection.db');
    }
  }
};
```

### 2. Sample Application Code

`src/user.js`:
```javascript
export class User {
  constructor(name, email, age) {
    this.name = name;
    this.email = email;
    this.age = age;
    this.preferences = JSON.parse(localStorage.getItem('userPrefs') || '{}');
  }
  
  updateProfile(data) {
    Object.assign(this, data);
    this.save();
  }
  
  save() {
    const userData = {
      name: this.name,
      email: this.email,
      age: this.age,
      preferences: this.preferences
    };
    localStorage.setItem('userData', JSON.stringify(userData));
  }
  
  getDisplayName() {
    return this.name || 'Anonymous User';
  }
}

export function createUser(userData) {
  return new User(userData.name, userData.email, userData.age);
}

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest'
};
```

`src/index.js`:
```javascript
import { User, createUser, USER_ROLES } from './user.js';

// Sample data that will be instrumented
const users = [
  { name: 'John Doe', email: 'john@example.com', age: 30 },
  { name: 'Jane Smith', email: 'jane@example.com', age: 25 },
  { name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
];

// Function calls that will be tracked
function initializeApp() {
  users.forEach(userData => {
    const user = createUser(userData);
    user.updateProfile({ role: USER_ROLES.USER });
    console.log(`Created user: ${user.getDisplayName()}`);
  });
}

// Status tracking
let appStatus = 'initializing';
setTimeout(() => {
  appStatus = 'ready';
  initializeApp();
}, 1000);

setTimeout(() => {
  appStatus = 'running';
}, 2000);
```

### 3. Run the Application

```bash
# Start both webpack dev server and TypeWiz API
npm run dev

# Or individually:
npm start              # Webpack dev server on port 8080
npm run api-server     # TypeWiz API server on port 4000
```

### 4. Interact and Collect Data

1. Open http://localhost:8080 in your browser
2. Interact with the application to generate runtime data
3. TypeWiz Enhanced automatically collects type information

### 5. Query the Collected Data

#### Get Collection Statistics
```bash
curl http://localhost:8080/__typewiz_stats
```

**Response:**
```json
{
  "totalEntities": 45,
  "totalObservations": 1834,
  "uniqueFiles": 3,
  "topTypes": [
    {"type": "string", "count": 892},
    {"type": "object", "count": 445},
    {"type": "number", "count": 312}
  ]
}
```

#### Analyze Function Signatures
```bash
curl "http://localhost:8080/__typewiz_function_calls?filepath=src/user.js"
```

**Response:**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "functionName": "constructor",
      "parameters": {
        "name": {"type": "string", "observations": 12, "examples": ["John Doe", "Jane Smith"]},
        "email": {"type": "string", "observations": 12, "examples": ["john@example.com"]},
        "age": {"type": "number", "observations": 12, "examples": [30, 25, 35]}
      },
      "location": {"filename": "src/user.js", "line": 2, "column": 3}
    },
    {
      "functionName": "updateProfile", 
      "parameters": {
        "data": {
          "type": "object", 
          "shape": "{role: string}",
          "observations": 6
        }
      },
      "location": {"filename": "src/user.js", "line": 9, "column": 3}
    }
  ]
}
```

#### Find Enum Candidates
```bash
curl "http://localhost:8080/__typewiz_sql" -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT entity_name, GROUP_CONCAT(DISTINCT literal_value) as values, COUNT(DISTINCT literal_value) as unique_count FROM value_observations WHERE value_type = \"string\" GROUP BY entity_name HAVING unique_count BETWEEN 2 AND 8 ORDER BY unique_count DESC"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "entity_name": "USER_ROLES_ADMIN",
      "values": "admin,user,guest", 
      "unique_count": 3
    },
    {
      "entity_name": "appStatus",
      "values": "initializing,ready,running",
      "unique_count": 3
    }
  ]
}
```

#### Get Location-Specific Data
```bash
curl "http://localhost:8080/__typewiz_location?filename=src/user.js&line_number=2"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "entity_name": "constructor_param_name",
      "value_type": "string",
      "literal_examples": "John Doe, Jane Smith, Bob Johnson",
      "observation_count": 12,
      "context": {
        "functionName": "constructor",
        "parameterName": "name",
        "context": "constructor_parameter"
      }
    }
  ]
}
```

## 🎯 Generating JSDoc Comments

Based on collected data, you can generate comprehensive JSDoc comments:

```javascript
/**
 * User class for managing user data and preferences
 * @class User
 */
export class User {
  /**
   * Creates a new User instance
   * @param {string} name - User's full name (e.g., "John Doe", "Jane Smith")
   * @param {string} email - User's email address (e.g., "john@example.com")
   * @param {number} age - User's age (observed range: 25-35)
   * @constructor
   */
  constructor(name, email, age) {
    // Implementation...
  }
  
  /**
   * Updates user profile with new data
   * @param {Object} data - Profile update data
   * @param {string} data.role - User role (admin|user|guest)
   * @returns {void}
   * @memberof User
   */
  updateProfile(data) {
    // Implementation...
  }
  
  /**
   * Returns user's display name or default
   * @returns {string} Display name or "Anonymous User"
   * @memberof User
   */
  getDisplayName() {
    // Implementation...
  }
}

/**
 * Factory function to create User instances
 * @param {Object} userData - User data object
 * @param {string} userData.name - User's name
 * @param {string} userData.email - User's email
 * @param {number} userData.age - User's age
 * @returns {User} New User instance
 */
export function createUser(userData) {
  // Implementation...
}

/**
 * User role constants
 * @enum {string}
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user', 
  GUEST: 'guest'
};
```

## 🔍 Advanced Queries

### Find Object Shapes
```bash
curl "http://localhost:8080/__typewiz_sql" -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT filename, entity_name, literal_value FROM value_observations WHERE value_type = \"object\" AND literal_value LIKE \"%name%\" LIMIT 10"
  }'
```

### Analyze Constructor Patterns
```bash
curl "http://localhost:8080/__typewiz_function_calls?functionName=constructor"
```

### Track localStorage Usage
```bash
curl "http://localhost:8080/__typewiz_sql" -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM value_observations WHERE entity_name LIKE \"%localStorage%\" ORDER BY observation_count DESC"
  }'
```

## 🎨 Integration Examples

### With LLM APIs
```javascript
async function generateTypeDefinitions() {
  const response = await fetch('http://localhost:8080/__typewiz_function_calls?filepath=src/user.js');
  const typeData = await response.json();
  
  // Send to your LLM API
  const llmResponse = await fetch('https://api.your-llm.com/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Generate TypeScript interfaces from this runtime data: ${JSON.stringify(typeData)}`,
      temperature: 0.1
    })
  });
  
  return llmResponse.json();
}
```

### With CI/CD Pipelines
```yaml
# .github/workflows/type-analysis.yml
name: Type Analysis
on: [push, pull_request]

jobs:
  analyze-types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
        
      - name: Run TypeWiz collection
        run: |
          npm run build
          timeout 30s npm run demo || true
          
      - name: Generate type report
        run: |
          curl -s http://localhost:8080/__typewiz_stats > type-report.json
          
      - name: Upload type analysis
        uses: actions/upload-artifact@v2
        with:
          name: type-analysis
          path: type-report.json
```

This example demonstrates the full power of TypeWiz Enhanced for runtime type collection and analysis. The collected data can be used for documentation generation, type checking, code understanding, and LLM-powered code analysis.