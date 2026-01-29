import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, currentUser, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/game');
    }
  }, [currentUser, navigate]);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      await signInWithGoogle();
      // User will be redirected to Google, then back to the app
      // The redirect result is handled in AuthContext
    } catch (error) {
      console.error('Sign-in error:', error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <span className="text-4xl">🃏</span>
          </div>
          <h1 className="text-3xl font-bold text-green-800 mb-2">
            Kansas City Lowball
          </h1>
          <p className="text-gray-500">
            2-7 Triple Draw Poker
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 font-bold">1</span>
            </span>
            <span>Lowest hand wins - aces are high</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 font-bold">2</span>
            </span>
            <span>Straights and flushes count against you</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 font-bold">3</span>
            </span>
            <span>Best possible hand: 2-3-4-5-7</span>
          </div>
        </div>

        {authError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm text-center">
            {authError}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <p className="mt-6 text-center text-xs text-gray-400">
          Play responsibly. This is a free game for entertainment only.
        </p>
      </div>
    </div>
  );
}

export default Login;
