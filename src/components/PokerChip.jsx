import { motion } from 'framer-motion';

/**
 * High-fidelity 3D-styled poker chip component
 * Uses CSS-only techniques for depth, edge spots, and realistic appearance
 */

// Chip denomination configurations
export const CHIP_DENOMINATIONS = {
  1: {
    value: 1,
    label: '$1',
    baseColor: '#E8E8E8',      // White/off-white
    edgeColor: '#4A90D9',      // Blue edge spots
    darkShade: '#B8B8B8',
    textColor: '#1a1a1a',
    borderColor: '#4A90D9',
  },
  5: {
    value: 5,
    label: '$5',
    baseColor: '#DC2626',      // Red
    edgeColor: '#FFFFFF',      // White edge spots
    darkShade: '#991B1B',
    textColor: '#FFFFFF',
    borderColor: '#B91C1C',
  },
  25: {
    value: 25,
    label: '$25',
    baseColor: '#16A34A',      // Green
    edgeColor: '#FFFFFF',      // White edge spots
    darkShade: '#15803D',
    textColor: '#FFFFFF',
    borderColor: '#166534',
  },
  100: {
    value: 100,
    label: '$100',
    baseColor: '#1F2937',      // Black
    edgeColor: '#FFFFFF',      // White edge spots
    darkShade: '#111827',
    textColor: '#FFFFFF',
    borderColor: '#374151',
  },
  500: {
    value: 500,
    label: '$500',
    baseColor: '#7C3AED',      // Purple
    edgeColor: '#FFFFFF',      // White edge spots
    darkShade: '#5B21B6',
    textColor: '#FFFFFF',
    borderColor: '#6D28D9',
  },
  1000: {
    value: 1000,
    label: '$1K',
    baseColor: '#F59E0B',      // Orange/Gold
    edgeColor: '#1F2937',      // Dark edge spots
    darkShade: '#D97706',
    textColor: '#1F2937',
    borderColor: '#B45309',
  },
};

// Size configurations
const SIZE_CONFIGS = {
  xs: { size: 28, fontSize: 8, thickness: 2, border: 2 },
  sm: { size: 36, fontSize: 10, thickness: 3, border: 2 },
  md: { size: 48, fontSize: 12, thickness: 4, border: 3 },
  lg: { size: 64, fontSize: 16, thickness: 5, border: 3 },
  xl: { size: 80, fontSize: 20, thickness: 6, border: 4 },
};

function PokerChip({
  denomination = 100,
  size = 'md',
  rotation = 0,
  style = {},
  animate = false,
  layoutId,
  onAnimationComplete,
}) {
  const config = CHIP_DENOMINATIONS[denomination] || CHIP_DENOMINATIONS[100];
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  const chipStyle = {
    width: sizeConfig.size,
    height: sizeConfig.size,
    borderRadius: '50%',
    position: 'relative',
    transform: `rotate(${rotation}deg)`,
    // 3D depth with multiple shadows
    boxShadow: `
      0 ${sizeConfig.thickness}px 0 ${config.darkShade},
      0 ${sizeConfig.thickness + 1}px 2px rgba(0,0,0,0.3),
      0 ${sizeConfig.thickness + 3}px 6px rgba(0,0,0,0.2),
      inset 0 2px 4px rgba(255,255,255,0.3),
      inset 0 -2px 4px rgba(0,0,0,0.2)
    `,
    // Radial gradient for 3D surface
    background: `
      radial-gradient(circle at 30% 30%,
        ${adjustBrightness(config.baseColor, 20)} 0%,
        ${config.baseColor} 50%,
        ${adjustBrightness(config.baseColor, -15)} 100%
      )
    `,
    ...style,
  };

  // Inner ring with edge spots (dashed border effect)
  const innerRingStyle = {
    position: 'absolute',
    top: sizeConfig.border + 2,
    left: sizeConfig.border + 2,
    right: sizeConfig.border + 2,
    bottom: sizeConfig.border + 2,
    borderRadius: '50%',
    border: `${sizeConfig.border}px dashed ${config.edgeColor}`,
    opacity: 0.9,
  };

  // Center circle for denomination text
  const centerCircleStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: sizeConfig.size * 0.55,
    height: sizeConfig.size * 0.55,
    borderRadius: '50%',
    background: `
      radial-gradient(circle at 40% 40%,
        ${adjustBrightness(config.baseColor, 25)} 0%,
        ${config.baseColor} 70%
      )
    `,
    border: `1px solid ${config.borderColor}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `
      inset 0 1px 3px rgba(255,255,255,0.4),
      inset 0 -1px 3px rgba(0,0,0,0.2)
    `,
  };

  // Text style
  const textStyle = {
    color: config.textColor,
    fontSize: sizeConfig.fontSize,
    fontWeight: 'bold',
    textShadow: config.textColor === '#FFFFFF'
      ? '0 1px 2px rgba(0,0,0,0.5)'
      : '0 1px 1px rgba(255,255,255,0.3)',
    userSelect: 'none',
  };

  // Edge pattern overlay (radial lines)
  const edgePatternStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: '50%',
    border: `${sizeConfig.border}px solid ${config.borderColor}`,
    pointerEvents: 'none',
  };

  const ChipContent = (
    <>
      <div style={edgePatternStyle} />
      <div style={innerRingStyle} />
      <div style={centerCircleStyle}>
        <span style={textStyle}>{config.label}</span>
      </div>
    </>
  );

  if (animate || layoutId) {
    return (
      <motion.div
        style={chipStyle}
        layoutId={layoutId}
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 25,
          layout: { type: 'spring', stiffness: 300, damping: 30 }
        }}
        onAnimationComplete={onAnimationComplete}
      >
        {ChipContent}
      </motion.div>
    );
  }

  return (
    <div style={chipStyle}>
      {ChipContent}
    </div>
  );
}

/**
 * Utility function to adjust color brightness
 */
function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

/**
 * Animated chip that flies between positions
 * Uses Framer Motion's layoutId for automatic trajectory calculation
 */
export function FlyingChip({
  denomination = 100,
  size = 'md',
  layoutId,
  sourceId,
  onAnimationComplete,
}) {
  const config = CHIP_DENOMINATIONS[denomination] || CHIP_DENOMINATIONS[100];
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  return (
    <motion.div
      layoutId={layoutId}
      style={{
        width: sizeConfig.size,
        height: sizeConfig.size,
        borderRadius: '50%',
        background: config.baseColor,
        boxShadow: `
          0 ${sizeConfig.thickness}px 0 ${config.darkShade},
          0 ${sizeConfig.thickness + 2}px 8px rgba(0,0,0,0.4)
        `,
        zIndex: 100,
      }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 25,
      }}
      onAnimationComplete={onAnimationComplete}
    >
      <PokerChip denomination={denomination} size={size} />
    </motion.div>
  );
}

/**
 * Chip preview for betting controls
 */
export function ChipPreview({ denomination, size = 'sm', selected = false, onClick }) {
  const config = CHIP_DENOMINATIONS[denomination] || CHIP_DENOMINATIONS[100];

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative cursor-pointer transition-all
        ${selected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-800' : ''}
      `}
      style={{ background: 'transparent', border: 'none', padding: 0 }}
    >
      <PokerChip denomination={denomination} size={size} />
    </motion.button>
  );
}

export default PokerChip;
