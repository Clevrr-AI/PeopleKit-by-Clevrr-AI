
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  serverTimestamp, 
  Timestamp, 
  runTransaction, 
  updateDoc, 
  increment, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs,
  setDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Export Auth utilities
export { onAuthStateChanged, signInWithEmailAndPassword, signOut };

// Export Firestore utilities
export { 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  serverTimestamp, 
  Timestamp, 
  runTransaction, 
  updateDoc, 
  increment, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs,
  setDoc
};
