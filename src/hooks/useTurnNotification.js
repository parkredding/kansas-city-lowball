import { useEffect, useRef, useCallback } from 'react';

/**
 * Audio notification hook for turn-based games.
 * Uses Web Audio API to generate pleasant notification sounds.
 * 
 * Features:
 * - Plays a chime when it becomes the player's turn
 * - Only plays when document is not focused (player on different tab)
 * - Respects user's audio preferences
 * - Updates page title to indicate turn status
 */
export function useTurnNotification(isMyTurn, gamePhase, enabled = true) {
  const audioContextRef = useRef(null);
  const wasMyTurnRef = useRef(false);
  const originalTitleRef = useRef(document.title);

  /**
   * Create or get the AudioContext (lazy initialization)
   */
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Play a pleasant notification chime using Web Audio API
   * Creates a two-tone ascending arpeggio for a friendly alert
   */
  const playTurnSound = useCallback(() => {
    if (!enabled) return;

    try {
      const audioContext = getAudioContext();
      
      // Resume audio context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const now = audioContext.currentTime;

      // Create a pleasant two-note ascending chime
      // First note: G5 (784 Hz)
      // Second note: C6 (1047 Hz)
      const frequencies = [784, 1047];
      const noteDuration = 0.15;
      const noteGap = 0.1;

      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Use a soft sine wave for a pleasant tone
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now);

        const noteStart = now + index * (noteDuration + noteGap);
        const noteEnd = noteStart + noteDuration;

        // Envelope: quick attack, short sustain, smooth decay
        gainNode.gain.setValueAtTime(0, noteStart);
        gainNode.gain.linearRampToValueAtTime(0.3, noteStart + 0.02); // Attack
        gainNode.gain.setValueAtTime(0.3, noteStart + 0.05); // Sustain
        gainNode.gain.exponentialRampToValueAtTime(0.01, noteEnd); // Decay

        oscillator.start(noteStart);
        oscillator.stop(noteEnd + 0.1);
      });

      // Add a subtle harmonic for richness
      const harmonic = audioContext.createOscillator();
      const harmonicGain = audioContext.createGain();
      
      harmonic.connect(harmonicGain);
      harmonicGain.connect(audioContext.destination);
      
      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(1568, now); // G6 - octave above first note
      
      harmonicGain.gain.setValueAtTime(0, now);
      harmonicGain.gain.linearRampToValueAtTime(0.1, now + 0.02);
      harmonicGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      
      harmonic.start(now);
      harmonic.stop(now + 0.5);

    } catch (error) {
      console.warn('Could not play turn notification sound:', error);
    }
  }, [enabled, getAudioContext]);

  /**
   * Update page title to indicate turn status
   */
  const updateTitle = useCallback((myTurn) => {
    if (myTurn) {
      document.title = '🎯 Your Turn! - Kansas City Lowball';
    } else {
      document.title = originalTitleRef.current;
    }
  }, []);

  /**
   * Effect: Detect turn changes and play notification
   */
  useEffect(() => {
    // Only trigger when transitioning from not-my-turn to my-turn
    // and we're in an active game phase (not IDLE or SHOWDOWN)
    const isActivePhase = gamePhase && 
      gamePhase !== 'IDLE' && 
      gamePhase !== 'SHOWDOWN';

    if (isMyTurn && !wasMyTurnRef.current && isActivePhase) {
      // Play sound when it becomes the player's turn
      playTurnSound();
      
      // Always update title when it becomes player's turn
      updateTitle(true);
    } else if (!isMyTurn && wasMyTurnRef.current) {
      // Reset title when it's no longer our turn
      updateTitle(false);
    }

    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn, gamePhase, playTurnSound, updateTitle]);

  /**
   * Effect: Reset title when component unmounts or game ends
   */
  useEffect(() => {
    return () => {
      document.title = originalTitleRef.current;
    };
  }, []);

  /**
   * Effect: Handle visibility change to update title appropriately
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isMyTurn) {
        // When user returns to tab and it's their turn, play a reminder sound
        playTurnSound();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isMyTurn, playTurnSound]);

  // Expose play function for manual triggering if needed
  return {
    playTurnSound,
  };
}

/**
 * Standalone function to play a generic notification sound
 * Can be used for other game events (win, card dealt, etc.)
 */
