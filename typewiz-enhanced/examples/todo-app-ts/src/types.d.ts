/**
 * TypeScript interfaces for the Todo App
 * Some types are intentionally left as 'any' for TypeWiz Enhanced to discover
 */
export interface TodoItem {
    id: string;
    description: string;
    completed: boolean;
    index: number;
}
export type DOMEventHandler = (event: any) => void;
export interface FormData {
    [key: string]: any;
}
export type StorageData = any;
export interface TodosList {
    list: TodoItem[];
    addTodo(todo: TodoItem): void;
    removeTodo(todoID: string): void;
    editTodo(todoId: string, todoDescription: string): void;
    completeTodo(todoId: string, status: boolean): void;
    clearCompletedTodos(): void;
}
