/**
 * Position indicator buttons for poker table (Dealer, Small Blind, Big Blind)
 * These are rendered as absolutely positioned elements near player avatars
 */

/**
 * Dealer Button - White "D" button
 */
export function DealerButton({ className = '', compact = false }) {
  const sizeClass = compact ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-sm';
  return (
    <div
      className={`
        ${sizeClass} rounded-full flex items-center justify-center
        bg-white text-gray-900 font-bold
        border border-gray-400
        shadow
        ${className}
      `}
      title="Dealer"
    >
      D
    </div>
  );
}

/**
 * Small Blind Button - Blue "SB" button
 */
export function SmallBlindButton({ className = '', compact = false }) {
  const sizeClass = compact ? 'w-5 h-5 text-[7px]' : 'w-7 h-7 text-[10px]';
  return (
    <div
      className={`
        ${sizeClass} rounded-full flex items-center justify-center
        bg-blue-500 text-white font-bold
        border border-blue-700
        shadow
        ${className}
      `}
      title="Small Blind"
    >
      SB
    </div>
  );
}

/**
 * Big Blind Button - Yellow/Gold "BB" button
 */
export function BigBlindButton({ className = '', compact = false }) {
  const sizeClass = compact ? 'w-5 h-5 text-[7px]' : 'w-7 h-7 text-[10px]';
  return (
    <div
      className={`
        ${sizeClass} rounded-full flex items-center justify-center
        bg-yellow-500 text-gray-900 font-bold
        border border-yellow-600
        shadow
        ${className}
      `}
      title="Big Blind"
    >
      BB
    </div>
  );
}

/**
 * Combined position indicators component
 * Renders all applicable position buttons for a player
 * @param {boolean} compact - Use smaller buttons for tight layouts
 */
export function PositionIndicators({ isDealer, isSmallBlind, isBigBlind, className = '', compact = false }) {
  const hasAnyPosition = isDealer || isSmallBlind || isBigBlind;

  if (!hasAnyPosition) return null;

  return (
    <div className={`flex ${compact ? 'flex-col gap-0.5' : 'gap-1'} ${className}`}>
      {isDealer && <DealerButton compact={compact} />}
      {isSmallBlind && <SmallBlindButton compact={compact} />}
      {isBigBlind && <BigBlindButton compact={compact} />}
    </div>
  );
}

export default PositionIndicators;
