// --------------------------------------
// PLUGIN SYSTEM
// --------------------------------------

const _hooks = new Map();
const _plugins = [];

// App API surface exposed to plugins. main.js populates this after its
// functions are defined, so plugins must only call these inside hook handlers
// (not at module evaluation time).
export const app = {
  getTasks: null,
  render: null,
  addTask: null,
  deleteTask: null,
  save: null,
};

export function registerPlugin(plugin) {
  if (!plugin || typeof plugin !== "object" || !plugin.name) {
    console.warn("[Plugins] Invalid plugin: must be an object with a 'name' property.");
    return;
  }
  if (_plugins.find(p => p.name === plugin.name)) {
    console.warn(`[Plugins] Plugin "${plugin.name}" is already registered. Skipping.`);
    return;
  }

  _plugins.push(plugin);

  if (plugin.hooks && typeof plugin.hooks === "object") {
    for (const [hookName, handler] of Object.entries(plugin.hooks)) {
      if (typeof handler !== "function") continue;
      if (!_hooks.has(hookName)) _hooks.set(hookName, []);
      _hooks.get(hookName).push({ pluginName: plugin.name, handler });
    }
  }

  const version = plugin.version ? ` v${plugin.version}` : "";
  console.log(`[Plugins] Registered: ${plugin.name}${version}`);
}

export function callHook(name, ...args) {
  const handlers = _hooks.get(name);
  if (!handlers || !handlers.length) return;
  for (const { pluginName, handler } of handlers) {
    try {
      handler(...args);
    } catch (err) {
      console.error(`[Plugins] Error in hook "${name}" from plugin "${pluginName}":`, err);
    }
  }
}

export function getPlugins() {
  return _plugins.slice();
}
