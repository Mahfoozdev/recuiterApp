import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBBLr9mB1h8GuasvsJDNu67tCndHdkMJRo",
  authDomain: "gen-lang-client-0800426739.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0800426739-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gen-lang-client-0800426739",
  storageBucket: "gen-lang-client-0800426739.firebasestorage.app",
  messagingSenderId: "1051676528127",
  appId: "1:1051676528127:web:12dc870cab9b77126aebca"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;