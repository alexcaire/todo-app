// Priority Labels Plugin
// Adds a high/medium/low priority badge to task cards and a "Set priority"
// menu group to the task context menu. Priorities are stored separately in
// localStorage so the core task data model is not touched.
//
// Storage is scoped per signed-in user, mirroring how the core scopes its own
// task keys. Without this, two accounts sharing a browser would see each
// other's priorities, since task ids are timestamps and can collide across
// users. Note this keeps priorities device-local: they intentionally do not
// sync to Firestore, so they will not follow a user to another device.

import { app } from "../plugins.js";

const STORAGE_KEY_BASE = "plugin_priority_labels";

function getStorageKey() {
  const userId = app.getUserId();
  return userId ? `${STORAGE_KEY_BASE}_${userId}` : `${STORAGE_KEY_BASE}_guest`;
}

function getPriorities() {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey()) || "{}");
  } catch {
    return {};
  }
}

function savePriorities(priorities) {
  localStorage.setItem(getStorageKey(), JSON.stringify(priorities));
}

function setPriority(taskId, level) {
  const priorities = getPriorities();
  if (level) {
    priorities[taskId] = level;
  } else {
    delete priorities[taskId];
  }
  savePriorities(priorities);
  app.render();
}

const LEVELS = {
  high:   { label: "High",   css: "priority-high" },
  medium: { label: "Medium", css: "priority-medium" },
  low:    { label: "Low",    css: "priority-low" },
};

export default {
  name: "priority-labels",
  version: "1.0.0",
  hooks: {
    onTaskRender(li, task) {
      const level = getPriorities()[task.id];
      if (!level || !LEVELS[level]) return;

      const meta = li.querySelector(".task-meta");
      if (!meta) return;

      const badge = document.createElement("span");
      badge.className = `plugin-badge priority-badge ${LEVELS[level].css}`;
      badge.textContent = LEVELS[level].label;
      badge.title = `Priority: ${LEVELS[level].label}`;
      meta.insertBefore(badge, meta.firstChild);
    },

    onMenuBuild(menuEl, task) {
      const current = getPriorities()[task.id];

      const sep = document.createElement("div");
      sep.className = "task-menu-separator";
      menuEl.appendChild(sep);

      for (const [level, { label }] of Object.entries(LEVELS)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "task-menu-item" + (current === level ? " is-active" : "");
        btn.textContent = current === level ? `✓ Priority: ${label}` : `Priority: ${label}`;
        btn.addEventListener("click", () => {
          setPriority(task.id, current === level ? null : level);
        });
        menuEl.appendChild(btn);
      }
    },

    // Fires only once the delete is final, i.e. the undo window has closed.
    afterDeleteTask(taskId) {
      const priorities = getPriorities();
      if (taskId in priorities) {
        delete priorities[taskId];
        savePriorities(priorities);
      }
    },
  },
};

// Note: no onUserChange handler is needed here. getPriorities() re-reads the
// user-scoped key on every onTaskRender, and the core re-renders immediately
// after an auth change, so the correct badges appear without extra work.
// A plugin that cached state in memory would want that hook.
