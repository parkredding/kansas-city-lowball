import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
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

  function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithRedirect(auth, provider);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    // Wait for persistence to be set before checking redirect result
    // This is critical for the OAuth redirect flow to work properly
    authReady
      .then(() => getRedirectResult(auth))
      .then((result) => {
        if (result?.user) {
          setCurrentUser(result.user);
        }
      })
      .catch((error) => {
        console.error('Redirect sign-in error:', error);
        setAuthError(error.message);
        setLoading(false);
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
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
