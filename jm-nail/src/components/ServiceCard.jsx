import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAZTqe0LbWUoqFDHPQ7JK9BckI5tJEJr9A",
  authDomain: "jm-nail-booking.firebaseapp.com",
  projectId: "jm-nail-booking",
  storageBucket: "jm-nail-booking.firebasestorage.app",
  messagingSenderId: "704128488448",
  appId: "1:704128488448:web:1759bde47b2fae188d74e5",
  measurementId: "G-GW0J0BQCWY"
};

// --- Initialize Firebase (Safe Mode) ---
let auth, db;
let initError = null;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase Init Error:", error);
  initError = error.message;
}

export { auth, db, initError };
export const APP_ID = "jm-nail-prod";