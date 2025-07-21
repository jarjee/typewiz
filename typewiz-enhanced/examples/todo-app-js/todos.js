/**
 * Todo item type definition based on TypeWiz analysis
 * TypeWiz validation: ✅ Object shape confirmed with 7 observations
 * Properties: completed:boolean, description:string, id:string, index:number
 * @typedef {Object} TodoItem
 * @property {boolean} completed - Whether the todo is completed
 * @property {string} description - The description text of the todo
 * @property {string} id - Unique identifier for the todo (pattern: 'id' + random hex string)
 * @property {number} index - Position index of the todo in the list (1-based indexing)
 */

/**
 * Todos class for managing a list of todo items with localStorage persistence
 * TypeWiz validation: ✅ Class methods and data types confirmed
 * 
 * @class Todos
 */
export default class Todos {
  /**
   * Initialize the Todos class with data from localStorage
   * Sets up the internal list array from stored data or empty array
   * TypeWiz validation: ✅ Constructor initializes list property correctly
   * 
   * @constructor
   * @memberof Todos
   */
  constructor() {
    /**
     * Internal list of todo items
     * @type {TodoItem[]}
     * @private
     */
    this.list = localStorage.getItem('todos')
      ? JSON.parse(localStorage.getItem('todos'))
      : [];
  }

  /**
   * Add a new todo item to the list and persist to localStorage
   * TypeWiz validation: ✅ Parameter confirmed as TodoItem object structure
   * Observed todo objects match: {completed:boolean, description:string, id:string, index:number}
   * 
   * @param {TodoItem} todo - The todo item to add to the list
   * @returns {void}
   * @memberof Todos
   * @example
   * // Add a new todo
   * todos.addTodo({
   *   id: 'id123abc',
   *   description: 'Buy groceries',
   *   completed: false,
   *   index: 1
   * });
   */
  addTodo(todo) {
    this.list.push(todo);
    localStorage.setItem('todos', JSON.stringify(this.list));
    
    console.log('[TypeWiz Auto] Added todo to list:', todo);
  }

  /**
   * Remove a todo item by ID and reindex remaining items
   * TypeWiz validation: ✅ todoID parameter confirmed as string type
   * Observed ID patterns: 'id' followed by random hex string (e.g., 'id2aa6f3fc227528')
   * 
   * @param {string} todoID - The unique ID of the todo to remove
   * @returns {void}
   * @memberof Todos
   * @example
   * // Remove a todo by ID
   * todos.removeTodo('id123abc');
   */
  removeTodo(todoID) {
    this.list = this.list.filter((todo) => todo.id !== todoID);
    this.list.forEach((todo, index) => {
      todo.index = index + 1;
    });
    localStorage.setItem('todos', JSON.stringify(this.list));
  }

  /**
   * Edit the description of an existing todo item
   * TypeWiz validation: ✅ Both parameters confirmed as string types
   * Observed descriptions: 'test', 'hello', 'test world', 'bloop'
   * 
   * @param {string} todoId - The unique ID of the todo to edit
   * @param {string} todoDescription - The new description text
   * @returns {void}
   * @memberof Todos
   * @example
   * // Edit a todo description
   * todos.editTodo('id123abc', 'Updated description');
   */
  editTodo(todoId, todoDescription) {
    this.list = this.list.map((todo) => {
      if (todo.id === todoId) {
        return { ...todo, description: todoDescription };
      }
      return todo;
    });
    localStorage.setItem('todos', JSON.stringify(this.list));
  }

  /**
   * Update the completion status of a todo item
   * TypeWiz validation: ✅ todoId confirmed as string, status as boolean
   * Boolean values observed in completed property of TodoItem objects
   * 
   * @param {string} todoId - The unique ID of the todo to update
   * @param {boolean} status - The new completion status (true for completed, false for incomplete)
   * @returns {void}
   * @memberof Todos
   * @throws {Error} If todo with specified ID is not found
   * @example
   * // Mark a todo as completed
   * todos.completeTodo('id123abc', true);
   */
  completeTodo(todoId, status) {
    const selected = this.list.findIndex((element) => element.id === todoId);
    if (selected === -1) {
      throw new Error(`Todo with ID '${todoId}' not found`);
    }
    this.list[selected].completed = status;
    localStorage.setItem('todos', JSON.stringify(this.list));
    
    console.log('[TypeWiz Auto] Todo status changed:', { todoId, status });
  }

  /**
   * Remove all completed todos from the list and reindex remaining items
   * TypeWiz validation: ✅ Filters by completed boolean property (confirmed type)
   * Reindexing ensures consistent 1-based index numbering
   * 
   * @returns {void}
   * @memberof Todos
   * @example
   * // Clear all completed todos
   * todos.clearCompletedTodos();
   */
  clearCompletedTodos() {
    this.list = this.list.filter((todo) => !todo.completed);
    this.list.forEach((todo, index) => {
      todo.index = index + 1;
    });
    localStorage.setItem('todos', JSON.stringify(this.list));
  }
}
