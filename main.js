import { signIn, signOutUser, onAuth, onTaskList, saveTaskList } from "./firebase.js";

// --------------------------------------
// STORAGE
// --------------------------------------
const STORAGE_KEY_BASE = "todo_tasks";
const MIGRATION_KEY_BASE = "todo_migrated";

let activeUserId = null;
let currentUser = null;
let accountMenuOpen = false;

let tasksUnsubscribe = null;
let isRemoteUpdate = false;
let lastSyncAt = null;
let lastSyncError = "";
let listenerActive = false;

function normalizeTasks(list) {
  if (!Array.isArray(list)) return [];
  return list.map(t => {
    const status = t.status || (t.done ? "done" : "todo");
    return {
      ...t,
      status,
      subtasks: Array.isArray(t.subtasks)
        ? t.subtasks.map(sub => ({
            ...sub,
            status: sub.status || (sub.done ? "done" : "todo"),
            id: (sub.id || `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`).toString(),
            text: sub.text || "",
            done: !!sub.done
          }))
        : []
    };
  });
}

function getStorageKey() {
  const key = activeUserId ? `${STORAGE_KEY_BASE}_${activeUserId}` : `${STORAGE_KEY_BASE}_guest`;
  return key;
}

function getMigrationKey(userId) {
  return `${MIGRATION_KEY_BASE}_${userId}`;
}

function hasMigrated(userId) {
  return localStorage.getItem(getMigrationKey(userId)) === "1";
}

function markMigrated(userId) {
  localStorage.setItem(getMigrationKey(userId), "1");
}

