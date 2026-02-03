/**
 * ============================================================================
 * TABLE UI COMPONENTS
 * Professional Poker Table Visual Assets and Data Overlays
 * ============================================================================
 *
 * This module exports all the new table UI components for the refactored
 * poker table visual experience:
 *
 * - TableOverlay: Centralized pot and community cards display
 * - HandHistory: Floating widget for hand results
 * - BlindsIndicator: Compact blinds display
 * - PlayerBetPill: High-contrast bet pills near player avatars
 * - PlayerHUD: Win % and hand type display
 * - PositionButtons: Enhanced dealer/blind buttons
 * - PokerTableContainer: Responsive table with aspect ratio
 * - CommunityCards: 4-color deck community cards
 *
 * Usage:
 * import { TableOverlay, HandHistory, PlayerBetPill } from './components/table-ui';
 *
 * ============================================================================
 */

// Table Overlay - Centralized pot & community cards
export {
  TableOverlay,
  CentralPotDisplay,
  CommunityCardsEnhanced,
} from '../TableOverlay';

// Hand History Widget
export {
  HandHistory,
  LatestWinBanner,
} from '../HandHistory';

// Blinds Indicator
export {
  BlindsIndicator,
  BlindsTimer,
} from '../BlindsIndicator';

// Player Bet Pills
export {
  PlayerBetPill,
  CallAmountPill,
  StagedBetDisplay,
} from '../PlayerBetPill';

// Player HUD (Heads-Up Display)
export {
  PlayerHUD,
  OpponentHUD,
} from '../PlayerHUD';

// Position Buttons (Dealer, Blinds)
export {
  DealerButton,
  SmallBlindButton,
  BigBlindButton,
  AnteButton,
  PositionIndicators,
  FloatingDealerButton,
} from '../PositionButtons';

// Poker Table Container
export {
  PokerTableContainer,
  ResponsiveTableZone,
  TableFeltBackground,
  useTableDimensions,
} from '../PokerTableContainer';

// Community Cards (4-color deck)
export {
  CommunityCards,
  BoardSummary,
  CardBadge,
} from '../CommunityCards';

// Default export - main components
export default {
  TableOverlay,
  HandHistory,
  BlindsIndicator,
  PlayerBetPill,
  PlayerHUD,
  PokerTableContainer,
  CommunityCards,
};
