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
import {
  MAX_PLAYERS,
  CARDS_PER_HAND,
  DEFAULT_STARTING_BALANCE,
  DEFAULT_MIN_BET,
  TURN_TIME_SECONDS,
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
   * @returns {Promise<string>} - The created table ID
   */
  static async createTable(user, userWallet, minBet = DEFAULT_MIN_BET) {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const tableId = GameService.generateTableId();
    const tableRef = doc(db, TABLES_COLLECTION, tableId);

    // Use custom username if available, otherwise fall back to Google displayName
    const displayName = GameService.getDisplayName(userWallet) || user.displayName || 'Anonymous';

    const tableData = {
      id: tableId,
      phase: 'IDLE',
      deck: GameService.createShuffledDeck(),
      muck: [], // Discard pile for reshuffling when deck runs low
      pot: 0,
      minBet: minBet,
      currentBet: 0,
      activePlayerIndex: 0,
      turnDeadline: null,
      dealerIndex: 0,
      players: [
        {
          uid: user.uid,
          displayName: displayName,
          photoURL: user.photoURL || null,
          chips: 0, // Start with 0, must buy in
          hand: [],
          status: 'active',
          cardsToDiscard: [],
          currentRoundBet: 0,
          hasActedThisRound: false,
          lastAction: null, // Track last draw action for display
        },
      ],
      chatLog: [], // Chat messages array
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
   * @param {Object} userWallet - User wallet data with username
   * @returns {Promise<void>}
   */
  static async joinTable(tableId, user, userWallet) {
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

    // Check if table is full
    if (tableData.players.length >= MAX_PLAYERS) {
      throw new Error('Table is full');
    }

    // Check if game is already in progress
    if (tableData.phase !== 'IDLE') {
      throw new Error('Game already in progress');
    }

    // Use custom username if available, otherwise fall back to Google displayName
    const displayName = GameService.getDisplayName(userWallet) || user.displayName || 'Anonymous';

    const newPlayer = {
      uid: user.uid,
      displayName: displayName,
      photoURL: user.photoURL || null,
      chips: 0, // Start with 0, must buy in
      hand: [],
      status: 'active',
      cardsToDiscard: [],
      currentRoundBet: 0,
      hasActedThisRound: false,
      lastAction: null, // Track last draw action for display
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
      muck, // Include muck in update (cleared or updated from reshuffle)
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
            player.chips = 0;
            player.status = 'all-in';
            player.hasActedThisRound = true;
            actionDescription = `${player.displayName} called all-in for $${allInAmount}`;
          } else {
            // Regular call
            player.chips = playerChips - callAmount;
            player.currentRoundBet = playerCurrentRoundBet + callAmount;
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
    const activePlayers = GameService.countActivePlayers(players);
    if (activePlayers === 1) {
      // Hand is over, award pot to winner
      const winner = players.find((p) => p.status === 'active' || p.status === 'all-in');
      let winnerDescription = '';
      if (winner) {
        winner.chips += pot;
        winnerDescription = `${winner.displayName} wins $${pot} (others folded)`;
      }

      // Get updated activity log
      const activityLog = await GameService.addActivityEvent(tableId, actionDescription);
      if (winnerDescription) {
        activityLog.push({
          type: 'game_event',
          text: winnerDescription,
          timestamp: Date.now(),
        });
      }

      await GameService.updateTable(tableId, {
        players,
        pot: 0,
        currentBet: 0,
        phase: 'SHOWDOWN',
        turnDeadline: null,
        chatLog: activityLog,
      });
      return { success: true, action, actionDescription };
    }

    // Check if betting round is complete
    const roundComplete = GameService.isBettingRoundComplete(players, newCurrentBet);

    const phaseAfterBet = {
      BETTING_1: 'DRAW_1',
      BETTING_2: 'DRAW_2',
      BETTING_3: 'DRAW_3',
      BETTING_4: 'SHOWDOWN',
    };

    // Add activity event for this action
    const activityLog = await GameService.addActivityEvent(tableId, actionDescription);

    if (roundComplete) {
      // Reset for next phase
      players.forEach((p) => {
        p.currentRoundBet = 0;
        p.hasActedThisRound = false;
      });

      // Find first active player for next phase (only players who can still act)
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
        chatLog: activityLog,
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
        chatLog: activityLog,
      });
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

    let deck = [...tableData.deck];
    let muck = [...(tableData.muck || [])];
    const players = [...tableData.players];
    const player = { ...players[playerIndex] };
    let hand = [...player.hand];

    // Sort indices in descending order to remove from end first
    const sortedIndices = [...cardIndices].sort((a, b) => b - a);

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
    const numToDraw = cardIndices.length;

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
    const drawDescription = numToDraw === 0
      ? `${player.displayName} stood pat`
      : `${player.displayName} drew ${numToDraw} card${numToDraw > 1 ? 's' : ''}`;

    players[playerIndex] = player;

    // Find next active player who can still draw (skip all-in players)
    const activeIndices = players
      .map((p, i) => (p.status === 'active' || p.status === 'all-in' ? i : -1))
      .filter((i) => i !== -1);

    let nextPlayerIndex = -1;
    for (let i = 1; i <= activeIndices.length; i++) {
      const candidateIndex = activeIndices[(activeIndices.indexOf(playerIndex) + i) % activeIndices.length];
      // Skip all-in players for draw actions - they auto stand pat
      if (!players[candidateIndex].hasActedThisRound && players[candidateIndex].status === 'active') {
        nextPlayerIndex = candidateIndex;
        break;
      }
    }

    // If no active player found, mark all-in players as having acted (they stand pat)
    if (nextPlayerIndex === -1) {
      players.forEach((p) => {
        if (p.status === 'all-in' && !p.hasActedThisRound) {
          p.hasActedThisRound = true;
          p.lastAction = 'Stood Pat';
        }
      });
    }

    const roundComplete = nextPlayerIndex === -1;

    // Determine next phase
    const phaseAfterDraw = {
      DRAW_1: 'BETTING_2',
      DRAW_2: 'BETTING_3',
      DRAW_3: 'BETTING_4',
    };

    // Add activity event for this draw
    const activityLog = await GameService.addActivityEvent(tableId, drawDescription);

    const updates = {
      deck,
      muck, // Include updated muck pile
      players,
      chatLog: activityLog,
    };

    if (roundComplete) {
      // Reset for next phase - clear lastAction when moving to betting
      players.forEach((p) => {
        p.hasActedThisRound = false;
        p.lastAction = null; // Clear action text when phase changes
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
      lastAction: null, // Clear action text for new hand
    }));

    // Move dealer button
    const activePlayerCount = players.filter((p) => p.status === 'active').length;
    const newDealerIndex = ((tableData.dealerIndex || 0) + 1) % Math.max(activePlayerCount, 1);

    await GameService.updateTable(tableId, {
      phase: 'IDLE',
      deck: GameService.createShuffledDeck(),
      muck: [], // Clear muck for new hand
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
  // CHAT & ACTIVITY LOG OPERATIONS
  // ============================================

  /**
   * Maximum number of messages (chat + game events) to keep in the log
   */
  static MAX_CHAT_MESSAGES = 50;

  /**
   * Add a game activity event to the activity log
   * @param {string} tableId - The table ID
   * @param {string} eventText - Description of the game event
   * @returns {Promise<Array>} - Updated activity log array
   */
  static async addActivityEvent(tableId, eventText) {
    if (!db || !eventText) {
      return [];
    }

    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      return [];
    }

    const tableData = tableSnap.data();
    let chatLog = tableData.chatLog || [];

    // Add new game event
    const newEvent = {
      type: 'game_event',
      text: eventText,
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