function loadGuestTasks() {
  const key = `${STORAGE_KEY_BASE}_guest`;
  try {
    return normalizeTasks(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch (err) {
    console.warn("[Storage] failed to parse guest tasks", err);
    return [];
  }
}

function clearGuestTasks() {
  localStorage.removeItem(`${STORAGE_KEY_BASE}_guest`);
}

let tasks = [];
let lastAddedSubtaskId = null;
let lastAddedSubtaskTaskId = null;
let openTaskMenuId = null;
let editingTaskId = null;
let editingTaskText = "";
let undoToastTimeoutId = null;
let renderedTaskIds = new Set();

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
const categoryButtons = document.querySelectorAll(".category-filters .chip[data-category]");

const dailyDrawer = document.getElementById("dailyDrawer");
const dailyDrawerList = document.getElementById("dailyDrawerList");
const openDailyDrawerBtn = document.getElementById("openDailyDrawerBtn");
const closeDailyDrawerBtn = document.getElementById("closeDailyDrawer");

// Working (Doing) drawer elements
const openWorkingDrawerBtn = document.getElementById("openWorkingDrawerBtn");
const workingDrawer = document.getElementById("workingDrawer");
const closeWorkingDrawerBtn = document.getElementById("closeWorkingDrawer");
const workingDrawerList = document.getElementById("workingDrawerList");
const workingCountEl = document.getElementById("workingCount");

const sortSelect = document.getElementById("sortSelect");
const themeToggle = document.getElementById("themeToggleBtn");
const accountChip = document.getElementById("accountChip");
const accountMenu = document.getElementById("accountMenu");
const accountMenuSignOut = document.getElementById("accountMenuSignOut");
const accountMenuCopyEmail = document.getElementById("accountMenuCopyEmail");
const syncStatusEl = document.getElementById("syncStatus");
const debugPanel = document.getElementById("debugPanel");
const syncRefreshBtn = document.getElementById("syncRefreshBtn");
const viewOptionsBtn = document.getElementById("viewOptionsBtn");
const toolbarEl = document.getElementById("toolbar");

// --------------------------------------
// SAVE
// --------------------------------------
function save() {
  if (activeUserId) {
    if (!isRemoteUpdate) {
      saveTaskList(activeUserId, tasks)
        .catch(err => console.error("[Firestore] save failed", err));
    }
  } else {
    const key = getStorageKey();
    console.log("[Storage] saving to key: " + key);
    localStorage.setItem(key, JSON.stringify(tasks));
  }
  render();
}

function loadTasks() {
  const key = getStorageKey();
  console.log(`[Storage] loading from key: ${key}`);
  tasks = normalizeTasks(JSON.parse(localStorage.getItem(key) || "[]"));
}

function startRemoteSync(userId) {
  if (!userId) return;
  if (tasksUnsubscribe) tasksUnsubscribe();
  let firstSnapshot = true;
  listenerActive = true;
  setSyncStatus(navigator.onLine ? "Syncing" : "Offline", navigator.onLine ? "is-syncing" : "is-error");
  tasksUnsubscribe = onTaskList(userId, remoteTasks => {
    const normalizedRemote = normalizeTasks(remoteTasks);
    if (firstSnapshot) {
      firstSnapshot = false;
      const migrated = hasMigrated(userId);
      const guestTasks = loadGuestTasks();
      if (!migrated && normalizedRemote.length === 0 && guestTasks.length > 0) {
        isRemoteUpdate = true;
        tasks = guestTasks;
        render();
        isRemoteUpdate = false;
        saveTaskList(userId, guestTasks)
          .then(() => {
            markMigrated(userId);
            clearGuestTasks();
          })
          .catch(err => console.error("[Firestore] migration failed", err));
        return;
      }
      if (!migrated) {
        markMigrated(userId);
      }
    }
    isRemoteUpdate = true;
    tasks = normalizedRemote;
    render();
    isRemoteUpdate = false;
    lastSyncAt = new Date();
    lastSyncError = "";
    setSyncStatus("Synced", "is-synced");
  }, err => {
    console.error("[Firestore] sync error", err);
    lastSyncError = err && err.message ? err.message : "unknown";
    setSyncStatus("Sync error", "is-error");
  });
}
function stopRemoteSync() {
  if (tasksUnsubscribe) {
    tasksUnsubscribe();
    tasksUnsubscribe = null;
  }
  listenerActive = false;
  updateDebugPanel();
}

function setSyncStatus(label, state) {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = label;
  syncStatusEl.classList.remove("is-syncing", "is-synced", "is-error");
  if (state) syncStatusEl.classList.add(state);
  if (lastSyncAt) {
    syncStatusEl.title = "Last sync: " + lastSyncAt.toLocaleString();
  } else {
    syncStatusEl.title = "";
  }
  updateDebugPanel();
}

function updateDebugPanel() {
  if (!debugPanel) return;
  const uid = currentUser ? currentUser.uid : "none";
  const email = currentUser ? (currentUser.email || currentUser.displayName || "unknown") : "signed out";
  const status = syncStatusEl ? syncStatusEl.textContent : "unknown";
  const lastSync = lastSyncAt ? lastSyncAt.toLocaleTimeString() : "n/a";
  const error = lastSyncError || "none";
  debugPanel.hidden = status === "Synced";
  if (debugPanel.hidden) return;
  debugPanel.innerHTML = [
    "<strong>Sync Debug</strong>",
    `User: ${email}`,
    `UID: ${uid}`,
    `Listener: ${listenerActive ? "on" : "off"}`,
    `Status: ${status}`,
    `Last sync: ${lastSync}`,
    `Last error: ${error}`
  ].join("<br>");
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
    status: "todo",
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
            done: false,
            status: "todo"
          }
        ]
      }
    : t
  );
  lastAddedSubtaskId = newId;
  lastAddedSubtaskTaskId = taskId;
  // Auto-promote parent if any subtask is doing
  const parent = tasks.find(t => t.id === taskId);
  if (parent) autoPromoteParentStatus(parent);
  save();
  return newId;
}

// --------------------------------------
// TOGGLES
// --------------------------------------
function toggleDone(id) {
  tasks = tasks.map(t => {
    if (t.id === id) {
      const done = !t.done;
      return { ...t, done, status: done ? "done" : "todo" };
    }
    return t;
  });
  save();
}

function cycleTaskStatus(id) {
  tasks = tasks.map(t => {
    if (t.id === id) {
      const cycle = { "todo": "doing", "doing": "done", "done": "todo" };
      const newStatus = cycle[t.status || "todo"];
      return { ...t, status: newStatus, done: newStatus === "done" };
    }
    return t;
  });
  save();
}

function toggleDaily(id) {
  const targetTask = tasks.find(t => t.id === id);
  if (!targetTask) return;
  const wasDaily = !!targetTask.isDaily;
  tasks = tasks.map(t => t.id === id ? { ...t, isDaily: !t.isDaily } : t);
  save();
  if (wasDaily) {
    showUndoToast("Removed from daily.", () => {
      tasks = tasks.map(t => t.id === id ? { ...t, isDaily: true } : t);
      save();
    });
  }
}

