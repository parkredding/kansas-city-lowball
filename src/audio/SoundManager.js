/**
 * SoundManager - Web Audio API synthesized sound effects
 *
 * Creates all sounds programmatically without external audio files.
 * Uses AudioContext for real-time audio synthesis.
 */

// Singleton AudioContext for reuse across all sound functions
let sharedAudioContext = null;
let isMuted = false;
let masterVolume = 0.5;

/**
 * Get or create the shared AudioContext
 * @returns {AudioContext} The shared audio context
 */
function getAudioContext() {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

/**
 * Create a gain node connected to destination with master volume
 * @param {AudioContext} ctx
 * @returns {GainNode}
 */
function createMasterGain(ctx) {
  const gain = ctx.createGain();
  gain.gain.value = isMuted ? 0 : masterVolume;
  gain.connect(ctx.destination);
  return gain;
}

/**
 * Create white noise buffer for whoosh effects
 * @param {AudioContext} ctx
 * @param {number} duration - Duration in seconds
 * @returns {AudioBuffer}
 */
function createWhiteNoiseBuffer(ctx, duration) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

/**
 * SoundManager singleton for managing all game sounds
 */
export const SoundManager = {
  /**
   * Set mute state
   * @param {boolean} muted
   */
  setMuted(muted) {
    isMuted = muted;
  },

  /**
   * Get mute state
   * @returns {boolean}
   */
  isMuted() {
    return isMuted;
  },

  /**
   * Set master volume (0-1)
   * @param {number} volume
   */
  setVolume(volume) {
    masterVolume = Math.max(0, Math.min(1, volume));
  },

  /**
   * Get master volume
   * @returns {number}
   */
  getVolume() {
    return masterVolume;
  },

  /**
   * Initialize audio context (call on user interaction)
   */
  init() {
    getAudioContext();
  },

  /**
   * Play a "whoosh" sound for card discards
   * Creates a burst of white noise through a sweeping low-pass filter
   * Simulates the sound of cards being rapidly thrown
   */
  playWhoosh() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const duration = 0.3;

      // Create white noise source
      const noiseBuffer = createWhiteNoiseBuffer(ctx, duration);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      // Low-pass filter that sweeps from high to low frequency
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4000, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + duration);
      filter.Q.setValueAtTime(1.5, now);

      // High-pass to remove rumble
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(100, now);

      // Envelope
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25 * masterVolume, now + 0.02);
      gainNode.gain.setValueAtTime(0.25 * masterVolume, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Connect: noise -> highpass -> lowpass -> gain -> destination
      noiseSource.connect(highpass);
      highpass.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + duration + 0.1);

      // Add a subtle "thwip" for impact
      const thwip = ctx.createOscillator();
      const thwipGain = ctx.createGain();
      thwip.type = 'sine';
      thwip.frequency.setValueAtTime(800, now);
      thwip.frequency.exponentialRampToValueAtTime(150, now + 0.08);
      thwipGain.gain.setValueAtTime(0.1 * masterVolume, now);
      thwipGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      thwip.connect(thwipGain);
      thwipGain.connect(ctx.destination);
      thwip.start(now);
      thwip.stop(now + 0.15);
    } catch (error) {
      console.warn('SoundManager: Could not play whoosh sound:', error);
    }
  },

  /**
   * Play a "chip clack" sound for betting
   * Short, high-pitched sine/triangle wave burst with quick decay
   */
  playChipClack() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Create multiple quick clinks for realistic chip sound
      const frequencies = [2200, 2600, 2400];
      const delays = [0, 0.03, 0.06];

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Mix of sine and triangle for metallic quality
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + delays[i]);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + delays[i] + 0.04);

        // Very quick attack and decay
        const startTime = now + delays[i];
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.12 * masterVolume, startTime + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.1);
      });

      // Add a subtle low thud for the "weight" of chips
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(180, now);
      thud.frequency.exponentialRampToValueAtTime(80, now + 0.05);
      thudGain.gain.setValueAtTime(0.08 * masterVolume, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      thud.connect(thudGain);
      thudGain.connect(ctx.destination);
      thud.start(now);
      thud.stop(now + 0.12);
    } catch (error) {
      console.warn('SoundManager: Could not play chip clack sound:', error);
    }
  },

  /**
   * Play a "check" (knock) sound
   * Low-frequency impulse simulating a wooden knock
   */
  playCheck() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Main knock - low frequency thump
      const knock = ctx.createOscillator();
      const knockGain = ctx.createGain();
      knock.type = 'sine';
      knock.frequency.setValueAtTime(150, now);
      knock.frequency.exponentialRampToValueAtTime(60, now + 0.08);

      knockGain.gain.setValueAtTime(0, now);
      knockGain.gain.linearRampToValueAtTime(0.3 * masterVolume, now + 0.005);
      knockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      knock.connect(knockGain);
      knockGain.connect(ctx.destination);

      knock.start(now);
      knock.stop(now + 0.2);

      // Add a higher "click" for the attack
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(500, now);
      click.frequency.exponentialRampToValueAtTime(200, now + 0.02);

      clickGain.gain.setValueAtTime(0.15 * masterVolume, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      click.connect(clickGain);
      clickGain.connect(ctx.destination);

      click.start(now);
      click.stop(now + 0.08);

      // Noise burst for wood texture
      const noiseBuffer = createWhiteNoiseBuffer(ctx, 0.05);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(400, now);
      noiseFilter.Q.setValueAtTime(2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08 * masterVolume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.06);
    } catch (error) {
      console.warn('SoundManager: Could not play check sound:', error);
    }
  },

  /**
   * Play a card deal sound
   * Quick swooshing sounds for cards being dealt
   * @param {number} cardCount - Number of cards (affects duration)
   */
  playDeal(cardCount = 5) {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const cardsToPlay = Math.min(cardCount, 5);

      for (let i = 0; i < cardsToPlay; i++) {
        const cardStart = now + i * 0.08;

        // Swoosh sound using oscillator sweep
        const swoosh = ctx.createOscillator();
        const swooshGain = ctx.createGain();
        swoosh.type = 'triangle';
        swoosh.frequency.setValueAtTime(800, cardStart);
        swoosh.frequency.exponentialRampToValueAtTime(200, cardStart + 0.05);

        swooshGain.gain.setValueAtTime(0, cardStart);
        swooshGain.gain.linearRampToValueAtTime(0.08 * masterVolume, cardStart + 0.01);
        swooshGain.gain.exponentialRampToValueAtTime(0.001, cardStart + 0.06);

        swoosh.connect(swooshGain);
        swooshGain.connect(ctx.destination);

        swoosh.start(cardStart);
        swoosh.stop(cardStart + 0.08);

        // Subtle noise for card texture
        const noiseBuffer = createWhiteNoiseBuffer(ctx, 0.04);
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, cardStart);
        filter.Q.setValueAtTime(1, cardStart);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.04 * masterVolume, cardStart);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, cardStart + 0.04);

        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        noiseSource.start(cardStart);
        noiseSource.stop(cardStart + 0.06);
      }

      // Final subtle thud when cards land
      const thudTime = now + cardsToPlay * 0.08;
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(100, thudTime);
      thud.frequency.exponentialRampToValueAtTime(50, thudTime + 0.1);
      thudGain.gain.setValueAtTime(0.1 * masterVolume, thudTime);
      thudGain.gain.exponentialRampToValueAtTime(0.001, thudTime + 0.15);
      thud.connect(thudGain);
      thudGain.connect(ctx.destination);
      thud.start(thudTime);
      thud.stop(thudTime + 0.2);
    } catch (error) {
      console.warn('SoundManager: Could not play deal sound:', error);
    }
  },

  /**
   * Play fold sound - soft dismissive descending tone
   */
  playFold() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);

      gain.gain.setValueAtTime(0.12 * masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (error) {
      console.warn('SoundManager: Could not play fold sound:', error);
    }
  },

  /**
   * Play win fanfare - triumphant ascending major chord
   */
  playWin() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // C major arpeggio: C5, E5, G5, C6
      const frequencies = [523, 659, 784, 1047];

      frequencies.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const start = now + index * 0.1;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2 * masterVolume, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.5);
      });

      // Sparkle overtone
      const sparkle = ctx.createOscillator();
      const sparkleGain = ctx.createGain();
      sparkle.type = 'sine';
      sparkle.frequency.setValueAtTime(2093, now + 0.3);
      sparkleGain.gain.setValueAtTime(0, now + 0.3);
      sparkleGain.gain.linearRampToValueAtTime(0.12 * masterVolume, now + 0.32);
      sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      sparkle.connect(sparkleGain);
      sparkleGain.connect(ctx.destination);
      sparkle.start(now + 0.3);
      sparkle.stop(now + 0.7);
    } catch (error) {
      console.warn('SoundManager: Could not play win sound:', error);
    }
  },

  /**
   * Play lose sound - descending minor tones (sympathetic, not harsh)
   */
  playLose() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Descending minor: G4, F4, Eb4
      const frequencies = [392, 349, 311];

      frequencies.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const start = now + index * 0.15;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15 * masterVolume, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch (error) {
      console.warn('SoundManager: Could not play lose sound:', error);
    }
  },

  /**
   * Play turn notification chime - ascending two-note alert
   */
  playTurnAlert() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // G5 to C6 ascending
      const frequencies = [784, 1047];
      const noteDuration = 0.15;
      const noteGap = 0.1;

      frequencies.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const noteStart = now + index * (noteDuration + noteGap);
        const noteEnd = noteStart + noteDuration;

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.25 * masterVolume, noteStart + 0.02);
        gain.gain.setValueAtTime(0.25 * masterVolume, noteStart + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteEnd + 0.1);
      });

      // Harmonic overtone for richness
      const harmonic = ctx.createOscillator();
      const harmonicGain = ctx.createGain();
      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(1568, now); // G6
      harmonicGain.gain.setValueAtTime(0, now);
      harmonicGain.gain.linearRampToValueAtTime(0.08 * masterVolume, now + 0.02);
      harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      harmonic.connect(harmonicGain);
      harmonicGain.connect(ctx.destination);
      harmonic.start(now);
      harmonic.stop(now + 0.5);
    } catch (error) {
      console.warn('SoundManager: Could not play turn alert sound:', error);
    }
  },

  /**
   * Play card flip sound - quick snap
   */
  playCardFlip() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Create a short noise burst filtered to sound like card paper
      const noiseBuffer = createWhiteNoiseBuffer(ctx, 0.05);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3000, now);
      filter.Q.setValueAtTime(2, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15 * masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.06);
    } catch (error) {
      console.warn('SoundManager: Could not play card flip sound:', error);
    }
  },

  /**
   * Play chips gathering to pot sound
   * Multiple overlapping chip clinks moving toward center
   */
  playChipsGather() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const duration = 0.4;

      // Multiple staggered chip sounds
      for (let i = 0; i < 6; i++) {
        const startTime = now + i * 0.05;
        const freq = 2000 + Math.random() * 800;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, startTime + 0.04);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.06 * masterVolume, startTime + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.08);
      }

      // Final satisfying clunk
      const clunkTime = now + 0.35;
      const clunk = ctx.createOscillator();
      const clunkGain = ctx.createGain();
      clunk.type = 'sine';
      clunk.frequency.setValueAtTime(250, clunkTime);
      clunk.frequency.exponentialRampToValueAtTime(100, clunkTime + 0.06);
      clunkGain.gain.setValueAtTime(0.12 * masterVolume, clunkTime);
      clunkGain.gain.exponentialRampToValueAtTime(0.001, clunkTime + 0.1);
      clunk.connect(clunkGain);
      clunkGain.connect(ctx.destination);
      clunk.start(clunkTime);
      clunk.stop(clunkTime + 0.15);
    } catch (error) {
      console.warn('SoundManager: Could not play chips gather sound:', error);
    }
  },

  /**
   * Play dealer cut sound - card pack splitting
   */
  playCutForDealer() {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Initial snap
      const snap = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snap.type = 'triangle';
      snap.frequency.setValueAtTime(1200, now);
      snap.frequency.exponentialRampToValueAtTime(400, now + 0.03);
      snapGain.gain.setValueAtTime(0.15 * masterVolume, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      snap.connect(snapGain);
      snapGain.connect(ctx.destination);
      snap.start(now);
      snap.stop(now + 0.08);

      // Noise for card ruffle texture
      const noiseBuffer = createWhiteNoiseBuffer(ctx, 0.15);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2500, now);
      filter.Q.setValueAtTime(1.5, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.08 * masterVolume, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.2);
    } catch (error) {
      console.warn('SoundManager: Could not play cut for dealer sound:', error);
    }
  },
};

export default SoundManager;
