const fs = require("fs");
const path = require("path");

const requiredVars = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_MEASUREMENT_ID"
];

const missing = requiredVars.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error("Missing required env vars:", missing.join(", "));
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const output = `// Auto-generated at build time by Netlify\nconst firebaseConfig = ${JSON.stringify(
  firebaseConfig,
  null,
  2
)};\n\nexport { firebaseConfig };\n`;

const outputPath = path.join(__dirname, "..", "firebase-config.js");
fs.writeFileSync(outputPath, output, "utf8");
console.log("Wrote firebase-config.js");