export function playNotificationSound(type = 'turn') {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;

    if (type === 'turn') {
      // Pleasant ascending chime
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(784, now);
      oscillator.frequency.linearRampToValueAtTime(1047, now + 0.15);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      oscillator.start(now);
      oscillator.stop(now + 0.4);
    } else if (type === 'win') {
      // Triumphant ascending major chord fanfare
      const frequencies = [523, 659, 784, 1047]; // C5, E5, G5, C6 (C major)
      frequencies.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const start = now + index * 0.1;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);

        osc.start(start);
        osc.stop(start + 0.5);
      });

      // Add a sparkle overtone
      const sparkle = audioContext.createOscillator();
      const sparkleGain = audioContext.createGain();
      sparkle.connect(sparkleGain);
      sparkleGain.connect(audioContext.destination);
      sparkle.type = 'sine';
      sparkle.frequency.setValueAtTime(2093, now + 0.3); // C7
      sparkleGain.gain.setValueAtTime(0, now + 0.3);
      sparkleGain.gain.linearRampToValueAtTime(0.15, now + 0.32);
      sparkleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      sparkle.start(now + 0.3);
      sparkle.stop(now + 0.7);

    } else if (type === 'lose') {
      // Descending minor tone - sympathetic but not harsh
      const frequencies = [392, 349, 311]; // G4, F4, Eb4 (descending minor)
      frequencies.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const start = now + index * 0.15;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.35);

        osc.start(start);
        osc.stop(start + 0.45);
      });

    } else if (type === 'deal') {
      // Card dealing sound - multiple quick swooshes
      for (let i = 0; i < 5; i++) {
        const noise = audioContext.createOscillator();
        const noiseGain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioContext.destination);

        // Use triangle wave with frequency sweep for "swoosh"
        noise.type = 'triangle';
        const cardStart = now + i * 0.08;
        noise.frequency.setValueAtTime(800, cardStart);
        noise.frequency.exponentialRampToValueAtTime(200, cardStart + 0.06);

        // Bandpass filter for more natural sound
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, cardStart);
        filter.Q.setValueAtTime(1, cardStart);

        noiseGain.gain.setValueAtTime(0, cardStart);
        noiseGain.gain.linearRampToValueAtTime(0.12, cardStart + 0.01);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, cardStart + 0.06);

        noise.start(cardStart);
        noise.stop(cardStart + 0.08);
      }

      // Add a subtle "thud" at the end
      const thud = audioContext.createOscillator();
      const thudGain = audioContext.createGain();
      thud.connect(thudGain);
      thudGain.connect(audioContext.destination);
      thud.type = 'sine';
      thud.frequency.setValueAtTime(100, now + 0.4);
      thud.frequency.exponentialRampToValueAtTime(60, now + 0.5);
      thudGain.gain.setValueAtTime(0.15, now + 0.4);
      thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      thud.start(now + 0.4);
      thud.stop(now + 0.6);

    } else if (type === 'fold') {
      // Soft dismissive sound
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.start(now);
      osc.stop(now + 0.2);

    } else if (type === 'chips') {
      // Chip clinking sound
      for (let i = 0; i < 3; i++) {
        const clink = audioContext.createOscillator();
        const clinkGain = audioContext.createGain();

        clink.connect(clinkGain);
        clinkGain.connect(audioContext.destination);

        clink.type = 'sine';
        const clinkStart = now + i * 0.05;
        // Slightly randomized frequencies for natural sound
        clink.frequency.setValueAtTime(2000 + (i * 200), clinkStart);

        clinkGain.gain.setValueAtTime(0, clinkStart);
        clinkGain.gain.linearRampToValueAtTime(0.08, clinkStart + 0.005);
        clinkGain.gain.exponentialRampToValueAtTime(0.01, clinkStart + 0.08);

        clink.start(clinkStart);
        clink.stop(clinkStart + 0.1);
      }
    }
  } catch (error) {
    console.warn('Could not play notification sound:', error);
  }
}

export default useTurnNotification;
