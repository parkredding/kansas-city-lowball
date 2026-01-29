import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, authReady } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // User is automatically set via onAuthStateChanged listener
      return result;
    } catch (error) {
      console.error('Google sign-in error:', error);
      setAuthError(error.message);
      throw error;
    }
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    let unsubscribe = () => {};

    // Wait for persistence to be ready before setting up auth listener
    authReady.then(() => {
      // onAuthStateChanged will fire immediately with current auth state
      // and then again whenever auth state changes (login/logout)
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    signInWithGoogle,
    logout,
    loading,
    authError,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex h-screen items-center justify-center">
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}
