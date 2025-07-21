/**
 * TypeScript interfaces for the Todo App
 * Some types are intentionally left as 'any' for TypeWiz Enhanced to discover
 */

// Proper TypeScript interface for TodoItem
export interface TodoItem {
  id: string;
  description: string;
  completed: boolean;
  index: number;
}

// Intentionally using 'any' for DOM events - TypeWiz Enhanced can discover the actual types
export type DOMEventHandler = (event: any) => void;

// Intentionally using 'any' for form data - TypeWiz Enhanced can discover the structure
export interface FormData {
  [key: string]: any;
}

// Intentionally using 'any' for localStorage data - TypeWiz Enhanced can discover the structure
export type StorageData = any;

// Proper interface for render function parameter
export interface TodosList {
  list: TodoItem[];
  addTodo(todo: TodoItem): void;
  removeTodo(todoID: string): void;
  editTodo(todoId: string, todoDescription: string): void;
  completeTodo(todoId: string, status: boolean): void;
  clearCompletedTodos(): void;
}