function toggleSubtask(taskId, subtaskId) {
  tasks = tasks.map(t => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      subtasks: t.subtasks.map(s => {
        if (s.id === subtaskId) {
          const done = !s.done;
          return { ...s, done, status: done ? "done" : "todo" };
        }
        return s;
      })
    };
  });
  // After toggling a subtask status, auto-promote parent if needed
  const parent = tasks.find(t => t.id === taskId);
  if (parent) autoPromoteParentStatus(parent);
  save();
}

function cycleSubtaskStatus(taskId, subtaskId) {
  tasks = tasks.map(t => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      subtasks: t.subtasks.map(s => {
        if (s.id === subtaskId) {
          const cycle = { "todo": "doing", "doing": "done", "done": "todo" };
          const newStatus = cycle[s.status || "todo"];
          return { ...s, status: newStatus, done: newStatus === "done" };
        }
        return s;
      })
    };
  });
  // After cycling a subtask status, auto-promote parent if any subtask is doing
  const parent = tasks.find(t => t.id === taskId);
  if (parent) autoPromoteParentStatus(parent);
  save();
}

// --------------------------------------
// DELETE / UPDATE
// --------------------------------------
function deleteTask(id) {
  animateTaskExits([id], () => {
    const index = tasks.findIndex(t => t.id === id);
    if (index < 0) return;
    const removedTask = tasks[index];
    tasks = tasks.filter(t => t.id !== id);
    if (editingTaskId === id) {
      editingTaskId = null;
      editingTaskText = "";
    }
    save();
    showUndoToast("Task deleted.", () => {
      const insertAt = Math.min(index, tasks.length);
      tasks.splice(insertAt, 0, removedTask);
      save();
    });
  });
}

function deleteSubtask(taskId, subtaskId) {
  tasks = tasks.map(t => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      subtasks: t.subtasks.filter(s => s.id !== subtaskId)
    };
  });
  // After removing a subtask, ensure parent status is promoted if any remaining subtasks are doing
  const parent = tasks.find(t => t.id === taskId);
  if (parent) autoPromoteParentStatus(parent);
  save();
}

// Auto-promote parent task status to 'doing' when any subtask is 'doing'
function autoPromoteParentStatus(task) {
  if (!task) return false;
  if (task.done) return false; // do not change completed tasks
  const hasDoing = Array.isArray(task.subtasks) && task.subtasks.some(s => s.status === 'doing');
  if (hasDoing && task.status !== 'doing') {
    task.status = 'doing';
    return true;
  }
  return false;
}

function updateText(id, newText) {
  tasks = tasks.map(t => t.id === id ? { ...t, text: newText } : t);
  save();
}

function updateDueDate(id, newDueDate) {
  tasks = tasks.map(t => t.id === id ? { ...t, dueDate: newDueDate } : t);
  save();
}

// --------------------------------------
// CLEAR COMPLETED
// --------------------------------------
function clearDone() {
  const removed = tasks
    .map((task, index) => task.done ? { task, index } : null)
    .filter(Boolean);
  if (!removed.length) return;
  const removedIds = removed.map(item => item.task.id);
  animateTaskExits(removedIds, () => {
    if (editingTaskId && removed.some(item => item.task.id === editingTaskId)) {
      editingTaskId = null;
      editingTaskText = "";
    }
    tasks = tasks.filter(t => !t.done);
    save();
    const count = removed.length;
    showUndoToast(
      count === 1 ? "Cleared 1 completed task." : `Cleared ${count} completed tasks.`,
      () => {
        removed.forEach(item => {
          const insertAt = Math.min(item.index, tasks.length);
          tasks.splice(insertAt, 0, item.task);
        });
        save();
      }
    );
  });
}

function animateTaskExits(taskIds, onComplete) {
  const nodes = taskIds
    .map(id => document.getElementById(`task-${id}`))
    .filter(Boolean);

  if (!nodes.length) {
    onComplete();
    return;
  }

  nodes.forEach(node => {
    node.classList.add("task-exit");
  });

  window.setTimeout(onComplete, 180);
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
  categoryFilter = category || "all";
  categoryButtons.forEach(btn =>
    btn.classList.toggle("active", btn.dataset.category === categoryFilter)
  );
  render();
}

function setOptionsPanelOpen(isOpen) {
  if (!toolbarEl || !viewOptionsBtn) return;
  toolbarEl.classList.toggle("is-open", isOpen);
  viewOptionsBtn.setAttribute("aria-expanded", String(isOpen));
  viewOptionsBtn.textContent = isOpen ? "Hide options" : "View options";
}

