import { useState, useEffect, useCallback, useRef } from 'react';

const TOTAL_TIME = 45; // seconds

// Time after deadline when we request immediate server processing
// This is just an optimization - server will process automatically within ~1 minute anyway
const REQUEST_PROCESSING_DELAY_SECONDS = 2;

/**
 * TurnTimer component that displays remaining time and optionally requests
 * immediate server-side timeout processing
 *
 * SERVER-HOSTED ARCHITECTURE:
 * - Timer is DISPLAY ONLY - it shows the countdown to the user
 * - Server processes ALL timeouts automatically via scheduled function (every ~1 minute)
 * - When timer expires, client can REQUEST immediate processing to reduce latency
 * - This request is fire-and-forget - server handles everything
 *
 * Benefits over passive timer system:
 * - No race conditions from player refresh/back button
 * - No timer hang bugs from client-side claiming failures
 * - Server is single source of truth for all state transitions
 *
 * @param {Object} turnDeadline - Firestore Timestamp or Date for when turn expires
 * @param {Function} onTimeout - Optional callback to request immediate server processing
 * @param {boolean} isMyTurn - Whether it's the current user's turn (for display only)
 * @param {boolean} canTriggerTimeout - Whether this client should request immediate processing
 * @param {boolean} isAtTable - Whether the user is at this table (player or railbird)
 */
function TurnTimer({ turnDeadline, onTimeout, isMyTurn, canTriggerTimeout = false, isAtTable = true }) {
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_TIME);
  const hasRequestedRef = useRef(false);

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
    // Reset request flag when deadline changes (new turn)
    hasRequestedRef.current = false;

    // Initial calculation
    setSecondsLeft(calculateSecondsLeft());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateSecondsLeft();
      setSecondsLeft(remaining);

      // Don't request if already requested, no callback, or not at table
      if (hasRequestedRef.current || !onTimeout || !isAtTable) return;

      // SERVER-HOSTED TIMEOUT REQUEST LOGIC:
      // Request immediate server processing when timer expires
      // This is just an optimization - server processes automatically anyway
      //
      // We wait a couple seconds past deadline before requesting to:
      // 1. Give the active player a chance to act
      // 2. Reduce unnecessary server calls
      const shouldRequestNow = (
        // Active player or designated handler can request immediately at 0
        (remaining <= 0 && (isMyTurn || canTriggerTimeout)) ||
        // After delay, any player can request (reduces latency vs waiting for scheduled function)
        (remaining <= -REQUEST_PROCESSING_DELAY_SECONDS)
      );

      if (shouldRequestNow) {
        hasRequestedRef.current = true;
        // Fire-and-forget: server handles everything
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
