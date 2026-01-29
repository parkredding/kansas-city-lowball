function Login() {
  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <h1 className="text-3xl font-bold text-center text-green-800 mb-6">
          Kansas City Lowball
        </h1>
        <p className="text-gray-600 text-center mb-8">
          2-7 Lowball Poker
        </p>
        <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
          Sign In to Play
        </button>
      </div>
    </div>
  )
}

export default Login
