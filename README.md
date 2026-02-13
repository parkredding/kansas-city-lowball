# Kansas City Lowball Poker

A real-time multiplayer poker application featuring Kansas City Lowball (2-7 Lowball) and Texas Hold'em variants.

## Features

- **Multiple Game Variants:**
  - Kansas City Lowball (2-7)
  - Deuce-to-Six Lowball
  - Texas Hold'em
  - Ace-to-Five Lowball

- **Betting Structures:**
  - No Limit
  - Pot Limit
  - Fixed Limit

- **Player Features:**
  - Real-time multiplayer gameplay
  - Career statistics tracking
  - Rivals/head-to-head analysis
  - GTO (Game Theory Optimal) performance tracking
  - Hand history review

- **Game Modes:**
  - Cash games
  - Tournament support (in development)

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Firebase
  - Firestore (real-time database)
  - Authentication (Google OAuth)
  - Cloud Functions (Node.js)
- **Game Engine:** Custom poker engine with hand evaluation

## Important: Firebase Blaze Plan Required

⚠️ **This application requires the Firebase Blaze (pay-as-you-go) plan** to function properly.

### Why Blaze Plan is Required

The Spark (free) tier does **NOT support Cloud Functions**, which are critical for:
- ✅ Server-side hand history recording (prevents cheating)
- ✅ Automated timeout processing
- ✅ Career stats tracking
- ✅ Rivals stats updates

**Without Cloud Functions deployed:**
- ❌ Career dashboard will show 0 hands played
- ❌ Rivals stats won't update
- ❌ Hand histories won't be recorded
- ❌ Automated timeouts won't work

### Expected Costs

Even on Blaze plan, you still get **free tier quotas**:
- **Firestore:** 50K reads, 20K writes per day
- **Cloud Functions:** 2M invocations per month
- **Authentication:** Unlimited

**Actual costs with typical usage:**
- Light usage (<10 users): **$0-1/month**
- Moderate usage (50-100 users): **$5-20/month**

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Firebase account with Blaze plan enabled
- Firebase project created

### 2. Clone and Install

```bash
git clone https://github.com/yourusername/kansas-city-lowball.git
cd kansas-city-lowball
npm install
```

### 3. Configure Firebase

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` and add your Firebase project credentials from Firebase Console:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123
```

### 4. Deploy Cloud Functions

**Critical step - App won't work without this!**

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Link to your Firebase project
firebase use --add

# Install function dependencies
cd functions
npm install
cd ..

# Deploy functions and rules
firebase deploy --only functions
firebase deploy --only firestore:rules
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

## Project Structure

```
kansas-city-lowball/
├── src/
│   ├── components/      # React components
│   ├── context/         # React context providers
│   ├── game/            # Game engine and logic
│   ├── pages/           # Page components
│   ├── services/        # Firebase service wrappers
│   └── firebase.js      # Firebase initialization
├── functions/           # Cloud Functions
│   └── index.js        # Function definitions
├── firestore.rules     # Firestore security rules
├── firebase.json       # Firebase configuration
└── DEPLOYMENT.md       # Deployment guide
```

## Architecture

### Server-Authoritative Game Model

This application uses a **server-hosted architecture** where:

1. **Scheduled Cloud Function** runs every minute to process game state
2. **Server is single source of truth** for all game transitions
3. **Clients display state only** - no client-triggered state changes

**Benefits:**
- Prevents cheating (all validation server-side)
- Eliminates race conditions
- Consistent game state regardless of client connectivity
- Prevents timer manipulation bugs

### Real-time Data Flow

1. **Game State:** Firestore real-time listeners
   - Table state updates instantly for all players
   - User balance updates in real-time

2. **Hand Recording:** Cloud Function `recordHandHistory`
   - Called when hand completes
   - Writes to `/hand_histories/{handId}`
   - Creates per-player logs at `/users/{uid}/hand_logs/{handId}`

3. **Statistics:** Computed from hand logs
   - Career stats: Aggregated from `/users/{uid}/hand_logs/`
   - Rivals: Stored in `/users/{uid}/rivals/{opponentUid}`
   - GTO tracking: Saved to `/users/{uid}/gto_performance/`

### Cloud Functions

| Function | Type | Purpose |
|----------|------|---------|
| `processTimeouts` | Scheduled (every 1 min) | Auto-fold timed-out players |
| `handleTimeout` | Callable | Legacy timeout handler |
| `triggerTimeoutCheck` | HTTP | Manual timeout trigger |
| `recordHandHistory` | Callable | Server-side hand recording |

### Firestore Collections

```
/users/{uid}                          - User profiles
/users/{uid}/hand_logs/{handId}       - Personal hand history
/users/{uid}/rivals/{opponentUid}     - Head-to-head stats
/users/{uid}/stats_cache/latest       - Cached statistics
/users/{uid}/gto_performance/{handId} - GTO analysis
/tables/{tableId}                     - Active game tables
/hand_histories/{handId}              - Complete hand records
```

## Local Development with Emulators

To develop without hitting production Firebase:

```bash
# Install emulators
firebase init emulators

# Start emulator suite
firebase emulators:start

# In .env, enable emulator mode
VITE_USE_FUNCTIONS_EMULATOR=true

# Run dev server
npm run dev
```

## Security

- **Authentication:** Google OAuth via Firebase Auth
- **Authorization:** Firestore security rules enforce user isolation
- **Server Validation:** Cloud Functions validate all game state changes
- **Hand Recording:** Server-only (clients can't forge hand histories)
- **Anti-Cheat:** Server-side timeout validation prevents timer manipulation

## Troubleshooting

### "Career shows 0 hands played"

**Cause:** Cloud Functions not deployed

**Fix:**
```bash
firebase deploy --only functions
```

### "Function not found" errors

**Cause:** Using emulator mode but emulator not running, OR functions not deployed

**Fix for production:**
1. Remove `VITE_USE_FUNCTIONS_EMULATOR=true` from `.env`
2. Deploy functions: `firebase deploy --only functions`

**Fix for local dev:**
1. Set `VITE_USE_FUNCTIONS_EMULATOR=true` in `.env`
2. Run `firebase emulators:start`

### "Permission denied" in Firestore

**Cause:** Security rules not deployed

**Fix:**
```bash
firebase deploy --only firestore:rules
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including Career/Rivals stats)
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For deployment issues, see [DEPLOYMENT.md](DEPLOYMENT.md)

For Firebase billing questions, visit [Firebase Support](https://firebase.google.com/support)
