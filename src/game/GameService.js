import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Deck } from './Deck';

const TABLES_COLLECTION = 'tables';
const USERS_COLLECTION = 'users';
const DEFAULT_STARTING_BALANCE = 10000;
const DEFAULT_MIN_BET = 50;
const TURN_TIME_SECONDS = 45;

/**
 * Betting action types
 */
export const BetAction = {
  FOLD: 'FOLD',
  CHECK: 'CHECK',
  CALL: 'CALL',
  RAISE: 'RAISE',
  BET: 'BET',
};

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

  // ============================================
  // USER WALLET OPERATIONS
  // ============================================

  /**
   * Get or create a user's wallet document
   * @param {string} uid - User's Firebase UID
   * @param {string} displayName - User's display name
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
    const userData = {
      uid,
      displayName: displayName || 'Anonymous',
      balance: DEFAULT_STARTING_BALANCE,
      createdAt: serverTimestamp(),
    };

    await setDoc(userRef, userData);
    return userData;
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
   * @param {number} minBet - Minimum bet for the table
   * @returns {Promise<string>} - The created table ID
   */
  static async createTable(user, minBet = DEFAULT_MIN_BET) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableId = GameService.generateTableId();
    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    const tableData = {
      id: tableId,
      phase: 'IDLE',
      deck: GameService.createShuffledDeck(),
      pot: 0,
      minBet: minBet,
      currentBet: 0,
      activePlayerIndex: 0,
      turnDeadline: null,
      dealerIndex: 0,
      players: [
        {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          photoURL: user.photoURL || null,
          chips: 0, // Start with 0, must buy in
          hand: [],
          status: 'active',
          cardsToDiscard: [],
          currentRoundBet: 0,
          hasActedThisRound: false,
        },
      ],
      createdBy: user.uid,
      lastUpdated: serverTimestamp(),
    };

    await setDoc(tableRef, tableData);
    return tableId;
  }

  /**
   * Join an existing table
   * @param {string} tableId - The table ID to join
   * @param {Object} user - Firebase user object
   * @returns {Promise<void>}
   */
  static async joinTable(tableId, user) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      throw new Error('Table not found');
    }

    const tableData = tableSnap.data();

    // Check if user is already at the table
    const existingPlayer = tableData.players.find((p) => p.uid === user.uid);
    if (existingPlayer) {
      // User is already at the table, no need to rejoin
      return;
    }

    // Check if table is full (max 6 players for now)
    if (tableData.players.length >= 6) {
      throw new Error('Table is full');
    }

    // Check if game is already in progress
    if (tableData.phase !== 'IDLE') {
      throw new Error('Game already in progress');
    }

    const newPlayer = {
      uid: user.uid,
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || null,
      chips: 0, // Start with 0, must buy in
      hand: [],
      status: 'active',
      cardsToDiscard: [],
      currentRoundBet: 0,
      hasActedThisRound: false,
    };

    await updateDoc(tableRef, {
      players: arrayUnion(newPlayer),
      lastUpdated: serverTimestamp(),
    });
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
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @returns {Promise<void>}
   */
  static async dealCards(tableId, tableData) {
    const deck = [...tableData.deck];
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
      hasActedThisRound: false,
    }));

    // Deal 5 cards to each active player
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < players.length; j++) {
        if (players[j].status === 'active' && deck.length > 0) {
          players[j].hand.push(deck.shift());
        }
      }
    }

    // Determine dealer, small blind, big blind positions
    const dealerIndex = (tableData.dealerIndex || 0) % activePlayers.length;

    // Find active player indices
    const activeIndices = players
      .map((p, i) => (p.status === 'active' ? i : -1))
      .filter((i) => i !== -1);

    // Small blind is next to dealer, big blind is next after small blind
    const dealerActivePos = activeIndices.indexOf(players.findIndex((p, i) =>
      p.status === 'active' && activeIndices.indexOf(i) === dealerIndex
    ));

    const sbActiveIndex = activeIndices[(dealerActivePos + 1) % activeIndices.length];
    const bbActiveIndex = activeIndices[(dealerActivePos + 2) % activeIndices.length];

    let pot = 0;

    // Post small blind
    const sbAmount = Math.min(smallBlind, players[sbActiveIndex].chips);
    players[sbActiveIndex].chips -= sbAmount;
    players[sbActiveIndex].currentRoundBet = sbAmount;
    pot += sbAmount;

    // Post big blind
    const bbAmount = Math.min(bigBlind, players[bbActiveIndex].chips);
    players[bbActiveIndex].chips -= bbAmount;
    players[bbActiveIndex].currentRoundBet = bbAmount;
    pot += bbAmount;

    // Action starts with player after big blind (UTG)
    const utgActiveIndex = activeIndices[(dealerActivePos + 3) % activeIndices.length];

    await GameService.updateTable(tableId, {
      deck,
      players,
      pot,
      currentBet: bigBlind,
      phase: 'BETTING_1',
      activePlayerIndex: utgActiveIndex,
      dealerIndex: dealerIndex,
      turnDeadline: GameService.calculateTurnDeadline(),
    });
  }

  // ============================================
  // BETTING OPERATIONS
  // ============================================

  /**
   * Find the next active (non-folded, non-all-in) player
   * @param {Array} players - Array of player objects
   * @param {number} currentIndex - Current player index
   * @returns {number} - Next active player index
   */
  static findNextActivePlayer(players, currentIndex) {
    const numPlayers = players.length;
    let nextIndex = (currentIndex + 1) % numPlayers;
    let checked = 0;

    while (checked < numPlayers) {
      const player = players[nextIndex];
      if (player.status === 'active' && player.chips > 0) {
        return nextIndex;
      }
      nextIndex = (nextIndex + 1) % numPlayers;
      checked++;
    }

    // No active player found (shouldn't happen in normal gameplay)
    return currentIndex;
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
   * @param {string} action - BetAction type (FOLD, CHECK, CALL, RAISE, BET)
   * @param {number} amount - Amount for RAISE/BET (optional)
   * @returns {Promise<void>}
   */
  static async performBetAction(tableId, tableData, playerUid, action, amount = 0) {
    const playerIndex = tableData.players.findIndex((p) => p.uid === playerUid);
    if (playerIndex === -1) {
      throw new Error('Player not found');
    }

    if (playerIndex !== tableData.activePlayerIndex) {
      throw new Error('Not your turn');
    }

    const players = tableData.players.map((p) => ({ ...p }));
    const player = players[playerIndex];
    const currentBet = tableData.currentBet || 0;
    const minBet = tableData.minBet || DEFAULT_MIN_BET;
    let pot = tableData.pot;
    let newCurrentBet = currentBet;

    if (player.status !== 'active') {
      throw new Error('Player cannot act');
    }

    switch (action) {
      case BetAction.FOLD:
        player.status = 'folded';
        player.hasActedThisRound = true;
        break;

      case BetAction.CHECK:
        // Can only check if current bet matches player's round bet
        if (player.currentRoundBet < currentBet) {
          throw new Error('Cannot check - must call or raise');
        }
        player.hasActedThisRound = true;
        break;

      case BetAction.CALL:
        {
          const callAmount = currentBet - player.currentRoundBet;
          if (callAmount <= 0) {
            // Nothing to call, treat as check
            player.hasActedThisRound = true;
          } else if (player.chips <= callAmount) {
            // All-in call
            pot += player.chips;
            player.currentRoundBet += player.chips;
            player.chips = 0;
            player.status = 'all-in';
            player.hasActedThisRound = true;
          } else {
            // Regular call
            player.chips -= callAmount;
            player.currentRoundBet += callAmount;
            pot += callAmount;
            player.hasActedThisRound = true;
          }
        }
        break;

      case BetAction.BET:
      case BetAction.RAISE:
        {
          // For RAISE, amount is the total bet (not additional)
          // For BET (when currentBet is 0), amount is the bet size
          const totalBetAmount = action === BetAction.RAISE ? amount : amount;
          const additionalAmount = totalBetAmount - player.currentRoundBet;

          if (totalBetAmount < currentBet + minBet && player.chips > additionalAmount) {
            throw new Error(`Minimum raise is ${currentBet + minBet}`);
          }

          if (additionalAmount <= 0) {
            throw new Error('Raise amount must be greater than current bet');
          }

          if (player.chips <= additionalAmount) {
            // All-in raise
            pot += player.chips;
            player.currentRoundBet += player.chips;
            if (player.currentRoundBet > currentBet) {
              newCurrentBet = player.currentRoundBet;
            }
            player.chips = 0;
            player.status = 'all-in';
            // Reset hasActed for other players since there's a raise
            players.forEach((p, i) => {
              if (i !== playerIndex && p.status === 'active') {
                p.hasActedThisRound = false;
              }
            });
          } else {
            // Regular raise
            player.chips -= additionalAmount;
            player.currentRoundBet = totalBetAmount;
            pot += additionalAmount;
            newCurrentBet = totalBetAmount;
            player.hasActedThisRound = true;
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
        throw new Error('Invalid action');
    }

    players[playerIndex] = player;

    // Check if only one player remains
    const activePlayers = GameService.countActivePlayers(players);
    if (activePlayers === 1) {
      // Hand is over, award pot to winner
      const winner = players.find((p) => p.status === 'active' || p.status === 'all-in');
      if (winner) {
        winner.chips += pot;
      }

      await GameService.updateTable(tableId, {
        players,
        pot: 0,
        currentBet: 0,
        phase: 'SHOWDOWN',
        turnDeadline: null,
      });
      return;
    }

    // Check if betting round is complete
    const roundComplete = GameService.isBettingRoundComplete(players, newCurrentBet);

    const phaseAfterBet = {
      BETTING_1: 'DRAW_1',
      BETTING_2: 'DRAW_2',
      BETTING_3: 'DRAW_3',
      BETTING_4: 'SHOWDOWN',
    };

    if (roundComplete) {
      // Reset for next phase
      players.forEach((p) => {
        p.currentRoundBet = 0;
        p.hasActedThisRound = false;
      });

      // Find first active player for next phase
      const activeIndices = players
        .map((p, i) => (p.status === 'active' ? i : -1))
        .filter((i) => i !== -1);

      const nextPhase = phaseAfterBet[tableData.phase];
      const isShowdown = nextPhase === 'SHOWDOWN';

      await GameService.updateTable(tableId, {
        players,
        pot,
        currentBet: 0,
        phase: nextPhase,
        activePlayerIndex: activeIndices.length > 0 ? activeIndices[0] : 0,
        turnDeadline: isShowdown ? null : GameService.calculateTurnDeadline(),
      });
    } else {
      // Move to next player
      const nextPlayerIndex = GameService.findNextActivePlayer(players, playerIndex);

      await GameService.updateTable(tableId, {
        players,
        pot,
        currentBet: newCurrentBet,
        activePlayerIndex: nextPlayerIndex,
        turnDeadline: GameService.calculateTurnDeadline(),
      });
    }
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
   * Auto-fold/check for timed out player
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

    const player = tableData.players[playerIndex];
    const currentBet = tableData.currentBet || 0;

    // Auto-check if possible, otherwise auto-fold
    if (player.currentRoundBet >= currentBet) {
      await GameService.performBetAction(tableId, tableData, playerUid, BetAction.CHECK);
    } else {
      await GameService.performBetAction(tableId, tableData, playerUid, BetAction.FOLD);
    }
  }

  // ============================================
  // DRAW OPERATIONS
  // ============================================

  /**
   * Submit a draw action for the current player
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

    const deck = [...tableData.deck];
    const players = [...tableData.players];
    const player = { ...players[playerIndex] };
    let hand = [...player.hand];

    // Sort indices in descending order to remove from end first
    const sortedIndices = [...cardIndices].sort((a, b) => b - a);

    // Remove discarded cards
    for (const index of sortedIndices) {
      if (index >= 0 && index < hand.length) {
        hand.splice(index, 1);
      }
    }

    // Deal replacement cards
    const numToDraw = cardIndices.length;
    for (let i = 0; i < numToDraw && deck.length > 0; i++) {
      hand.push(deck.shift());
    }

    player.hand = hand;
    player.cardsToDiscard = [];
    player.hasActedThisRound = true;
    players[playerIndex] = player;

    // Find next active player who can still draw
    const activeIndices = players
      .map((p, i) => (p.status === 'active' || p.status === 'all-in' ? i : -1))
      .filter((i) => i !== -1);

    let nextPlayerIndex = -1;
    for (let i = 1; i <= activeIndices.length; i++) {
      const candidateIndex = activeIndices[(activeIndices.indexOf(playerIndex) + i) % activeIndices.length];
      if (!players[candidateIndex].hasActedThisRound) {
        nextPlayerIndex = candidateIndex;
        break;
      }
    }

    const roundComplete = nextPlayerIndex === -1;

    // Determine next phase
    const phaseAfterDraw = {
      DRAW_1: 'BETTING_2',
      DRAW_2: 'BETTING_3',
      DRAW_3: 'BETTING_4',
    };

    const updates = {
      deck,
      players,
    };

    if (roundComplete) {
      // Reset for next phase
      players.forEach((p) => {
        p.hasActedThisRound = false;
      });
      updates.players = players;
      updates.phase = phaseAfterDraw[tableData.phase];
      updates.activePlayerIndex = activeIndices.length > 0 ? activeIndices[0] : 0;
      updates.currentBet = 0;
      updates.turnDeadline = GameService.calculateTurnDeadline();
    } else {
      updates.activePlayerIndex = nextPlayerIndex;
      updates.turnDeadline = GameService.calculateTurnDeadline();
    }

    await GameService.updateTable(tableId, updates);
  }

  /**
   * Start a new hand (reset for next round)
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @returns {Promise<void>}
   */
  static async startNextHand(tableId, tableData) {
    const players = tableData.players.map((player) => ({
      ...player,
      hand: [],
      status: player.chips > 0 ? 'active' : 'sitting_out',
      cardsToDiscard: [],
      currentRoundBet: 0,
      hasActedThisRound: false,
    }));

    // Move dealer button
    const activePlayerCount = players.filter((p) => p.status === 'active').length;
    const newDealerIndex = ((tableData.dealerIndex || 0) + 1) % Math.max(activePlayerCount, 1);

    await GameService.updateTable(tableId, {
      phase: 'IDLE',
      deck: GameService.createShuffledDeck(),
      pot: 0,
      currentBet: 0,
      players,
      activePlayerIndex: 0,
      dealerIndex: newDealerIndex,
      turnDeadline: null,
    });
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
      // If cash out fails, just remove from table
      console.error('Cash out failed during leave:', err);

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
}
