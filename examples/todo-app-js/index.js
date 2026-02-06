import './style.css';
import render from './todosRender';
import Todos from './todos';
import './typewiz-test.js';

const todosList = new Todos();
render(todosList);

// add todo - handle form submission properly
const form = document.querySelector('form');
const addTodoBtn = document.querySelector('.add-btn');
const inputTodo = document.querySelector('.input-todo');

// Handle form submission (Enter key or button click)
form.addEventListener('submit', (e) => {
  e.preventDefault(); // Prevent page refresh
  addNewTodo();
});

// Handle button click
addTodoBtn.addEventListener('click', (e) => {
  e.preventDefault(); // Prevent form submission
  addNewTodo();
});

function addNewTodo() {
  const id = `id${Math.random().toString(16).slice(2)}`;
  const description = inputTodo.value.trim();
  const completed = false;
  const index = todosList.list.length + 1;

  const newTodo = {
    id, description, completed, index,
  };
  
  if (description) {
    todosList.addTodo(newTodo);
    render(todosList);
    inputTodo.value = ''; // Clear input after adding
    
    console.log('[TypeWiz Auto] Added todo:', newTodo);
  }
}

// clear all completed todos
const clearBtn = document.querySelector('.clear-btn');
clearBtn.addEventListener('click', () => {
  todosList.clearCompletedTodos();
  render(todosList);
});
