import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
function signIn() {
  console.log("[Auth] signIn invoked");
  return signInWithPopup(auth, provider);
}
function signOutUser() {
  console.log("[Auth] signOutUser invoked");
  return signOut(auth);
}
function onAuth(callback) {
  console.log("[Auth] onAuth subscription registered");
  return onAuthStateChanged(auth, user => {
    console.log("[Auth] state changed", user ? (user.email || user.displayName) : "signed out");
    callback(user);
  });
}
function getTaskListDoc(uid) {
  return doc(db, "users", uid, "taskLists", "default");
}
function saveTaskList(uid, tasks) {
  if (!uid) return Promise.reject(new Error("Missing uid"));
  const ref = getTaskListDoc(uid);
  return setDoc(ref, {
    tasks: Array.isArray(tasks) ? tasks : [],
    updatedAt: serverTimestamp()
  }, { merge: true });
}
function onTaskList(uid, callback, errorCallback) {
  if (!uid) throw new Error("Missing uid");
  const ref = getTaskListDoc(uid);
  return onSnapshot(ref, snap => {
    const data = snap.exists() ? snap.data() : {};
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    callback(tasks);
  }, errorCallback);
}
export { auth, provider, signIn, signOutUser, onAuth, saveTaskList, onTaskList };

