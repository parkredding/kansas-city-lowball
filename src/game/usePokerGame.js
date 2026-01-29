import { useState, useCallback } from 'react';
import { Deck } from './Deck';
import { HandEvaluator } from './HandEvaluator';

export function usePokerGame() {
  const [playerHand, setPlayerHand] = useState([]);
  const [handResult, setHandResult] = useState(null);
  const [deck, setDeck] = useState(null);

  const startNewHand = useCallback(() => {
    const newDeck = new Deck();
    newDeck.shuffle();

    const hand = newDeck.deal(5);
    const result = HandEvaluator.evaluate(hand);

    setDeck(newDeck);
    setPlayerHand(hand);
    setHandResult(result);
  }, []);

  return {
    playerHand,
    handResult,
    deck,
    startNewHand,
  };
}
