<<<<<<< HEAD
// STORAGE
const STORAGE_KEY = "todo_categories_due_daily_v1";
let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

let statusFilter = "all";
let categoryFilter = "all";

// ELEMENTS
const listEl = document.getElementById("list");
const form = document.getElementById("addForm");
const input = document.getElementById("taskInput");
const categorySelect = document.getElementById("categorySelect");
const dueInput = document.getElementById("dueInput");
const dailyInput = document.getElementById("dailyInput");

const countEl = document.getElementById("count");
const activeCountEl = document.getElementById("activeCount");
const clearDoneBtn = document.getElementById("clearDone");

const statusButtons = document.querySelectorAll(".filters .chip");
const categoryButtons = document.querySelectorAll(".category-filters .chip");

const dailyDrawer = document.getElementById("dailyDrawer");
const dailyDrawerList = document.getElementById("dailyDrawerList");
const openDailyDrawerBtn = document.getElementById("openDailyDrawerBtn");
const closeDailyDrawerBtn = document.getElementById("closeDailyDrawer");

// SAVE
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  render();
}

// ADD TASK
function addTask(text, category, dueDate, isDaily){
  tasks.unshift({
    id: Date.now().toString(),
    text: text.trim(),
    done: false,
    category,
    dueDate: dueDate || "",
    isDaily: !!isDaily
  });
  save();
}

// TOGGLES
function toggleDone(id){
  tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
  save();
}

function toggleDaily(id){
  tasks = tasks.map(t => 
    t.id === id ? { ...t, isDaily: !t.isDaily } : t
  );
  save();
}

// DELETE
function deleteTask(id){
  tasks = tasks.filter(t => t.id !== id);
  save();
}

// UPDATE TEXT
function updateText(id, newText){
  tasks = tasks.map(t => t.id === id ? { ...t, text: newText } : t);
  save();
}

// CLEAR DONE
function clearDone(){
  tasks = tasks.filter(t => !t.done);
  save();
}

// FILTER SETTERS
function setStatusFilter(filter){
  statusFilter = filter;
  statusButtons.forEach(b =>
    b.classList.toggle("active", b.dataset.filter === filter)
  );
  render();
}

function setCategoryFilter(category){
  categoryFilter = category;
  categoryButtons.forEach(b =>
    b.classList.toggle("active", b.dataset.category === category)
  );
  render();
}

// HELPERS
function isOverdue(date){
  if(!date) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const d = new Date(date + "T00:00:00");
  return d < today;
}

