import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKJQLcMdWCziHnZxGRe1CZyp4y8-HWKAA",
  authDomain: "salao-saas-everton.firebaseapp.com",
  projectId: "salao-saas-everton",
  storageBucket: "salao-saas-everton.firebasestorage.app",
  messagingSenderId: "323769254134",
  appId: "1:323769254134:web:078c3b3094e0beb7022cd7"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };