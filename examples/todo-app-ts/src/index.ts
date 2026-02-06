import './style.css';
import render from './todosRender';
import Todos from './todos';
import { runTypewizTests } from './typewiz-test';
import { TodoItem, FormData, DOMEventHandler } from './types';

// Initialize the todos list
const todosList = new Todos();
render(todosList);

// Run TypeWiz tests for type discovery
runTypewizTests();

// Get DOM elements - intentionally using 'any' types for TypeWiz Enhanced to discover
const form: any = document.querySelector('form');
const addTodoBtn: any = document.querySelector('.add-btn');
const inputTodo: any = document.querySelector('.input-todo');

/**
 * Add a new todo to the list
 * Intentionally uses 'any' types in some places for TypeWiz Enhanced to discover
 */
function addNewTodo(): void {
  // Generate ID - intentionally using 'any' for Math operations
  const randomValue: any = Math.random();
  const id: string = `id${randomValue.toString(16).slice(2)}`;
  
  const description: string = inputTodo.value.trim();
  const completed: boolean = false;
  const index: number = todosList.list.length + 1;

  // Intentionally using 'any' for newTodo object - TypeWiz Enhanced will discover TodoItem structure
  const newTodo: any = {
    id, 
    description, 
    completed, 
    index,
  };
  
  if (description) {
    todosList.addTodo(newTodo as TodoItem);
    render(todosList);
    inputTodo.value = ''; // Clear input after adding
    
    console.log('[TypeWiz TS Auto] Added todo:', newTodo);
  }
}

// Handle form submission (Enter key or button click)
// Intentionally using 'any' for event parameter - TypeWiz Enhanced will discover Event type
const formSubmitHandler: DOMEventHandler = (e: any) => {
  e.preventDefault(); // Prevent page refresh
  addNewTodo();
};

// Handle button click
// Intentionally using 'any' for event parameter - TypeWiz Enhanced will discover MouseEvent type
const buttonClickHandler: DOMEventHandler = (e: any) => {
  e.preventDefault(); // Prevent form submission
  addNewTodo();
};

form.addEventListener('submit', formSubmitHandler);
addTodoBtn.addEventListener('click', buttonClickHandler);

// Clear all completed todos
// Intentionally using 'any' for DOM element - TypeWiz Enhanced will discover HTMLElement type
const clearBtn: any = document.querySelector('.clear-btn');
const clearClickHandler: DOMEventHandler = () => {
  todosList.clearCompletedTodos();
  render(todosList);
};

clearBtn.addEventListener('click', clearClickHandler);