function formatDate(date){
  if(!date) return "";
  const [y,m,d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function escapeHtml(s){
  return s
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

/* ---- DAILY DRAWER ---- */
function renderDaily(){
  dailyDrawerList.innerHTML = "";

  const dailyTasks = tasks.filter(t => t.isDaily);

  if(!dailyTasks.length){
    dailyDrawerList.innerHTML = "<li>No daily tasks yet.</li>";
    return;
  }

  dailyTasks.forEach(t => {
    const li = document.createElement("li");

    li.innerHTML = `
      <div class="task-text">${escapeHtml(t.text)}</div>
      <div style="font-size:12px; color:#6b7280;">${t.category}</div>
      ${t.dueDate ? `<div style="font-size:12px;">Due: ${formatDate(t.dueDate)}</div>` : ""}
    `;

    const btn = document.createElement("button");
    btn.className = "icon-btn";
    btn.textContent = "Remove from daily";

    btn.addEventListener("click", () => {
      toggleDaily(t.id);
      renderDaily();
    });

    li.appendChild(btn);
    dailyDrawerList.appendChild(li);
  });
}

/* ---- MAIN RENDER ---- */
function render(){
  listEl.innerHTML = "";

  let shown = tasks;

  // Status filters
  if(statusFilter === "active")
    shown = shown.filter(t => !t.done);

  if(statusFilter === "done")
    shown = shown.filter(t => t.done);

  // Category filter
  if(categoryFilter !== "all")
    shown = shown.filter(t => t.category === categoryFilter);

  shown.forEach(t => {
    const li = document.createElement("li");
    li.className = "task" + (t.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = t.done;
    checkbox.addEventListener("change", ()=> toggleDone(t.id));

    const textDiv = document.createElement("div");
    textDiv.className = "task-text";
    textDiv.textContent = t.text;

    const catSpan = document.createElement("span");
    catSpan.className = "pill " + t.category;
    catSpan.textContent = t.category;

    if(t.isDaily){
      const tag = document.createElement("span");
      tag.className = "daily-tag";
      tag.textContent = "Daily";
      catSpan.appendChild(tag);
    }

    const dueDiv = document.createElement("div");
    dueDiv.className = "due";
    if(t.dueDate){
      const overdue = isOverdue(t.dueDate) && !t.done;
      if(overdue) dueDiv.classList.add("overdue");
      dueDiv.textContent = (overdue ? "Overdue: " : "Due: ") + formatDate(t.dueDate);
    } else {
      dueDiv.textContent = "No due date";
    }

    const controls = document.createElement("div");
    controls.className = "controls";

    const dailyBtn = document.createElement("button");
    dailyBtn.className = "icon-btn";
    dailyBtn.textContent = t.isDaily ? "☀️" : "☆";
    dailyBtn.title = t.isDaily ? "Remove from daily" : "Add to daily";
    dailyBtn.addEventListener("click", ()=> toggleDaily(t.id));

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => {
      const newText = prompt("Edit task:", t.text);
      if(newText && newText.trim()) updateText(t.id, newText.trim());
    });

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", () => {
      if(confirm("Delete this task?")) deleteTask(t.id);
    });

    controls.appendChild(dailyBtn);
    controls.appendChild(editBtn);
    controls.appendChild(delBtn);

    li.appendChild(checkbox);
    li.appendChild(textDiv);
    li.appendChild(catSpan);
    li.appendChild(dueDiv);
    li.appendChild(controls);
    listEl.appendChild(li);
  });

  countEl.textContent = tasks.length;
  activeCountEl.textContent = tasks.filter(t => !t.done).length;
}

/* ---- EVENTS ---- */
form.addEventListener("submit", e=>{
  e.preventDefault();
  if(!input.value.trim()) return;

  addTask(
    input.value,
    categorySelect.value,
    dueInput.value,
    dailyInput.checked
  );

  input.value = "";
  dueInput.value = "";
  dailyInput.checked = false;
});

statusButtons.forEach(b=>{
  b.addEventListener("click", ()=> setStatusFilter(b.dataset.filter));
});

categoryButtons.forEach(b=>{
  b.addEventListener("click", ()=> setCategoryFilter(b.dataset.category));
});

clearDoneBtn.addEventListener("click", ()=>{
  if(confirm("Remove all completed tasks?")) clearDone();
});

/* DRAWER */
openDailyDrawerBtn.addEventListener("click", ()=>{
  dailyDrawer.classList.add("open");
  renderDaily();
});

closeDailyDrawerBtn.addEventListener("click", ()=>{
  dailyDrawer.classList.remove("open");
});

render();
=======
// STORAGE
const STORAGE_KEY = "todo_categories_due_daily_v1";
let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

let statusFilter = "all";
let categoryFilter = "all";

// ELEMENTS
const listEl = document.getElementById("list");
const form = document.getElementById("addForm");
const input = document.getElementById("taskInput");
const categorySelect = document.getElementById("categorySelect");
const dueInput = document.getElementById("dueInput");
const dailyInput = document.getElementById("dailyInput");

const countEl = document.getElementById("count");
const activeCountEl = document.getElementById("activeCount");
const clearDoneBtn = document.getElementById("clearDone");

const statusButtons = document.querySelectorAll(".filters .chip");
const categoryButtons = document.querySelectorAll(".category-filters .chip");

const dailyDrawer = document.getElementById("dailyDrawer");
const dailyDrawerList = document.getElementById("dailyDrawerList");
const openDailyDrawerBtn = document.getElementById("openDailyDrawerBtn");
const closeDailyDrawerBtn = document.getElementById("closeDailyDrawer");

// SAVE
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  render();
}

// ADD TASK
function addTask(text, category, dueDate, isDaily){
  tasks.unshift({
    id: Date.now().toString(),
    text: text.trim(),
    done: false,
    category,
    dueDate: dueDate || "",
    isDaily: !!isDaily
  });
  save();
}

// TOGGLES
function toggleDone(id){
  tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
  save();
}

function toggleDaily(id){
  tasks = tasks.map(t => 
    t.id === id ? { ...t, isDaily: !t.isDaily } : t
  );
  save();
}

// DELETE
function deleteTask(id){
  tasks = tasks.filter(t => t.id !== id);
  save();
}

// UPDATE TEXT
function updateText(id, newText){
  tasks = tasks.map(t => t.id === id ? { ...t, text: newText } : t);
  save();
}

// CLEAR DONE
function clearDone(){
  tasks = tasks.filter(t => !t.done);
  save();
}

// FILTER SETTERS
function setStatusFilter(filter){
  statusFilter = filter;
  statusButtons.forEach(b =>
    b.classList.toggle("active", b.dataset.filter === filter)
  );
  render();
}

function setCategoryFilter(category){
  categoryFilter = category;
  categoryButtons.forEach(b =>
    b.classList.toggle("active", b.dataset.category === category)
  );
  render();
}

// HELPERS
function isOverdue(date){
  if(!date) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const d = new Date(date + "T00:00:00");
  return d < today;
}