function syncOptionsPanelToViewport() {
  if (!toolbarEl || !viewOptionsBtn) return;
  const isMobile = window.innerWidth <= 720;
  const wasMobile = toolbarEl.dataset.mobileViewport === "1";

  if (isMobile) {
    toolbarEl.dataset.mobileViewport = "1";
    if (!wasMobile) setOptionsPanelOpen(false);
  } else {
    toolbarEl.dataset.mobileViewport = "0";
    toolbarEl.classList.add("is-open");
    viewOptionsBtn.setAttribute("aria-expanded", "false");
    viewOptionsBtn.textContent = "View options";
  }
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

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
}

function toLocalISODate(daysOffset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showUndoToast(message, undoAction) {
  const existing = document.getElementById("undoToast");
  if (existing) existing.remove();
  if (undoToastTimeoutId) clearTimeout(undoToastTimeoutId);

  const toast = document.createElement("div");
  toast.id = "undoToast";
  toast.className = "undo-toast";

  const text = document.createElement("span");
  text.className = "undo-toast-text";
  text.textContent = message;

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "undo-toast-btn";
  undoBtn.textContent = "Undo";
  undoBtn.addEventListener("click", () => {
    toast.remove();
    if (undoToastTimeoutId) clearTimeout(undoToastTimeoutId);
    undoAction();
  });

  toast.appendChild(text);
  toast.appendChild(undoBtn);
  document.body.appendChild(toast);

  undoToastTimeoutId = window.setTimeout(() => {
    toast.remove();
    undoToastTimeoutId = null;
  }, 5000);
}

function openDueDatePicker(initialValue, onSubmit) {
  const overlay = document.createElement("div");
  overlay.className = "date-picker-overlay";

  const panel = document.createElement("div");
  panel.className = "date-picker-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Edit due date");

  const title = document.createElement("h3");
  title.className = "date-picker-title";
  title.textContent = "Select due date";

  const inputEl = document.createElement("input");
  inputEl.type = "date";
  inputEl.className = "date-picker-input";
  inputEl.value = initialValue || "";

  const quickActions = document.createElement("div");
  quickActions.className = "date-picker-shortcuts";

  const todayBtn = document.createElement("button");
  todayBtn.type = "button";
  todayBtn.className = "date-picker-shortcut-btn";
  todayBtn.textContent = "Today";

  const tomorrowBtn = document.createElement("button");
  tomorrowBtn.type = "button";
  tomorrowBtn.className = "date-picker-shortcut-btn";
  tomorrowBtn.textContent = "Tomorrow";

  const nextWeekBtn = document.createElement("button");
  nextWeekBtn.type = "button";
  nextWeekBtn.className = "date-picker-shortcut-btn";
  nextWeekBtn.textContent = "+7 days";

  quickActions.appendChild(todayBtn);
  quickActions.appendChild(tomorrowBtn);
  quickActions.appendChild(nextWeekBtn);

  const actions = document.createElement("div");
  actions.className = "date-picker-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "date-picker-btn";
  cancelBtn.textContent = "Cancel";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "date-picker-btn";
  clearBtn.textContent = "Clear";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "date-picker-btn primary";
  saveBtn.textContent = "Save";

  actions.appendChild(cancelBtn);
  actions.appendChild(clearBtn);
  actions.appendChild(saveBtn);

  panel.appendChild(title);
  panel.appendChild(inputEl);
  panel.appendChild(quickActions);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const closePicker = () => {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
  };

  const submitValue = (value) => {
    if (value && !isValidDateInput(value)) {
      alert("Invalid date. Use YYYY-MM-DD.");
      return;
    }
    closePicker();
    onSubmit(value);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") closePicker();
  };
  document.addEventListener("keydown", onKeyDown);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePicker();
  });

  cancelBtn.addEventListener("click", closePicker);
  clearBtn.addEventListener("click", () => submitValue(""));
  saveBtn.addEventListener("click", () => submitValue(inputEl.value.trim()));
  todayBtn.addEventListener("click", () => submitValue(toLocalISODate(0)));
  tomorrowBtn.addEventListener("click", () => submitValue(toLocalISODate(1)));
  nextWeekBtn.addEventListener("click", () => submitValue(toLocalISODate(7)));
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitValue(inputEl.value.trim());
    }
  });

  inputEl.focus();
  if (typeof inputEl.showPicker === "function") {
    try {
      inputEl.showPicker();
    } catch (_err) {
      // ignore when the browser blocks programmatic picker opening
    }
  }
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
// WORKING (Doing) DRAWER
// --------------------------------------
function updateWorkingDrawer() {
  if (!workingCountEl || !workingDrawerList) return;
  const items = tasks.filter(t => t.status === "doing" || (Array.isArray(t.subtasks) && t.subtasks.some(s => s.status === "doing")));
  workingCountEl.textContent = String(items.length);
  workingDrawerList.innerHTML = "";
  if (!items.length) {
    workingDrawerList.innerHTML = '<li class="daily-empty">Nothing in progress yet.</li>';
    return;
  }

  items.forEach(t => {
    const li = document.createElement('li');
    li.dataset.id = t.id;

    const parentDiv = document.createElement('div');
    parentDiv.style.display = 'flex';
    parentDiv.style.alignItems = 'center';
    parentDiv.style.gap = '8px';

    const title = document.createElement('div');
    title.className = 'task-text';
    title.textContent = t.text;
    parentDiv.appendChild(title);

    if (t.status === 'doing') {
      const badge = document.createElement('span');
      badge.style.fontSize = '12px';
      badge.style.color = 'var(--text-muted)';
      badge.textContent = '(In progress)';
      parentDiv.appendChild(badge);
    }

    li.appendChild(parentDiv);

    const doingSubs = Array.isArray(t.subtasks) ? t.subtasks.filter(s => s.status === 'doing') : [];
    if (doingSubs.length) {
      const ul = document.createElement('ul');
      ul.style.margin = '6px 0 0 12px';
      ul.style.padding = '0';
      ul.style.listStyle = 'none';
      doingSubs.forEach(s => {
        const sLi = document.createElement('li');
        sLi.style.fontSize = '13px';
        sLi.style.color = 'var(--text-muted)';
        sLi.textContent = '- ' + s.text;
        ul.appendChild(sLi);
      });
      li.appendChild(ul);
    }

    // Click behavior: close drawer, scroll to task, flash highlight
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      if (workingDrawer) workingDrawer.classList.remove('open');
      const target = document.getElementById(`task-${t.id}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('flash-focus');
        setTimeout(() => target.classList.remove('flash-focus'), 700);
      }
    });

    workingDrawerList.appendChild(li);
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
    shown = shown.filter(t => t.status !== "done");
  } else if (statusFilter === "done") {
    shown = shown.filter(t => t.status === "done");
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

  if (!shown.length) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "list-empty";
    const hasFilters = statusFilter !== "all" || categoryFilter !== "all";
    const message = document.createElement("p");
    message.className = "list-empty-copy";
    message.textContent = hasFilters
      ? "No tasks match your current view options."
      : "No tasks yet. Start with one clear next action.";

    const ctaBtn = document.createElement("button");
    ctaBtn.type = "button";
    ctaBtn.className = "primary";
    ctaBtn.textContent = hasFilters ? "Clear view options" : "Add your first task";
    ctaBtn.addEventListener("click", () => {
      if (hasFilters) {
        setStatusFilter("all");
        setCategoryFilter("all");
        return;
      }
      if (input) input.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    emptyLi.appendChild(message);
    emptyLi.appendChild(ctaBtn);
    listEl.appendChild(emptyLi);
  }

  const nextRenderedTaskIds = new Set();

  shown.forEach(t => {
    const li = document.createElement("li");
    li.className = "task task-card" + (t.done ? " done" : "");
    li.dataset.id = t.id; // needed for drag & drop
    li.id = `task-${t.id}`; // stable DOM hook for working drawer navigation
    nextRenderedTaskIds.add(t.id);
    if (!renderedTaskIds.has(t.id)) li.classList.add("task-enter");

    const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];

    const leading = document.createElement("div");
    leading.className = "task-leading";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = t.done;
    checkbox.addEventListener("change", () => toggleDone(t.id));
    leading.appendChild(checkbox);

    const statusBtn = document.createElement("button");
    statusBtn.className = "icon-btn status-btn";
    statusBtn.setAttribute("aria-label", "Cycle task status");
    statusBtn.title = "Cycle status";
    statusBtn.textContent =
      t.status === "doing" ? "In progress" : t.status === "done" ? "Done" : "To do";
    statusBtn.addEventListener("click", () => cycleTaskStatus(t.id));
    leading.appendChild(statusBtn);

    const content = document.createElement("div");
    content.className = "task-content";

    const textDiv = document.createElement("div");
    textDiv.className = "task-text";
    textDiv.textContent = t.text;
    content.appendChild(textDiv);

    if (editingTaskId === t.id) {
      const inlineEdit = document.createElement("div");
      inlineEdit.className = "task-inline-edit";

      const editInput = document.createElement("input");
      editInput.type = "text";
      editInput.className = "task-inline-input";
      editInput.value = editingTaskText || t.text;
      editInput.setAttribute("aria-label", "Edit task text");

      const saveEditBtn = document.createElement("button");
      saveEditBtn.type = "button";
      saveEditBtn.className = "task-inline-btn primary";
      saveEditBtn.textContent = "Save";

      const cancelEditBtn = document.createElement("button");
      cancelEditBtn.type = "button";
      cancelEditBtn.className = "task-inline-btn";
      cancelEditBtn.textContent = "Cancel";

      const saveInlineEdit = () => {
        const nextText = editInput.value.trim();
        if (!nextText) {
          alert("Task text cannot be empty.");
          return;
        }
        editingTaskId = null;
        editingTaskText = "";
        updateText(t.id, nextText);
      };

      const cancelInlineEdit = () => {
        editingTaskId = null;
        editingTaskText = "";
        render();
      };

      editInput.addEventListener("input", () => {
        editingTaskText = editInput.value;
      });
      editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveInlineEdit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelInlineEdit();
        }
      });
      saveEditBtn.addEventListener("click", saveInlineEdit);
      cancelEditBtn.addEventListener("click", cancelInlineEdit);

      inlineEdit.appendChild(editInput);
      inlineEdit.appendChild(saveEditBtn);
      inlineEdit.appendChild(cancelEditBtn);
      content.appendChild(inlineEdit);

      requestAnimationFrame(() => {
        editInput.focus();
        editInput.select();
      });
    }

    const meta = document.createElement("div");
    meta.className = "task-meta";
    const catSpan = document.createElement("span");
    catSpan.className = "pill " + t.category;
    catSpan.textContent = t.category;

    if (t.isDaily) {
      const tag = document.createElement("span");
      tag.className = "daily-tag";
      tag.textContent = "Daily";
      catSpan.appendChild(tag);
    }
    meta.appendChild(catSpan);

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
    meta.appendChild(dueDiv);

    const subCount = document.createElement("span");
    subCount.className = "task-subcount";
    subCount.textContent = subtasks.length === 1 ? "1 subtask" : `${subtasks.length} subtasks`;
    meta.appendChild(subCount);
    content.appendChild(meta);

    const controls = document.createElement("div");
    controls.className = "controls";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn edit-btn";
    editBtn.setAttribute("aria-label", "Edit task");
    editBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="edit-icon">
        <path d="M11 7L4 14v3h3l7-7" />
      </svg>
    `;
    editBtn.addEventListener("click", () => {
      editingTaskId = editingTaskId === t.id ? null : t.id;
      editingTaskText = editingTaskId === t.id ? t.text : "";
      render();
    });

    controls.appendChild(editBtn);

    const menuWrap = document.createElement("div");
    menuWrap.className = "task-menu-wrap";

    const moreBtn = document.createElement("button");
    moreBtn.className = "icon-btn task-more-btn";
    moreBtn.setAttribute("aria-label", "More task actions");
    moreBtn.setAttribute("aria-expanded", openTaskMenuId === t.id ? "true" : "false");
    moreBtn.textContent = "⋯";
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTaskMenuId = openTaskMenuId === t.id ? null : t.id;
      render();
    });

    const menu = document.createElement("div");
    menu.className = "task-menu" + (openTaskMenuId === t.id ? " is-open" : "");
    menu.setAttribute("aria-hidden", openTaskMenuId === t.id ? "false" : "true");
    menu.addEventListener("click", (e) => e.stopPropagation());

    const dailyMenuBtn = document.createElement("button");
    dailyMenuBtn.type = "button";
    dailyMenuBtn.className = "task-menu-item";
    dailyMenuBtn.textContent = t.isDaily ? "Remove from daily" : "Add to daily";
    dailyMenuBtn.addEventListener("click", () => {
      openTaskMenuId = null;
      toggleDaily(t.id);
    });

    const dueMenuBtn = document.createElement("button");
    dueMenuBtn.type = "button";
    dueMenuBtn.className = "task-menu-item";
    dueMenuBtn.textContent = "Edit due date";
    dueMenuBtn.addEventListener("click", () => {
      openTaskMenuId = null;
      render();
      openDueDatePicker(t.dueDate || "", (selectedDueDate) => {
        updateDueDate(t.id, selectedDueDate);
      });
    });

    const deleteMenuBtn = document.createElement("button");
    deleteMenuBtn.type = "button";
    deleteMenuBtn.className = "task-menu-item danger";
    deleteMenuBtn.textContent = "Delete task";
    deleteMenuBtn.addEventListener("click", () => {
      openTaskMenuId = null;
      deleteTask(t.id);
    });

    menu.appendChild(dailyMenuBtn);
    menu.appendChild(dueMenuBtn);
    menu.appendChild(deleteMenuBtn);
    menuWrap.appendChild(moreBtn);
    menuWrap.appendChild(menu);
    controls.appendChild(menuWrap);

    if (t.status === "doing") {
      const progressLine = document.createElement("div");
      progressLine.className = "progress-line";
      progressLine.setAttribute("aria-hidden", "true");
      li.appendChild(progressLine);
    }

    li.appendChild(leading);
    li.appendChild(content);
    li.appendChild(controls);

    // Subtasks
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

      if (sub.status === "doing") {
        const progressLine = document.createElement("div");
        progressLine.className = "progress-line";
        progressLine.setAttribute("aria-hidden", "true");
        row.appendChild(progressLine);
      }

      const subStatusBtn = document.createElement("button");
      subStatusBtn.className = "icon-btn subtask-status-btn";
      subStatusBtn.setAttribute("aria-label", "Cycle subtask status");
      subStatusBtn.title = "Cycle status";
      subStatusBtn.textContent = "⏳";
      subStatusBtn.addEventListener("click", () => cycleSubtaskStatus(t.id, sub.id));

      const subDelete = document.createElement("button");
      subDelete.className = "icon-btn subtask-delete";
      subDelete.setAttribute("aria-label", "Delete subtask");
      subDelete.textContent = "x";
      subDelete.addEventListener("click", () => deleteSubtask(t.id, sub.id));

      row.appendChild(subCheck);
      row.appendChild(subText);
      row.appendChild(subStatusBtn);
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

  renderedTaskIds = nextRenderedTaskIds;

  countEl.textContent = tasks.length.toString();
  activeCountEl.textContent = tasks.filter(t => t.status !== "done").length.toString();

  if (lastAddedSubtaskTaskId) {
    const li = listEl.querySelector(`li.task[data-id="${lastAddedSubtaskTaskId}"]`);
    const list = li ? li.querySelector(".subtasks-list") : null;
    if (list) list.scrollTop = list.scrollHeight;
  }
  lastAddedSubtaskId = null;
  lastAddedSubtaskTaskId = null;
  // Update the doing/working drawer badge & list
  if (typeof updateWorkingDrawer === "function") updateWorkingDrawer();
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
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

// --------------------------------------
// AUTH UI
// --------------------------------------
function getInitialsFromUser(user) {
  const source = (user && (user.displayName || user.email)) || "";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (source) return source.slice(0, 2).toUpperCase();
  return "?";
}

function closeAccountMenu() {
  accountMenuOpen = false;
  if (accountMenu) accountMenu.hidden = true;
  if (accountChip) accountChip.setAttribute("aria-expanded", "false");
}

function openAccountMenu() {
  if (!accountMenu || !currentUser) return;
  accountMenu.hidden = false;
  accountMenuOpen = true;
  accountChip?.setAttribute("aria-expanded", "true");
}

function toggleAccountMenu() {
  if (accountMenuOpen) closeAccountMenu();
  else openAccountMenu();
}

function renderAccountChipSignedOut() {
  if (!accountChip) return;
  accountChip.textContent = "Sign in →";
  accountChip.setAttribute("aria-expanded", "false");
  closeAccountMenu();
}

function renderAccountChipSignedIn(user) {
  if (!accountChip) return;
  accountChip.innerHTML = "";

  const avatar = document.createElement("span");
  avatar.className = "account-avatar";
  if (user.photoURL) {
    const img = document.createElement("img");
    img.src = user.photoURL;
    img.alt = user.displayName || user.email || "User";
    avatar.appendChild(img);
  } else {
    avatar.textContent = getInitialsFromUser(user);
  }

  const nameSpan = document.createElement("span");
  nameSpan.className = "account-name";
  nameSpan.textContent = user.displayName || user.email || "Signed in";

  const chevron = document.createElement("span");
  chevron.className = "account-chevron";
  chevron.textContent = "?";

  accountChip.appendChild(avatar);
  accountChip.appendChild(nameSpan);
  accountChip.appendChild(chevron);
  accountChip.setAttribute("aria-expanded", accountMenuOpen ? "true" : "false");
}

function initAuthUI() {
  console.log("[Auth] DOM ready, wiring buttons");

  renderAccountChipSignedOut();

  if (accountChip) {
    accountChip.addEventListener("click", () => {
      if (!currentUser) {
        signIn().catch(err => console.error("[Auth] signIn error", err));
      } else {
        toggleAccountMenu();
      }
    });
  }

  if (accountMenuSignOut) {
    accountMenuSignOut.addEventListener("click", () => {
      closeAccountMenu();
      signOutUser().catch(err => console.error("[Auth] signOut error", err));
    });
  }

  if (accountMenuCopyEmail) {
    accountMenuCopyEmail.addEventListener("click", () => {
      const email = currentUser && currentUser.email;
      if (!email) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email)
          .then(() => console.log("[Auth] email copied"))
          .catch(err => console.warn("[Auth] copy failed", err));
      } else {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = email;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          textarea.remove();
          console.log("[Auth] email copied (fallback)");
        } catch (err) {
          console.warn("[Auth] copy failed (fallback)", err);
        }
      }
      closeAccountMenu();
    });
  }

  document.addEventListener("click", e => {
    if (!accountMenuOpen) return;
    if ((accountChip && accountChip.contains(e.target)) ||
        (accountMenu && accountMenu.contains(e.target))) {
      return;
    }
    closeAccountMenu();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeAccountMenu();
    }
  });

  onAuth(user => {
    console.log("[Auth] UI update", user ? (user.displayName || user.email) : "Not signed in");
    const newUserId = user ? user.uid : null;
    if (activeUserId !== newUserId) {
      console.log("[Auth] activeUserId changed", activeUserId, "->", newUserId);
    }
    activeUserId = newUserId;
    currentUser = user || null;
    closeAccountMenu();
      if (currentUser) {
        renderAccountChipSignedIn(currentUser);
        tasks = [];
        render();
        setSyncStatus(navigator.onLine ? "Syncing" : "Offline", navigator.onLine ? "is-syncing" : "is-error");
        startRemoteSync(currentUser.uid);
      } else {
        renderAccountChipSignedOut();
        stopRemoteSync();
        loadTasks();
        render();
        setSyncStatus("Local", "");
      }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuthUI);
} else {
  initAuthUI();
}

