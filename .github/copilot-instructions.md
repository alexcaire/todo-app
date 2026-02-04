## Purpose

This repo is a small single-page task manager. The goal of this file is to give an AI coding agent the precise, repo-specific knowledge needed to make safe, minimal, and high-impact changes.

## Big picture

- Single-page UI served statically: `index.html` (markup + styles) and `main.js` (app logic). `main.js` imports `firebase.js` for auth.
- Persistence: browser `localStorage` keyed per-user. `main.js` computes a storage key from `STORAGE_KEY_BASE` + `activeUserId` via `getStorageKey()`.
- Runtime libs: `Sortable.js` (CDN) is used for drag & drop ordering; manual ordering is persisted only when `sortMode === 'manual'`.
- UI features: drawers for daily tasks (`isDaily`) and working tasks (`status === 'doing'`), theme toggle (dark mode), account menu with Google sign-in.

## Key files to read first

- `index.html` — UI structure, IDs, and where `main.js` mounts. Start here to see DOM hooks (`list`, `addForm`, `categorySelect`, etc.).
- `main.js` — app behavior, storage, auth wiring, and rendering logic. See `normalizeTasks()`, `save()`, `loadTasks()`, and `render()`.
- `firebase.js` — minimal auth surface exported (`signIn`, `signOutUser`, `onAuth`) used by `main.js`.

## Concrete data model & important helpers

- Task shape (as used in `main.js`): `{ id, text, done, category, dueDate, isDaily, subtasks[], status }`. `subtasks` items: `{ id, text, done, status }`.
- `status`: "todo" (default), "doing", "done" — cycled via `cycleTaskStatus()`/`cycleSubtaskStatus()` (todo → doing → done → todo). `done` is derived from `status === "done"`.
- Auto-promotion: parent task `status` set to "doing" if any subtask is "doing".
- Key helpers: `normalizeTasks(list)` (sanitizes stored shape, handles legacy `done` → `status`), `getStorageKey()` (per-user key), `escapeHtml()` (prevents HTML injection, though currently unused in render).
- Sorting: `sortMode` values — `manual`, `dueAsc`, `dueDesc`, `newest`, `oldest`, `alpha`, `dailyTop` — affect only the view order; only `manual` writes order back to `tasks` on drag end.

## Auth & storage behaviors to preserve

- Auth flow is in `main.js` via `onAuth(user)`; when the active user changes the code calls `loadTasks()` then `render()` so data switches to the user's key. Preserve this sequence.
- Storage migration: `normalizeTasks()` accepts legacy or malformed shapes. If you change the stored schema, implement a migration in `loadTasks()` that preserves older keys.

## Developer workflows (run & test locally)

- No build step. Serve the folder and open `index.html`.

PowerShell (from repo root):
```powershell
python -m http.server 8000
# open http://localhost:8000/index.html
```

Or open `index.html` directly (some browser APIs behave differently under `file://`).

Manual checks useful for PRs: add/edit/delete tasks, toggle daily, add subtasks, switch filters, cycle status, open drawers, and verify per-user separation of `localStorage` keys.

## Project-specific conventions

- UI IDs and class names are the integration surface — prefer updating selectors in `index.html` and `main.js` together.
- New tasks are `unshift`ed to the front; keep this unless changing UX intentionally.
- DOM rendering uses `textContent` for user text to prevent injection; `escapeHtml()` available if needed.
- Theme: toggles 'dark' class on `document.body`, persisted in `localStorage` as "theme".

## Where to start for common changes

- Add category: update the `<select id="categorySelect">` and the `.category-filters` block in `index.html`, then ensure any new category string is handled by UI filters.
- Change persistence key/schema: update `STORAGE_KEY_BASE` in `main.js` and add migration logic to `loadTasks()`.
- Extract JS to module(s): move functions from `main.js` to new files, keep `initAuthUI()` call on DOM ready, and preserve exported `onAuth` usage from `firebase.js`.
- Add UI feature: update `index.html` for markup, add event listeners and render logic in `main.js`, ensure state persistence if needed.

If you'd like, I can expand this file with suggested test cases, a refactor checklist, or automated migration examples.
