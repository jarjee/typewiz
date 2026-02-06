# TypeWiz Enhanced - JavaScript Todo App Example

This is a complete working example demonstrating TypeWiz Enhanced with a JavaScript todo application using Webpack.

## Quick Start

1. **Install dependencies for TypeWiz Enhanced (from the root typewiz-enhanced directory):**
   ```bash
   cd /workspace/typewiz-enhanced
   npm install
   ```

2. **Install dependencies for this example:**
   ```bash
   cd examples/todo-app-js
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

   This will:
   - Start webpack-dev-server on http://localhost:8080
   - Automatically open your browser
   - Set up TypeWiz Enhanced endpoints for type collection
   - Instrument JavaScript files for runtime type analysis

## Features

- **Live Todo App**: Add, edit, complete, and delete todos
- **TypeWiz Integration**: Runtime type collection and analysis
- **SQLite Storage**: Type data stored in `typewiz-collection.db`
- **REST API**: Access collected type data via HTTP endpoints
- **Hot Reload**: Development server with hot module replacement

## API Endpoints

TypeWiz Enhanced provides several endpoints for accessing collected type information:

- `POST /__typewiz_sqlite_report` - Submit type collection data
- `GET /__typewiz_stats` - View type collection statistics
- `GET /__typewiz_function_calls` - Function call analysis
- `GET /__typewiz_location` - Location-specific type data
- `POST /__typewiz_sql` - Execute direct SQL queries
- `GET /__typewiz_entities` - Browse collected entities

## Testing TypeWiz

1. Open the browser console when running the app
2. Use the todo app (add, edit, complete todos)
3. Run `testTypeWizAPI()` in the console to test API endpoints
4. Check the collected type data in the database

## Files Structure

```
todo-app-js/
├── index.html          # Main HTML template
├── index.js            # Application entry point
├── todos.js            # Todo class with CRUD operations
├── todosRender.js      # DOM rendering and event handling
├── style.css           # Application styles
├── typewiz-test.js     # TypeWiz testing utilities
├── webpack.config.js   # Webpack configuration with TypeWiz
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## Configuration Details

### Webpack Configuration

The `webpack.config.js` includes:

- **TypeWiz Loader**: `require.resolve('../../lib/webpack-loader.js')`
- **Endpoint Setup**: `setupTypewizEndpoints` from `'../../index'`
- **Node Modules Exclusion**: TypeWiz only instruments your application code
- **Dev Server Integration**: Middleware setup for type collection endpoints

### Key Configuration Options

```javascript
{
  test: /\.js$/,
  include: path.resolve(__dirname),
  exclude: /node_modules/,
  use: {
    loader: require.resolve('../../lib/webpack-loader.js'),
    options: {
      enableProxyDecorators: true
    }
  }
}
```

## Available Scripts

- `npm start` - Start development server with TypeWiz
- `npm run dev` - Same as start
- `npm run build` - Build for production

## Example Type Analysis

The todo app demonstrates TypeWiz's ability to analyze:

- **Object Structures**: Todo items with properties like `{id, description, completed, index}`
- **Function Parameters**: String IDs, boolean status values, todo objects
- **Array Operations**: Todo list manipulations and filtering
- **DOM Interactions**: Event handling and form processing

## Troubleshooting

1. **Module not found errors**: Ensure dependencies are installed in both the root typewiz-enhanced directory and this example directory
2. **Port 8080 in use**: The dev server will automatically find an available port
3. **TypeWiz not collecting data**: Check browser console for `$_$twiz` availability
4. **Build errors**: Ensure node_modules is excluded from TypeWiz instrumentation

## Contributing

This example is part of the TypeWiz Enhanced project. See the main README for contribution guidelines.