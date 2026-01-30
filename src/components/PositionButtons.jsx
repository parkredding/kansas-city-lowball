/**
 * Position indicator buttons for poker table (Dealer, Small Blind, Big Blind)
 * These are rendered as absolutely positioned elements near player avatars
 */

/**
 * Dealer Button - White "D" button
 */
export function DealerButton({ className = '' }) {
  return (
    <div
      className={`
        w-7 h-7 rounded-full flex items-center justify-center
        bg-white text-gray-900 font-bold text-sm
        border-2 border-gray-400
        shadow-lg
        ${className}
      `}
      style={{
        boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.8)',
      }}
      title="Dealer"
    >
      D
    </div>
  );
}

/**
 * Small Blind Button - Blue "SB" button
 */
export function SmallBlindButton({ className = '' }) {
  return (
    <div
      className={`
        w-7 h-7 rounded-full flex items-center justify-center
        bg-blue-500 text-white font-bold text-[10px]
        border-2 border-blue-700
        shadow-lg
        ${className}
      `}
      style={{
        boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3)',
      }}
      title="Small Blind"
    >
      SB
    </div>
  );
}

/**
 * Big Blind Button - Yellow/Gold "BB" button
 */
export function BigBlindButton({ className = '' }) {
  return (
    <div
      className={`
        w-7 h-7 rounded-full flex items-center justify-center
        bg-yellow-500 text-gray-900 font-bold text-[10px]
        border-2 border-yellow-600
        shadow-lg
        ${className}
      `}
      style={{
        boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.5)',
      }}
      title="Big Blind"
    >
      BB
    </div>
  );
}

/**
 * Combined position indicators component
 * Renders all applicable position buttons for a player
 */
export function PositionIndicators({ isDealer, isSmallBlind, isBigBlind, className = '' }) {
  const hasAnyPosition = isDealer || isSmallBlind || isBigBlind;

  if (!hasAnyPosition) return null;

  return (
    <div className={`flex gap-1 ${className}`}>
      {isDealer && <DealerButton />}
      {isSmallBlind && <SmallBlindButton />}
      {isBigBlind && <BigBlindButton />}
    </div>
  );
}

export default PositionIndicators;