function formatDate(date){
  if(!date) return "";
  const [y,m,d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function escapeHtml(s){
  return s
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

/* ---- DAILY DRAWER ---- */
function renderDaily(){
  dailyDrawerList.innerHTML = "";

  const dailyTasks = tasks.filter(t => t.isDaily);

  if(!dailyTasks.length){
    dailyDrawerList.innerHTML = "<li>No daily tasks yet.</li>";
    return;
  }

  dailyTasks.forEach(t => {
    const li = document.createElement("li");

    li.innerHTML = `
      <div class="task-text">${escapeHtml(t.text)}</div>
      <div style="font-size:12px; color:#6b7280;">${t.category}</div>
      ${t.dueDate ? `<div style="font-size:12px;">Due: ${formatDate(t.dueDate)}</div>` : ""}
    `;

    const btn = document.createElement("button");
    btn.className = "icon-btn";
    btn.textContent = "Remove from daily";

    btn.addEventListener("click", () => {
      toggleDaily(t.id);
      renderDaily();
    });

    li.appendChild(btn);
    dailyDrawerList.appendChild(li);
  });
}

/* ---- MAIN RENDER ---- */
function render(){
  listEl.innerHTML = "";

  let shown = tasks;

  // Status filters
  if(statusFilter === "active")
    shown = shown.filter(t => !t.done);

  if(statusFilter === "done")
    shown = shown.filter(t => t.done);

  // Category filter
  if(categoryFilter !== "all")
    shown = shown.filter(t => t.category === categoryFilter);

  shown.forEach(t => {
    const li = document.createElement("li");
    li.className = "task" + (t.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = t.done;
    checkbox.addEventListener("change", ()=> toggleDone(t.id));

    const textDiv = document.createElement("div");
    textDiv.className = "task-text";
    textDiv.textContent = t.text;

    const catSpan = document.createElement("span");
    catSpan.className = "pill " + t.category;
    catSpan.textContent = t.category;

    if(t.isDaily){
      const tag = document.createElement("span");
      tag.className = "daily-tag";
      tag.textContent = "Daily";
      catSpan.appendChild(tag);
    }

    const dueDiv = document.createElement("div");
    dueDiv.className = "due";
    if(t.dueDate){
      const overdue = isOverdue(t.dueDate) && !t.done;
      if(overdue) dueDiv.classList.add("overdue");
      dueDiv.textContent = (overdue ? "Overdue: " : "Due: ") + formatDate(t.dueDate);
    } else {
      dueDiv.textContent = "No due date";
    }

    const controls = document.createElement("div");
    controls.className = "controls";

    const dailyBtn = document.createElement("button");
    dailyBtn.className = "icon-btn";
    dailyBtn.textContent = t.isDaily ? "☀️" : "☆";
    dailyBtn.title = t.isDaily ? "Remove from daily" : "Add to daily";
    dailyBtn.addEventListener("click", ()=> toggleDaily(t.id));

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => {
      const newText = prompt("Edit task:", t.text);
      if(newText && newText.trim()) updateText(t.id, newText.trim());
    });

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", () => {
      if(confirm("Delete this task?")) deleteTask(t.id);
    });

    controls.appendChild(dailyBtn);
    controls.appendChild(editBtn);
    controls.appendChild(delBtn);

    li.appendChild(checkbox);
    li.appendChild(textDiv);
    li.appendChild(catSpan);
    li.appendChild(dueDiv);
    li.appendChild(controls);
    listEl.appendChild(li);
  });

  countEl.textContent = tasks.length;
  activeCountEl.textContent = tasks.filter(t => !t.done).length;
}

/* ---- EVENTS ---- */
form.addEventListener("submit", e=>{
  e.preventDefault();
  if(!input.value.trim()) return;

  addTask(
    input.value,
    categorySelect.value,
    dueInput.value,
    dailyInput.checked
  );

  input.value = "";
  dueInput.value = "";
  dailyInput.checked = false;
});

statusButtons.forEach(b=>{
  b.addEventListener("click", ()=> setStatusFilter(b.dataset.filter));
});

categoryButtons.forEach(b=>{
  b.addEventListener("click", ()=> setCategoryFilter(b.dataset.category));
});

clearDoneBtn.addEventListener("click", ()=>{
  if(confirm("Remove all completed tasks?")) clearDone();
});

/* DRAWER */
openDailyDrawerBtn.addEventListener("click", ()=>{
  dailyDrawer.classList.add("open");
  renderDaily();
});

closeDailyDrawerBtn.addEventListener("click", ()=>{
  dailyDrawer.classList.remove("open");
});

render();
>>>>>>> d0405b90f60cc7ad66fcac25984c6e65e87415b0
