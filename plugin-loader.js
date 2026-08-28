// Plugin Loader
// Add or remove plugins by importing them and passing them to registerPlugin.
// This file is the only place you need to edit to manage which plugins are active.

import { registerPlugin } from "./plugins.js";
import priorityLabels from "./plugins/priority-labels.js";

registerPlugin(priorityLabels);
