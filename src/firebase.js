import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAAFCbuRe4lzdE4OUE_ulALZCN6EfcDNIQ",
  authDomain: "fwt-lv-tracker.firebaseapp.com",
  databaseURL: "https://fwt-lv-tracker-default-rtdb.firebaseio.com",
  projectId: "fwt-lv-tracker",
  storageBucket: "fwt-lv-tracker.firebasestorage.app",
  messagingSenderId: "670069354019",
  appId: "1:670069354019:web:26800dd2423cf44b334b96",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const storage = getStorage(app);

export {
  auth,
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  updateProfile,
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
};
