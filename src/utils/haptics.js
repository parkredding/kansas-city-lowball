/**
 * ============================================================================
 * HAPTIC FEEDBACK UTILITY
 * "Sensory Trust Layer" - PWA Gaming Design System
 * ============================================================================
 *
 * Provides tactile feedback using the Vibration API to make the app feel
 * "real" and trustworthy. Different events get distinct vibration patterns
 * to create an intuitive sensory language.
 *
 * PATTERN DESIGN PHILOSOPHY:
 * - Shorter patterns = lighter interactions (taps, toggles)
 * - Longer patterns = significant events (turn alerts, wins)
 * - Pauses in patterns = rhythm and emphasis
 *
 * BROWSER SUPPORT:
 * - Android Chrome: Full support
 * - iOS Safari: NO SUPPORT (uses AudioContext as fallback hint)
 * - Desktop: Generally no support
 *
 * The utility gracefully degrades - it's safe to call on any platform.
 * ============================================================================
 */

/**
 * Check if the Vibration API is available
 */
export const isHapticSupported = () => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

/**
 * Check if we're on iOS (for fallback handling)
 */
const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Predefined haptic patterns for different game events.
 *
 * Pattern format: number | number[]
 * - Single number: Vibrate for that many milliseconds
 * - Array: Alternates between vibrate/pause durations
 *   e.g., [100, 50, 100] = vibrate 100ms, pause 50ms, vibrate 100ms
 */
export const HapticPatterns = {
  // ============================================
  // MICRO-INTERACTIONS (Light, instant feedback)
  // ============================================

  /**
   * TAP: Standard button press
   * Sharp, single tick - like pressing a physical button
   */
  TAP: 10,

  /**
   * TICK: Increment/decrement, slider movement
   * Very light tick for continuous adjustments
   */
  TICK: 5,

  /**
   * TOGGLE: Switch or checkbox change
   * Slightly longer than TAP for state change emphasis
   */
  TOGGLE: 15,

  // ============================================
  // ACTION FEEDBACK (Confirming user actions)
  // ============================================

  /**
   * SUCCESS: Bet placed, action confirmed
   * Two quick pulses - "got it!"
   */
  SUCCESS: [20, 30, 20],

  /**
   * CANCEL: Action cancelled, drawer closed
   * Single slightly longer pulse
   */
  CANCEL: 25,

  /**
   * ERROR: Invalid action attempted
   * Three rapid pulses - "nope!"
   */
  ERROR: [50, 30, 50, 30, 50],

  // ============================================
  // GAME EVENTS (Significant moments)
  // ============================================

  /**
   * MY_TURN: Player's turn to act
   * Strong, attention-grabbing double pulse
   * This is THE most important haptic - must be noticeable
   */
  MY_TURN: [100, 80, 150],

  /**
   * CARD_DEAL: Cards being dealt to player
   * Quick sequence simulating cards hitting felt
   */
  CARD_DEAL: [15, 40, 15, 40, 15, 40, 15, 40, 15],

  /**
   * CARD_FLIP: Community card revealed
   * Single medium pulse for reveal moment
   */
  CARD_FLIP: 40,

  /**
   * POT_WON: Player wins the pot
   * Celebratory sequence - builds excitement
   */
  POT_WON: [50, 30, 50, 30, 100, 50, 150],

  /**
   * POT_LOST: Player loses the pot
   * Single heavy thud
   */
  POT_LOST: 80,

  /**
   * ALL_IN: All-in moment (player or opponent)
   * Dramatic, attention-grabbing pattern
   */
  ALL_IN: [80, 50, 80, 50, 150],

  /**
   * TIMER_WARNING: Turn timer running low
   * Urgent pulsing to alert player
   */
  TIMER_WARNING: [30, 100, 30, 100, 30],

  // ============================================
  // CHIP MOVEMENTS
  // ============================================

  /**
   * CHIP_STACK: Chips being stacked/moved
   * Light sequence mimicking chip clicking
   */
  CHIP_STACK: [8, 20, 8, 20, 8],

  /**
   * BET_PLACED: Chips pushed to pot
   * Medium pulse for commitment
   */
  BET_PLACED: 35,
};

/**
 * Trigger haptic feedback with a specific pattern.
 *
 * @param {number | number[]} pattern - Vibration pattern from HapticPatterns or custom
 * @returns {boolean} - Whether the vibration was triggered successfully
 *
 * @example
 * // On button press
 * triggerHaptic(HapticPatterns.TAP);
 *
 * // On player's turn
 * triggerHaptic(HapticPatterns.MY_TURN);
 *
 * // Custom pattern
 * triggerHaptic([100, 50, 100, 50, 200]);
 */
