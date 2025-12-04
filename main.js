// --------------------------------------
// STORAGE
// --------------------------------------
const STORAGE_KEY = "todo_categories_due_daily_v1";

function normalizeTasks(list) {
  if (!Array.isArray(list)) return [];
  return list.map(t => ({
    ...t,
    subtasks: Array.isArray(t.subtasks)
      ? t.subtasks.map(sub => ({
          ...sub,
          id: (sub.id || `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`).toString(),
          text: sub.text || "",
          done: !!sub.done
        }))
      : []
  }));
}

let tasks = normalizeTasks(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
let lastAddedSubtaskId = null;
let lastAddedSubtaskTaskId = null;

let statusFilter = "all";
let categoryFilter = "all";
let sortMode = "manual"; // manual, dueAsc, dueDesc, newest, oldest, alpha, dailyTop

// --------------------------------------
// ELEMENTS
// --------------------------------------
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

const sortSelect = document.getElementById("sortSelect");
const themeToggle = document.getElementById("themeToggle");

// --------------------------------------
// SAVE
// --------------------------------------
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  render();
}

// --------------------------------------
// ADD TASK
// --------------------------------------
function addTask(text, category, dueDate, isDaily) {
  const dueIsToday = isToday(dueDate);
  tasks.unshift({
    id: Date.now().toString(),
    text: text.trim(),
    done: false,
    category,
    dueDate: dueDate || "",
    isDaily: !!isDaily || dueIsToday,
    subtasks: []
  });
  save();
}

