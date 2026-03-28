# CLAUDE.md

## Project Overview

A vanilla JavaScript todo app with Firebase authentication and Firestore sync, deployable to Netlify. No build system — just static files served directly.

## Tech Stack

- **Frontend**: Vanilla JS (ES6 modules), no framework, no bundler
- **Styling**: Vanilla CSS with custom properties for light/dark theming
- **Auth/DB**: Firebase v10 (Google Sign-In + Cloud Firestore)
- **Drag-and-drop**: Sortable.js v1.15.0 (CDN)
- **Deployment**: Netlify (build script generates firebase config from env vars)

## Local Development

No install step required. Just serve the directory:

```bash
python -m http.server 8000
# or
npx http-server
```

Then open `http://localhost:8000`.

**Firebase config setup**: Copy `firebase-config.example.js` to `firebase-config.js` and fill in your credentials. This file is gitignored — never commit it.

## Project Structure

```
index.html                    # HTML markup and DOM structure
main.js                       # All app logic (~1700 lines)
firebase.js                   # Firebase auth/Firestore wrapper
firebase-config.example.js    # Credential template (copy to firebase-config.js)
styles.css                    # All styles including light/dark themes
netlify.toml                  # Netlify build config
scripts/
  generate-firebase-config.js # Generates firebase-config.js from Netlify env vars
.github/
  copilot-instructions.md     # AI coding guidelines for this project
```

## Architecture

### State Management
All state lives in `main.js` as module-level variables:
- `tasks[]` — the canonical task array
- `activeUserId`, `currentUser` — auth state
- `statusFilter`, `categoryFilter`, `sortMode` — view state
- `editingTaskId`, `openTaskMenuId` — UI state

### Task Data Model
```javascript
{
  id: string,          // Unix timestamp as string
  text: string,
  status: "todo" | "doing" | "done",
  category: string,    // "General" | "Home" | "Work" | "Personal"
  dueDate: string,     // YYYY-MM-DD
  isDaily: boolean,
  subtasks: [{ id, text, done, status }]
}
```

### Persistence
- **Guest users**: `localStorage` key `todo_tasks_guest`
- **Signed-in users**: Firestore at `users/{uid}/taskLists/default` + localStorage for optimistic updates
- On first sign-in, guest data migrates to Firestore automatically

### Render Pattern
Every state change calls `save()` → persists to storage → calls `render()`. Full re-render on each change (acceptable for task-count scale).

### Filtering & Sorting
`render()` works on a shallow copy of `tasks`. Only "manual" sort mode persists order back to the `tasks` array; all other sort modes are view-only.

## Deployment (Netlify)

Set these environment variables in Netlify:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID` (optional)

The build command (`node scripts/generate-firebase-config.js`) generates `firebase-config.js` from these vars.

## Key Conventions

- Use `textContent` (not `innerHTML`) for user-provided text — XSS prevention is in place, keep it that way
- `normalizeTasks()` handles legacy data migration; run it when loading tasks
- Drag-and-drop (Sortable.js) is only enabled in "manual" sort mode
- Theme is persisted in `localStorage` as `"theme"` (`"dark"` or `"light"`)
- No automated tests — changes should be verified manually across: task CRUD, subtasks, filters, sorting, drag-and-drop, auth flow, daily/working drawers, and dark mode

## Branch

Active development branch: `claude/add-claude-md-v8oOT`
