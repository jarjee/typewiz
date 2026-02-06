// Start the LLM API Server for TypeWiz Enhanced
const { createLLMApiServer } = require('./typewiz-enhanced/llm-api-server');

console.log('🚀 Starting TypeWiz Enhanced LLM API Server...');
console.log('📂 Working directory:', process.cwd());
console.log('🗄️  Database: ./typewiz-collection.db');

try {
    const server = createLLMApiServer('./typewiz-collection.db', 4000);
    
    console.log('\n✅ Server started successfully!');
    console.log('🌐 Webpack Dev Server: http://localhost:3000');
    console.log('🤖 LLM API Server: http://localhost:4000');
    console.log('\n📋 Quick Test Commands:');
    console.log('  curl http://localhost:4000/health');
    console.log('  curl http://localhost:4000/__typewiz_stats');
    console.log('  curl http://localhost:4000/api/entities');
    console.log('\n⏳ Waiting for type collection data...');
    console.log('   Open http://localhost:3000 and interact with the todo app');
    console.log('   Then check http://localhost:4000/api/enum-candidates for results');
    
} catch (error) {
    console.error('❌ Failed to start API server:', error.message);
    console.error('Make sure all dependencies are installed:');
    console.error('  npm install better-sqlite3 express cors');
    process.exit(1);
}