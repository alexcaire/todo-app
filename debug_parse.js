// Helper file extracted from index.html to perform a static parse with Node
const STORAGE_KEY = 'todo_starter_tasks_v2';
let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

let filter = 'all'; // all | active | done
let categoryFilter = 'all'; // all | categoryName

const listEl = document.getElementById('list');
const form = document.getElementById('addForm');
const input = document.getElementById('taskInput');
const categorySelect = document.getElementById('categorySelect');
const countEl = document.getElementById('count');
const clearDoneBtn = document.getElementById('clearDone');
const filterButtons = document.querySelectorAll('.filters button');
const categoryButtons = document.querySelectorAll('.category-filters button');

console.log('[todo] init', {
  listEl: !!listEl,
  form: !!form,
  input: !!input,
  categorySelect: !!categorySelect,
  countEl: !!countEl,
  clearDoneBtn: !!clearDoneBtn,
  filterButtons: filterButtons.length,
  categoryButtons: categoryButtons.length,
  submitButton: !!document.querySelector('form button[type="submit"]')
});

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  render();
}

function addTask(text, category) {
  tasks.unshift({
    id: Date.now().toString(),
    text: text.trim(),
    done: false,
    category
  });
  save();
}

function toggleDone(id) {
  tasks = tasks.map(t => t.id === id ? {...t, done: !t.done} : t);
  save();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
}

function updateText(id, newText) {
  tasks = tasks.map(t => t.id === id ? {...t, text: newText} : t);
  save();
}

function clearDone() {
  tasks = tasks.filter(t => !t.done);
  save();
}

function setFilter(f) {
  filter = f;
  filterButtons.forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  render();
}

function setCategoryFilter(cat) {
  categoryFilter = cat;
  categoryButtons.forEach(b => b.classList.toggle('active', b.dataset.category === cat));
  render();
}

function render() {
  listEl.innerHTML = '';

  let shown = tasks;

  if (filter !== 'all') {
    shown = shown.filter(t => filter === 'done' ? t.done : !t.done);
  }

  if (categoryFilter !== 'all') {
    shown = shown.filter(t => t.category === categoryFilter);
  }

  shown.forEach(t => {
    const li = document.createElement('li');
    li.className = t.done ? 'done' : '';
    
    li.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''} />
      <div class="task-text">${escapeHtml(t.text)}</div>
      <span class="category-label">${t.category}</span>
      <div class="controls">
        <button class="edit">✏️</button>
        <button class="delete">🗑️</button>
      </div>
    `;

    const checkbox = li.querySelector('input[type="checkbox"]');
    const delBtn = li.querySelector('.delete');
    const editBtn = li.querySelector('.edit');
    const textDiv = li.querySelector('.task-text');

    checkbox.addEventListener('change', () => toggleDone(t.id));
    delBtn.addEventListener('click', () => {
      if (confirm('Delete this task?')) deleteTask(t.id);
    });

    editBtn.addEventListener('click', () => {
      textDiv.contentEditable = 'true';
      textDiv.classList.add('editable');
      textDiv.focus();
    });

    textDiv.addEventListener('blur', () => {
      if (textDiv.isContentEditable) {
        textDiv.contentEditable = 'false';
        textDiv.classList.remove('editable');
        const newText = textDiv.innerText.trim();
        if (!newText) return;
        updateText(t.id, newText);
      }
    });

    textDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        textDiv.blur();
      }
    });

    listEl.appendChild(li);
  });

  countEl.textContent = tasks.length;
}

// Escape HTML characters safely. Use regex replaces instead of
// `String.prototype.replaceAll` for broader compatibility (older
// browsers / webviews may not support replaceAll). A runtime error
// here would stop the whole script and prevent event listeners from
// attaching (making buttons appear to not work).
function escapeHtml(s){
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  console.log('[todo] submit', { value: input.value, category: categorySelect.value });
  if (!input.value.trim()) return;
  addTask(input.value, categorySelect.value);
  input.value = '';
  input.focus();
});

filterButtons.forEach(b => b.addEventListener('click', () => setFilter(b.dataset.filter)));
categoryButtons.forEach(b => b.addEventListener('click', () => setCategoryFilter(b.dataset.category)));
clearDoneBtn.addEventListener('click', () => {
  if (confirm('Remove all completed tasks?')) clearDone();
});

render();