export function triggerHaptic(pattern) {
  // Skip if haptics are disabled by user preference
  if (typeof window !== 'undefined' && window.localStorage) {
    const hapticsEnabled = localStorage.getItem('haptics-enabled');
    if (hapticsEnabled === 'false') {
      return false;
    }
  }

  // Use Vibration API if available
  if (isHapticSupported()) {
    try {
      return navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Haptic feedback failed:', e);
      return false;
    }
  }

  // For iOS, we could potentially use AudioContext for a "click" sound
  // as a fallback, but that requires user gesture and audio setup
  // For now, we gracefully degrade to no-op on iOS

  return false;
}

/**
 * Stop any ongoing vibration
 */
export function stopHaptic() {
  if (isHapticSupported()) {
    navigator.vibrate(0);
  }
}

/**
 * Create a custom haptic pattern
 *
 * @param {Object} options
 * @param {number} options.intensity - 1 (light) to 5 (heavy)
 * @param {number} options.count - Number of pulses
 * @param {number} options.gap - Gap between pulses in ms
 * @returns {number[]} - Vibration pattern array
 *
 * @example
 * const pattern = createHapticPattern({ intensity: 3, count: 3, gap: 50 });
 * triggerHaptic(pattern);
 */
export function createHapticPattern({ intensity = 3, count = 1, gap = 50 }) {
  // Map intensity (1-5) to duration (10-100ms)
  const duration = Math.min(100, Math.max(10, intensity * 20));

  if (count === 1) {
    return duration;
  }

  const pattern = [];
  for (let i = 0; i < count; i++) {
    pattern.push(duration);
    if (i < count - 1) {
      pattern.push(gap);
    }
  }

  return pattern;
}

/**
 * React hook for haptic feedback with automatic cleanup
 *
 * @returns {Object} - Haptic control functions
 *
 * @example
 * function MyComponent() {
 *   const haptic = useHaptic();
 *
 *   return (
 *     <button onClick={() => haptic.tap()}>
 *       Click me
 *     </button>
 *   );
 * }
 */
export function useHaptic() {
  return {
    tap: () => triggerHaptic(HapticPatterns.TAP),
    tick: () => triggerHaptic(HapticPatterns.TICK),
    toggle: () => triggerHaptic(HapticPatterns.TOGGLE),
    success: () => triggerHaptic(HapticPatterns.SUCCESS),
    cancel: () => triggerHaptic(HapticPatterns.CANCEL),
    error: () => triggerHaptic(HapticPatterns.ERROR),
    myTurn: () => triggerHaptic(HapticPatterns.MY_TURN),
    cardDeal: () => triggerHaptic(HapticPatterns.CARD_DEAL),
    cardFlip: () => triggerHaptic(HapticPatterns.CARD_FLIP),
    potWon: () => triggerHaptic(HapticPatterns.POT_WON),
    potLost: () => triggerHaptic(HapticPatterns.POT_LOST),
    allIn: () => triggerHaptic(HapticPatterns.ALL_IN),
    timerWarning: () => triggerHaptic(HapticPatterns.TIMER_WARNING),
    chipStack: () => triggerHaptic(HapticPatterns.CHIP_STACK),
    betPlaced: () => triggerHaptic(HapticPatterns.BET_PLACED),
    stop: stopHaptic,
    isSupported: isHapticSupported,
    custom: triggerHaptic,
  };
}

/**
 * Settings helper: Check if haptics are enabled
 */
export function getHapticsEnabled() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const setting = localStorage.getItem('haptics-enabled');
    // Default to true if not set
    return setting !== 'false';
  }
  return true;
}

/**
 * Settings helper: Toggle haptics on/off
 */
export function setHapticsEnabled(enabled) {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('haptics-enabled', String(enabled));
    // Provide feedback when enabling
    if (enabled) {
      triggerHaptic(HapticPatterns.SUCCESS);
    }
  }
}

export default {
  trigger: triggerHaptic,
  stop: stopHaptic,
  patterns: HapticPatterns,
  isSupported: isHapticSupported,
  useHaptic,
  createPattern: createHapticPattern,
  getEnabled: getHapticsEnabled,
  setEnabled: setHapticsEnabled,
};
