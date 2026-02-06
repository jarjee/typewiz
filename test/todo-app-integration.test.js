// Integration test to verify removeTodo/editTodo functions are properly captured
const { instrumentCodeWithAST } = require('../lib/ast-instrumenter');
const fs = require('fs');
const path = require('path');

describe('Todo App Function Capture Integration', () => {
    
    test('should properly instrument removeTodo and editTodo functions', () => {
        // Read the actual todos.js file from the todo app
        const todosPath = path.join(__dirname, '../examples/todo-app-js/src/todos.js');
        
        let todosSource;
        try {
            todosSource = fs.readFileSync(todosPath, 'utf8');
        } catch (error) {
            // If file doesn't exist, create a sample that represents the issue
            todosSource = `
// Sample todos.js content representing the functions that were missing
export const todos = [];

export function addTodo(description) {
    const todo = {
        id: Date.now(),
        description,
        completed: false
    };
    todos.push(todo);
    return todo;
}

export function removeTodo(id) {
    const index = todos.findIndex(todo => todo.id === id);
    if (index !== -1) {
        return todos.splice(index, 1)[0];
    }
    return null;
}

export function editTodo(id, newDescription) {
    const todo = todos.find(todo => todo.id === id);
    if (todo) {
        todo.description = newDescription;
        return todo;
    }
    return null;
}

export function toggleTodo(id) {
    const todo = todos.find(todo => todo.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        return todo;
    }
    return null;
}

export function getTodos() {
    return [...todos];
}

export function clearCompleted() {
    const completedIndices = todos
        .map((todo, index) => todo.completed ? index : -1)
        .filter(index => index !== -1)
        .reverse();
    
    return completedIndices.map(index => todos.splice(index, 1)[0]);
}
`;
        }
        
        // Instrument the todos code with AST
        const instrumentedCode = instrumentCodeWithAST(todosSource, 'todos.js');
        
        // Verify that key functions are instrumented
        expect(instrumentedCode).toContain('$_$twiz');
        
        // Verify specific function instrumentations
        expect(instrumentedCode).toContain('removeTodo_param_id');
        expect(instrumentedCode).toContain('editTodo_param_id');
        expect(instrumentedCode).toContain('editTodo_param_newDescription');
        expect(instrumentedCode).toContain('addTodo_param_description');
        expect(instrumentedCode).toContain('toggleTodo_param_id');
        
        // Verify entry point instrumentations
        expect(instrumentedCode).toContain('removeTodo_entry');
        expect(instrumentedCode).toContain('editTodo_entry');
        expect(instrumentedCode).toContain('addTodo_entry');
        expect(instrumentedCode).toContain('toggleTodo_entry');
        
        // Verify function context metadata
        expect(instrumentedCode).toContain('functionName: "removeTodo"');
        expect(instrumentedCode).toContain('functionName: "editTodo"');
        expect(instrumentedCode).toContain('parameterName: "id"');
        expect(instrumentedCode).toContain('parameterName: "newDescription"');
        
        // Verify line number tracking is included
        expect(instrumentedCode).toContain('lineNumber:');
        expect(instrumentedCode).toContain('columnNumber:');
        
        console.log('✅ All todo app functions are properly instrumented with AST approach!');
    });
    
    test('should handle complex function patterns in todo app', () => {
        // Test more complex patterns that might appear in todo apps
        const complexTodosSource = `
class TodoManager {
    constructor(initialTodos = []) {
        this.todos = initialTodos;
        this.listeners = [];
    }
    
    addTodo(description, priority = 'normal') {
        const todo = {
            id: Date.now(),
            description,
            priority,
            completed: false,
            createdAt: new Date()
        };
        this.todos.push(todo);
        this.notifyListeners('add', todo);
        return todo;
    }
    
    removeTodo(id) {
        const index = this.todos.findIndex(todo => todo.id === id);
        if (index !== -1) {
            const removed = this.todos.splice(index, 1)[0];
            this.notifyListeners('remove', removed);
            return removed;
        }
        return null;
    }
    
    editTodo(id, updates) {
        const todo = this.todos.find(todo => todo.id === id);
        if (todo) {
            Object.assign(todo, updates);
            this.notifyListeners('edit', todo);
            return todo;
        }
        return null;
    }
    
    batchUpdate(updates) {
        const results = updates.map(({ id, ...changes }) => 
            this.editTodo(id, changes)
        ).filter(Boolean);
        
        return results;
    }
}

// Arrow functions
const createTodo = (description, tags = []) => ({
    id: Date.now(),
    description,
    tags,
    completed: false
});

// Object methods
const todoUtils = {
    filterByTag(todos, tag) {
        return todos.filter(todo => todo.tags?.includes(tag));
    },
    
    sortByPriority(todos) {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return todos.sort((a, b) => 
            (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
        );
    }
};

// Destructuring parameters
function updateTodoStatus({ id, completed, updatedBy }) {
    return { id, completed, updatedBy, timestamp: Date.now() };
}

function processTodoBatch([...todoIds]) {
    return todoIds.map(id => ({ id, processed: true }));
}
`;
        
        const instrumentedCode = instrumentCodeWithAST(complexTodosSource, 'complex-todos.js');
        
        // Verify class constructor instrumentation
        expect(instrumentedCode).toContain('constructor_param_initialTodos');
        expect(instrumentedCode).toContain('hasDefault: true');
        
        // Verify class method instrumentation
        expect(instrumentedCode).toContain('addTodo_param_description');
        expect(instrumentedCode).toContain('addTodo_param_priority');
        expect(instrumentedCode).toContain('removeTodo_param_id');
        expect(instrumentedCode).toContain('editTodo_param_id');
        expect(instrumentedCode).toContain('editTodo_param_updates');
        
        // Verify arrow function instrumentation
        expect(instrumentedCode).toContain('createTodo_param_description');
        expect(instrumentedCode).toContain('createTodo_param_tags');
        
        // Verify object method instrumentation
        expect(instrumentedCode).toContain('filterByTag_param_todos');
        expect(instrumentedCode).toContain('filterByTag_param_tag');
        expect(instrumentedCode).toContain('sortByPriority_param_todos');
        
        // Verify destructuring parameter instrumentation
        expect(instrumentedCode).toContain('updateTodoStatus_param_destructured_object');
        expect(instrumentedCode).toContain('processTodoBatch_param_destructured_array');
        expect(instrumentedCode).toContain('isDestructured: true');
        
        // Verify context information
        expect(instrumentedCode).toContain('context: "class_method_parameter"');
        expect(instrumentedCode).toContain('context: "arrow_function_parameter"');
        expect(instrumentedCode).toContain('context: "object_method_parameter"');
        expect(instrumentedCode).toContain('context: "constructor_parameter"');
        
        console.log('✅ Complex todo app patterns are properly instrumented!');
    });
    
    test('should compare AST vs Regex approach coverage', () => {
        // This test demonstrates why the AST approach captures more functions
        const problematicSource = `
// These patterns were problematic for regex-based parsing:

// 1. Nested function expressions
const todoActions = {
    batch: {
        remove: function(ids) {
            return ids.map(id => this.parent.remove(id));
        },
        
        edit: (updates) => {
            return updates.map(({ id, ...changes }) => 
                todoManager.edit(id, changes)
            );
        }
    }
};

// 2. Complex arrow functions with destructuring
const processUpdates = ({ 
    additions = [], 
    removals = [], 
    edits = [] 
}) => {
    return {
        added: additions.map(addTodo),
        removed: removals.map(removeTodo),
        edited: edits.map(({ id, ...changes }) => editTodo(id, changes))
    };
};

// 3. Conditional function definitions
if (typeof window !== 'undefined') {
    window.removeTodo = function(id) {
        console.log('Removing todo:', id);
        return todoManager.remove(id);
    };
}

// 4. Functions with complex parameter patterns
function complexEdit(
    todoId,
    {
        description,
        tags = [],
        priority = 'normal',
        dueDate,
        ...metadata
    } = {}
) {
    return updateTodo(todoId, { 
        description, 
        tags, 
        priority, 
        dueDate,
        ...metadata 
    });
}
`;
        
        const instrumentedCode = instrumentCodeWithAST(problematicSource, 'problematic-patterns.js');
        
        // Key functions that AST approach captures but regex would miss:
        expect(instrumentedCode).toContain('processUpdates_param_destructured_object');
        expect(instrumentedCode).toContain('complexEdit_param_todoId');
        
        // The key improvements over regex approach:
        expect(instrumentedCode).toContain('functionName: "processUpdates"');
        expect(instrumentedCode).toContain('functionName: "complexEdit"');
        expect(instrumentedCode).toContain('isDestructured: true');
        expect(instrumentedCode).toContain('context: "arrow_function_parameter"');
        expect(instrumentedCode).toContain('context: "function_declaration_parameter"');
        
        // Verify line and column tracking works for complex patterns
        expect(instrumentedCode).toContain('lineNumber:');
        expect(instrumentedCode).toContain('columnNumber:');
        
        console.log('✅ AST approach successfully handles patterns that regex parsing missed!');
    });
    
    test('should verify TypeScript todo patterns', () => {
        const typescriptTodoSource = `
interface Todo {
    id: number;
    description: string;
    completed: boolean;
    tags?: string[];
    priority: 'low' | 'normal' | 'high';
}

class TypedTodoManager {
    private todos: Todo[] = [];
    
    constructor(
        public readonly maxTodos: number = 100,
        private logger?: (message: string) => void
    ) {}
    
    addTodo(description: string, priority: Todo['priority'] = 'normal'): Todo {
        const todo: Todo = {
            id: Date.now(),
            description,
            completed: false,
            priority
        };
        this.todos.push(todo);
        this.logger?.(\`Added todo: \${description}\`);
        return todo;
    }
    
    removeTodo(id: number): Todo | null {
        const index = this.todos.findIndex(todo => todo.id === id);
        if (index !== -1) {
            const removed = this.todos.splice(index, 1)[0];
            this.logger?.(\`Removed todo: \${removed.description}\`);
            return removed;
        }
        return null;
    }
    
    editTodo(id: number, updates: Partial<Todo>): Todo | null {
        const todo = this.todos.find(todo => todo.id === id);
        if (todo) {
            Object.assign(todo, updates);
            this.logger?.(\`Edited todo: \${todo.description}\`);
            return todo;
        }
        return null;
    }
}

// Generic function
function filterTodos<T extends Todo>(
    todos: T[],
    predicate: (todo: T) => boolean
): T[] {
    return todos.filter(predicate);
}

// Arrow function with generics
const mapTodos = <T, U>(
    todos: T[],
    mapper: (todo: T, index: number) => U
): U[] => {
    return todos.map(mapper);
};
`;
        
        const instrumentedCode = instrumentCodeWithAST(typescriptTodoSource, 'typed-todos.ts');
        
        // Verify TypeScript class constructor with visibility modifiers
        expect(instrumentedCode).toContain('constructor_param_maxTodos');
        expect(instrumentedCode).toContain('constructor_param_logger');
        expect(instrumentedCode).toContain('accessibility: "public"');
        expect(instrumentedCode).toContain('accessibility: "private"');
        expect(instrumentedCode).toContain('parameterType: "annotated"');
        expect(instrumentedCode).toContain('hasDefault: true');
        
        // Verify typed method parameters
        expect(instrumentedCode).toContain('addTodo_param_description');
        expect(instrumentedCode).toContain('addTodo_param_priority');
        expect(instrumentedCode).toContain('removeTodo_param_id');
        expect(instrumentedCode).toContain('editTodo_param_id');
        expect(instrumentedCode).toContain('editTodo_param_updates');
        
        // Verify generic function parameters
        expect(instrumentedCode).toContain('filterTodos_param_todos');
        expect(instrumentedCode).toContain('filterTodos_param_predicate');
        expect(instrumentedCode).toContain('mapTodos_param_todos');
        expect(instrumentedCode).toContain('mapTodos_param_mapper');
        
        console.log('✅ TypeScript todo patterns are properly instrumented!');
    });
    
});

// Manual test helper for visual verification
if (require.main === module) {
    console.log('🧪 Running Todo App Integration Tests...\n');
    
    // You can run this directly to see the instrumentation output
    const sampleCode = `
function removeTodo(id) {
    return todos.filter(todo => todo.id !== id);
}

function editTodo(id, newDescription) {
    return todos.map(todo => 
        todo.id === id ? { ...todo, description: newDescription } : todo
    );
}
`;
    
    const result = instrumentCodeWithAST(sampleCode, 'sample-todos.js');
    console.log('📝 Sample instrumented code:');
    console.log(result.slice(0, 1000) + '...\n');
    
    console.log('✅ Manual verification complete!');
}