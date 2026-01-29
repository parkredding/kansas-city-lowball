import { useState, useCallback } from 'react';
import { Deck } from './Deck';
import { HandEvaluator } from './HandEvaluator';

// Game phases for Triple Draw
export const PHASES = {
  IDLE: 'IDLE',
  BETTING_1: 'BETTING_1',
  DRAW_1: 'DRAW_1',
  BETTING_2: 'BETTING_2',
  DRAW_2: 'DRAW_2',
  BETTING_3: 'BETTING_3',
  DRAW_3: 'DRAW_3',
  BETTING_4: 'BETTING_4',
  SHOWDOWN: 'SHOWDOWN',
};

// Phase transitions
const PHASE_AFTER_BET = {
  [PHASES.BETTING_1]: PHASES.DRAW_1,
  [PHASES.BETTING_2]: PHASES.DRAW_2,
  [PHASES.BETTING_3]: PHASES.DRAW_3,
  [PHASES.BETTING_4]: PHASES.SHOWDOWN,
};

const PHASE_AFTER_DRAW = {
  [PHASES.DRAW_1]: PHASES.BETTING_2,
  [PHASES.DRAW_2]: PHASES.BETTING_3,
  [PHASES.DRAW_3]: PHASES.BETTING_4,
};

// Human-readable phase names
export const PHASE_DISPLAY_NAMES = {
  [PHASES.IDLE]: 'Waiting to Start',
  [PHASES.BETTING_1]: 'First Betting Round',
  [PHASES.DRAW_1]: 'First Draw',
  [PHASES.BETTING_2]: 'Second Betting Round',
  [PHASES.DRAW_2]: 'Second Draw',
  [PHASES.BETTING_3]: 'Third Betting Round',
  [PHASES.DRAW_3]: 'Third Draw',
  [PHASES.BETTING_4]: 'Final Betting Round',
  [PHASES.SHOWDOWN]: 'Showdown',
};

const STARTING_CHIPS = 1000;
const ANTE_AMOUNT = 10;

export function usePokerGame() {
  const [playerHand, setPlayerHand] = useState([]);
  const [handResult, setHandResult] = useState(null);
  const [deck, setDeck] = useState(null);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [selectedCardIndices, setSelectedCardIndices] = useState(new Set());
  const [pot, setPot] = useState(0);
  const [playerChips, setPlayerChips] = useState(STARTING_CHIPS);

  // Check if we're in a betting phase
  const isBettingPhase = phase.startsWith('BETTING_');

  // Check if we're in a draw phase
  const isDrawPhase = phase.startsWith('DRAW_');

  // Toggle card selection (for draw phases)
  const toggleCardSelection = useCallback((index) => {
    if (!isDrawPhase) return;

    setSelectedCardIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, [isDrawPhase]);

  // Start a new game - resets everything and deals initial hand
  const startNewGame = useCallback(() => {
    const newDeck = new Deck();
    newDeck.shuffle();

    const hand = newDeck.deal(5);

    setDeck(newDeck);
    setPlayerHand(hand);
    setHandResult(null);
    setSelectedCardIndices(new Set());

    // Collect ante
    setPlayerChips(prev => prev - ANTE_AMOUNT);
    setPot(ANTE_AMOUNT);

    setPhase(PHASES.BETTING_1);
  }, []);

  // Submit draw - discard selected cards and draw replacements
  const submitDraw = useCallback(() => {
    if (!isDrawPhase || !deck) return;

    const indicesToDiscard = Array.from(selectedCardIndices).sort((a, b) => b - a);
    const numToDraw = indicesToDiscard.length;

    // Create new hand with selected cards removed
    const newHand = [...playerHand];
    for (const index of indicesToDiscard) {
      newHand.splice(index, 1);
    }

    // Deal replacement cards
    if (numToDraw > 0) {
      const newCards = deck.deal(numToDraw);
      newHand.push(...newCards);
    }

    setPlayerHand(newHand);
    setSelectedCardIndices(new Set());
    setDeck(deck); // Update deck reference

    // Advance to next betting phase
    const nextPhase = PHASE_AFTER_DRAW[phase];
    setPhase(nextPhase);
  }, [isDrawPhase, deck, selectedCardIndices, playerHand, phase]);

  // Submit bet - for this milestone, just a simple check/call that advances the phase
  const submitBet = useCallback((amount = 0) => {
    if (!isBettingPhase) return;

    // Move chips from player to pot
    if (amount > 0) {
      setPlayerChips(prev => prev - amount);
      setPot(prev => prev + amount);
    }

    // Advance to next phase
    const nextPhase = PHASE_AFTER_BET[phase];
    setPhase(nextPhase);

    // If we're going to showdown, evaluate the hand
    if (nextPhase === PHASES.SHOWDOWN) {
      const result = HandEvaluator.evaluate(playerHand);
      setHandResult(result);
    }
  }, [isBettingPhase, phase, playerHand]);

  // Start next hand (from showdown) - awards pot and starts fresh
  const startNextHand = useCallback(() => {
    if (phase !== PHASES.SHOWDOWN) return;

    // Award pot to player (in single player, they always "win")
    setPlayerChips(prev => prev + pot);
    setPot(0);

    // Start a fresh game
    startNewGame();
  }, [phase, pot, startNewGame]);

  // Legacy function for backward compatibility
  const startNewHand = startNewGame;

  return {
    // State
    playerHand,
    handResult,
    deck,
    phase,
    selectedCardIndices,
    pot,
    playerChips,

    // Derived state
    isBettingPhase,
    isDrawPhase,

    // Actions
    startNewGame,
    startNewHand, // Legacy alias
    submitDraw,
    submitBet,
    startNextHand,
    toggleCardSelection,
  };
}
