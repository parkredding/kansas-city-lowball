import { useState, useEffect, useCallback, useRef } from 'react';
import { BLIND_LEVEL_DURATION_MS, getBlindLevel, SNG_BLIND_STRUCTURE } from '../game/constants';

/**
 * BlindTimer component displays the current blind level and countdown to next level increase
 * Visible to all players and railbirds in Sit & Go tournaments
 *
 * @param {Object} blindTimer - Tournament blind timer state from tableData.tournament.blindTimer
 *   - currentLevel: number (0-indexed blind level)
 *   - nextLevelAt: Firestore Timestamp or number (when blinds increase)
 * @param {boolean} tournamentRunning - Whether the tournament is currently running
 * @param {Function} onLevelUp - Callback when timer expires (to trigger blind level increase)
 * @param {boolean} canTriggerLevelUp - Whether this client should trigger level up (e.g., table creator)
 */
function BlindTimer({ blindTimer, tournamentRunning, onLevelUp, canTriggerLevelUp = false }) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const hasTriggeredRef = useRef(false);
  const lastLevelRef = useRef(blindTimer?.currentLevel || 0);

  const calculateSecondsLeft = useCallback(() => {
    if (!blindTimer?.nextLevelAt) return 0;

    let nextLevelMs;
    if (blindTimer.nextLevelAt.toDate) {
      // Firestore Timestamp
      nextLevelMs = blindTimer.nextLevelAt.toDate().getTime();
    } else if (blindTimer.nextLevelAt.seconds) {
      // Firestore Timestamp as object
      nextLevelMs = blindTimer.nextLevelAt.seconds * 1000;
    } else {
      // Raw milliseconds or Date
      nextLevelMs = new Date(blindTimer.nextLevelAt).getTime();
    }

    const now = Date.now();
    return Math.max(0, Math.floor((nextLevelMs - now) / 1000));
  }, [blindTimer?.nextLevelAt]);

  // Reset trigger flag when level changes
  useEffect(() => {
    const currentLevel = blindTimer?.currentLevel || 0;
    if (currentLevel !== lastLevelRef.current) {
      hasTriggeredRef.current = false;
      lastLevelRef.current = currentLevel;
    }
  }, [blindTimer?.currentLevel]);

  useEffect(() => {
    if (!tournamentRunning || !blindTimer) return;

    // Initial calculation
    setSecondsLeft(calculateSecondsLeft());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateSecondsLeft();
      setSecondsLeft(remaining);

      // Trigger level up when timer expires
      if (remaining <= 0 && canTriggerLevelUp && onLevelUp && !hasTriggeredRef.current) {
        const currentLevel = blindTimer?.currentLevel || 0;
        const isMaxLevel = currentLevel >= SNG_BLIND_STRUCTURE.length - 1;
        if (!isMaxLevel) {
          hasTriggeredRef.current = true;
          Promise.resolve(onLevelUp()).then(result => {
            // If the increase failed, reset trigger so next tick can retry
            if (!result || !result.success) {
              hasTriggeredRef.current = false;
            }
          }).catch(() => {
            hasTriggeredRef.current = false;
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [blindTimer, tournamentRunning, calculateSecondsLeft, canTriggerLevelUp, onLevelUp]);

  if (!tournamentRunning || !blindTimer) return null;

  const currentLevel = blindTimer.currentLevel || 0;
  const blindInfo = getBlindLevel(currentLevel);
  const nextBlindInfo = getBlindLevel(currentLevel + 1);
  const isMaxLevel = currentLevel >= SNG_BLIND_STRUCTURE.length - 1;

  // Format time as MM:SS
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Calculate percentage for progress bar
  const totalDuration = BLIND_LEVEL_DURATION_MS / 1000;
  const percentage = Math.min(100, Math.max(0, (secondsLeft / totalDuration) * 100));

  // Color based on time remaining
  let timerColor = 'text-green-400';
  let progressColor = 'bg-green-500';
  if (percentage <= 20) {
    timerColor = 'text-red-400';
    progressColor = 'bg-red-500';
  } else if (percentage <= 50) {
    timerColor = 'text-yellow-400';
    progressColor = 'bg-yellow-500';
  }

  // Add pulse animation when low on time
  const pulseClass = percentage <= 20 ? 'animate-pulse' : '';

  return (
    <div className={`bg-slate-800/90 rounded-lg border border-slate-600/50 px-3 py-1.5 ${pulseClass}`}>
      {/* Compact single-row layout to match other header elements */}
      <div className="flex items-center gap-3">
        {/* Level indicator */}
        <span className="text-slate-400 text-xs">Lvl {blindInfo.level}</span>

        {/* Current Blinds */}
        <div className="flex items-center gap-1">
          <span className="text-amber-400 font-bold text-sm">
            {blindInfo.smallBlind.toLocaleString()}
          </span>
          <span className="text-slate-500 text-sm">/</span>
          <span className="text-amber-400 font-bold text-sm">
            {blindInfo.bigBlind.toLocaleString()}
          </span>
        </div>

        {/* Timer countdown */}
        {!isMaxLevel && (
          <>
            <span className="text-slate-600">|</span>
            <span className={`font-mono font-bold text-sm ${timerColor}`}>{timeDisplay}</span>
            {/* Mini progress bar */}
            <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressColor} transition-all duration-1000 ease-linear`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </>
        )}

        {/* Max level indicator */}
        {isMaxLevel && (
          <span className="text-slate-500 text-xs">Max</span>
        )}
      </div>
    </div>
  );
}

/**
 * Compact BlindTimer variant for mobile or smaller displays
 */
export function CompactBlindTimer({ blindTimer, tournamentRunning }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  const calculateSecondsLeft = useCallback(() => {
    if (!blindTimer?.nextLevelAt) return 0;

    let nextLevelMs;
    if (blindTimer.nextLevelAt.toDate) {
      nextLevelMs = blindTimer.nextLevelAt.toDate().getTime();
    } else if (blindTimer.nextLevelAt.seconds) {
      nextLevelMs = blindTimer.nextLevelAt.seconds * 1000;
    } else {
      nextLevelMs = new Date(blindTimer.nextLevelAt).getTime();
    }

    const now = Date.now();
    return Math.max(0, Math.floor((nextLevelMs - now) / 1000));
  }, [blindTimer?.nextLevelAt]);

  useEffect(() => {
    if (!tournamentRunning || !blindTimer) return;

    setSecondsLeft(calculateSecondsLeft());

    const interval = setInterval(() => {
      setSecondsLeft(calculateSecondsLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [blindTimer, tournamentRunning, calculateSecondsLeft]);

  if (!tournamentRunning || !blindTimer) return null;

  const currentLevel = blindTimer.currentLevel || 0;
  const blindInfo = getBlindLevel(currentLevel);

  // Format time as MM:SS
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Color based on time remaining
  const totalDuration = BLIND_LEVEL_DURATION_MS / 1000;
  const percentage = (secondsLeft / totalDuration) * 100;
  let timerColor = 'text-green-400';
  if (percentage <= 20) {
    timerColor = 'text-red-400';
  } else if (percentage <= 50) {
    timerColor = 'text-yellow-400';
  }

  return (
    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
      <span className="text-amber-400 font-bold">
        {blindInfo.smallBlind}/{blindInfo.bigBlind}
      </span>
      <span className="text-slate-500">|</span>
      <span className={`font-mono font-bold ${timerColor}`}>{timeDisplay}</span>
    </div>
  );
}

/**
 * MobileBlindBanner - Prominent blind level + timer display for mobile
 * Full-width banner shown below the mobile header during tournaments
 */
export function MobileBlindBanner({ blindTimer, tournamentRunning, onLevelUp, canTriggerLevelUp = false }) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const hasTriggeredRef = useRef(false);
  const lastLevelRef = useRef(blindTimer?.currentLevel || 0);

  const calculateSecondsLeft = useCallback(() => {
    if (!blindTimer?.nextLevelAt) return 0;

    let nextLevelMs;
    if (blindTimer.nextLevelAt.toDate) {
      nextLevelMs = blindTimer.nextLevelAt.toDate().getTime();
    } else if (blindTimer.nextLevelAt.seconds) {
      nextLevelMs = blindTimer.nextLevelAt.seconds * 1000;
    } else {
      nextLevelMs = new Date(blindTimer.nextLevelAt).getTime();
    }

    const now = Date.now();
    return Math.max(0, Math.floor((nextLevelMs - now) / 1000));
  }, [blindTimer?.nextLevelAt]);

  // Reset trigger flag when level changes
  useEffect(() => {
    const currentLevel = blindTimer?.currentLevel || 0;
    if (currentLevel !== lastLevelRef.current) {
      hasTriggeredRef.current = false;
      lastLevelRef.current = currentLevel;
    }
  }, [blindTimer?.currentLevel]);

  useEffect(() => {
    if (!tournamentRunning || !blindTimer) return;

    setSecondsLeft(calculateSecondsLeft());

    const interval = setInterval(() => {
      const remaining = calculateSecondsLeft();
      setSecondsLeft(remaining);

      if (remaining <= 0 && canTriggerLevelUp && onLevelUp && !hasTriggeredRef.current) {
        const currentLevel = blindTimer?.currentLevel || 0;
        const isMaxLevel = currentLevel >= SNG_BLIND_STRUCTURE.length - 1;
        if (!isMaxLevel) {
          hasTriggeredRef.current = true;
          Promise.resolve(onLevelUp()).then(result => {
            if (!result || !result.success) {
              hasTriggeredRef.current = false;
            }
          }).catch(() => {
            hasTriggeredRef.current = false;
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [blindTimer, tournamentRunning, calculateSecondsLeft, canTriggerLevelUp, onLevelUp]);

  if (!tournamentRunning || !blindTimer) return null;

  const currentLevel = blindTimer.currentLevel || 0;
  const blindInfo = getBlindLevel(currentLevel);
  const nextBlindInfo = getBlindLevel(currentLevel + 1);
  const isMaxLevel = currentLevel >= SNG_BLIND_STRUCTURE.length - 1;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const totalDuration = BLIND_LEVEL_DURATION_MS / 1000;
  const percentage = Math.min(100, Math.max(0, (secondsLeft / totalDuration) * 100));

  let timerColor = 'text-green-400';
  let progressColor = 'bg-green-500';
  let bgAccent = 'border-slate-600/50';
  if (percentage <= 20) {
    timerColor = 'text-red-400';
    progressColor = 'bg-red-500';
    bgAccent = 'border-red-500/40';
  } else if (percentage <= 50) {
    timerColor = 'text-yellow-400';
    progressColor = 'bg-yellow-500';
    bgAccent = 'border-yellow-500/30';
  }

  const pulseClass = percentage <= 20 ? 'animate-pulse' : '';

  return (
    <div className={`flex-shrink-0 bg-slate-800/95 border-b ${bgAccent} px-3 py-1.5 ${pulseClass}`}>
      <div className="flex items-center justify-between">
        {/* Left: Level badge + blinds */}
        <div className="flex items-center gap-2">
          <span className="bg-violet-600/80 text-violet-100 text-[10px] font-bold px-1.5 py-0.5 rounded">
            LVL {blindInfo.level}
          </span>
          <span className="text-amber-400 font-bold text-sm">
            {blindInfo.smallBlind.toLocaleString()}/{blindInfo.bigBlind.toLocaleString()}
          </span>
        </div>

        {/* Right: Timer + progress */}
        {!isMaxLevel ? (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressColor} transition-all duration-1000 ease-linear`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className={`font-mono font-bold text-sm ${timerColor}`}>{timeDisplay}</span>
            {!isMaxLevel && nextBlindInfo && (
              <span className="text-slate-500 text-[10px]">
                {nextBlindInfo.smallBlind}/{nextBlindInfo.bigBlind}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-xs font-medium">Max Level</span>
        )}
      </div>
    </div>
  );
}

export default BlindTimer;