// --------------------------------------
// EVENTS
// --------------------------------------

if (viewOptionsBtn && toolbarEl) {
  viewOptionsBtn.addEventListener("click", () => {
    const shouldOpen = !toolbarEl.classList.contains("is-open");
    setOptionsPanelOpen(shouldOpen);
  });
}

window.addEventListener("resize", syncOptionsPanelToViewport);

document.addEventListener("click", e => {
  if (!openTaskMenuId) return;
  if (e.target.closest(".task-menu-wrap")) return;
  openTaskMenuId = null;
  render();
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || !openTaskMenuId) return;
  openTaskMenuId = null;
  render();
});

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
  clearDone();
});

// Daily drawer
openDailyDrawerBtn.addEventListener("click", () => {
  dailyDrawer.classList.add("open");
  renderDaily();
});

closeDailyDrawerBtn.addEventListener("click", () => {
  dailyDrawer.classList.remove("open");
});

// Working drawer
if (openWorkingDrawerBtn) {
  openWorkingDrawerBtn.addEventListener("click", () => {
    if (workingDrawer) workingDrawer.classList.add("open");
    updateWorkingDrawer();
  });
}

if (closeWorkingDrawerBtn) {
  closeWorkingDrawerBtn.addEventListener("click", () => {
    if (workingDrawer) workingDrawer.classList.remove("open");
  });
}

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

// Network status
window.addEventListener("online", () => {
  if (currentUser) {
    setSyncStatus("Syncing", "is-syncing");
    startRemoteSync(currentUser.uid);
  } else {
    setSyncStatus("Local", "");
  }
});

window.addEventListener("offline", () => {
  if (currentUser) {
    lastSyncError = "offline";
    setSyncStatus("Offline", "is-error");
  }
});

if (syncRefreshBtn) {
  syncRefreshBtn.addEventListener("click", () => {
    if (!currentUser) {
      setSyncStatus("Local", "");
      return;
    }
    if (navigator.onLine) {
      setSyncStatus("Syncing", "is-syncing");
      startRemoteSync(currentUser.uid);
    } else {
      lastSyncError = "offline";
      setSyncStatus("Offline", "is-error");
    }
  });
}

// --------------------------------------
// INITIALIZE
// --------------------------------------
applySavedTheme();
loadTasks();
syncOptionsPanelToViewport();
render();
initSortable();










