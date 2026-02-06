# todo-app

## Setup

Create a local Firebase config file before running:

1. Copy `firebase-config.example.js` to `firebase-config.js`
2. Fill in your Firebase project values

`firebase-config.js` is ignored by git on purpose.

## Netlify

On Netlify, `firebase-config.js` is generated at build time from environment variables.
Set these in your Netlify site settings (Site configuration -> Environment variables):
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`
