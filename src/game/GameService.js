import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  runTransaction,
  Timestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { Deck } from './Deck';
import { HandEvaluator } from './HandEvaluator';
import { TexasHoldemHandEvaluator } from './TexasHoldemHandEvaluator';
import {
  MAX_PLAYERS,
  CARDS_PER_HAND,
  DEFAULT_STARTING_BALANCE,
  DEFAULT_MIN_BET,
  TURN_TIME_SECONDS,
  RANK_VALUES,
  SUIT_VALUES,
  HOLDEM_HOLE_CARDS,
  GAME_TYPES,
} from './constants';

const TABLES_COLLECTION = 'tables';
const USERS_COLLECTION = 'users';

/**
 * Betting action types
 */
export const BetAction = {
  FOLD: 'FOLD',
  CHECK: 'CHECK',
  CALL: 'CALL',
  RAISE: 'RAISE',
  BET: 'BET',
  ALL_IN: 'ALL_IN',
};

/**
 * Calculate side pots based on player contributions.
 *
 * This handles the case where players go all-in for different amounts.
 *
 * Example: Player A goes all-in for 100, Player B bets 500, Player C calls 500
 * Result:
 *   - Main Pot: 300 (100 from each), eligible: [A, B, C]
 *   - Side Pot: 800 (400 from B + 400 from C), eligible: [B, C]
 *
 * @param {Array} players - Array of player objects with uid, totalContribution, status
 * @returns {Array} - Array of pot objects: { amount, eligiblePlayers: [uid, ...] }
 */
export function calculateSidePots(players) {
  // Filter to players who are still in the hand (not folded)
  const eligiblePlayers = players.filter(
    p => p.status === 'active' || p.status === 'all-in'
  );

  if (eligiblePlayers.length === 0) {
    return [];
  }

  // Get all unique contribution levels from players who contributed
  const contributions = eligiblePlayers
    .map(p => p.totalContribution || 0)
    .filter(c => c > 0);

  // Get unique contribution levels sorted ascending
  const uniqueContributions = [...new Set(contributions)].sort((a, b) => a - b);

  if (uniqueContributions.length === 0) {
    return [];
  }

  const pots = [];
  let previousLevel = 0;

  for (const contributionLevel of uniqueContributions) {
    const levelDiff = contributionLevel - previousLevel;

    if (levelDiff > 0) {
      // Find all players who contributed at least this much
      const playersAtThisLevel = eligiblePlayers.filter(
        p => (p.totalContribution || 0) >= contributionLevel
      );

      // The pot amount is (level difference) * (number of players who contributed at least this much)
      const potAmount = levelDiff * playersAtThisLevel.length;

      if (potAmount > 0) {
        pots.push({
          amount: potAmount,
          eligiblePlayers: playersAtThisLevel.map(p => p.uid),
        });
      }
    }

    previousLevel = contributionLevel;
  }

  return pots;
}

/**
 * Get total pot amount from pots array
 * @param {Array} pots - Array of pot objects
 * @returns {number} - Total pot amount
 */
export function getTotalPotAmount(pots) {
  if (!Array.isArray(pots)) return 0;
  return pots.reduce((sum, pot) => sum + (pot.amount || 0), 0);
}

/**
 * Distribute winnings from pots to winners.
 * Each pot is awarded to the best hand among eligible players.
 *
 * @param {Array} pots - Array of pot objects
 * @param {Array} players - Array of player objects with uid, hand
 * @param {Function} evaluateHand - Function to evaluate hand strength
 * @returns {Object} - { winners: [{uid, amount, potIndex}], updatedPlayers: [...] }
 */
export function distributePots(pots, players, evaluateHand) {
  const updatedPlayers = players.map(p => ({ ...p }));
  const winners = [];

  for (let potIndex = 0; potIndex < pots.length; potIndex++) {
    const pot = pots[potIndex];
    const eligibleUids = pot.eligiblePlayers;

    // Find eligible players with hands (not folded)
    const contenders = updatedPlayers.filter(
      p => eligibleUids.includes(p.uid) &&
           (p.status === 'active' || p.status === 'all-in') &&
           p.hand && p.hand.length > 0
    );

    if (contenders.length === 0) continue;

    // Evaluate each contender's hand
    const evaluatedContenders = contenders.map(p => ({
      player: p,
      handResult: evaluateHand(p.hand),
    }));

    // Find the best hand (lowest in lowball)
    // Sort by hand score ascending (lower is better in 2-7 lowball)
    // Note: score is a string, so we use string comparison
    evaluatedContenders.sort((a, b) => {
      if (a.handResult.score < b.handResult.score) return -1;
      if (a.handResult.score > b.handResult.score) return 1;
      return 0;
    });

    // Get all players tied for best hand
    const bestScore = evaluatedContenders[0].handResult.score;
    const potWinners = evaluatedContenders.filter(
      c => c.handResult.score === bestScore
    );

    // Split pot among winners
    const sharePerWinner = Math.floor(pot.amount / potWinners.length);
    const remainder = pot.amount % potWinners.length;

    potWinners.forEach((winner, idx) => {
      const winAmount = sharePerWinner + (idx === 0 ? remainder : 0);
      const playerIdx = updatedPlayers.findIndex(p => p.uid === winner.player.uid);
      if (playerIdx !== -1) {
        updatedPlayers[playerIdx].chips += winAmount;
        winners.push({
          uid: winner.player.uid,
          displayName: winner.player.displayName,
          amount: winAmount,
          potIndex,
          handResult: winner.handResult,
        });
      }
    });
  }

  return { winners, updatedPlayers };
}

/**
 * Calculate showdown result - who wins with what hand
 * Supports both Lowball (lower is better) and Hold'em (higher is better)
 * @param {Array} players - Array of player objects
 * @param {number} pot - Total pot amount
 * @param {string} gameType - Game type ('lowball_27' or 'holdem')
 * @param {Array} communityCards - Community cards for Hold'em (optional)
 * @returns {Object} - { winners: [{uid, displayName, amount, handDescription}], message }
 */
export function calculateShowdownResult(players, pot, gameType = 'lowball_27', communityCards = []) {
  const isHoldem = gameType === 'holdem';

  // Find players still in the hand with hands
  const minHandSize = isHoldem ? 2 : 5;
  const contenders = players.filter(
    p => (p.status === 'active' || p.status === 'all-in') &&
         p.hand && p.hand.length >= minHandSize
  );

  // Count how many players folded (to determine if win is contested)
  const foldedCount = players.filter(p => p.status === 'folded').length;
  const isContested = contenders.length > 1;

  if (contenders.length === 0) {
    return { winners: [], message: 'No showdown', isContested: false };
  }

  // For uncontested wins (everyone else folded), winner doesn't need to show
  if (contenders.length === 1) {
    const winner = contenders[0];
    return {
      winners: [{
        uid: winner.uid,
        displayName: winner.displayName,
        amount: pot,
        handDescription: null, // Don't reveal hand description for uncontested
        handResult: null,
      }],
      message: `${winner.displayName} wins $${pot} (others folded)`,
      allHands: [], // No hands shown for uncontested win
      isContested: false,
    };
  }

  // Evaluate each contender's hand
  const evaluated = contenders.map(p => {
    let result;
    if (isHoldem) {
      // For Hold'em, combine hole cards with community cards
      const allCards = [...p.hand, ...communityCards];
      result = TexasHoldemHandEvaluator.evaluate(allCards);
      return {
        uid: p.uid,
        displayName: p.displayName,
        handResult: result,
        handDescription: TexasHoldemHandEvaluator.getHandDescription(result),
      };
    } else {
      // For Lowball, evaluate 5-card hand directly
      result = HandEvaluator.evaluate(p.hand);
      return {
        uid: p.uid,
        displayName: p.displayName,
        handResult: result,
        handDescription: HandEvaluator.getHandDescription(result),
      };
    }
  });

  // Sort by hand value
  // In Lowball: lower score is better
  // In Hold'em: higher score is better
  if (isHoldem) {
    evaluated.sort((a, b) => {
      if (a.handResult.score > b.handResult.score) return -1;
      if (a.handResult.score < b.handResult.score) return 1;
      return 0;
    });
  } else {
    evaluated.sort((a, b) => {
      if (a.handResult.score < b.handResult.score) return -1;
      if (a.handResult.score > b.handResult.score) return 1;
      return 0;
    });
  }

  // Find all players tied for best hand
  const bestScore = evaluated[0].handResult.score;
  const winners = evaluated.filter(e => e.handResult.score === bestScore);
  const losers = evaluated.filter(e => e.handResult.score !== bestScore);

  // Calculate winnings
  const sharePerWinner = Math.floor(pot / winners.length);
  const remainder = pot % winners.length;

  const winnersWithAmounts = winners.map((w, idx) => ({
    uid: w.uid,
    displayName: w.displayName,
    amount: sharePerWinner + (idx === 0 ? remainder : 0),
    handDescription: w.handDescription,
    handResult: w.handResult,
  }));

  // Generate message
  let message;
  if (winners.length === 1) {
    message = `${winners[0].displayName} wins $${pot} with ${winners[0].handDescription}`;
  } else {
    const names = winners.map(w => w.displayName).join(' and ');
    message = `${names} split $${pot} with ${winners[0].handDescription}`;
  }

  return {
    winners: winnersWithAmounts,
    losers: losers, // Include losers for show/muck UI
    message,
    allHands: evaluated, // Include all hands for display
    isContested: true, // Showdown with multiple contenders
  };
}

/**
 * GameService - Handles all Firestore operations for multiplayer poker tables
 */
export class GameService {
  /**
   * Generate a random table ID
   */
  static generateTableId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create a new shuffled deck as an array of card objects
   */
  static createShuffledDeck() {
    const deck = new Deck();
    deck.shuffle();
    return deck.cards;
  }

