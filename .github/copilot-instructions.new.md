## Purpose

This repo is a small single-page task manager. The goal of this file is to give an AI coding agent the precise, repo-specific knowledge needed to make safe, minimal, and high-impact changes.

## Big picture

- Single-page UI served statically: `index.html` (markup + styles) and `main.js` (app logic). `main.js` imports `firebase.js` for auth.
- Persistence: browser `localStorage` keyed per-user. `main.js` computes a storage key from `STORAGE_KEY_BASE` + `activeUserId` via `getStorageKey()`.
- Runtime libs: `Sortable.js` (CDN) is used for drag & drop ordering; manual ordering is persisted only when `sortMode === 'manual'`.

## Key files to read first

- `index.html` — UI structure, IDs, and where `main.js` mounts. Start here to see DOM hooks (`list`, `addForm`, `categorySelect`, etc.).
- `main.js` — app behavior, storage, auth wiring, and rendering logic. See `normalizeTasks()`, `save()`, `loadTasks()`, and `render()`.
- `firebase.js` — minimal auth surface exported (`signIn`, `signOutUser`, `onAuth`) used by `main.js`.

## Concrete data model & important helpers

- Task shape (as used in `main.js`): `{ id, text, done, category, dueDate, isDaily, subtasks[] }`. `subtasks` items: `{ id, text, done }`.
- Key helpers: `normalizeTasks(list)` (sanitizes stored shape), `getStorageKey()` (per-user key), `escapeHtml()` (prevents HTML injection in `render()`).
- Sorting: `sortMode` values — `manual`, `dueAsc`, `dueDesc`, `newest`, `oldest`, `alpha`, `dailyTop` — affect only the view order except `manual` which writes order back to `tasks` on drag end.

## Auth & storage behaviors to preserve

- Auth flow is in `main.js` via `onAuth(user)`; when active user changes the code calls `loadTasks()` and `render()` so data switches to the user's key. Preserve this sequence.
- Storage migration: `normalizeTasks()` accepts legacy or malformed shapes. If you change stored schema, implement a migration in `loadTasks()` that preserves older keys.

## Developer workflows (run & test locally)

- No build step. Serve the folder and open `index.html`.

PowerShell (from repo root):
```powershell
python -m http.server 8000
# open http://localhost:8000/index.html
```

Or open `index.html` directly (some APIs behave differently under `file://`).

Manual checks useful for PRs: add/edit/delete tasks, toggle daily, add subtasks, switch filters, and verify per-user separation of `localStorage` keys.

## Project-specific conventions

- UI IDs and class names are the integration surface — prefer updating selectors in `index.html` and `main.js` together.
- New tasks are `unshift`ed to the front; keep this unless changing UX intentionally.
- DOM sanitization: keep `escapeHtml()` usage when rendering user-provided text.

## Where to start for common changes

- Add category: update the `<select id="categorySelect">` and the `.category-filters` block in `index.html`, then ensure any new category string is handled by UI filters.
- Change persistence key/schema: update `STORAGE_KEY_BASE` in `main.js` and add migration logic to `loadTasks()`.
- Extract JS to module(s): move functions from `main.js` to new files, keep `initAuthUI()` call on DOM ready, and preserve exported `onAuth` usage from `firebase.js`.

If you'd like, I can replace the original file with this content or expand sections (tests, CI, migration examples).