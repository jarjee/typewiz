# Changelog

All notable changes to TypeWiz Enhanced will be documented in this file.

## [2.0.0] - 2025-01-XX

### ✨ Major New Features

- **🚀 Complete Rewrite**: Enhanced TypeWiz with comprehensive runtime type collection
- **📊 SQLite Integration**: Persistent storage for all collected type data
- **🌐 REST API Suite**: 6 comprehensive endpoints for querying type information
- **🎯 Function Context**: Capture function names, line numbers, and parameter types
- **📍 Location-Based Queries**: Precise line/column correlation for targeted analysis

### 🏗️ Enhanced Instrumentation

- **Constructor Coverage**: Special instrumentation for class constructors and initialization patterns
- **localStorage Integration**: Automatic tracking of localStorage operations and JSON parsing
- **Property Assignment**: Enhanced instrumentation for `this.property = value` patterns
- **Function Entry Tracking**: Better coverage tracking for all function types
- **Enhanced Context**: Rich metadata including function names, line numbers, and context information

### 🛠️ API Endpoints

- `/__typewiz_stats` - Collection statistics and overview
- `/__typewiz_function_calls` - Function call analysis with pagination
- `/__typewiz_location` - Location-specific type data queries
- `/__typewiz_entities` - Browse all collected entities
- `/__typewiz_sql` - Execute custom SQL queries
- `/__typewiz_sqlite_report` - Submit collected type data

### 📦 Webpack Integration

- **Simplified Configuration**: Direct import approach instead of complex middleware
- **Auto-Setup**: Automatic endpoint configuration via `setupTypewizEndpoints()`
- **Enhanced Loader**: Comprehensive code instrumentation with proxy decorators
- **Zero Config**: Works out-of-the-box with minimal setup

### 🗄️ Database Schema

- **Structured Storage**: Comprehensive SQLite schema for entities, observations, and shapes
- **Relationship Mapping**: Foreign key relationships for complex type analysis
- **Performance Optimized**: Indexed queries for fast data retrieval
- **Scalable Design**: Handles large-scale type collection efficiently

### 🤖 LLM Integration

- **Structured JSON**: Optimized data format for LLM consumption
- **Smart Detection**: Automatic enum candidates and object shape analysis
- **Type Inference**: Runtime-based type inference with confidence scoring
- **JSDoc Generation**: Perfect for AI-powered documentation generation

### 🔧 Development Experience

- **Hot Reload**: Real-time type collection during development
- **Concurrent Mode**: Run webpack dev server and API server simultaneously
- **Debug Support**: Comprehensive logging and error handling
- **Memory Efficient**: Database storage instead of in-memory collection

### 📚 Documentation & Examples

- **Comprehensive README**: Detailed setup and usage instructions
- **Example Integration**: Complete example with todo application
- **API Documentation**: Full endpoint reference with examples
- **Use Case Guide**: JSDoc generation, TypeScript definitions, code analysis

### 🛡️ Production Ready

- **Error Handling**: Graceful fallbacks and error recovery
- **Performance**: Minimal overhead (~2-5% in development)
- **Security**: Development-only by default with configurable options
- **Monitoring**: Built-in statistics and health checks

### 🔗 Migration from Original TypeWiz

- **Drop-in Replacement**: Enhanced features while maintaining compatibility
- **Improved Coverage**: Better constructor and initialization tracking
- **Advanced Queries**: SQL-based queries instead of simple data dumps
- **API First**: RESTful design for integration with external tools

---

## Previous Versions

This is the first release of TypeWiz Enhanced as a standalone package. 

Based on the original [TypeWiz](https://github.com/urish/typewiz) project with significant enhancements for modern JavaScript development workflows.