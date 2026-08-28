// Priority Labels Plugin
// Adds a high/medium/low priority badge to task cards and a "Set priority"
// menu group to the task context menu. Priorities are stored separately in
// localStorage so the core task data model is not touched.

import { app } from "../plugins.js";

const STORAGE_KEY = "plugin_priority_labels";

function getPriorities() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setPriority(taskId, level) {
  const priorities = getPriorities();
  if (level) {
    priorities[taskId] = level;
  } else {
    delete priorities[taskId];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(priorities));
  if (typeof app.render === "function") app.render();
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

    afterDeleteTask(taskId) {
      const priorities = getPriorities();
      if (taskId in priorities) {
        delete priorities[taskId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(priorities));
      }
    },
  },
};
