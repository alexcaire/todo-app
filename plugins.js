// --------------------------------------
// PLUGIN SYSTEM
// --------------------------------------

const _hooks = new Map();
const _plugins = [];

// App API surface exposed to plugins. main.js replaces each of these once its
// own functions are defined, which happens *after* plugin modules are
// evaluated. Plugins must therefore only call app.* from inside hook handlers,
// never at module top level.
//
// Until main.js wires them, each entry is a stub that throws a message saying
// exactly what went wrong — otherwise a too-early call surfaces as an opaque
// "app.render is not a function".
function notWiredYet(name) {
  return () => {
    throw new Error(
      `[Plugins] app.${name}() was called before the app finished initializing. ` +
      `Call app.* from inside a hook handler, not at module top level.`
    );
  };
}

export const app = {
  getTasks: notWiredYet("getTasks"),
  getUserId: notWiredYet("getUserId"),
  render: notWiredYet("render"),
  addTask: notWiredYet("addTask"),
  deleteTask: notWiredYet("deleteTask"),
  save: notWiredYet("save"),
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
