# PWA Gaming Design System
## "Ergonomic Sovereignty" - The Native Illusion for Real-Money Gaming

> Version 1.0 | Kansas City Lowball Poker

---

## Table of Contents

1. [Overview](#overview)
2. [The Native Shell](#the-native-shell)
3. [Ergonomic Zone Architecture](#ergonomic-zone-architecture)
4. [Color System](#color-system)
5. [Four-Color Deck Standard](#four-color-deck-standard)
6. [Animation Physics](#animation-physics)
7. [Haptic Feedback](#haptic-feedback)
8. [Hybrid Betting Interface](#hybrid-betting-interface)
9. [Touch Target Standards](#touch-target-standards)
10. [Component Reference](#component-reference)

---

## Overview

This design system transforms our browser-based poker application into a professional, native-feeling mobile experience. The core philosophy is **"Ergonomic Sovereignty"** — ensuring one-handed, portrait-mode play with all critical actions within thumb reach.

### Goals

1. **Native Illusion**: Make the browser frame invisible
2. **Thumb Zone Dominance**: All critical actions at the bottom 40%
3. **Trust Through Physics**: Goldilocks timing for animations
4. **Sensory Feedback**: Haptics that feel "real"

---

## The Native Shell

### Meta Tag Configuration (`index.html`)

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0,
               user-scalable=no, viewport-fit=cover,
               interactive-widget=resizes-content" />

<!-- iOS PWA -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

<!-- Android PWA -->
<meta name="theme-color" content="#0f172a" />
<meta name="mobile-web-app-capable" content="yes" />
```

### The "Anti-Wonk" CSS Stack

Applied globally to suppress browser behaviors:

```css
html, body {
  /* Disable rubber-banding */
  overscroll-behavior: none;
  overscroll-behavior-y: none;

  /* Lock the body */
  overflow: hidden;
  position: fixed;
  inset: 0;
}

/* Disable callout menus */
*, *::before, *::after {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* Re-enable for inputs only */
input, textarea {
  -webkit-user-select: text;
  user-select: text;
}
```

### PWA Manifest (`public/manifest.json`)

```json
{
  "name": "Kansas City Lowball Poker",
  "short_name": "KC Lowball",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#0f172a",
  "background_color": "#0f172a"
}
```

---

## Ergonomic Zone Architecture

The portrait layout is divided into ergonomic zones:

```
┌─────────────────────────────────┐
│      HEADER ZONE (8-10%)        │  ← Passive viewing
├─────────────────────────────────┤
│    HORSESHOE ZONE (20-25%)      │  ← Opponent avatars
│         (Arc Layout)            │
├─────────────────────────────────┤
│    COMMUNITY ZONE (15-20%)      │  ← Focal point
│      Board + Pot Display        │
├─────────────────────────────────┤
│                                 │
│      HERO ZONE (40-45%)         │  ← Active thumb zone
│    (Large Cards + Actions)      │
│                                 │
└─────────────────────────────────┘
      ← Safe Area (Home Bar) →
```

### CSS Classes

| Zone | Class | Purpose |
|------|-------|---------|
| Container | `.game-layout-portrait` | Full-height flex container |
| Header | `.zone-header` | Status bar, menu |
| Opponents | `.zone-opponents` | Opponent horseshoe |
| Community | `.zone-community` | Board cards, pot |
| Hero | `.zone-hero` | Player's area |
| Actions | `.zone-action-bar` | Bottom action buttons |

### Safe Area Handling

```css
.zone-action-bar {
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}
```

---

## Color System

### CSS Custom Properties

```css
:root {
  /* Background Layers */
  --color-bg-primary: #0f172a;    /* Deepest */
  --color-bg-secondary: #1e293b;  /* Elevated */
  --color-bg-tertiary: #334155;   /* Cards */

  /* Table Felt */
  --color-felt-primary: #166534;
  --color-felt-secondary: #14532d;

  /* Accent (Gold) */
  --color-accent-primary: #f59e0b;
  --color-accent-secondary: #d97706;

  /* Semantic Actions */
  --color-action-positive: #22c55e;  /* Check, Win */
  --color-action-negative: #ef4444;  /* Fold, Lose */
  --color-action-warning: #eab308;   /* Raise, Bet */
  --color-action-info: #0ea5e9;      /* Call */
  --color-action-special: #8b5cf6;   /* All-In */
}
```

---

## Four-Color Deck Standard

Professional poker uses 4-color decks for instant suit recognition:

| Suit | Color | CSS Class | Hex Code |
|------|-------|-----------|----------|
| Spades ♠ | Black | `.suit-spades` | `#1f2937` |
| Hearts ♥ | Red | `.suit-hearts` | `#dc2626` |
| Diamonds ♦ | **Blue** | `.suit-diamonds` | `#2563eb` |
| Clubs ♣ | **Green** | `.suit-clubs` | `#16a34a` |

### Usage

```jsx
import { getSuitColor, getSuitSymbol } from './PortraitGameLayout';

<span className={getSuitColor('d')}>
  {getSuitSymbol('d')} {/* Blue ♦ */}
</span>
```

---

## Animation Physics

### The "Goldilocks Zone"

| Speed | Duration | Feeling | Use Case |
|-------|----------|---------|----------|
| Too Fast | < 100ms | Cheap, jarring | Avoid |
| **Goldilocks** | **200-300ms** | **Professional, trustworthy** | **Card deals, reveals** |
| Too Slow | > 500ms | Frustrating | Avoid for repeat actions |

### CSS Timing Variables

```css
:root {
  /* Micro-interactions */
  --duration-instant: 50ms;
  --duration-fast: 100ms;
  --duration-normal: 200ms;

  /* Card animations (Goldilocks) */
  --duration-card-deal: 250ms;
  --duration-card-flip: 200ms;
  --duration-card-muck: 300ms;

  /* Easing curves */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.1);
}
```

### JavaScript Constants

```javascript
// src/components/AnimatedCard.jsx
const ANIMATION_TIMING = {
  CARD_DEAL: 250,
  CARD_FLIP: 200,
  CARD_MUCK: 300,
  STAGGER_DELAY: 80,
  SPRING_STIFFNESS: 350,
  SPRING_DAMPING: 28,
};
```

---

## Haptic Feedback

### Pattern Reference

| Pattern | Use Case | Duration |
|---------|----------|----------|
| `TAP` | Button press | 10ms |
| `TICK` | Increment/slider | 5ms |
| `SUCCESS` | Action confirmed | [20, 30, 20]ms |
| `MY_TURN` | Player's turn | [100, 80, 150]ms |
| `CARD_DEAL` | Cards dealt | [15, 40, 15, 40...]ms |
| `POT_WON` | Win celebration | [50, 30, 50, 30, 100, 50, 150]ms |
| `ALL_IN` | All-in moment | [80, 50, 80, 50, 150]ms |

### Usage

```javascript
import { triggerHaptic, HapticPatterns, useHaptic } from '../utils/haptics';

// Direct trigger
triggerHaptic(HapticPatterns.MY_TURN);

// React hook
function MyComponent() {
  const haptic = useHaptic();

  return (
    <button onClick={() => haptic.tap()}>
      Click
    </button>
  );
}
```

### Settings Integration

```javascript
import { getHapticsEnabled, setHapticsEnabled } from '../utils/haptics';

// Toggle haptics
setHapticsEnabled(false);

// Check status
if (getHapticsEnabled()) {
  // Haptics are on
}
```

---

## Hybrid Betting Interface

The betting interface replaces finicky sliders with a robust system:

### Structure

```
┌─────────────────────────────────────────────────┐
│  Raise to              Pot                      │
│  $1,250               $2,500                    │
├─────────────────────────────────────────────────┤
│  MACRO ROW (Presets)                            │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ Min │ │½ Pot│ │¾ Pot│ │ Pot │ │ Max │      │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘      │
├─────────────────────────────────────────────────┤
│  MICRO ROW (Precise Adjustment)                 │
│  ┌───┐  ┌──────────────────────┐  ┌───┐       │
│  │ - │  │      $1,250          │  │ + │       │
│  └───┘  └──────────────────────┘  └───┘       │
│         (±1 BB per tap)                         │
├─────────────────────────────────────────────────┤
│  QUICK INCREMENTS                               │
│  [-5 BB] [+5 BB]  [-10 BB] [+10 BB]  [-25 BB]  │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Cancel    │  │   RAISE $1,250          │  │
│  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Components

```jsx
import { BettingDrawer, ActionBar } from '../components/BettingDrawer';

// Action bar (always visible when it's your turn)
<ActionBar
  onFold={handleFold}
  onCheck={handleCheck}
  onCall={handleCall}
  onOpenBetting={() => setShowDrawer(true)}
  canCheck={callAmount === 0}
  callAmount={100}
  minRaise={200}
  isMyTurn={true}
/>

// Betting drawer (opens when Raise/Bet is tapped)
<BettingDrawer
  isOpen={showDrawer}
  onClose={() => setShowDrawer(false)}
  onSubmit={handleBet}
  pot={500}
  callAmount={100}
  minRaise={200}
  maxRaise={1000}
  bigBlind={10}
  playerChips={1000}
/>
```

---

## Touch Target Standards

### Minimum Sizes

| Context | Minimum Size | CSS Variable |
|---------|--------------|--------------|
| Standard | 44×44px | `--touch-target-min` |
| Gaming | 48×48px | `--touch-target-comfortable` |
| Primary Actions | 56×56px | `--touch-target-large` |

### CSS Classes

```css
.touch-target {
  min-width: var(--touch-target-min);
  min-height: var(--touch-target-min);
}

.action-btn {
  min-width: var(--touch-target-large);
  min-height: var(--touch-target-large);
}
```

---

## Component Reference

### Layout Components

| Component | Import Path | Purpose |
|-----------|-------------|---------|
| `PortraitGameLayout` | `./components/PortraitGameLayout` | Main layout container |
| `PortraitHeader` | `./components/PortraitGameLayout` | Header zone content |
| `OpponentHorseshoe` | `./components/PortraitGameLayout` | Arc-positioned opponents |
| `HeroCards` | `./components/PortraitGameLayout` | Large player cards |
| `LandscapeWarning` | `./components/PortraitGameLayout` | Rotation prompt |

### Betting Components

| Component | Import Path | Purpose |
|-----------|-------------|---------|
| `BettingDrawer` | `./components/BettingDrawer` | Full betting interface |
| `ActionBar` | `./components/BettingDrawer` | Quick action buttons |

### Card Components

| Component | Import Path | Purpose |
|-----------|-------------|---------|
| `AnimatedCard` | `./components/AnimatedCard` | Individual card with animation |
| `AnimatedCardBack` | `./components/AnimatedCard` | Face-down card |
| `AnimatedHand` | `./components/AnimatedCard` | Multiple cards with stagger |
| `MuckPile` | `./components/AnimatedCard` | Discard pile visualization |

### Utilities

| Utility | Import Path | Purpose |
|---------|-------------|---------|
| `triggerHaptic` | `./utils/haptics` | Trigger vibration |
| `HapticPatterns` | `./utils/haptics` | Predefined patterns |
| `useHaptic` | `./utils/haptics` | React hook for haptics |

---

## File Structure

```
src/
├── styles/
│   ├── pwa-gaming.css      # Complete design system CSS
│   └── DESIGN_SYSTEM.md    # This documentation
├── components/
│   ├── AnimatedCard.jsx    # Card rendering + 4-color deck
│   ├── BettingDrawer.jsx   # Hybrid betting interface
│   └── PortraitGameLayout.jsx  # Portrait layout system
├── utils/
│   └── haptics.js          # Haptic feedback utility
└── index.css               # Tailwind + design system import

public/
└── manifest.json           # PWA configuration

index.html                  # Meta tags + Native Shell
```

---

## Migration Guide

### Updating Existing Components

1. **Import the CSS**: Already done via `index.css`
2. **Wrap game in PortraitGameLayout**:
   ```jsx
   <PortraitGameLayout
     headerContent={<PortraitHeader ... />}
     opponentsContent={<OpponentHorseshoe ... />}
     communityContent={...}
     heroCardsContent={<HeroCards ... />}
     actionBarContent={<ActionBar ... />}
   >
     {/* Modals, overlays */}
   </PortraitGameLayout>
   ```
3. **Add haptics to interactions**:
   ```jsx
   onClick={() => {
     triggerHaptic(HapticPatterns.TAP);
     handleClick();
   }}
   ```
4. **Use BettingDrawer for betting**:
   Replace slider-based betting with `BettingDrawer` + `ActionBar`

---

## Browser Support

| Feature | Chrome Android | Safari iOS | Notes |
|---------|----------------|------------|-------|
| Vibration API | ✅ Full | ❌ None | Graceful degradation |
| Safe Areas | ✅ Full | ✅ Full | Use `env()` |
| Overscroll | ✅ Full | ✅ Full | CSS override |
| Backdrop Blur | ✅ Full | ✅ Full | Prefixed |

---

*Last updated: January 2026*
*Design System Version: 1.0*