function addSubtask(taskId, text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  let newId = null;
  tasks = tasks.map(t => t.id === taskId
    ? {
        ...t,
        subtasks: [
          ...t.subtasks,
          {
            id: (newId = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`),
            text: trimmed,
            done: false
          }
        ]
      }
    : t
  );
  lastAddedSubtaskId = newId;
  lastAddedSubtaskTaskId = taskId;
  save();
  return newId;
}

// --------------------------------------
// TOGGLES
// --------------------------------------
function toggleDone(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
  save();
}

function toggleDaily(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, isDaily: !t.isDaily } : t);
  save();
}

function toggleSubtask(taskId, subtaskId) {
  tasks = tasks.map(t => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      subtasks: t.subtasks.map(s =>
        s.id === subtaskId ? { ...s, done: !s.done } : s
      )
    };
  });
  save();
}

// --------------------------------------
// DELETE / UPDATE
// --------------------------------------
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
}

function deleteSubtask(taskId, subtaskId) {
  tasks = tasks.map(t => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      subtasks: t.subtasks.filter(s => s.id !== subtaskId)
    };
  });
  save();
}

function updateText(id, newText) {
  tasks = tasks.map(t => t.id === id ? { ...t, text: newText } : t);
  save();
}

// --------------------------------------
// CLEAR COMPLETED
// --------------------------------------
function clearDone() {
  tasks = tasks.filter(t => !t.done);
  save();
}

// --------------------------------------
// FILTER SETTERS
// --------------------------------------
function setStatusFilter(filter) {
  statusFilter = filter;
  statusButtons.forEach(btn =>
    btn.classList.toggle("active", btn.dataset.filter === filter)
  );
  render();
}

function setCategoryFilter(category) {
  categoryFilter = category;
  categoryButtons.forEach(btn =>
    btn.classList.toggle("active", btn.dataset.category === category)
  );
  render();
}

// --------------------------------------
// SORTING HELPERS
// --------------------------------------
function dueTime(t) {
  if (!t.dueDate) return Infinity;
  return new Date(t.dueDate + "T00:00:00").getTime();
}

// --------------------------------------
// DAILY DRAWER RENDER
// --------------------------------------
function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return d < today;
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr + "T00:00:00");
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function renderDaily() {
  dailyDrawerList.innerHTML = "";

  const dailyTasks = tasks.filter(t => t.isDaily);

  if (!dailyTasks.length) {
    dailyDrawerList.innerHTML = "<li class=\"daily-empty\">Nothing daily yet. Mark tasks as Daily to pin them here.</li>";
    return;
  }

  dailyTasks.forEach(t => {
    const li = document.createElement("li");
    if (t.done) li.classList.add("done");

    const topRow = document.createElement("div");
    topRow.className = "daily-task-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "daily-check";
    checkbox.checked = t.done;
    checkbox.addEventListener("change", () => {
      toggleDone(t.id);
      renderDaily();
    });
    topRow.appendChild(checkbox);

    const textDiv = document.createElement("div");
    textDiv.className = "task-text";
    textDiv.textContent = t.text;
    topRow.appendChild(textDiv);

    if (t.dueDate) {
      const status = document.createElement("span");
      status.className = "daily-chip";
      if (isOverdue(t.dueDate)) {
        status.textContent = "Overdue";
        status.classList.add("overdue");
      } else if (isToday(t.dueDate)) {
        status.textContent = "Today";
        status.classList.add("today");
      } else {
        status.textContent = "Upcoming";
      }
      topRow.appendChild(status);
    }

    const btn = document.createElement("button");
    btn.className = "icon-btn daily-remove";
    btn.setAttribute("aria-label", "Remove from daily");
    btn.title = "Remove from daily";
    btn.innerHTML = "&times;";
    btn.addEventListener("click", () => {
      toggleDaily(t.id);
      renderDaily();
    });

    topRow.appendChild(btn);
    li.appendChild(topRow);

    const meta = document.createElement("div");
    meta.className = "daily-meta";
    meta.textContent = t.category;
    li.appendChild(meta);

    if (t.dueDate) {
      const due = document.createElement("div");
      due.className = "daily-meta";
      due.textContent = "Due: " + formatDate(t.dueDate);
      li.appendChild(due);
    }
    dailyDrawerList.appendChild(li);
  });
}

// --------------------------------------
// MAIN RENDER
// --------------------------------------
function render() {
  listEl.innerHTML = "";

  let shown = tasks.slice();

  // Filters
  if (statusFilter === "active") {
    shown = shown.filter(t => !t.done);
  } else if (statusFilter === "done") {
    shown = shown.filter(t => t.done);
  }

  if (categoryFilter !== "all") {
    shown = shown.filter(t => t.category === categoryFilter);
  }

  // Sorting (does not change the underlying array = "view sort")
  switch (sortMode) {
    case "newest":
      shown.sort((a, b) => Number(b.id) - Number(a.id));
      break;
    case "oldest":
      shown.sort((a, b) => Number(a.id) - Number(b.id));
      break;
    case "dueAsc":
      shown.sort((a, b) => dueTime(a) - dueTime(b));
      break;
    case "dueDesc":
      shown.sort((a, b) => dueTime(b) - dueTime(a));
      break;
    case "alpha":
      shown.sort((a, b) =>
        a.text.toLowerCase().localeCompare(b.text.toLowerCase())
      );
      break;
    case "dailyTop":
      shown.sort((a, b) => {
        if (a.isDaily === b.isDaily) return 0;
        return a.isDaily ? -1 : 1;
      });
      break;
    case "manual":
    default:
      // keep underlying order
      break;
  }

  // Render list
  const isMobile = window.innerWidth < 480;

  shown.forEach(t => {
    const li = document.createElement("li");
    li.className = "task task-card" + (t.done ? " done" : "");
    li.dataset.id = t.id; // needed for drag & drop

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = t.done;
    checkbox.addEventListener("change", () => toggleDone(t.id));

    const textDiv = document.createElement("div");
    textDiv.className = "task-text";
    textDiv.textContent = t.text;

    const catSpan = document.createElement("span");
    catSpan.className = "pill " + t.category;
    catSpan.textContent = t.category;

    if (t.isDaily) {
      const tag = document.createElement("span");
      tag.className = "daily-tag";
      tag.textContent = "Daily";
      catSpan.appendChild(tag);
    }

    const dueDiv = document.createElement("div");
    dueDiv.className = "due";
    if (t.dueDate) {
      const overdue = isOverdue(t.dueDate) && !t.done;
      if (overdue) dueDiv.classList.add("overdue");
      dueDiv.textContent =
        (overdue ? "Overdue: " : "Due: ") + formatDate(t.dueDate);
    } else {
      dueDiv.textContent = "No due date";
    }

    const controls = document.createElement("div");
    controls.className = "controls";

    const dailyBtn = document.createElement("button");
    dailyBtn.className = "icon-btn";
    dailyBtn.title = t.isDaily ? "Remove from daily" : "Add to daily";

    const star = document.createElement("span");
    star.className = "star-icon" + (t.isDaily ? " active" : "");
    star.dataset.star = t.isDaily ? "on" : "off";
    star.textContent = String.fromCharCode(0x2605);

    dailyBtn.appendChild(star);
    dailyBtn.addEventListener("click", () => toggleDaily(t.id));

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn edit-btn";
    editBtn.setAttribute("aria-label", "Edit task");
    editBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="edit-icon">
        <path d="M11 7L4 14v3h3l7-7" />
      </svg>
    `;
    editBtn.addEventListener("click", () => {
      const newText = prompt("Edit task:", t.text);
      if (newText && newText.trim()) updateText(t.id, newText.trim());
    });

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn delete-btn";
    delBtn.setAttribute("aria-label", "Delete task");
    delBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="delete-icon">
        <polyline points="3 6 5 6 21 6" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
        <path d="M5 6l1 14h12l1-14" />
        <path d="M9 6V4h6v2" />
      </svg>
    `;
    delBtn.addEventListener("click", () => {
      if (confirm("Delete this task?")) deleteTask(t.id);
    });

    controls.appendChild(dailyBtn);
    controls.appendChild(editBtn);
    controls.appendChild(delBtn);

    li.appendChild(checkbox);
    li.appendChild(textDiv);
    li.appendChild(catSpan);
    li.appendChild(dueDiv);
    li.appendChild(controls);

    // Subtasks
    const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
    const subtasksSection = document.createElement("div");
    subtasksSection.className = "subtasks";

    const subtasksList = document.createElement("div");
    subtasksList.className = "subtasks-list";

    const renderSubtaskRow = sub => {
      const row = document.createElement("div");
      row.className = "subtask-row" + (sub.done ? " done" : "");
      if (sub.id === lastAddedSubtaskId) row.classList.add("slide-in-subtask");

      const subCheck = document.createElement("input");
      subCheck.type = "checkbox";
      subCheck.className = "subtask-check";
      subCheck.checked = sub.done;
      subCheck.addEventListener("change", () => toggleSubtask(t.id, sub.id));

      const subText = document.createElement("div");
      subText.className = "subtask-text";
      subText.textContent = sub.text;

      const subDelete = document.createElement("button");
      subDelete.className = "icon-btn subtask-delete";
      subDelete.setAttribute("aria-label", "Delete subtask");
      subDelete.textContent = "x";
      subDelete.addEventListener("click", () => deleteSubtask(t.id, sub.id));

      row.appendChild(subCheck);
      row.appendChild(subText);
      row.appendChild(subDelete);
      subtasksList.appendChild(row);
    };

    subtasks.forEach(renderSubtaskRow);

    const mountMobileSubtaskInput = () => {
      const existing = subtasksList.querySelector(".mobile-subtask-input");
      if (existing) {
        const inputEl = existing.querySelector("input");
        if (inputEl) inputEl.focus();
        return;
      }

      const row = document.createElement("div");
      row.className = "subtask-row mobile-subtask-input";

      const subInput = document.createElement("input");
      subInput.type = "text";
      subInput.className = "subtask-text";
      subInput.placeholder = "New subtask";

      const inlineAdd = document.createElement("button");
      inlineAdd.type = "button";
      inlineAdd.className = "icon-btn subtask-add-inline";
      inlineAdd.textContent = "+";

      const submitInline = () => {
        const value = subInput.value.trim();
        if (!value) {
          row.classList.remove("shake");
          void row.offsetWidth;
          row.classList.add("shake");
          return;
        }
        addSubtask(t.id, value);
      };

      inlineAdd.addEventListener("click", submitInline);
      subInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitInline();
        }
      });

      row.appendChild(subInput);
      row.appendChild(inlineAdd);
      subtasksList.appendChild(row);
      subInput.focus();
    };

    subtasksSection.appendChild(subtasksList);
    li.appendChild(subtasksSection);

    const subtaskFab = document.createElement("button");
    subtaskFab.className = "subtask-fab-small";
    subtaskFab.type = "button";
    subtaskFab.textContent = "+";
    subtaskFab.addEventListener("click", mountMobileSubtaskInput);
    li.appendChild(subtaskFab);

    listEl.appendChild(li);
  });

  countEl.textContent = tasks.length.toString();
  activeCountEl.textContent = tasks.filter(t => !t.done).length.toString();

  if (lastAddedSubtaskTaskId) {
    const li = listEl.querySelector(`li.task[data-id="${lastAddedSubtaskTaskId}"]`);
    const list = li ? li.querySelector(".subtasks-list") : null;
    if (list) list.scrollTop = list.scrollHeight;
  }
  lastAddedSubtaskId = null;
  lastAddedSubtaskTaskId = null;
}

// --------------------------------------
// DRAG & DROP (Sortable.js)
// --------------------------------------
let sortable = null;

function initSortable() {
  if (sortable) {
    sortable.destroy();
  }
  if (!listEl) return;

  sortable = new Sortable(listEl, {
    animation: 150,
    ghostClass: "drag-ghost",
    onEnd: () => {
      // Only persist manual order when in manual sort mode
      if (sortMode !== "manual") return;

      const idsInDomOrder = Array.from(listEl.children).map(li => li.dataset.id);
      tasks.sort((a, b) => {
        const ia = idsInDomOrder.indexOf(a.id);
        const ib = idsInDomOrder.indexOf(b.id);
        const sa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
        const sb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
        return sa - sb;
      });
      save();
    }
  });

  // Disable dragging if not in manual mode
  updateSortableState();
}

function updateSortableState() {
  if (!sortable) return;
  sortable.option("disabled", sortMode !== "manual");
}

// --------------------------------------
// THEME (Dark / Light)
// --------------------------------------
function applySavedTheme() {
  let savedTheme = localStorage.getItem("theme");

  if (!savedTheme) {
    // follow OS preference on first load
    if (window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.body.classList.add("dark");
      savedTheme = "dark";
    } else {
      savedTheme = "light";
    }
  }

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }

  updateThemeButton();
}

function updateThemeButton() {
  if (!themeToggle) return;
  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
}

// --------------------------------------
// EVENTS
// --------------------------------------

// Add form
form.addEventListener("submit", e => {
  e.preventDefault();
  if (!input.value.trim()) return;

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

// Filters
statusButtons.forEach(btn =>
  btn.addEventListener("click", () => setStatusFilter(btn.dataset.filter))
);

categoryButtons.forEach(btn =>
  btn.addEventListener("click", () => setCategoryFilter(btn.dataset.category))
);

// Clear completed
clearDoneBtn.addEventListener("click", () => {
  if (confirm("Remove all completed tasks?")) clearDone();
});

// Daily drawer
openDailyDrawerBtn.addEventListener("click", () => {
  dailyDrawer.classList.add("open");
  renderDaily();
});

closeDailyDrawerBtn.addEventListener("click", () => {
  dailyDrawer.classList.remove("open");
});

// Sort select
sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  updateSortableState();
  render();
});

// Theme toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeButton();
});

// --------------------------------------
// INITIALIZE
// --------------------------------------
applySavedTheme();
render();
initSortable();





