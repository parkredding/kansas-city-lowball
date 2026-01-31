import { useState, useEffect, useCallback, useRef } from 'react';

const TOTAL_TIME = 45; // seconds

// Time after deadline when any player can claim timeout (prevents hangs if active player disconnects)
const GRACE_PERIOD_SECONDS = 2;

/**
 * TurnTimer component that displays remaining time and triggers timeout callback
 *
 * PASSIVE TIMER SYSTEM:
 * - Timer displays locally using (turnDeadline - Date.now())
 * - When timer hits 0, the active player gets first chance to claim timeout
 * - After GRACE_PERIOD_SECONDS, ANY player can claim (anti-hang protection)
 * - Server validates all claims using server time (anti-cheat)
 *
 * @param {Object} turnDeadline - Firestore Timestamp or Date for when turn expires
 * @param {Function} onTimeout - Callback when timer expires (called for server-validated claim)
 * @param {boolean} isMyTurn - Whether it's the current user's turn
 * @param {boolean} canTriggerTimeout - Whether this client can trigger the timeout (for bot handling)
 * @param {boolean} isAtTable - Whether the user is at this table (player or railbird)
 */
function TurnTimer({ turnDeadline, onTimeout, isMyTurn, canTriggerTimeout = false, isAtTable = true }) {
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_TIME);
  const hasClaimedRef = useRef(false);

  const calculateSecondsLeft = useCallback(() => {
    if (!turnDeadline) return TOTAL_TIME;

    // Handle Firestore Timestamp object
    let deadlineMs;
    if (turnDeadline.toDate) {
      deadlineMs = turnDeadline.toDate().getTime();
    } else if (turnDeadline.seconds) {
      deadlineMs = turnDeadline.seconds * 1000;
    } else {
      deadlineMs = new Date(turnDeadline).getTime();
    }

    const now = Date.now();
    // Allow negative values to track time past deadline
    return Math.floor((deadlineMs - now) / 1000);
  }, [turnDeadline]);

  useEffect(() => {
    // Reset claim flag when deadline changes (new turn)
    hasClaimedRef.current = false;

    // Initial calculation
    setSecondsLeft(calculateSecondsLeft());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateSecondsLeft();
      setSecondsLeft(remaining);

      // Don't try to claim if already claimed or no callback
      if (hasClaimedRef.current || !onTimeout || !isAtTable) return;

      // PASSIVE TIMER CLAIM LOGIC:
      // 1. Active player (or bot handler) can claim immediately when timer hits 0
      // 2. Any other player can claim after GRACE_PERIOD_SECONDS past deadline
      //    This prevents hangs when active player disconnects

      const canClaimNow = (
        // Active player or bot handler can claim at 0
        (remaining <= 0 && (isMyTurn || canTriggerTimeout)) ||
        // Any player can claim after grace period (anti-hang protection)
        (remaining <= -GRACE_PERIOD_SECONDS)
      );

      if (canClaimNow) {
        hasClaimedRef.current = true;
        onTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [turnDeadline, calculateSecondsLeft, isMyTurn, canTriggerTimeout, isAtTable, onTimeout]);

  // Calculate percentage for progress bar (clamp to 0-100)
  const displaySeconds = Math.max(0, secondsLeft);
  const percentage = Math.min(100, Math.max(0, (displaySeconds / TOTAL_TIME) * 100));

  // Determine color based on time remaining
  let barColor = 'bg-green-500';
  let textColor = 'text-green-400';

  if (percentage <= 33) {
    barColor = 'bg-red-500';
    textColor = 'text-red-400';
  } else if (percentage <= 66) {
    barColor = 'bg-yellow-500';
    textColor = 'text-yellow-400';
  }

  // Add pulse animation when low on time
  const pulseClass = percentage <= 20 ? 'animate-pulse' : '';

  if (!turnDeadline) return null;

  return (
    <div className={`w-full ${pulseClass}`}>
      {/* Timer Bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-1000 ease-linear`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Timer Text */}
      <div className="flex justify-between items-center mt-1">
        <span className={`text-xs ${textColor} font-medium`}>
          {isMyTurn ? 'Your turn' : 'Waiting...'}
        </span>
        <span className={`text-sm ${textColor} font-bold tabular-nums`}>
          {displaySeconds}s
        </span>
      </div>
    </div>
  );
}

// Circular timer variant for player avatars
export function CircularTimer({ turnDeadline, size = 48, isActive }) {
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_TIME);

  const calculateSecondsLeft = useCallback(() => {
    if (!turnDeadline) return TOTAL_TIME;

    let deadlineMs;
    if (turnDeadline.toDate) {
      deadlineMs = turnDeadline.toDate().getTime();
    } else if (turnDeadline.seconds) {
      deadlineMs = turnDeadline.seconds * 1000;
    } else {
      deadlineMs = new Date(turnDeadline).getTime();
    }

    const now = Date.now();
    const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));
    return remaining;
  }, [turnDeadline]);

  useEffect(() => {
    if (!isActive || !turnDeadline) return;

    setSecondsLeft(calculateSecondsLeft());

    const interval = setInterval(() => {
      setSecondsLeft(calculateSecondsLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [turnDeadline, isActive, calculateSecondsLeft]);

  if (!isActive || !turnDeadline) return null;

  const percentage = (secondsLeft / TOTAL_TIME) * 100;

  // Color based on time
  let strokeColor = '#22c55e'; // green
  if (percentage <= 33) {
    strokeColor = '#ef4444'; // red
  } else if (percentage <= 66) {
    strokeColor = '#eab308'; // yellow
  }

  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg
        width={size + 8}
        height={size + 8}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={(size + 8) / 2}
          cy={(size + 8) / 2}
          r={radius + 2}
          fill="none"
          stroke="rgba(55, 65, 81, 0.5)"
          strokeWidth="4"
        />
        {/* Progress circle */}
        <circle
          cx={(size + 8) / 2}
          cy={(size + 8) / 2}
          r={radius + 2}
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
    </div>
  );
}

export default TurnTimer;
