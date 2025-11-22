## Purpose

This repository is a tiny single-page to‑do app implemented in one file. These instructions give actionable, codebase-specific guidance so an AI coding assistant can be productive immediately.

## Big picture

- Single-page app: the entire implementation (UI, styles, logic, persistence) lives in `index.html`.
- No backend or build system: state is persisted in the browser `localStorage` under the key defined by `STORAGE_KEY` in `index.html`.
- UI → model → view flow is explicit and synchronous: user events call functions (`addTask`, `toggleDone`, `updateText`, `deleteTask`, `clearDone`) which update the `tasks` array, call `save()` to persist, and then `render()`.

## Key files

- `index.html` — single source of truth: markup, CSS, and JavaScript. Read this file top-to-bottom to understand behavior.
- `README.md` — minimal; no build/test info present.

## Data flow & important symbols

- `STORAGE_KEY` (string) — localStorage key. Example: `const STORAGE_KEY = 'todo_starter_tasks_v2';`
- `tasks` (array) — in-memory model of tasks: objects shaped `{ id, text, done, category }`.
- `addTask(text, category)` — prepends a new task using `Date.now().toString()` as `id`.
- `save()` — writes `tasks` to `localStorage` and calls `render()`.
- `render()` — reads `tasks` and builds DOM nodes. It uses `escapeHtml()` before inserting user text into the DOM.

## UI conventions and selectors

- Filter buttons: use `data-filter` attributes (`all`, `active`, `done`) and class `active` to indicate selection.
- Category buttons: use `data-category` attributes and class `active` to indicate selection.
- CSS class `done` marks completed items; `editable` marks the currently edited task element.
- Task list container: element with id `list`.

## Patterns to preserve when modifying code

- Keep persistence as `localStorage` unless a migration plan is added: other code expects `tasks` to be an array stored under `STORAGE_KEY`.
- New tasks are added to the front of the list (`unshift`) — preserve ordering unless explicitly changing UX.
- The app protects against HTML injection by calling `escapeHtml()` in `render()`; if you change rendering, preserve or improve this behavior.

## Developer workflows (how to run / test locally)

- There is no build step. To run, open `index.html` in a browser or serve the folder with a static server.

PowerShell (recommended) — from repository root:
```powershell
python -m http.server 8000
# then open http://localhost:8000/index.html
```

Or simply double-click `index.html` to open in the default browser (note: some browser APIs behave differently when opened via `file://`).

Manual test checklist (useful for automated test writing):
- Add task via the form (verify inserted at top and `count` increments).
- Edit: click the ✏️ button, change text, press Enter (blur triggers `updateText`).
- Toggle done: click checkbox (verify `done` class and `localStorage` update).
- Delete: click 🗑️ and confirm (verify removal and `localStorage`).
- Filters: click filter/category buttons and confirm visible items.

## Integration points & external dependencies

- No external dependencies or APIs. Everything runs client-side.

## Typical change patterns (concrete examples)

- Add a new default category: update the `<select id="categorySelect">` options and the `.category-filters` block in `index.html`.
- Change persistence key for a breaking change: update `STORAGE_KEY` and provide a migration path (e.g., read old key and convert data to new shape before overwriting).
- Move JS out of `index.html`: if extracting to a module, ensure `render()` is called after DOM load and retain the same global element IDs (`list`, `addForm`, etc.) or update selectors consistently.

## What an AI agent should do first

- Read `index.html` completely (structure, style, script). The app is small — understanding this file is sufficient to make most changes.
- Preserve the `escapeHtml()` call when changing how task text is inserted.
- When adding features that affect persistence, document data migration in `README.md` and keep backward-compatible reads where possible.

## Where to look for examples inside this repo

- `index.html`: examples of event handlers (`form.addEventListener('submit', ...)`), DOM updates (`render()`), and storage usage (`localStorage.getItem` / `setItem`).

If any of this is unclear or you want additional sections (e.g., suggested test cases, stub tasks for automation, or refactor goals), tell me which areas to expand.
