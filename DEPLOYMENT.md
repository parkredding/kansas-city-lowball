# Firebase Deployment Guide

## Prerequisites

### Firebase Blaze Plan Required

This project uses **Cloud Functions** which require the **Firebase Blaze (pay-as-you-go) plan**. The Spark (free) tier does NOT support Cloud Functions deployment.

**Why Cloud Functions are critical:**
- Server-side hand history recording (prevents cheating)
- Automated timeout processing for game state
- Secure hand log creation for Career stats
- Rivalry tracking depends on Cloud Function success

**Without Cloud Functions deployed:**
- ❌ Career stats won't track hands played
- ❌ Rivals stats won't update
- ❌ Timeouts won't be processed automatically
- ❌ Hand histories won't be recorded

### Upgrade to Blaze Plan

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to: **⚙️ Settings → Usage and billing → Details & settings**
4. Click **Modify plan** → Select **Blaze (pay as you go)**
5. Add payment method (credit card required)
6. **Set budget alerts** (recommended: $5, $10, $20 thresholds)

**Expected costs with free tier quotas:**
- Light usage (<10 active users): **$0-1/month**
- Moderate usage (50-100 users): **$5-20/month**
- Scheduled function runs 43,200 times/month (within free tier)

---

## Deployment Steps

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

This opens a browser for Google authentication.

### 3. Initialize Firebase Project

```bash
firebase use --add
```

Select your Firebase project from the list. This creates a `.firebaserc` file linking your local code to your Firebase project.

### 4. Install Cloud Functions Dependencies

```bash
cd functions
npm install
cd ..
```

### 5. Deploy Cloud Functions

Deploy all 4 Cloud Functions:

```bash
firebase deploy --only functions
```

This deploys:
- `processTimeouts` - Scheduled function (runs every 1 minute)
- `handleTimeout` - Callable function (legacy timeout handler)
- `triggerTimeoutCheck` - HTTP function (manual timeout trigger)
- `recordHandHistory` - Callable function (server-side hand recording)

**Expected output:**
```
✔  functions[processTimeouts(us-central1)] Successful create operation.
✔  functions[handleTimeout(us-central1)] Successful create operation.
✔  functions[triggerTimeoutCheck(us-central1)] Successful create operation.
✔  functions[recordHandHistory(us-central1)] Successful create operation.
```

### 6. Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

This deploys the security rules from `firestore.rules`.

### 7. Update Environment Variables

In your `.env` file, disable the functions emulator for production:

```env
# Set to false for production (uses deployed Cloud Functions)
VITE_USE_FUNCTIONS_EMULATOR=false
```

Or simply remove/comment out this line to use deployed functions by default.

---

## Verify Deployment

### Check Functions Status

```bash
firebase functions:list
```

Should show all 4 functions in the list.

### Check Scheduled Function

The `processTimeouts` function should appear in:
- Firebase Console → Functions → processTimeouts
- Shows "Trigger: every 1 minutes"

### Test Hand Recording

1. Play a complete hand in the game
2. Check browser console - should NOT see errors about "function not found"
3. Go to Career Dashboard - hand should appear in stats
4. Go to Rivals page - opponent should appear with hand count incremented

---

## Firestore Collections Created

After hands are played, these collections will be populated:

```
/hand_histories/{handId}              - Complete hand records
/users/{uid}/hand_logs/{handId}       - Per-user hand history
/users/{uid}/rivals/{opponentUid}     - Head-to-head stats
/users/{uid}/stats_cache/latest       - Cached aggregate stats
/users/{uid}/gto_performance/{handId} - GTO analysis (if enabled)
```

---

## Local Development with Emulator

To develop locally without hitting production:

### 1. Install Emulator Suite

```bash
firebase init emulators
```

Select:
- ✅ Functions Emulator
- ✅ Firestore Emulator

### 2. Start Emulators

```bash
firebase emulators:start
```

### 3. Enable Emulator Mode

In your `.env`:

```env
VITE_USE_FUNCTIONS_EMULATOR=true
```

### 4. Run Dev Server

```bash
npm run dev
```

The app will now use local emulators instead of production Firebase.

---

## Troubleshooting

### "Function not found" errors

**Symptom:** Browser console shows `Failed to record hand data: Function not found`

**Solution:**
1. Verify Blaze plan is active
2. Run `firebase deploy --only functions`
3. Check `.env` has `VITE_USE_FUNCTIONS_EMULATOR=false` (or remove the line)
4. Rebuild app: `npm run build`

### Career/Rivals not tracking hands

**Symptom:** Stats show 0 hands played after completing games

**Root cause:** Cloud Functions not deployed

**Solution:** Follow deployment steps above

### Scheduled function not running

**Symptom:** Timeouts not processing automatically

**Solution:**
1. Check Firebase Console → Functions → processTimeouts
2. Verify schedule shows "every 1 minutes"
3. Check logs for errors: `firebase functions:log --only processTimeouts`

### Permission denied errors

**Symptom:** Firestore security rules blocking operations

**Solution:**
1. Deploy rules: `firebase deploy --only firestore:rules`
2. Verify authentication is working (user logged in via Google)
3. Check `firestore.rules` for proper permission settings

---

## Cost Monitoring

### Set Budget Alerts

1. Firebase Console → Usage and billing
2. Click "Details & settings"
3. Set up budget alerts at $5, $10, $20
4. Add email notifications

### Monitor Usage

Check daily usage at:
- Firebase Console → Usage and billing → Usage tab

**Key metrics to watch:**
- Cloud Functions invocations
- Firestore reads/writes
- Firestore storage (1 GB free)

### Free Tier Quotas (Included with Blaze)

- **Firestore:** 50K reads, 20K writes, 20K deletes per day
- **Cloud Functions:** 2M invocations, 400K GB-seconds, 200K CPU-seconds per month
- **Authentication:** Unlimited

You only pay if you exceed these quotas.

---

## CI/CD Deployment (Optional)

To automate deployment via GitHub Actions:

1. Generate a Firebase token:
   ```bash
   firebase login:ci
   ```

2. Add token to GitHub Secrets as `FIREBASE_TOKEN`

3. Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to Firebase
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - uses: actions/setup-node@v2
         - run: npm install -g firebase-tools
         - run: cd functions && npm install
         - run: firebase deploy --token ${{ secrets.FIREBASE_TOKEN }}
   ```

---

## Support

For issues with:
- **Firebase billing:** https://firebase.google.com/support
- **Deployment errors:** Check `firebase debug.log`
- **Function logs:** `firebase functions:log`
