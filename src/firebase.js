import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate required Firebase config values
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

export let configError = null;
export let auth = null;

if (missingKeys.length > 0) {
  configError = `Missing Firebase configuration: ${missingKeys.join(', ')}. ` +
    'Make sure you have a .env file with the required VITE_FIREBASE_* variables. ' +
    'See .env.example for the required format.';
  console.error(configError);
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export default auth;