  /**
   * Generate a unique bot UID
   */
  static generateBotUid() {
    return `bot_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate a bot display name
   */
  static generateBotName(index) {
    const names = [
      'Ace', 'Bluff', 'Chip', 'Dealer', 'Edge', 'Flush', 'Gambit', 'Hustler',
      'Ivy', 'Jack', 'King', 'Lucky', 'Maverick', 'Nova', 'Omega', 'Poker',
      'Queen', 'River', 'Shark', 'Titan', 'Uncle', 'Vegas', 'Wild', 'X-Ray',
      'Yankee', 'Zorro'
    ];
    return names[index % names.length] + Math.floor(Math.random() * 100);
  }

  /**
   * Create a bot player object
   */
  static createBotPlayer(botDifficulty = 'medium', index = 0, initialChips = 1000) {
    return {
      uid: GameService.generateBotUid(),
      displayName: GameService.generateBotName(index),
      photoURL: null,
      chips: initialChips, // Bots start with chips to allow immediate gameplay
      hand: [],
      status: 'active',
      cardsToDiscard: [],
      currentRoundBet: 0,
      totalContribution: 0,
      hasActedThisRound: false,
      lastAction: null,
      isBot: true,
      botDifficulty: botDifficulty,
    };
  }

  /**
   * Shuffle an array in place using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} - The shuffled array (same reference)
   */
  static shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Reshuffle muck into deck if deck is running low
   * @param {Array} deck - Current deck array
   * @param {Array} muck - Discard pile array
   * @param {number} neededCards - Number of cards needed
   * @returns {Object} - { deck: Array, muck: Array } with updated arrays
   */
  static reshuffleMuckIfNeeded(deck, muck, neededCards) {
    if (deck.length >= neededCards) {
      return { deck, muck };
    }

    // Not enough cards in deck - shuffle muck and add to deck
    if (muck.length === 0) {
      // No cards to reshuffle, return what we have
      return { deck, muck };
    }

    console.log(`Reshuffling ${muck.length} cards from muck into deck (needed: ${neededCards}, had: ${deck.length})`);

    // Shuffle the muck
    const shuffledMuck = GameService.shuffleArray([...muck]);

    // Append shuffled muck to bottom of deck
    const newDeck = [...deck, ...shuffledMuck];

    return { deck: newDeck, muck: [] };
  }

  /**
   * Compare two cards for dealer cut
   * Returns positive if card1 wins, negative if card2 wins, 0 if tie (shouldn't happen with suit tiebreaker)
   * Highest rank wins. Ties broken by suit: Spades > Hearts > Diamonds > Clubs
   * @param {Object} card1 - { rank, suit }
   * @param {Object} card2 - { rank, suit }
   * @returns {number} - Comparison result
   */
  static compareDealerCutCards(card1, card2) {
    const rank1 = RANK_VALUES[card1.rank] || 0;
    const rank2 = RANK_VALUES[card2.rank] || 0;

    if (rank1 !== rank2) {
      return rank1 - rank2;
    }

    // Tie-breaker: suit priority
    const suit1 = SUIT_VALUES[card1.suit] || 0;
    const suit2 = SUIT_VALUES[card2.suit] || 0;

    return suit1 - suit2;
  }

  /**
   * Start the "Cut for Dealer" phase
   * Deals 1 card face-up to each active player to determine dealer
   * Uses a transaction to read fresh data and prevent race conditions with concurrent joins
   * @param {string} tableId - The table ID
   * @param {Object} _tableData - Current table data (unused, we read fresh data in transaction)
   * @returns {Promise<void>}
   */
  static async startCutForDealer(tableId, _tableData) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    await runTransaction(db, async (transaction) => {
      // Read fresh data inside transaction to avoid race conditions
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const tableData = tableDoc.data();
      let deck = [...tableData.deck];
      let muck = [...(tableData.muck || [])];

      // Filter players with chips
      const activePlayers = tableData.players.filter((p) => p.chips > 0);
      if (activePlayers.length < 2) {
        throw new Error('Need at least 2 players with chips to start');
      }

      // Reshuffle if needed
      const reshuffled = GameService.reshuffleMuckIfNeeded(deck, muck, activePlayers.length);
      deck = reshuffled.deck;
      muck = reshuffled.muck;

      // Deal 1 card to each player for dealer cut
      const players = tableData.players.map((player) => ({
        ...player,
        cutCard: null,
        hand: [],
        status: player.chips > 0 ? 'active' : 'sitting_out',
        cardsToDiscard: [],
        currentRoundBet: 0,
        totalContribution: 0,
        hasActedThisRound: false,
        lastAction: null,
      }));

      // Deal one card to each active player
      for (let i = 0; i < players.length; i++) {
        if (players[i].status === 'active' && deck.length > 0) {
          players[i].cutCard = deck.shift();
        }
      }

      transaction.update(tableRef, {
        deck,
        muck,
        players,
        phase: 'CUT_FOR_DEALER',
        pot: 0,
        pots: [],
        currentBet: 0,
        turnDeadline: null, // No time limit for cut phase
        cutForDealerComplete: false,
        lastUpdated: serverTimestamp(),
      });
    });
  }

  /**
   * Resolve the "Cut for Dealer" phase
   * Determines the winner (highest card) and sets them as dealer
   * Uses a transaction to read fresh data and prevent race conditions with concurrent joins
   * @param {string} tableId - The table ID
   * @param {Object} _tableData - Current table data (unused, we read fresh data in transaction)
   * @returns {Promise<number>} - The seat index of the winning dealer
   */
  static async resolveCutForDealer(tableId, _tableData) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    return await runTransaction(db, async (transaction) => {
      // Read fresh data inside transaction to avoid race conditions
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const tableData = tableDoc.data();
      const players = tableData.players;
      let winnerIndex = -1;
      let winnerCard = null;

      // Find the player with the highest card
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (player.cutCard && player.status !== 'sitting_out') {
          if (!winnerCard || GameService.compareDealerCutCards(player.cutCard, winnerCard) > 0) {
            winnerCard = player.cutCard;
            winnerIndex = i;
          }
        }
      }

      if (winnerIndex === -1) {
        // Fallback: first active player
        winnerIndex = players.findIndex(p => p.status === 'active');
        if (winnerIndex === -1) winnerIndex = 0;
      }

      // Find active player indices and determine dealer position
      const activeIndices = players
        .map((p, i) => (p.status === 'active' ? i : -1))
        .filter((i) => i !== -1);

      const dealerActivePosition = activeIndices.indexOf(winnerIndex);
      const finalDealerPosition = dealerActivePosition !== -1 ? dealerActivePosition : 0;

      // Collect cut cards to muck
      const cutCards = players
        .filter(p => p.cutCard)
        .map(p => p.cutCard);

      // Clear cut cards from players
      const updatedPlayers = players.map(p => ({
        ...p,
        cutCard: null,
      }));

      transaction.update(tableRef, {
        players: updatedPlayers,
        muck: [...(tableData.muck || []), ...cutCards],
        dealerIndex: finalDealerPosition,
        cutForDealerWinner: winnerIndex,
        cutForDealerComplete: true,
        phase: 'IDLE', // Return to idle for deal
        lastUpdated: serverTimestamp(),
      });

      return winnerIndex;
    });
  }

  // ============================================
  // USER WALLET OPERATIONS
  // ============================================

  /**
   * Get or create a user's wallet document
   * @param {string} uid - User's Firebase UID
   * @param {string} displayName - User's display name (Google display name, used as fallback)
   * @returns {Promise<Object>} - User data with balance
   */
  static async getOrCreateUser(uid, displayName) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const userRef = doc(db, USERS_COLLECTION, uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data();
    }

    // Create new user with starting balance
    // Note: username is null initially - user must set it before playing
    const userData = {
      uid,
      displayName: displayName || 'Anonymous', // Keep Google name for reference
      username: null, // Custom username - must be set before playing
      balance: DEFAULT_STARTING_BALANCE,
      createdAt: serverTimestamp(),
    };

    await setDoc(userRef, userData);
    return userData;
  }

  /**
   * Update a user's custom username
   * @param {string} uid - User's Firebase UID
   * @param {string} username - New custom username
   * @returns {Promise<void>}
   */
  static async updateUsername(uid, username) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    if (!username || username.trim().length < 2) {
      throw new Error('Username must be at least 2 characters');
    }

    if (username.trim().length > 20) {
      throw new Error('Username must be 20 characters or less');
    }

    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      username: username.trim(),
    });
  }

  /**
   * Get user's display name (custom username or fallback to displayName)
   * @param {Object} userData - User data object
   * @returns {string} - Display name to show in game
   */
  static getDisplayName(userData) {
    return userData?.username || userData?.displayName || 'Anonymous';
  }

  /**
   * Subscribe to user wallet updates
   * @param {string} uid - User's Firebase UID
   * @param {Function} callback - Callback function receiving (userData, error)
   * @returns {Function} - Unsubscribe function
   */
  static subscribeToUser(uid, callback) {
    if (!db) {
      callback(null, new Error('Firestore not initialized'));
      return () => {};
    }

    const userRef = doc(db, USERS_COLLECTION, uid);

    return onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data(), null);
        } else {
          callback(null, new Error('User not found'));
        }
      },
      (error) => {
        console.error('Error subscribing to user:', error);
        callback(null, error);
      }
    );
  }

  /**
   * Get user balance
   * @param {string} uid - User's Firebase UID
   * @returns {Promise<number>} - User's balance
   */
  static async getUserBalance(uid) {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data().balance || 0;
    }
    return 0;
  }

  /**
   * Buy in to a table - Transfer funds from wallet to table chips
   * Uses a Firestore transaction for atomicity
   * @param {string} tableId - The table ID
   * @param {string} uid - User's Firebase UID
   * @param {number} amount - Amount to buy in
   * @returns {Promise<void>}
   */
  static async buyInToTable(tableId, uid, amount) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    if (amount <= 0) {
      throw new Error('Buy-in amount must be positive');
    }

    const userRef = doc(db, USERS_COLLECTION, uid);
    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const tableDoc = await transaction.get(tableRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const userData = userDoc.data();
      const tableData = tableDoc.data();

      if (userData.balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Find player at table
      const playerIndex = tableData.players.findIndex((p) => p.uid === uid);
      if (playerIndex === -1) {
        throw new Error('Player not found at table');
      }

      // Update user balance
      transaction.update(userRef, {
        balance: userData.balance - amount,
      });

      // Update player chips at table
      const updatedPlayers = [...tableData.players];
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        chips: updatedPlayers[playerIndex].chips + amount,
      };

      transaction.update(tableRef, {
        players: updatedPlayers,
        lastUpdated: serverTimestamp(),
      });
    });
  }

  /**
   * Cash out from table - Transfer chips back to wallet
   * Uses a Firestore transaction for atomicity
   * @param {string} tableId - The table ID
   * @param {string} uid - User's Firebase UID
   * @returns {Promise<number>} - Amount cashed out
   */
  static async cashOutFromTable(tableId, uid) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const userRef = doc(db, USERS_COLLECTION, uid);
    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    let cashedOutAmount = 0;

    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const tableDoc = await transaction.get(tableRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const userData = userDoc.data();
      const tableData = tableDoc.data();

      // Find player at table
      const playerIndex = tableData.players.findIndex((p) => p.uid === uid);
      if (playerIndex === -1) {
        throw new Error('Player not found at table');
      }

      cashedOutAmount = tableData.players[playerIndex].chips;

      // Update user balance (add chips back to wallet)
      transaction.update(userRef, {
        balance: userData.balance + cashedOutAmount,
      });

      // Remove player from table
      const updatedPlayers = tableData.players.filter((p) => p.uid !== uid);

      // Adjust activePlayerIndex if needed
      let activeIndex = tableData.activePlayerIndex;
      if (playerIndex <= activeIndex && activeIndex > 0) {
        activeIndex--;
      }
      if (activeIndex >= updatedPlayers.length) {
        activeIndex = 0;
      }

      const updates = {
        players: updatedPlayers,
        activePlayerIndex: activeIndex,
        lastUpdated: serverTimestamp(),
      };

      // Reset table if no players left
      if (updatedPlayers.length === 0) {
        updates.phase = 'IDLE';
        updates.pot = 0;
        updates.currentBet = 0;
        updates.deck = GameService.createShuffledDeck();
      }

      transaction.update(tableRef, updates);
    });

    return cashedOutAmount;
  }

  // ============================================
  // TABLE OPERATIONS
  // ============================================

  /**
   * Creates a new table with the user as the first player
   * @param {Object} user - Firebase user object with uid, displayName, photoURL
   * @param {Object} userWallet - User wallet data with username
   * @param {number} minBet - Minimum bet for the table
   * @param {Object} config - Table configuration object (optional)
   * @returns {Promise<string>} - The created table ID
   */
  static async createTable(user, userWallet, minBet = DEFAULT_MIN_BET, config = null) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableId = GameService.generateTableId();
    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    // Use custom username if available, otherwise fall back to Google displayName
    const displayName = GameService.getDisplayName(userWallet) || user.displayName || 'Anonymous';

    // Default config if not provided
    const defaultConfig = {
      gameType: 'lowball_27',
      bettingType: 'no_limit',
      maxPlayers: 6,
      turnTimeLimit: TURN_TIME_SECONDS,
      passwordHash: null,
      bots: {
        count: 0,
        difficulty: 'medium',
        fillStrategy: 'fixed',
      },
    };

    const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;

    // Create initial players array with human player
    const players = [
      {
        uid: user.uid,
        displayName: displayName,
        photoURL: user.photoURL || null,
        chips: 0, // Start with 0, must buy in
        hand: [],
        status: 'active',
        cardsToDiscard: [],
        currentRoundBet: 0,
        totalContribution: 0, // Total contributed to pot this hand
        hasActedThisRound: false,
        lastAction: null, // Track last draw action for display
      },
    ];

    // Add bot players if configured
    const botConfig = finalConfig.bots || defaultConfig.bots;
    if (botConfig.count > 0) {
      // Calculate bot starting chips: 20x the minimum bet (2x the minimum buy-in)
      // This ensures bots have enough chips to play multiple hands
      const botStartingChips = minBet * 20;
      for (let i = 0; i < botConfig.count && players.length < finalConfig.maxPlayers; i++) {
        players.push(GameService.createBotPlayer(botConfig.difficulty, i, botStartingChips));
      }
    }

    const tableData = {
      id: tableId,
      phase: 'IDLE',
      deck: GameService.createShuffledDeck(),
      muck: [], // Discard pile for reshuffling when deck runs low
      pots: [], // Array of pot objects: { amount, eligiblePlayers: [uid, ...] }
      pot: 0, // Legacy: total pot for display (sum of all pots)
      minBet: minBet,
      currentBet: 0,
      activePlayerIndex: 0,
      turnDeadline: null,
      dealerIndex: 0,
      players: players,
      railbirds: [], // Observers watching the game (can chat but can't see card indices)
      chatLog: [], // Chat messages array
      createdBy: user.uid,
      config: finalConfig, // Store configuration
      lastUpdated: serverTimestamp(),
    };

    await setDoc(tableRef, tableData);
    return tableId;
  }

  /**
   * Join an existing table
   * If game is in progress, joins as railbird (observer)
   * @param {string} tableId - The table ID to join
   * @param {Object} user - Firebase user object
   * @param {Object} userWallet - User wallet data with username
   * @param {string} password - Optional password for private tables
   * @param {boolean} asRailbird - Force joining as railbird even if seats available
   * @returns {Promise<{joinedAs: 'player' | 'railbird'}>}
   */
  static async joinTable(tableId, user, userWallet, password = null, asRailbird = false) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      throw new Error('Table not found');
    }

    const tableData = tableSnap.data();

    // Check if user is already at the table as a player
    const existingPlayer = tableData.players.find((p) => p.uid === user.uid);
    if (existingPlayer) {
      // User is already at the table as a player
      return { joinedAs: 'player' };
    }

    // Check if user is already a railbird
    const railbirds = tableData.railbirds || [];
    const existingRailbird = railbirds.find((r) => r.uid === user.uid);
    if (existingRailbird) {
      // User is already watching as railbird
      return { joinedAs: 'railbird' };
    }

    // Check password for private tables
    const config = tableData.config || {};
    if (config.passwordHash) {
      if (!password || password.trim() !== config.passwordHash) {
        throw new Error('Incorrect password');
      }
    }

    // Use custom username if available, otherwise fall back to Google displayName
    const displayName = GameService.getDisplayName(userWallet) || user.displayName || 'Anonymous';

    // Determine if we should join as railbird or player
    const gameInProgress = tableData.phase !== 'IDLE';
    const tableIsFull = tableData.players.length >= MAX_PLAYERS;
    const shouldJoinAsRailbird = asRailbird || gameInProgress || tableIsFull;

    if (shouldJoinAsRailbird) {
      // Join as railbird (observer)
      // Note: wantsToPlay is now ALWAYS false - users must explicitly click "Join Game"
      // This moves us from "Auto-Join" to "Opt-In" model
      const newRailbird = {
        uid: user.uid,
        displayName: displayName,
        photoURL: user.photoURL || null,
        joinedAt: Date.now(),
        wantsToPlay: false, // Always false - user must explicitly opt-in via "Join Game" button
      };

      await updateDoc(tableRef, {
        railbirds: arrayUnion(newRailbird),
        lastUpdated: serverTimestamp(),
      });

      return { joinedAs: 'railbird' };
    }

    // Join as player
    const newPlayer = {
      uid: user.uid,
      displayName: displayName,
      photoURL: user.photoURL || null,
      chips: 0, // Start with 0, must buy in
      hand: [],
      status: 'active',
      cardsToDiscard: [],
      currentRoundBet: 0,
      totalContribution: 0, // Total contributed to pot this hand
      hasActedThisRound: false,
      lastAction: null, // Track last draw action for display
    };

    await updateDoc(tableRef, {
      players: arrayUnion(newPlayer),
      lastUpdated: serverTimestamp(),
    });

    return { joinedAs: 'player' };
  }

  /**
   * Promote a railbird to a player when a seat becomes available
   * @param {string} tableId - The table ID
   * @param {string} railbirdUid - The railbird's UID to promote
   * @returns {Promise<boolean>} - True if promotion was successful
   */
  static async promoteRailbirdToPlayer(tableId, railbirdUid) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    return await runTransaction(db, async (transaction) => {
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const tableData = tableDoc.data();
      const railbirds = tableData.railbirds || [];
      const players = tableData.players || [];

      // Check if table is full
      if (players.length >= MAX_PLAYERS) {
        throw new Error('Table is full');
      }

      // Check if game is in progress
      if (tableData.phase !== 'IDLE') {
        throw new Error('Cannot join while game is in progress');
      }

      // Find the railbird
      const railbirdIndex = railbirds.findIndex((r) => r.uid === railbirdUid);
      if (railbirdIndex === -1) {
        throw new Error('Railbird not found');
      }

      const railbird = railbirds[railbirdIndex];

      // Create new player from railbird data
      const newPlayer = {
        uid: railbird.uid,
        displayName: railbird.displayName,
        photoURL: railbird.photoURL || null,
        chips: 0, // Start with 0, must buy in
        hand: [],
        status: 'active',
        cardsToDiscard: [],
        currentRoundBet: 0,
        totalContribution: 0,
        hasActedThisRound: false,
        lastAction: null,
      };

      // Remove from railbirds and add to players
      const updatedRailbirds = railbirds.filter((r) => r.uid !== railbirdUid);
      const updatedPlayers = [...players, newPlayer];

      transaction.update(tableRef, {
        players: updatedPlayers,
        railbirds: updatedRailbirds,
        lastUpdated: serverTimestamp(),
      });

      return true;
    });
  }

  /**
   * Request to sit out from the game
   * - If game is IDLE: Immediately demote player to railbird
   * - If game is in progress: Set pendingSitOut flag (player finishes current hand)
   *
   * @param {string} tableId - The table ID
   * @param {string} playerUid - The player's UID
   * @returns {Promise<{ immediate: boolean }>} - Whether the sit out was immediate or pending
   */
  static async requestSitOut(tableId, playerUid) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    return await runTransaction(db, async (transaction) => {
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const tableData = tableDoc.data();
      const players = tableData.players || [];
      const playerIndex = players.findIndex((p) => p.uid === playerUid);

      if (playerIndex === -1) {
        throw new Error('Player not found at this table');
      }

      const player = players[playerIndex];

      // If game is IDLE, demote immediately
      if (tableData.phase === 'IDLE') {
        // Create railbird from player data
        const newRailbird = {
          uid: player.uid,
          displayName: player.displayName,
          photoURL: player.photoURL || null,
          joinedAt: Date.now(),
          wantsToPlay: false,
        };

        // Return chips to wallet before removing player
        if (player.chips > 0) {
          const userRef = doc(db, USERS_COLLECTION, playerUid);
          const userSnap = await transaction.get(userRef);
          if (userSnap.exists()) {
            const currentBalance = userSnap.data().balance || 0;
            transaction.update(userRef, {
              balance: currentBalance + player.chips,
            });
          }
        }

        // Remove from players and add to railbirds
        const updatedPlayers = players.filter((p) => p.uid !== playerUid);
        const updatedRailbirds = [...(tableData.railbirds || []), newRailbird];

        transaction.update(tableRef, {
          players: updatedPlayers,
          railbirds: updatedRailbirds,
          lastUpdated: serverTimestamp(),
        });

        return { immediate: true };
      } else {
        // Game is in progress - set pending flag
        const updatedPlayers = players.map((p) => {
          if (p.uid === playerUid) {
            return { ...p, pendingSitOut: true };
          }
          return p;
        });

        transaction.update(tableRef, {
          players: updatedPlayers,
          lastUpdated: serverTimestamp(),
        });

        return { immediate: false };
      }
    });
  }

  /**
   * Cancel a pending sit out request
   * @param {string} tableId - The table ID
   * @param {string} playerUid - The player's UID
   * @returns {Promise<void>}
   */
  static async cancelSitOut(tableId, playerUid) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      throw new Error('Table not found');
    }

    const tableData = tableSnap.data();
    const players = tableData.players || [];
    const playerIndex = players.findIndex((p) => p.uid === playerUid);

    if (playerIndex === -1) {
      throw new Error('Player not found at this table');
    }

    const updatedPlayers = players.map((p) => {
      if (p.uid === playerUid) {
        const { pendingSitOut, ...rest } = p;
        return rest;
      }
      return p;
    });

    await updateDoc(tableRef, {
      players: updatedPlayers,
      lastUpdated: serverTimestamp(),
    });
  }

  /**
   * Demote a player to railbird (used at hand end for pending sit outs)
   * @param {string} tableId - The table ID
   * @param {string} playerUid - The player's UID
   * @returns {Promise<void>}
   */
  static async demotePlayerToRailbird(tableId, playerUid) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    await runTransaction(db, async (transaction) => {
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const tableData = tableDoc.data();
      const players = tableData.players || [];
      const playerIndex = players.findIndex((p) => p.uid === playerUid);

      if (playerIndex === -1) {
        return; // Player already removed
      }

      const player = players[playerIndex];

      // Create railbird from player data
      const newRailbird = {
        uid: player.uid,
        displayName: player.displayName,
        photoURL: player.photoURL || null,
        joinedAt: Date.now(),
        wantsToPlay: false,
      };

      // Return chips to wallet before removing player
      if (player.chips > 0) {
        const userRef = doc(db, USERS_COLLECTION, playerUid);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists()) {
          const currentBalance = userSnap.data().balance || 0;
          transaction.update(userRef, {
            balance: currentBalance + player.chips,
          });
        }
      }

      // Remove from players and add to railbirds
      const updatedPlayers = players.filter((p) => p.uid !== playerUid);
      const updatedRailbirds = [...(tableData.railbirds || []), newRailbird];

      transaction.update(tableRef, {
        players: updatedPlayers,
        railbirds: updatedRailbirds,
        lastUpdated: serverTimestamp(),
      });
    });
  }

  /**
   * Kick a bot player from the table to make room for a human player
   * Only the table creator can kick bots
   * @param {string} tableId - The table ID
   * @param {string} botUid - The bot's UID to kick
   * @param {string} requesterUid - The UID of the user requesting the kick
   * @returns {Promise<void>}
   */
  static async kickBot(tableId, botUid, requesterUid) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    await runTransaction(db, async (transaction) => {
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const tableData = tableDoc.data();

      // Only table creator can kick bots
      if (tableData.createdBy !== requesterUid) {
        throw new Error('Only the table creator can kick bots');
      }

      // Can only kick bots when game is IDLE
      if (tableData.phase !== 'IDLE') {
        throw new Error('Cannot kick bots while game is in progress');
      }

      const players = tableData.players || [];
      const botIndex = players.findIndex((p) => p.uid === botUid);

      if (botIndex === -1) {
        throw new Error('Bot not found');
      }

      const bot = players[botIndex];
      if (!bot.isBot) {
        throw new Error('Can only kick bot players');
      }

      // Remove the bot
      const updatedPlayers = players.filter((p) => p.uid !== botUid);

      // Adjust dealer index if needed
      let dealerIndex = tableData.dealerIndex || 0;
      if (botIndex <= dealerIndex && dealerIndex > 0) {
        dealerIndex--;
      }
      if (dealerIndex >= updatedPlayers.length) {
        dealerIndex = 0;
      }

      transaction.update(tableRef, {
        players: updatedPlayers,
        dealerIndex,
        lastUpdated: serverTimestamp(),
      });
    });
  }

  /**
   * Remove a railbird from the table (when they leave)
   * @param {string} tableId - The table ID
   * @param {string} railbirdUid - The railbird's UID
   * @returns {Promise<void>}
   */
  static async removeRailbird(tableId, railbirdUid) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      throw new Error('Table not found');
    }

    const tableData = tableSnap.data();
    const railbirds = tableData.railbirds || [];
    const updatedRailbirds = railbirds.filter((r) => r.uid !== railbirdUid);

    await updateDoc(tableRef, {
      railbirds: updatedRailbirds,
      lastUpdated: serverTimestamp(),
    });
  }

  /**
   * Auto-promote railbirds who want to play when the game becomes IDLE and seats are available
   *
   * NOTE: This function is now effectively disabled as part of the "Opt-In" model.
   * Railbirds must explicitly click "Join Game" to become players.
   * The wantsToPlay flag is always set to false when joining.
   *
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @returns {Promise<void>}
   */
  static async autoPromoteRailbirds(tableId, tableData) {
    // DISABLED: Auto-promotion is no longer supported.
    // Users must explicitly click "Join Game" to become players.
    // This function is kept for backward compatibility but does nothing.
    // If a railbird's wantsToPlay is true (legacy data), they will still be promoted.

    if (!db) {
      throw new Error('Firestore not initialized');
    }

    // Only run when game is IDLE
    if (tableData.phase !== 'IDLE') return;

    const railbirds = tableData.railbirds || [];
    const players = tableData.players || [];

    // Find railbirds who want to play, sorted by join time (first come first served)
    // Note: With the new Opt-In model, wantsToPlay is always false for new joins
    // This only handles legacy data where wantsToPlay might still be true
    const waitingRailbirds = railbirds
      .filter((r) => r.wantsToPlay === true) // Strict check for true
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

    const availableSeats = MAX_PLAYERS - players.length;

    // Promote up to available seats (only for legacy wantsToPlay=true railbirds)
    for (let i = 0; i < Math.min(waitingRailbirds.length, availableSeats); i++) {
      try {
        await GameService.promoteRailbirdToPlayer(tableId, waitingRailbirds[i].uid);
      } catch (err) {
        console.error(`Failed to promote railbird ${waitingRailbirds[i].uid}:`, err);
      }
    }
  }

  /**
   * Subscribe to real-time updates for a table
   * @param {string} tableId - The table ID to subscribe to
   * @param {Function} callback - Callback function receiving (tableData, error)
   * @returns {Function} - Unsubscribe function
   */
  static subscribeToTable(tableId, callback) {
    if (!db) {
      callback(null, new Error('Firestore not initialized'));
      return () => {};
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    return onSnapshot(
      tableRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data(), null);
        } else {
          callback(null, new Error('Table not found'));
        }
      },
      (error) => {
        console.error('Error subscribing to table:', error);
        callback(null, error);
      }
    );
  }

  /**
   * Update table data
   * @param {string} tableId - The table ID to update
   * @param {Object} data - Partial data to update
   * @returns {Promise<void>}
   */
  static async updateTable(tableId, data) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    await updateDoc(tableRef, {
      ...data,
      lastUpdated: serverTimestamp(),
    });
  }

  /**
   * Get a table by ID (one-time fetch)
   * @param {string} tableId - The table ID
   * @returns {Promise<Object|null>} - Table data or null if not found
   */
  static async getTable(tableId) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    const tableSnap = await getDoc(tableRef);

    if (tableSnap.exists()) {
      return tableSnap.data();
    }
    return null;
  }

  // ============================================
  // GAME FLOW OPERATIONS
  // ============================================

  /**
   * Calculate turn deadline timestamp (45 seconds from now)
   * @returns {Timestamp} - Firestore Timestamp
   */
  static calculateTurnDeadline() {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + TURN_TIME_SECONDS);
    return Timestamp.fromDate(deadline);
  }

  /**
   * Deal cards to all players and start the game
   * Uses a transaction to read fresh data and prevent race conditions with concurrent joins
   * @param {string} tableId - The table ID
   * @param {Object} _tableData - Current table data (unused, we read fresh data in transaction)
   * @returns {Promise<void>}
   */
  static async dealCards(tableId, _tableData) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    await runTransaction(db, async (transaction) => {
      // Read fresh data inside transaction to avoid race conditions
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const tableData = tableDoc.data();
      let deck = [...tableData.deck];
      let muck = [...(tableData.muck || [])];
      const minBet = tableData.minBet || DEFAULT_MIN_BET;
      const smallBlind = Math.floor(minBet / 2);
      const bigBlind = minBet;

      // Filter players with chips and reset their state
      const activePlayers = tableData.players.filter((p) => p.chips > 0);
      if (activePlayers.length < 2) {
        throw new Error('Need at least 2 players with chips to start');
      }

      const players = tableData.players.map((player) => ({
        ...player,
        hand: [],
        status: player.chips > 0 ? 'active' : 'sitting_out',
        cardsToDiscard: [],
        currentRoundBet: 0,
        totalContribution: 0, // Reset for new hand
        hasActedThisRound: false,
        lastAction: null, // Clear any previous action text
      }));

      // Calculate cards needed for initial deal
      const cardsNeeded = CARDS_PER_HAND * activePlayers.length;

      // Reshuffle muck into deck if needed
      const reshuffled = GameService.reshuffleMuckIfNeeded(deck, muck, cardsNeeded);
      deck = reshuffled.deck;
      muck = reshuffled.muck;

      // Deal 5 cards to each active player
      for (let i = 0; i < CARDS_PER_HAND; i++) {
        for (let j = 0; j < players.length; j++) {
          if (players[j].status === 'active' && deck.length > 0) {
            players[j].hand.push(deck.shift());
          }
        }
      }

      // Find active player indices (players who can participate in the hand)
      const activeIndices = players
        .map((p, i) => (p.status === 'active' ? i : -1))
        .filter((i) => i !== -1);

      // Determine dealer position within active players, then convert to actual seat index
      const dealerActivePosition = (tableData.dealerIndex || 0) % activeIndices.length;
      const dealerSeatIndex = activeIndices[dealerActivePosition];

      // Small blind is next active player after dealer
      const sbActivePosition = (dealerActivePosition + 1) % activeIndices.length;
      const sbSeatIndex = activeIndices[sbActivePosition];

      // Big blind is next active player after small blind
      const bbActivePosition = (dealerActivePosition + 2) % activeIndices.length;
      const bbSeatIndex = activeIndices[bbActivePosition];

      // For legacy compatibility, use variable names matching existing code
      const sbActiveIndex = sbSeatIndex;
      const bbActiveIndex = bbSeatIndex;

      let pot = 0;

      // Post small blind
      const sbAmount = Math.min(smallBlind, players[sbActiveIndex].chips);
      players[sbActiveIndex].chips -= sbAmount;
      players[sbActiveIndex].currentRoundBet = sbAmount;
      players[sbActiveIndex].totalContribution = sbAmount;
      pot += sbAmount;

      // Post big blind
      const bbAmount = Math.min(bigBlind, players[bbActiveIndex].chips);
      players[bbActiveIndex].chips -= bbAmount;
      players[bbActiveIndex].currentRoundBet = bbAmount;
      players[bbActiveIndex].totalContribution = bbAmount;
      pot += bbAmount;

      // Action starts with player after big blind (UTG)
      const utgActivePosition = (dealerActivePosition + 3) % activeIndices.length;
      const utgActiveIndex = activeIndices[utgActivePosition];

      transaction.update(tableRef, {
        deck,
        muck, // Include muck in update (cleared or updated from reshuffle)
        players,
        pot,
        currentBet: bigBlind,
        phase: 'BETTING_1',
        activePlayerIndex: utgActiveIndex,
        // Store actual seat indices (full players array indices) for UI
        dealerIndex: dealerActivePosition, // Keep as position for rotation in startNextHand
        dealerSeatIndex: dealerSeatIndex,
        smallBlindSeatIndex: sbSeatIndex,
        bigBlindSeatIndex: bbSeatIndex,
        turnDeadline: GameService.calculateTurnDeadline(),
        hasHadFirstDeal: true, // Mark that dealer has been determined
        cutForDealerComplete: null, // Clear cut for dealer state
        cutForDealerWinner: null,
        lastUpdated: serverTimestamp(),
      });
    });
  }

  /**
   * Deal cards for Texas Hold'em - 2 hole cards to each player
   * Uses a transaction to read fresh data and prevent race conditions with concurrent joins
   * @param {string} tableId - The table ID
   * @param {Object} _tableData - Current table data (unused, we read fresh data in transaction)
   * @returns {Promise<void>}
   */
  static async dealHoldemCards(tableId, _tableData) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    await runTransaction(db, async (transaction) => {
      // Read fresh data inside transaction to avoid race conditions
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const tableData = tableDoc.data();
      let deck = [...tableData.deck];
      let muck = [...(tableData.muck || [])];
      const minBet = tableData.minBet || DEFAULT_MIN_BET;
      const smallBlind = Math.floor(minBet / 2);
      const bigBlind = minBet;

      // Filter players with chips and reset their state
      const activePlayers = tableData.players.filter((p) => p.chips > 0);
      if (activePlayers.length < 2) {
        throw new Error('Need at least 2 players with chips to start');
      }

      const players = tableData.players.map((player) => ({
        ...player,
        hand: [],
        status: player.chips > 0 ? 'active' : 'sitting_out',
        cardsToDiscard: [],
        currentRoundBet: 0,
        totalContribution: 0,
        hasActedThisRound: false,
        lastAction: null,
      }));

      // Calculate cards needed for Hold'em (2 per player + 5 community)
      const cardsNeeded = HOLDEM_HOLE_CARDS * activePlayers.length + 5;

      // Reshuffle muck into deck if needed
      const reshuffled = GameService.reshuffleMuckIfNeeded(deck, muck, cardsNeeded);
      deck = reshuffled.deck;
      muck = reshuffled.muck;

      // Deal 2 hole cards to each active player
      for (let i = 0; i < HOLDEM_HOLE_CARDS; i++) {
        for (let j = 0; j < players.length; j++) {
          if (players[j].status === 'active' && deck.length > 0) {
            players[j].hand.push(deck.shift());
          }
        }
      }

      // Find active player indices
      const activeIndices = players
        .map((p, i) => (p.status === 'active' ? i : -1))
        .filter((i) => i !== -1);

      // Determine dealer position
      const dealerActivePosition = (tableData.dealerIndex || 0) % activeIndices.length;
      const dealerSeatIndex = activeIndices[dealerActivePosition];

      // Small blind is next active player after dealer
      const sbActivePosition = (dealerActivePosition + 1) % activeIndices.length;
      const sbSeatIndex = activeIndices[sbActivePosition];

      // Big blind is next active player after small blind
      const bbActivePosition = (dealerActivePosition + 2) % activeIndices.length;
      const bbSeatIndex = activeIndices[bbActivePosition];

      const sbActiveIndex = sbSeatIndex;
      const bbActiveIndex = bbSeatIndex;

      let pot = 0;

      // Post small blind
      const sbAmount = Math.min(smallBlind, players[sbActiveIndex].chips);
      players[sbActiveIndex].chips -= sbAmount;
      players[sbActiveIndex].currentRoundBet = sbAmount;
      players[sbActiveIndex].totalContribution = sbAmount;
      pot += sbAmount;

      // Post big blind
      const bbAmount = Math.min(bigBlind, players[bbActiveIndex].chips);
      players[bbActiveIndex].chips -= bbAmount;
      players[bbActiveIndex].currentRoundBet = bbAmount;
      players[bbActiveIndex].totalContribution = bbAmount;
      pot += bbAmount;

      // Action starts with player after big blind (UTG)
      const utgActivePosition = (dealerActivePosition + 3) % activeIndices.length;
      const utgActiveIndex = activeIndices[utgActivePosition];

      transaction.update(tableRef, {
        deck,
        muck,
        players,
        pot,
        currentBet: bigBlind,
        phase: 'PREFLOP',
        activePlayerIndex: utgActiveIndex,
        dealerIndex: dealerActivePosition,
        dealerSeatIndex: dealerSeatIndex,
        smallBlindSeatIndex: sbSeatIndex,
        bigBlindSeatIndex: bbSeatIndex,
        communityCards: [], // Initialize empty community cards
        turnDeadline: GameService.calculateTurnDeadline(),
        hasHadFirstDeal: true,
        cutForDealerComplete: null,
        cutForDealerWinner: null,
        lastUpdated: serverTimestamp(),
      });
    });
  }

  /**
   * Deal community cards for Hold'em (flop, turn, river)
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @param {string} street - 'FLOP', 'TURN', or 'RIVER'
   * @returns {Promise<void>}
   */
  static async dealCommunityCards(tableId, tableData, street) {
    let deck = [...tableData.deck];
    let muck = [...(tableData.muck || [])];
    const communityCards = [...(tableData.communityCards || [])];

    // Burn a card before dealing community cards
    if (deck.length > 0) {
      muck.push(deck.shift());
    }

    // Deal appropriate number of cards based on street
    let cardsToDeal = 0;
    if (street === 'FLOP') {
      cardsToDeal = 3;
    } else if (street === 'TURN' || street === 'RIVER') {
      cardsToDeal = 1;
    }

    for (let i = 0; i < cardsToDeal && deck.length > 0; i++) {
      communityCards.push(deck.shift());
    }

    // Reset betting for new street
    const players = tableData.players.map((p) => ({
      ...p,
      currentRoundBet: 0,
      hasActedThisRound: false,
    }));

    // Find first active player after dealer button for post-flop betting
    const activeIndices = players
      .map((p, i) => (p.status === 'active' && p.chips > 0 ? i : -1))
      .filter((i) => i !== -1);

    // Post-flop action starts with first active player after dealer
    const dealerSeatIndex = tableData.dealerSeatIndex || 0;
    let firstToAct = -1;
    for (let i = 1; i <= players.length; i++) {
      const idx = (dealerSeatIndex + i) % players.length;
      if (players[idx].status === 'active' && players[idx].chips > 0) {
        firstToAct = idx;
        break;
      }
    }
    if (firstToAct === -1 && activeIndices.length > 0) {
      firstToAct = activeIndices[0];
    }

    await GameService.updateTable(tableId, {
      deck,
      muck,
      players,
      communityCards,
      currentBet: 0,
      phase: street,
      activePlayerIndex: firstToAct >= 0 ? firstToAct : 0,
      turnDeadline: GameService.calculateTurnDeadline(),
    });
  }

  /**
   * Get the first player to act after the dealer (for draw or post-draw phases)
   * This is the first active player clockwise from the dealer button
   * @param {Array} players - Array of player objects
   * @param {Object} tableData - Table data with dealer position
   * @param {boolean} includeAllIn - Whether to include all-in players (true for draw phases)
   * @returns {number} - Seat index of first player to act
   */
  static getFirstToActAfterDealer(players, tableData, includeAllIn = false) {
    // Get indices of players who can participate
    const activeIndices = players
      .map((p, i) => {
        if (includeAllIn) {
          return (p.status === 'active' || p.status === 'all-in') ? i : -1;
        }
        return (p.status === 'active' && p.chips > 0) ? i : -1;
      })
      .filter((i) => i !== -1);

    if (activeIndices.length === 0) return 0;

    const dealerActivePosition = tableData.dealerIndex || 0;
    // First to act is the player after the dealer (SB position in standard play)
    const firstActivePosition = (dealerActivePosition + 1) % activeIndices.length;
    return activeIndices[firstActivePosition];
  }

  /**
   * Get the first player to act in post-draw betting rounds
   * Handles heads-up exception where BB acts first post-draw
   * @param {Array} players - Array of player objects
   * @param {Object} tableData - Table data with dealer/blind positions
   * @returns {number} - Seat index of first player to act
   */
  static getFirstToActPostDraw(players, tableData) {
    const activeIndices = players
      .map((p, i) => (p.status === 'active' || p.status === 'all-in' ? i : -1))
      .filter((i) => i !== -1);

    if (activeIndices.length === 0) return 0;

    const numActivePlayers = activeIndices.length;
    const isHeadsUp = numActivePlayers === 2 || tableData.isHeadsUp;
    const dealerActivePosition = tableData.dealerIndex || 0;

    if (isHeadsUp) {
      // HEADS-UP: Post-draw action starts with opponent (BB)
      const opponentActivePosition = (dealerActivePosition + 1) % activeIndices.length;
      return activeIndices[opponentActivePosition];
    } else {
      // STANDARD: Post-draw action starts at (dealer + 1) - Small Blind position
      const sbActivePosition = (dealerActivePosition + 1) % activeIndices.length;
      return activeIndices[sbActivePosition];
    }
  }

  // ============================================
  // BETTING OPERATIONS
  // ============================================

  /**
   * Find the next active (non-folded, non-all-in) player who can act
   * @param {Array} players - Array of player objects
   * @param {number} currentIndex - Current player index
   * @returns {number} - Next active player index, or -1 if no player can act
   */
  static findNextActivePlayer(players, currentIndex) {
    const numPlayers = players.length;
    let nextIndex = (currentIndex + 1) % numPlayers;
    let checked = 0;

    while (checked < numPlayers) {
      const player = players[nextIndex];
      // Only return players who are active and have chips (can still act)
      if (player.status === 'active' && player.chips > 0) {
        return nextIndex;
      }
      nextIndex = (nextIndex + 1) % numPlayers;
      checked++;
    }

    // No active player found who can act (all are all-in, folded, or sitting out)
    return -1;
  }

  /**
   * Check if the betting round is complete
   * @param {Array} players - Array of player objects
   * @param {number} currentBet - Current bet amount
   * @returns {boolean} - True if round is complete
   */
  static isBettingRoundComplete(players, currentBet) {
    const activePlayers = players.filter(
      (p) => p.status === 'active' || p.status === 'all-in'
    );

    // Only one player left not all-in/folded
    const playersWhoCanAct = activePlayers.filter((p) => p.status === 'active' && p.chips > 0);
    if (playersWhoCanAct.length <= 1) {
      // Check if all bets match or everyone else is all-in/folded
      const allBetsMatch = activePlayers.every(
        (p) => p.currentRoundBet === currentBet || p.status === 'all-in' || p.chips === 0
      );
      if (allBetsMatch) return true;
    }

    // All active players have acted and bets match
    const allHaveActed = activePlayers.every(
      (p) => p.hasActedThisRound || p.status === 'all-in'
    );
    const allBetsMatch = activePlayers.every(
      (p) => p.currentRoundBet === currentBet || p.status === 'all-in'
    );

    return allHaveActed && allBetsMatch;
  }

  /**
   * Count players still in the hand (not folded)
   * @param {Array} players - Array of player objects
   * @returns {number} - Number of active players
   */
  static countActivePlayers(players) {
    return players.filter(
      (p) => p.status === 'active' || p.status === 'all-in'
    ).length;
  }

  /**
   * Perform a betting action
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @param {string} playerUid - The player's UID
   * @param {string} action - BetAction type (FOLD, CHECK, CALL, RAISE, BET, ALL_IN)
   * @param {number} amount - Amount for RAISE/BET (optional)
   * @returns {Promise<Object>} - Returns { success: true, action, amount } or throws error
   */
  static async performBetAction(tableId, tableData, playerUid, action, amount = 0) {
    const playerIndex = tableData.players.findIndex((p) => p.uid === playerUid);
    if (playerIndex === -1) {
      throw new Error('Player not found at this table');
    }

    if (playerIndex !== tableData.activePlayerIndex) {
      throw new Error('Not your turn - please wait');
    }

    const players = tableData.players.map((p) => ({ ...p }));
    const player = players[playerIndex];

    // Use Math.floor() for all chip values to avoid floating-point errors
    const currentBet = Math.floor(tableData.currentBet || 0);
    const minBet = Math.floor(tableData.minBet || DEFAULT_MIN_BET);
    const playerChips = Math.floor(player.chips || 0);
    const playerCurrentRoundBet = Math.floor(player.currentRoundBet || 0);

    let pot = Math.floor(tableData.pot);
    let newCurrentBet = currentBet;

    if (player.status !== 'active') {
      throw new Error('You cannot act - status: ' + player.status);
    }

    // Track what action was taken for activity log
    let actionDescription = '';

    switch (action) {
      case BetAction.FOLD:
        player.status = 'folded';
        player.hasActedThisRound = true;
        actionDescription = `${player.displayName} folded`;
        break;

      case BetAction.CHECK:
        // Can only check if current bet matches player's round bet
        if (playerCurrentRoundBet < currentBet) {
          throw new Error(`Cannot check - you must call $${currentBet - playerCurrentRoundBet} or raise`);
        }
        player.hasActedThisRound = true;
        actionDescription = `${player.displayName} checked`;
        break;

      case BetAction.CALL:
        {
          const callAmount = Math.floor(currentBet - playerCurrentRoundBet);
          if (callAmount <= 0) {
            // Nothing to call, treat as check
            player.hasActedThisRound = true;
            actionDescription = `${player.displayName} checked`;
          } else if (playerChips <= callAmount) {
            // All-in call
            const allInAmount = playerChips;
            pot += allInAmount;
            player.currentRoundBet = playerCurrentRoundBet + allInAmount;
            player.totalContribution = (player.totalContribution || 0) + allInAmount;
            player.chips = 0;
            player.status = 'all-in';
            player.hasActedThisRound = true;
            actionDescription = `${player.displayName} called all-in for $${allInAmount}`;
          } else {
            // Regular call
            player.chips = playerChips - callAmount;
            player.currentRoundBet = playerCurrentRoundBet + callAmount;
            player.totalContribution = (player.totalContribution || 0) + callAmount;
            pot += callAmount;
            player.hasActedThisRound = true;
            actionDescription = `${player.displayName} called $${callAmount}`;
          }
        }
        break;

      case BetAction.ALL_IN:
        {
          // Player is going all-in with their entire stack
          const allInAmount = playerChips;
          if (allInAmount <= 0) {
            throw new Error('You have no chips to go all-in with');
          }

          pot += allInAmount;
          player.currentRoundBet = playerCurrentRoundBet + allInAmount;
          player.totalContribution = (player.totalContribution || 0) + allInAmount;

          // If this all-in is a raise (exceeds current bet), update the bet and reset other players
          if (player.currentRoundBet > currentBet) {
            newCurrentBet = Math.floor(player.currentRoundBet);
            // Reset hasActed for other active players since there's a raise
            players.forEach((p, i) => {
              if (i !== playerIndex && p.status === 'active') {
                p.hasActedThisRound = false;
              }
            });
          }

          player.chips = 0;
          player.status = 'all-in';
          player.hasActedThisRound = true;
          actionDescription = `${player.displayName} went all-in for $${allInAmount}`;
        }
        break;

      case BetAction.BET:
      case BetAction.RAISE:
        {
          // For RAISE, amount is the total bet (not additional)
          // For BET (when currentBet is 0), amount is the bet size
          const totalBetAmount = Math.floor(amount);
          const additionalAmount = Math.floor(totalBetAmount - playerCurrentRoundBet);

          // Validate minimum raise (unless going all-in)
          if (totalBetAmount < currentBet + minBet && playerChips > additionalAmount) {
            throw new Error(`Minimum raise is $${currentBet + minBet} (you tried $${totalBetAmount})`);
          }

          if (additionalAmount <= 0) {
            throw new Error(`Raise amount must be greater than current bet ($${currentBet})`);
          }

          if (additionalAmount > playerChips) {
            throw new Error(`Insufficient chips - you have $${playerChips}, need $${additionalAmount}`);
          }

          if (playerChips <= additionalAmount) {
            // All-in raise
            pot += playerChips;
            player.currentRoundBet = playerCurrentRoundBet + playerChips;
            player.totalContribution = (player.totalContribution || 0) + playerChips;
            if (player.currentRoundBet > currentBet) {
              newCurrentBet = Math.floor(player.currentRoundBet);
            }
            player.chips = 0;
            player.status = 'all-in';
            player.hasActedThisRound = true;
            actionDescription = `${player.displayName} raised all-in to $${player.currentRoundBet}`;
            // Reset hasActed for other players since there's a raise
            players.forEach((p, i) => {
              if (i !== playerIndex && p.status === 'active') {
                p.hasActedThisRound = false;
              }
            });
          } else {
            // Regular raise
            player.chips = playerChips - additionalAmount;
            player.currentRoundBet = totalBetAmount;
            player.totalContribution = (player.totalContribution || 0) + additionalAmount;
            pot += additionalAmount;
            newCurrentBet = totalBetAmount;
            player.hasActedThisRound = true;
            actionDescription = currentBet === 0
              ? `${player.displayName} bet $${totalBetAmount}`
              : `${player.displayName} raised to $${totalBetAmount}`;
            // Reset hasActed for other players since there's a raise
            players.forEach((p, i) => {
              if (i !== playerIndex && p.status === 'active') {
                p.hasActedThisRound = false;
              }
            });
          }
        }
        break;

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    players[playerIndex] = player;

    // Check if only one player remains
    const activePlayersCount = GameService.countActivePlayers(players);
    if (activePlayersCount === 1) {
      // Hand is over, award pot to winner
      const winner = players.find((p) => p.status === 'active' || p.status === 'all-in');
      let winnerDescription = '';
      if (winner) {
        winner.chips += pot;
        winnerDescription = `${winner.displayName} wins $${pot} (others folded)`;
      }

      // Reset totalContribution for next hand
      players.forEach(p => {
        p.totalContribution = 0;
      });

      // Get updated activity log with player info for color coding
      const activityLog = await GameService.addActivityEvent(tableId, actionDescription, player.uid, player.displayName);
      if (winnerDescription) {
        activityLog.push({
          type: 'game_event',
          eventType: 'win',
          text: winnerDescription,
          playerUid: winner?.uid || null,
          playerName: winner?.displayName || null,
          timestamp: Date.now(),
        });
      }

      await GameService.updateTable(tableId, {
        players,
        pot: 0,
        pots: [],
        currentBet: 0,
        phase: 'SHOWDOWN',
        turnDeadline: null,
        chatLog: activityLog,
      });
      return { success: true, action, actionDescription };
    }

    // Check if betting round is complete
    const roundComplete = GameService.isBettingRoundComplete(players, newCurrentBet);

    // Determine game type from config
    const gameType = tableData.config?.gameType || 'lowball_27';
    const isHoldem = gameType === 'holdem';

    // Phase transitions depend on game type
    const phaseAfterBet = isHoldem ? {
      PREFLOP: 'FLOP',
      FLOP: 'TURN',
      TURN: 'RIVER',
      RIVER: 'SHOWDOWN',
    } : {
      BETTING_1: 'DRAW_1',
      BETTING_2: 'DRAW_2',
      BETTING_3: 'DRAW_3',
      BETTING_4: 'SHOWDOWN',
    };

    // Add activity event for this action with player info for color coding
    const activityLog = await GameService.addActivityEvent(tableId, actionDescription, player.uid, player.displayName);

    if (roundComplete) {
      // Calculate side pots when betting round completes
      const sidePots = calculateSidePots(players);

      // Reset currentRoundBet for next phase (but keep totalContribution)
      players.forEach((p) => {
        p.currentRoundBet = 0;
        p.hasActedThisRound = false;
      });

      // Find first active player for next phase
      const nextPhase = phaseAfterBet[tableData.phase];
      const isShowdown = nextPhase === 'SHOWDOWN';
      const isDrawPhase = !isHoldem && nextPhase?.startsWith('DRAW_');
      const isCommunityCardPhase = isHoldem && ['FLOP', 'TURN', 'RIVER'].includes(nextPhase);

      // For draw phases (Lowball), include all-in players since they must still draw
      // For betting phases, only active players with chips can act
      let activeIndices;
      if (isDrawPhase) {
        // All-in players participate in draw and can choose to discard or stand pat
        activeIndices = players
          .map((p, i) => (p.status === 'active' || p.status === 'all-in' ? i : -1))
          .filter((i) => i !== -1);
      } else {
        activeIndices = players
          .map((p, i) => (p.status === 'active' && p.chips > 0 ? i : -1))
          .filter((i) => i !== -1);
      }

      // If going to showdown, calculate result and award pot
      let showdownResult = null;
      let updatedPlayers = players;
      let updatedPot = pot;
      let updatedActivityLog = activityLog;

      if (isShowdown) {
        const communityCards = tableData.communityCards || [];
        showdownResult = calculateShowdownResult(players, pot, gameType, communityCards);

        // Award pot to winner(s)
        updatedPlayers = players.map(p => {
          const winner = showdownResult.winners.find(w => w.uid === p.uid);
          if (winner) {
            return { ...p, chips: p.chips + winner.amount };
          }
          return p;
        });

        // Reset totalContribution for next hand
        updatedPlayers.forEach(p => {
          p.totalContribution = 0;
        });

        updatedPot = 0;

        // Add winner message to activity log with winner info for color coding
        if (showdownResult.message) {
          const firstWinner = showdownResult.winners?.[0];
          updatedActivityLog = [...activityLog, {
            type: 'game_event',
            eventType: 'win',
            text: showdownResult.message,
            playerUid: firstWinner?.uid || null,
            playerName: firstWinner?.displayName || null,
            timestamp: Date.now(),
          }];
        }
      }

      // For Hold'em community card phases, deal the cards
      if (isCommunityCardPhase) {
        await GameService.dealCommunityCards(tableId, { ...tableData, players }, nextPhase);
        return { success: true, action, actionDescription };
      }

      // Determine first player for next phase based on phase type
      let firstToAct;
      if (isDrawPhase) {
        // Draw phases: start with first player after dealer (includes all-in players)
        firstToAct = GameService.getFirstToActAfterDealer(players, tableData, true);
      } else if (activeIndices.length > 0) {
        firstToAct = activeIndices[0];
      } else {
        firstToAct = 0;
      }

      await GameService.updateTable(tableId, {
        players: updatedPlayers,
        pot: updatedPot,
        pots: isShowdown ? [] : sidePots,
        currentBet: 0,
        phase: nextPhase,
        activePlayerIndex: firstToAct,
        turnDeadline: isShowdown ? null : GameService.calculateTurnDeadline(),
        chatLog: updatedActivityLog,
        showdownResult: isShowdown ? showdownResult : null,
      });
    } else {
      // Move to next player
      const nextPlayerIndex = GameService.findNextActivePlayer(players, playerIndex);

      // If no player can act (all are all-in/folded), check if round should complete
      if (nextPlayerIndex === -1) {
        // Re-check if round is complete now that this player has acted
        const shouldComplete = GameService.isBettingRoundComplete(players, newCurrentBet);
        if (shouldComplete) {
          // Round is complete, advance to next phase
          // Use game type-specific phase transitions
          const phaseAfterBetInner = isHoldem ? {
            PREFLOP: 'FLOP',
            FLOP: 'TURN',
            TURN: 'RIVER',
            RIVER: 'SHOWDOWN',
          } : {
            BETTING_1: 'DRAW_1',
            BETTING_2: 'DRAW_2',
            BETTING_3: 'DRAW_3',
            BETTING_4: 'SHOWDOWN',
          };
          const nextPhase = phaseAfterBetInner[tableData.phase];
          const isShowdown = nextPhase === 'SHOWDOWN';
          const isDrawPhase = !isHoldem && nextPhase?.startsWith('DRAW_');
          const isCommunityCardPhase = isHoldem && ['FLOP', 'TURN', 'RIVER'].includes(nextPhase);

          // Find first player for next phase
          let activeIndices;
          if (isDrawPhase) {
            activeIndices = players
              .map((p, i) => (p.status === 'active' || p.status === 'all-in' ? i : -1))
              .filter((i) => i !== -1);
          } else {
            activeIndices = players
              .map((p, i) => (p.status === 'active' && p.chips > 0 ? i : -1))
              .filter((i) => i !== -1);
          }

          // If going to showdown, calculate result and award pot
          let showdownResult = null;
          let updatedPlayers = players;
          let updatedPot = pot;
          let updatedActivityLog = activityLog;

          if (isShowdown) {
            const communityCards = tableData.communityCards || [];
            showdownResult = calculateShowdownResult(players, pot, gameType, communityCards);

            // Award pot to winner(s)
            updatedPlayers = players.map(p => {
              const winner = showdownResult.winners.find(w => w.uid === p.uid);
              if (winner) {
                return { ...p, chips: p.chips + winner.amount };
              }
              return p;
            });

            // Reset totalContribution for next hand
            updatedPlayers.forEach(p => {
              p.totalContribution = 0;
            });

            updatedPot = 0;

            // Add winner message to activity log with winner info for color coding
            if (showdownResult.message) {
              const firstWinner = showdownResult.winners?.[0];
              updatedActivityLog = [...activityLog, {
                type: 'game_event',
                eventType: 'win',
                text: showdownResult.message,
                playerUid: firstWinner?.uid || null,
                playerName: firstWinner?.displayName || null,
                timestamp: Date.now(),
              }];
            }
          }

          // For Hold'em community card phases, deal the cards
          if (isCommunityCardPhase) {
            await GameService.dealCommunityCards(tableId, { ...tableData, players }, nextPhase);
            return { success: true, action, actionDescription };
          }

          // Determine first player for next phase based on phase type
          let firstToActInner;
          if (isDrawPhase) {
            // Draw phases: start with first player after dealer (includes all-in players)
            firstToActInner = GameService.getFirstToActAfterDealer(players, tableData, true);
          } else if (activeIndices.length > 0) {
            firstToActInner = activeIndices[0];
          } else {
            firstToActInner = 0;
          }

          await GameService.updateTable(tableId, {
            players: updatedPlayers,
            pot: updatedPot,
            pots: isShowdown ? [] : calculateSidePots(players),
            currentBet: 0,
            phase: nextPhase,
            activePlayerIndex: firstToActInner,
            turnDeadline: isShowdown ? null : GameService.calculateTurnDeadline(),
            chatLog: updatedActivityLog,
            showdownResult: isShowdown ? showdownResult : null,
          });
        } else {
          // Round not complete but no one can act - this shouldn't happen, but set to 0 as fallback
          await GameService.updateTable(tableId, {
            players,
            pot,
            currentBet: newCurrentBet,
            activePlayerIndex: 0,
            turnDeadline: null,
            chatLog: activityLog,
          });
        }
      } else {
        await GameService.updateTable(tableId, {
          players,
          pot,
          currentBet: newCurrentBet,
          activePlayerIndex: nextPlayerIndex,
          turnDeadline: GameService.calculateTurnDeadline(),
          chatLog: activityLog,
        });
      }
    }

    return { success: true, action, actionDescription };
  }

  /**
   * Submit a bet action (legacy - calls performBetAction)
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @param {string} playerUid - The player's UID
   * @param {number} amount - Bet amount (0 for check/call)
   * @returns {Promise<void>}
   */
  static async submitBet(tableId, tableData, playerUid, amount = 0) {
    const playerIndex = tableData.players.findIndex((p) => p.uid === playerUid);
    const player = tableData.players[playerIndex];
    const currentBet = tableData.currentBet || 0;

    // Determine action based on amount
    let action;
    if (amount === 0) {
      if (player.currentRoundBet >= currentBet) {
        action = BetAction.CHECK;
      } else {
        action = BetAction.CALL;
      }
    } else if (amount > currentBet) {
      action = currentBet === 0 ? BetAction.BET : BetAction.RAISE;
    } else {
      action = BetAction.CALL;
    }

    await GameService.performBetAction(tableId, tableData, playerUid, action, amount);
  }

  /**
   * Auto-action for timed out player
   * - Betting phase: Auto-check if possible, otherwise auto-fold
   * - Draw phase: Auto stand pat (discard nothing)
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @param {string} playerUid - The player's UID
   * @returns {Promise<void>}
   */
  static async handleTimeout(tableId, tableData, playerUid) {
    const playerIndex = tableData.players.findIndex((p) => p.uid === playerUid);
    if (playerIndex === -1 || playerIndex !== tableData.activePlayerIndex) {
      return; // Not this player's turn
    }

    const phase = tableData.phase;
    const isDrawPhase = phase?.startsWith('DRAW_');
    // Include both Lowball betting phases and Hold'em phases
    const isBettingPhase = phase?.startsWith('BETTING_') ||
                           ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(phase);

    if (isDrawPhase) {
      // Auto stand pat (discard nothing) in draw phases
      await GameService.submitDraw(tableId, tableData, playerUid, []);
    } else if (isBettingPhase) {
      const player = tableData.players[playerIndex];
      const currentBet = tableData.currentBet || 0;

      // Auto-check if possible, otherwise auto-fold
      if (player.currentRoundBet >= currentBet) {
        await GameService.performBetAction(tableId, tableData, playerUid, BetAction.CHECK);
      } else {
        await GameService.performBetAction(tableId, tableData, playerUid, BetAction.FOLD);
      }
    }
  }

  /**
   * Claim a timeout via Cloud Function (Passive Timer System)
   *
   * This is the primary method for enforcing timeouts. It can be called by ANY
   * player at the table when the timer expires. The Cloud Function validates
   * that the deadline has actually passed using server time.
   *
   * ANTI-HANG LOGIC:
   * - ANY player can trigger timeout (not just the active player)
   * - Server validates turnDeadline against server time (anti-cheat)
   * - Atomic transaction ensures exactly one timeout action
   * - Fallback to client-side timeout if Cloud Function unavailable
   *
   * @param {string} tableId - The table ID
   * @returns {Promise<Object>} - { success: boolean, action?: string, message?: string }
   */
  static async claimTimeout(tableId) {
    try {
      // Call the Cloud Function for server-validated timeout
      const handleTimeoutFn = httpsCallable(functions, 'handleTimeout');
      const result = await handleTimeoutFn({ tableId });
      return result.data;
    } catch (error) {
      console.error('claimTimeout error:', error);

      // If Cloud Function fails, return error info
      // The caller can decide whether to fall back to client-side handling
      return {
        success: false,
        error: error.message || 'Failed to claim timeout',
        code: error.code,
      };
    }
  }

  /**
   * Fallback client-side timeout handler (legacy)
   *
   * This method is kept for backwards compatibility and as a fallback
   * when Cloud Functions are unavailable. It should only be used when:
   * 1. Cloud Functions are not deployed
   * 2. The calling player IS the active player (for security)
   *
   * For production, use claimTimeout() instead.
   *
   * @deprecated Use claimTimeout() for server-validated timeouts
   */
  static async handleTimeoutFallback(tableId, tableData, playerUid) {
    // Same logic as original handleTimeout
    const playerIndex = tableData.players.findIndex((p) => p.uid === playerUid);
    if (playerIndex === -1 || playerIndex !== tableData.activePlayerIndex) {
      return; // Not this player's turn
    }

    const phase = tableData.phase;
    const isDrawPhase = phase?.startsWith('DRAW_');
    const isBettingPhase = phase?.startsWith('BETTING_') ||
                           ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(phase);

    if (isDrawPhase) {
      await GameService.submitDraw(tableId, tableData, playerUid, []);
    } else if (isBettingPhase) {
      const player = tableData.players[playerIndex];
      const currentBet = tableData.currentBet || 0;

      if (player.currentRoundBet >= currentBet) {
        await GameService.performBetAction(tableId, tableData, playerUid, BetAction.CHECK);
      } else {
        await GameService.performBetAction(tableId, tableData, playerUid, BetAction.FOLD);
      }
    }
  }

  // ============================================
  // DRAW OPERATIONS
  // ============================================

  /**
   * Submit a draw action for the current player
   * All-in players automatically stand pat and cannot discard cards.
   *
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @param {string} playerUid - The player's UID
   * @param {number[]} cardIndices - Indices of cards to discard
   * @returns {Promise<void>}
   */
  static async submitDraw(tableId, tableData, playerUid, cardIndices = []) {
    const playerIndex = tableData.players.findIndex((p) => p.uid === playerUid);
    if (playerIndex === -1) {
      throw new Error('Player not found');
    }

    if (playerIndex !== tableData.activePlayerIndex) {
      throw new Error('Not your turn');
    }

    let deck = [...tableData.deck];
    let muck = [...(tableData.muck || [])];
    const players = tableData.players.map(p => ({ ...p }));
    const player = players[playerIndex];
    let hand = [...player.hand];

    // All-in players CAN still discard cards - they just can't bet
    const isAllIn = player.status === 'all-in';
    const effectiveCardIndices = cardIndices;

    // Sort indices in descending order to remove from end first
    const sortedIndices = [...effectiveCardIndices].sort((a, b) => b - a);

    // Remove discarded cards and add them to the muck
    const discardedCards = [];
    for (const index of sortedIndices) {
      if (index >= 0 && index < hand.length) {
        const discarded = hand.splice(index, 1)[0];
        discardedCards.push(discarded);
      }
    }

    // Add discarded cards to muck
    muck = [...muck, ...discardedCards];

    // Deal replacement cards (reshuffle muck if needed)
    const numToDraw = effectiveCardIndices.length;

    // Check if we need to reshuffle the muck
    if (numToDraw > 0) {
      const reshuffled = GameService.reshuffleMuckIfNeeded(deck, muck, numToDraw);
      deck = reshuffled.deck;
      muck = reshuffled.muck;
    }

    // Draw replacement cards
    for (let i = 0; i < numToDraw && deck.length > 0; i++) {
      hand.push(deck.shift());
    }

    player.hand = hand;
    player.cardsToDiscard = [];
    player.hasActedThisRound = true;

    // Set lastAction to show what the player did
    const actionText = numToDraw === 0 ? 'Stood Pat' : `Drew ${numToDraw}`;
    player.lastAction = actionText;

    // Create activity log description
    let drawDescription;
    if (numToDraw === 0) {
      drawDescription = isAllIn 
        ? `${player.displayName} stood pat (all-in)`
        : `${player.displayName} stood pat`;
    } else {
      drawDescription = isAllIn
        ? `${player.displayName} drew ${numToDraw} card${numToDraw > 1 ? 's' : ''} (all-in)`
        : `${player.displayName} drew ${numToDraw} card${numToDraw > 1 ? 's' : ''}`;
    }

    // Get all players still in hand (active or all-in, not folded)
    const playersInHand = players
      .map((p, i) => ({ player: p, index: i }))
      .filter(({ player: p }) => p.status === 'active' || p.status === 'all-in');

    // Find next player who needs to act (hasn't acted yet)
    // All-in players participate in draw phases and can choose to discard or stand pat
    let nextPlayerIndex = -1;
    for (let i = 1; i <= playersInHand.length; i++) {
      const lookupIdx = (playersInHand.findIndex(p => p.index === playerIndex) + i) % playersInHand.length;
      const candidate = playersInHand[lookupIdx];
      if (!candidate.player.hasActedThisRound) {
        nextPlayerIndex = candidate.index;
        break;
      }
    }

    const roundComplete = nextPlayerIndex === -1;

    // Determine next phase - normally goes to betting, but if no one can bet, skip to next draw
    const phaseAfterDraw = {
      DRAW_1: 'BETTING_2',
      DRAW_2: 'BETTING_3',
      DRAW_3: 'BETTING_4',
    };
    
    // Map betting phases to their subsequent draw phases (for skipping when all are all-in)
    const phaseAfterBetting = {
      BETTING_2: 'DRAW_2',
      BETTING_3: 'DRAW_3',
      BETTING_4: 'SHOWDOWN',
    };

    // Add activity event for this draw with player info for color coding
    const activityLog = await GameService.addActivityEvent(tableId, drawDescription, player.uid, player.displayName);

    const updates = {
      deck,
      muck,
      players,
      chatLog: activityLog,
    };

    if (roundComplete) {
      // Reset for next phase - clear lastAction when moving to betting
      players.forEach((p) => {
        p.hasActedThisRound = false;
        p.lastAction = null;
      });

      const nextPhase = phaseAfterDraw[tableData.phase];

      // For betting phase, find first active player with chips (skip all-in)
      const bettingActiveIndices = players
        .map((p, i) => (p.status === 'active' && p.chips > 0 ? i : -1))
        .filter((i) => i !== -1);

      // Check if no one can bet (all players are all-in or folded)
      // A single active player with chips should still be able to check/act
      const canAnyoneBet = bettingActiveIndices.length >= 1;

      if (!canAnyoneBet) {
        // No betting possible - skip the betting phase
        // Determine the phase after the betting phase we're skipping
        const phaseAfterSkippedBetting = phaseAfterBetting[nextPhase];
        
        if (phaseAfterSkippedBetting === 'SHOWDOWN') {
          // After DRAW_3, there are no more draw opportunities - go to showdown
          const showdownResult = calculateShowdownResult(players, tableData.pot);

          // Award pot to winner(s)
          const updatedPlayers = players.map(p => {
            const winner = showdownResult.winners.find(w => w.uid === p.uid);
            if (winner) {
              return { ...p, chips: p.chips + winner.amount };
            }
            return p;
          });

          // Reset totalContribution for next hand
          updatedPlayers.forEach(p => {
            p.totalContribution = 0;
          });

          updates.phase = 'SHOWDOWN';
          updates.turnDeadline = null;
          updates.activePlayerIndex = 0;
          updates.players = updatedPlayers;
          updates.pot = 0;
          updates.pots = [];
          updates.showdownResult = showdownResult;

          // Add winner message to activity log with winner info for color coding
          if (showdownResult.message) {
            const firstWinner = showdownResult.winners?.[0];
            updates.chatLog = [...activityLog, {
              type: 'game_event',
              eventType: 'win',
              text: showdownResult.message,
              playerUid: firstWinner?.uid || null,
              playerName: firstWinner?.displayName || null,
              timestamp: Date.now(),
            }];
          }
        } else {
          // Skip to next draw phase (DRAW_2 or DRAW_3)
          // All-in players still get to draw cards
          updates.phase = phaseAfterSkippedBetting;
          updates.turnDeadline = GameService.calculateTurnDeadline();

          // Draw phase: start with first player after dealer (includes all-in players)
          updates.activePlayerIndex = GameService.getFirstToActAfterDealer(players, tableData, true);
          updates.players = players;
        }
      } else {
        // Normal case - proceed to betting phase
        // Use proper post-draw starting position (SB for standard, BB for heads-up)
        const firstToAct = GameService.getFirstToActPostDraw(players, tableData);
        // Make sure the first to act is in the bettingActiveIndices list
        const validFirstToAct = bettingActiveIndices.includes(firstToAct)
          ? firstToAct
          : bettingActiveIndices[0];

        updates.phase = nextPhase;
        updates.activePlayerIndex = validFirstToAct;
        updates.currentBet = 0;
        updates.turnDeadline = GameService.calculateTurnDeadline();
        updates.players = players;
      }
    } else {
      // Move to next player who hasn't acted yet
      updates.activePlayerIndex = nextPlayerIndex;
      updates.turnDeadline = GameService.calculateTurnDeadline();
    }

    await GameService.updateTable(tableId, updates);
  }

  /**
   * Start a new hand (reset for next round)
   * Uses a transaction to read fresh data and prevent race conditions
   * Also handles pending sit outs and auto-promotes waiting railbirds after the phase becomes IDLE
   * @param {string} tableId - The table ID
   * @param {Object} _tableData - Current table data (unused, we read fresh data in transaction)
   * @returns {Promise<void>}
   */
  static async startNextHand(tableId, _tableData) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    // Use a transaction to read fresh data and prevent race conditions
    const freshTableData = await runTransaction(db, async (transaction) => {
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists()) {
        throw new Error('Table not found');
      }

      const tableData = tableDoc.data();
      let railbirds = [...(tableData.railbirds || [])];

      // Handle pending sit outs - demote players with pendingSitOut flag to railbirds
      const playersWithPendingSitOut = tableData.players.filter((p) => p.pendingSitOut === true);
      const playersStaying = tableData.players.filter((p) => p.pendingSitOut !== true);

      // Process pending sit outs - return chips and convert to railbirds
      for (const player of playersWithPendingSitOut) {
        // Return chips to wallet
        if (player.chips > 0) {
          const userRef = doc(db, USERS_COLLECTION, player.uid);
          const userSnap = await transaction.get(userRef);
          if (userSnap.exists()) {
            const currentBalance = userSnap.data().balance || 0;
            transaction.update(userRef, {
              balance: currentBalance + player.chips,
            });
          }
        }

        // Convert to railbird
        const newRailbird = {
          uid: player.uid,
          displayName: player.displayName,
          photoURL: player.photoURL || null,
          joinedAt: Date.now(),
          wantsToPlay: false,
        };
        railbirds.push(newRailbird);
      }

      // Reset remaining players for new hand
      const players = playersStaying.map((player) => ({
        ...player,
        hand: [],
        status: player.chips > 0 ? 'active' : 'sitting_out',
        cardsToDiscard: [],
        currentRoundBet: 0,
        totalContribution: 0, // Reset for new hand
        hasActedThisRound: false,
        lastAction: null, // Clear action text for new hand
        pendingSitOut: undefined, // Clear any lingering flag
      }));

      // Move dealer button - dealerIndex is a position among active players
      const activePlayerCount = players.filter((p) => p.status === 'active').length;
      const newDealerIndex = ((tableData.dealerIndex || 0) + 1) % Math.max(activePlayerCount, 1);

      transaction.update(tableRef, {
        phase: 'IDLE',
        deck: GameService.createShuffledDeck(),
        muck: [], // Clear muck for new hand
        pot: 0,
        pots: [], // Clear side pots
        currentBet: 0,
        players,
        railbirds,
        activePlayerIndex: 0,
        dealerIndex: newDealerIndex,
        // Clear seat indices - will be recalculated when dealing
        dealerSeatIndex: null,
        smallBlindSeatIndex: null,
        bigBlindSeatIndex: null,
        // Clear showdown result
        showdownResult: null,
        turnDeadline: null,
        // Clear community cards for Hold'em
        communityCards: [],
        lastUpdated: serverTimestamp(),
      });

      // Return the updated data for autoPromoteRailbirds
      return {
        ...tableData,
        players,
        phase: 'IDLE',
        railbirds: tableData.railbirds || [],
      };
    });

    // Auto-promote any waiting railbirds now that the game is IDLE
    try {
      await GameService.autoPromoteRailbirds(tableId, freshTableData);
    } catch (err) {
      // Log but don't fail the whole operation if promotion fails
      console.error('Error auto-promoting railbirds:', err);
    }
  }

  /**
   * Leave a table (with cash out)
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @param {string} playerUid - The player's UID
   * @returns {Promise<void>}
   */
  static async leaveTable(tableId, tableData, playerUid) {
    // Try to cash out first (this handles the removal atomically)
    try {
      await GameService.cashOutFromTable(tableId, playerUid);
    } catch (err) {
      // If cash out fails, try to handle gracefully by:
      // 1. Adding chips back to wallet manually
      // 2. Removing player from table
      console.error('Cash out failed during leave:', err);

      // Find the player's chips from local data
      const leavingPlayer = tableData.players.find((p) => p.uid === playerUid);
      const chipsToReturn = leavingPlayer?.chips || 0;

      // Try to add chips back to wallet if player had any
      if (chipsToReturn > 0) {
        try {
          const userRef = doc(db, USERS_COLLECTION, playerUid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const currentBalance = userSnap.data().balance || 0;
            await updateDoc(userRef, {
              balance: currentBalance + chipsToReturn,
            });
          }
        } catch (walletErr) {
          console.error('Failed to return chips to wallet:', walletErr);
        }
      }

      const players = tableData.players.filter((p) => p.uid !== playerUid);

      if (players.length === 0) {
        await GameService.updateTable(tableId, {
          phase: 'IDLE',
          players: [],
          pot: 0,
          currentBet: 0,
          deck: GameService.createShuffledDeck(),
        });
      } else {
        let activeIndex = tableData.activePlayerIndex;
        const leavingPlayerIndex = tableData.players.findIndex(
          (p) => p.uid === playerUid
        );

        if (leavingPlayerIndex <= activeIndex && activeIndex > 0) {
          activeIndex--;
        }
        if (activeIndex >= players.length) {
          activeIndex = 0;
        }

        await GameService.updateTable(tableId, {
          players,
          activePlayerIndex: activeIndex,
        });
      }
    }
  }

  // ============================================
  // STALE TABLE CLEANUP OPERATIONS
  // ============================================

  /**
   * Stale table threshold in milliseconds (3 hours)
   */
  static STALE_TABLE_THRESHOLD_MS = 3 * 60 * 60 * 1000;

  /**
   * Clean up stale tables that have been inactive for more than 3 hours
   * This runs client-side since we're on Firebase Free Plan (no scheduled functions)
   *
   * Before deleting:
   * 1. Refund all players' chips back to their wallets
   * 2. Delete the table document
   *
   * @returns {Promise<{cleaned: number, errors: string[]}>}
   */
  static async cleanupStaleTables() {
    if (!db) {
      return { cleaned: 0, errors: ['Firestore not initialized'] };
    }

    const errors = [];
    let cleaned = 0;

    try {
      // Calculate the cutoff time (3 hours ago)
      const cutoffTime = new Date(Date.now() - GameService.STALE_TABLE_THRESHOLD_MS);
      const cutoffTimestamp = Timestamp.fromDate(cutoffTime);

      // Query for stale tables
      const tablesRef = collection(db, TABLES_COLLECTION);
      const staleQuery = query(
        tablesRef,
        where('lastUpdated', '<', cutoffTimestamp)
      );

      const staleTablesSnap = await getDocs(staleQuery);

      if (staleTablesSnap.empty) {
        return { cleaned: 0, errors: [] };
      }

      console.log(`[Cleanup] Found ${staleTablesSnap.size} stale tables to clean up`);

      // Process each stale table
      for (const tableDoc of staleTablesSnap.docs) {
        const tableId = tableDoc.id;
        const tableData = tableDoc.data();

        try {
          // Step 1: Refund all players' chips back to their wallets
          if (tableData.players && tableData.players.length > 0) {
            for (const player of tableData.players) {
              if (player.chips > 0 && player.uid) {
                try {
                  await GameService.refundPlayerChips(player.uid, player.chips);
                  console.log(`[Cleanup] Refunded $${player.chips} to ${player.displayName || player.uid}`);
                } catch (refundError) {
                  errors.push(`Failed to refund ${player.uid}: ${refundError.message}`);
                }
              }
            }
          }

          // Also refund any chips in the pot (split evenly among players if possible)
          if (tableData.pot > 0 && tableData.players && tableData.players.length > 0) {
            const playersWithUid = tableData.players.filter(p => p.uid);
            if (playersWithUid.length > 0) {
              const refundPerPlayer = Math.floor(tableData.pot / playersWithUid.length);
              for (const player of playersWithUid) {
                try {
                  await GameService.refundPlayerChips(player.uid, refundPerPlayer);
                  console.log(`[Cleanup] Refunded pot share $${refundPerPlayer} to ${player.displayName || player.uid}`);
                } catch (refundError) {
                  errors.push(`Failed to refund pot to ${player.uid}: ${refundError.message}`);
                }
              }
            }
          }

          // Step 2: Delete the table document
          const tableRef = doc(db, TABLES_COLLECTION, tableId);
          await deleteDoc(tableRef);
          console.log(`[Cleanup] Deleted stale table: ${tableId}`);
          cleaned++;
        } catch (tableError) {
          errors.push(`Failed to clean up table ${tableId}: ${tableError.message}`);
        }
      }
    } catch (queryError) {
      errors.push(`Failed to query stale tables: ${queryError.message}`);
    }

    return { cleaned, errors };
  }

  /**
   * Refund chips to a player's wallet
   * @param {string} uid - Player's Firebase UID
   * @param {number} amount - Amount to refund
   */
  static async refundPlayerChips(uid, amount) {
    if (!db || !uid || amount <= 0) return;

    const userRef = doc(db, USERS_COLLECTION, uid);

    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        // Create user document if it doesn't exist
        transaction.set(userRef, {
          balance: amount,
          createdAt: serverTimestamp(),
        });
      } else {
        const currentBalance = userDoc.data().balance || 0;
        transaction.update(userRef, {
          balance: currentBalance + amount,
        });
      }
    });
  }

  /**
   * Check if cleanup should run (rate limiting)
   * Returns true if at least 5 minutes have passed since last cleanup
   */
  static shouldRunCleanup() {
    const lastCleanup = localStorage.getItem('lastTableCleanup');
    if (!lastCleanup) return true;

    const lastCleanupTime = parseInt(lastCleanup, 10);
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastCleanupTime > fiveMinutes;
  }

  /**
   * Mark that cleanup has run (for rate limiting)
   */
  static markCleanupRun() {
    localStorage.setItem('lastTableCleanup', Date.now().toString());
  }

  // ============================================
  // SHOW/MUCK HAND OPERATIONS
  // ============================================

  /**
   * Reveal a player's hand at showdown (show instead of muck)
   * Used when a player chooses to show their cards after winning uncontested
   * or when a losing player wants to show their hand
   * @param {string} tableId - The table ID
   * @param {string} playerUid - The player's UID
   * @returns {Promise<void>}
   */
  static async revealHand(tableId, playerUid) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      throw new Error('Table not found');
    }

    const tableData = tableSnap.data();

    // Can only reveal hands during showdown phase
    if (tableData.phase !== 'SHOWDOWN') {
      throw new Error('Can only reveal hands during showdown');
    }

    const players = tableData.players.map(p => {
      if (p.uid === playerUid) {
        return { ...p, handRevealed: true };
      }
      return p;
    });

    // Add activity event with player info for color coding
    const revealingPlayer = players.find(p => p.uid === playerUid);
    const activityLog = tableData.chatLog || [];
    activityLog.push({
      type: 'game_event',
      eventType: 'reveal',
      text: `${revealingPlayer?.displayName || 'Player'} shows their hand`,
      playerUid: playerUid,
      playerName: revealingPlayer?.displayName || null,
      timestamp: Date.now(),
    });

    await updateDoc(tableRef, {
      players,
      chatLog: activityLog,
      lastUpdated: serverTimestamp(),
    });
  }

  // ============================================
  // CHAT & ACTIVITY LOG OPERATIONS
  // ============================================

  /**
   * Maximum number of messages (chat + game events) to keep in the log
   */
  static MAX_CHAT_MESSAGES = 50;

  /**
   * Centralized game event logger - ensures all game actions are reliably logged
   * This function should be called immediately after every successful state change
   *
   * @param {string} tableId - The table ID
   * @param {string} eventType - Type of event (bet, fold, check, call, raise, draw, win, etc.)
   * @param {Object} payload - Event payload containing:
   *   - text: Description of the game event
   *   - playerUid: UID of the player who performed the action (optional, for color coding)
   *   - playerName: Display name of the player (optional)
   * @returns {Promise<Array>} - Updated activity log array
   */
  static async logGameEvent(tableId, eventType, payload) {
    if (!db || !payload?.text) {
      console.warn('logGameEvent called without required parameters');
      return [];
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      console.warn(`logGameEvent: Table ${tableId} not found`);
      return [];
    }

    const tableData = tableSnap.data();
    let chatLog = tableData.chatLog || [];

    // Create enhanced game event with player info for color coding
    const newEvent = {
      type: 'game_event',
      eventType: eventType, // e.g., 'bet', 'fold', 'draw', 'win'
      text: payload.text,
      playerUid: payload.playerUid || null, // For color coding
      playerName: payload.playerName || null,
      timestamp: Date.now(),
    };

    chatLog.push(newEvent);

    // Keep only the last MAX_CHAT_MESSAGES entries
    if (chatLog.length > GameService.MAX_CHAT_MESSAGES) {
      chatLog = chatLog.slice(-GameService.MAX_CHAT_MESSAGES);
    }

    return chatLog;
  }

  /**
   * Add a game activity event to the activity log (legacy wrapper)
   * @param {string} tableId - The table ID
   * @param {string} eventText - Description of the game event
   * @param {string} playerUid - Optional UID of the acting player for color coding
   * @param {string} playerName - Optional display name of the player
   * @returns {Promise<Array>} - Updated activity log array
   */
  static async addActivityEvent(tableId, eventText, playerUid = null, playerName = null) {
    return GameService.logGameEvent(tableId, 'action', {
      text: eventText,
      playerUid,
      playerName,
    });
  }

  /**
   * Send a chat message to a table
   * @param {string} tableId - The table ID
   * @param {string} senderName - Display name of the sender
   * @param {string} text - Message text
   * @returns {Promise<void>}
   */
  static async sendChatMessage(tableId, senderName, text) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    if (!text || text.trim().length === 0) {
      return; // Don't send empty messages
    }

    // Limit message length
    const trimmedText = text.trim().slice(0, 200);

    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      throw new Error('Table not found');
    }

    const tableData = tableSnap.data();
    let chatLog = tableData.chatLog || [];

    // Add new message with type 'chat' to distinguish from game events
    const newMessage = {
      type: 'chat',
      sender: senderName,
      text: trimmedText,
      timestamp: Date.now(),
    };

    chatLog.push(newMessage);

    // Keep only the last MAX_CHAT_MESSAGES messages
    if (chatLog.length > GameService.MAX_CHAT_MESSAGES) {
      chatLog = chatLog.slice(-GameService.MAX_CHAT_MESSAGES);
    }

    await updateDoc(tableRef, {
      chatLog,
      lastUpdated: serverTimestamp(),
    });
  }
}
