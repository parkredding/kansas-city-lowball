import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Deck } from './Deck';

const TABLES_COLLECTION = 'tables';
const STARTING_CHIPS = 1000;

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
   * Creates a new table with the user as the first player
   * @param {Object} user - Firebase user object with uid, displayName, photoURL
   * @returns {Promise<string>} - The created table ID
   */
  static async createTable(user) {
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
      activePlayerIndex: 0,
      turnDeadline: null,
      players: [
        {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          photoURL: user.photoURL || null,
          chips: STARTING_CHIPS,
          hand: [],
          status: 'active',
          cardsToDiscard: [],
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
      chips: STARTING_CHIPS,
      hand: [],
      status: 'active',
      cardsToDiscard: [],
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

  /**
   * Deal cards to all players and start the game
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @returns {Promise<void>}
   */
  static async dealCards(tableId, tableData) {
    const deck = [...tableData.deck];
    const players = tableData.players.map((player) => ({
      ...player,
      hand: [],
      status: 'active',
      cardsToDiscard: [],
    }));

    // Deal 5 cards to each player
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < players.length; j++) {
        if (deck.length > 0) {
          players[j].hand.push(deck.shift());
        }
      }
    }

    // Collect antes (10 chips per player)
    const anteAmount = 10;
    let pot = 0;
    for (const player of players) {
      if (player.chips >= anteAmount) {
        player.chips -= anteAmount;
        pot += anteAmount;
      }
    }

    await GameService.updateTable(tableId, {
      deck,
      players,
      pot,
      phase: 'BETTING_1',
      activePlayerIndex: 0,
    });
  }

  /**
   * Submit a bet action for the current player
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @param {string} playerUid - The player's UID
   * @param {number} amount - Bet amount (0 for check/call)
   * @returns {Promise<void>}
   */
  static async submitBet(tableId, tableData, playerUid, amount = 0) {
    const playerIndex = tableData.players.findIndex((p) => p.uid === playerUid);
    if (playerIndex === -1) {
      throw new Error('Player not found');
    }

    if (playerIndex !== tableData.activePlayerIndex) {
      throw new Error('Not your turn');
    }

    const players = [...tableData.players];
    const player = { ...players[playerIndex] };

    // Deduct bet from player and add to pot
    if (amount > 0 && player.chips >= amount) {
      player.chips -= amount;
      players[playerIndex] = player;
    }

    // Find next active player
    let nextPlayerIndex = (playerIndex + 1) % players.length;
    let checkedAll = nextPlayerIndex === 0; // If we've gone around

    // Determine next phase
    const phaseAfterBet = {
      BETTING_1: 'DRAW_1',
      BETTING_2: 'DRAW_2',
      BETTING_3: 'DRAW_3',
      BETTING_4: 'SHOWDOWN',
    };

    const updates = {
      players,
      pot: tableData.pot + amount,
    };

    if (checkedAll) {
      // Everyone has acted, move to next phase
      updates.phase = phaseAfterBet[tableData.phase];
      updates.activePlayerIndex = 0;
    } else {
      updates.activePlayerIndex = nextPlayerIndex;
    }

    await GameService.updateTable(tableId, updates);
  }

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
    players[playerIndex] = player;

    // Find next active player
    let nextPlayerIndex = (playerIndex + 1) % players.length;
    let roundComplete = nextPlayerIndex === 0;

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
      updates.phase = phaseAfterDraw[tableData.phase];
      updates.activePlayerIndex = 0;
    } else {
      updates.activePlayerIndex = nextPlayerIndex;
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
      status: 'active',
      cardsToDiscard: [],
    }));

    await GameService.updateTable(tableId, {
      phase: 'IDLE',
      deck: GameService.createShuffledDeck(),
      pot: 0,
      players,
      activePlayerIndex: 0,
    });
  }

  /**
   * Leave a table
   * @param {string} tableId - The table ID
   * @param {Object} tableData - Current table data
   * @param {string} playerUid - The player's UID
   * @returns {Promise<void>}
   */
  static async leaveTable(tableId, tableData, playerUid) {
    const players = tableData.players.filter((p) => p.uid !== playerUid);

    if (players.length === 0) {
      // If no players left, could delete the table
      // For now, just reset it
      await GameService.updateTable(tableId, {
        phase: 'IDLE',
        players: [],
        pot: 0,
        deck: GameService.createShuffledDeck(),
      });
    } else {
      // Adjust activePlayerIndex if needed
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
