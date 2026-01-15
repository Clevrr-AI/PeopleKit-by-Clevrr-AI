
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
  // Added limit to fix the export error in Dashboard.tsx
  limit, 
  onSnapshot, 
  getDocs,
  setDoc,
  GeoPoint,
  // Fix: Added missing deleteDoc import from firestore
  deleteDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDnqcY_PAsPmfLBt4eG7o62t7a5YV877dA",
  authDomain: "studio-2980330480-5ba3b.firebaseapp.com",
  projectId: "studio-2980330480-5ba3b",
  storageBucket: "studio-2980330480-5ba3b.firebasestorage.app",
  messagingSenderId: "1017876570620",
  appId: "1:1017876570620:web:287e44f78d6b3b743f9279"
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
  limit,
  onSnapshot, 
  getDocs,
  setDoc,
  GeoPoint,
  deleteDoc
};
