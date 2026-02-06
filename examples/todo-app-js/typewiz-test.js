// Simple browser test for TypeWiz data flow
console.log('🧪 TypeWiz Browser Test Loading...');

// Test TypeWiz availability 
setTimeout(() => {
    if (typeof $_$twiz !== 'undefined') {
        console.log('✅ $_$twiz is available');
        
        // Manual test data
        $_$twiz('test_string', 'hello', 100, 'test.js', '{}');
        $_$twiz('test_number', 42, 101, 'test.js', '{}');
        $_$twiz('test_boolean', true, 102, 'test.js', '{}');
        $_$twiz('test_object', {id: 1, name: 'test'}, 103, 'test.js', '{}');
        
        console.log('🔍 Manual test data added');
        
        // Check collected data
        const data = $_$twiz.get();
        console.log('📊 Current collected data:', data);
        
        // Test manual API call
        window.testTypeWizAPI = async function() {
            try {
                console.log('🌐 Testing manual API call...');
                const response = await fetch('/__typewiz_sqlite_report', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Manual API call successful:', result);
                    
                    // Check results
                    const statsResponse = await fetch('/__typewiz_stats');
                    const stats = await statsResponse.json();
                    console.log('📈 Updated stats:', stats);
                    
                    const enumsResponse = await fetch('/__typewiz_entities');
                    const enums = await enumsResponse.json();
                    console.log('🔤 Entity data:', enums);
                    
                } else {
                    console.error('❌ Manual API call failed:', response.status, await response.text());
                }
            } catch (error) {
                console.error('❌ Network error:', error);
            }
        };
        
        console.log('💡 Run testTypeWizAPI() in console to test the API manually');
        
    } else {
        console.error('❌ $_$twiz is not available - TypeWiz plugin not working');
    }
}, 1000);

export default {};