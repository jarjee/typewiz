import { TodoItem, TodosList, DOMEventHandler } from './types';

/**
 * Render function for displaying todos in the DOM
 * Demonstrates TypeScript with intentional 'any' types for TypeWiz Enhanced to discover
 * @param todosList - The todos list instance to render
 */
const render = (todosList: TodosList): void => {
  const sortedTodos: TodoItem[] = todosList.list.sort((a: TodoItem, b: TodoItem) => a.index - b.index);
  const todosContainer = document.querySelector('.todos') as HTMLElement;
  let todosHtml = '';

  sortedTodos.forEach(({ completed, description, id }: TodoItem) => {
    const checkedTodo = completed ? 'checked' : '';
    const checkClass = completed ? 'checked' : '';
    todosHtml += `  <div class="todo-item">
                        <div>
                            <input id="${id}" class="todo-check" type="checkbox" ${checkedTodo} />
                            <input id="${id}" class="todo-edit ${checkClass}" type="text" value="${description}" />
                        </div>
                        <button id="${id}" class="remove-btn"> <i class="fas fa-trash"></i></button>
                    </div>
    `;
  });
  todosContainer.innerHTML = todosHtml;

  // Remove todo functionality
  // Intentionally using 'any' for DOM elements - TypeWiz Enhanced can discover the actual HTMLElement types
  const removeBtns: any = document.querySelectorAll('.remove-btn');
  removeBtns.forEach((btn: any) => {
    const clickHandler: DOMEventHandler = (e: any) => {
      const element = btn.parentNode;
      element.remove();
      todosList.removeTodo(e.target.parentNode.id);
    };
    btn.addEventListener('click', clickHandler);
  });

  // Edit todo functionality
  // Intentionally using 'any' for NodeList - TypeWiz Enhanced can discover the actual types
  const todosContent: any = document.querySelectorAll('.todo-edit');
  todosContent.forEach((todo: any) => {
    // Focus in handler - intentionally using 'any' for event parameter
    const focusinHandler: DOMEventHandler = (e: any) => {
      e.target.parentNode.parentNode.style.background = 'rgb(241,240,204)';
      e.target.style.background = 'rgb(241,240,204)';
    };

    // Focus out handler - intentionally using 'any' for event parameter
    const focusoutHandler: DOMEventHandler = (e: any) => {
      e.target.style.background = 'white';
      e.target.parentNode.parentNode.style.background = 'white';
    };

    // Input handler - intentionally using 'any' for event parameter
    const inputHandler: DOMEventHandler = (e: any) => {
      todosList.editTodo(e.target.id, e.target.value);
    };

    todo.addEventListener('focusin', focusinHandler);
    todo.addEventListener('focusout', focusoutHandler);
    todo.addEventListener('input', inputHandler);
  });

  // Complete Todo functionality
  // Intentionally using 'any' for checkbox elements - TypeWiz Enhanced can discover HTMLInputElement
  const todosCheck: any = document.querySelectorAll('.todo-check');
  todosCheck.forEach((todo: any) => {
    const changeHandler: DOMEventHandler = (e: any) => {
      const { id } = e.target;
      todosList.completeTodo(id, e.target.checked);
      e.target.parentNode.lastElementChild.classList.toggle('checked');
    };
    todo.addEventListener('change', changeHandler);
  });
};

export default render;