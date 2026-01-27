
import { initializeApp, getApps, getApp } from 'firebase/app';
// Fix: Added createUserWithEmailAndPassword to imports and ensured getAuth is available for export
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
// Consolidated multiline firestore imports into a single line to fix "no exported member" errors in the current environment
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, Timestamp, runTransaction, updateDoc, increment, query, where, orderBy, limit, onSnapshot, getDocs, setDoc, GeoPoint, deleteDoc, enableIndexedDbPersistence } from 'firebase/firestore';

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

// Enable Offline Persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('Persistence failed-precondition: Multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Persistence unimplemented: Browser not supported.');
    }
  });
}

// Fix: Exporting auth utilities including getAuth and createUserWithEmailAndPassword for centralized access
export { onAuthStateChanged, signInWithEmailAndPassword, signOut, getAuth, createUserWithEmailAndPassword };

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
