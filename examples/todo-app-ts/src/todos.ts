import { TodoItem, StorageData } from './types';

/**
 * Todos class for managing a list of todo items with localStorage persistence
 * Demonstrates TypeScript integration with TypeWiz Enhanced
 * Some types are intentionally left as 'any' for TypeWiz Enhanced to discover
 */
export default class Todos {
  /**
   * Internal list of todo items
   */
  public list: TodoItem[];

  /**
   * Initialize the Todos class with data from localStorage
   * Uses 'any' type for localStorage data - TypeWiz Enhanced can discover actual structure
   */
  constructor() {
    // Intentionally using 'any' for localStorage parsing - TypeWiz Enhanced will discover the actual type
    const storedData: any = localStorage.getItem('todos');
    this.list = storedData ? JSON.parse(storedData) : [];
  }

  /**
   * Add a new todo item to the list and persist to localStorage
   * @param todo - The todo item to add to the list
   */
  addTodo(todo: TodoItem): void {
    this.list.push(todo);
    this.saveToStorage();
    
    console.log('[TypeWiz TS] Added todo to list:', todo);
  }

  /**
   * Remove a todo item by ID and reindex remaining items
   * @param todoID - The unique ID of the todo to remove
   */
  removeTodo(todoID: string): void {
    this.list = this.list.filter((todo: TodoItem) => todo.id !== todoID);
    this.reindexTodos();
    this.saveToStorage();
  }

  /**
   * Edit the description of an existing todo item
   * @param todoId - The unique ID of the todo to edit
   * @param todoDescription - The new description text
   */
  editTodo(todoId: string, todoDescription: string): void {
    this.list = this.list.map((todo: TodoItem) => {
      if (todo.id === todoId) {
        return { ...todo, description: todoDescription };
      }
      return todo;
    });
    this.saveToStorage();
  }

  /**
   * Update the completion status of a todo item
   * @param todoId - The unique ID of the todo to update
   * @param status - The new completion status
   * @throws {Error} If todo with specified ID is not found
   */
  completeTodo(todoId: string, status: boolean): void {
    const selected = this.list.findIndex((element: TodoItem) => element.id === todoId);
    if (selected === -1) {
      throw new Error(`Todo with ID '${todoId}' not found`);
    }
    this.list[selected].completed = status;
    this.saveToStorage();
    
    console.log('[TypeWiz TS] Todo status changed:', { todoId, status });
  }

  /**
   * Remove all completed todos from the list and reindex remaining items
   */
  clearCompletedTodos(): void {
    this.list = this.list.filter((todo: TodoItem) => !todo.completed);
    this.reindexTodos();
    this.saveToStorage();
  }

  /**
   * Private helper method to reindex todos
   * Intentionally using 'any' for the callback parameter - TypeWiz Enhanced will discover the actual type
   */
  private reindexTodos(): void {
    this.list.forEach((todo: any, index: number) => {
      todo.index = index + 1;
    });
  }

  /**
   * Private helper method to save data to localStorage
   * Intentionally using 'any' for storage data - TypeWiz Enhanced can discover the actual structure
   */
  private saveToStorage(): void {
    const dataToStore: any = this.list;
    localStorage.setItem('todos', JSON.stringify(dataToStore));
  }
}