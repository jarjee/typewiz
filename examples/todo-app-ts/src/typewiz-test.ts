/**
 * TypeWiz Enhanced test functions for TypeScript
 * Intentionally uses 'any' types to demonstrate TypeWiz Enhanced type discovery
 */

// Intentionally using 'any' parameters - TypeWiz Enhanced will discover actual types
export function processUserData(userData: any): any {
  console.log('[TypeWiz TS Test] Processing user data:', userData);
  
  if (userData && userData.name) {
    return {
      fullName: userData.name.toUpperCase(),
      age: userData.age || 0,
      isActive: userData.active === true
    };
  }
  
  return null;
}

// Intentionally using 'any' for array operations - TypeWiz Enhanced will discover array element types
export function filterItems(items: any, condition: any): any {
  console.log('[TypeWiz TS Test] Filtering items:', items);
  
  if (Array.isArray(items)) {
    return items.filter(condition);
  }
  
  return [];
}

// Intentionally using 'any' for DOM manipulation - TypeWiz Enhanced will discover HTMLElement types
export function updateElement(element: any, config: any): void {
  console.log('[TypeWiz TS Test] Updating element:', element, config);
  
  if (element && config) {
    if (config.text) {
      element.textContent = config.text;
    }
    if (config.className) {
      element.className = config.className;
    }
    if (config.styles) {
      Object.assign(element.style, config.styles);
    }
  }
}

// Test function that will be called to generate type data
export function runTypewizTests(): void {
  console.log('[TypeWiz TS Test] Running TypeScript type discovery tests...');
  
  // Test with user data
  const user = processUserData({
    name: 'John Doe',
    age: 30,
    active: true,
    email: 'john@example.com'
  });
  
  // Test with array filtering
  const numbers = [1, 2, 3, 4, 5];
  const evenNumbers = filterItems(numbers, (n: number) => n % 2 === 0);
  
  // Test with DOM element (if available)
  const testElement = document.createElement('div');
  updateElement(testElement, {
    text: 'TypeWiz Test Element',
    className: 'test-element',
    styles: { color: 'blue', fontSize: '16px' }
  });
  
  console.log('[TypeWiz TS Test] Results:', { user, evenNumbers, testElement });
}