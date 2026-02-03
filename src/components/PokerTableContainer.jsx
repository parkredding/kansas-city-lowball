/**
 * ============================================================================
 * POKER TABLE CONTAINER
 * Responsive, Aspect-Ratio Preserving Table Layout
 * ============================================================================
 *
 * This component provides a responsive container for the poker table that:
 * - Maintains 4:3 or 16:9 aspect ratio across all screen sizes
 * - Features a dark green gradient felt background
 * - Includes a thick, wooden/dark-textured rail (border)
 * - Keeps the table zone centered on mobile
 * - Ensures action bar stays clamped to the bottom
 *
 * Visual Design:
 * ┌─────────────────────────────────────────────────────────┐
 * │  ╭──────────────────────────────────────────────────╮  │
 * │  │                                                  │  │
 * │  │        DARK GREEN GRADIENT FELT                  │  │ WOODEN
 * │  │                                                  │  │ RAIL
 * │  │              ┌─────────────┐                     │  │
 * │  │              │    POT      │                     │  │
 * │  │              └─────────────┘                     │  │
 * │  │          [  ] [  ] [  ] [  ] [  ]               │  │
 * │  │                                                  │  │
 * │  ╰──────────────────────────────────────────────────╯  │
 * └─────────────────────────────────────────────────────────┘
 *
 * ============================================================================
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Hook to calculate responsive table dimensions
 */
export function useTableDimensions(containerRef, aspectRatio = 4/3) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, scale: 1 });

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate dimensions that fit within container while maintaining aspect ratio
      let tableWidth, tableHeight;

      if (containerWidth / containerHeight > aspectRatio) {
        // Container is wider than aspect ratio - height constrained
        tableHeight = containerHeight;
        tableWidth = tableHeight * aspectRatio;
      } else {
        // Container is taller than aspect ratio - width constrained
        tableWidth = containerWidth;
        tableHeight = tableWidth / aspectRatio;
      }

      // Calculate scale for responsive elements
      const baseWidth = 400; // Design base width
      const scale = tableWidth / baseWidth;

      setDimensions({
        width: tableWidth,
        height: tableHeight,
        scale: Math.min(scale, 1.5), // Cap scale at 1.5x
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [containerRef, aspectRatio]);

  return dimensions;
}

/**
 * Poker Table Container Component
 *
 * Props:
 * - aspectRatio: '4:3' | '16:9' | number (default: 4/3)
 * - railStyle: 'wood' | 'dark' | 'leather' (default: 'wood')
 * - feltStyle: 'classic' | 'dark' | 'emerald' (default: 'dark')
 * - children: Table content (players, cards, pot)
 */
export function PokerTableContainer({
  aspectRatio = 4/3,
  railStyle = 'wood',
  feltStyle = 'dark',
  showRail = true,
  children,
  className = '',
}) {
  const containerRef = useRef(null);
  const dimensions = useTableDimensions(containerRef, aspectRatio);

  // Rail style configurations
  const railStyles = {
    wood: {
      background: `
        linear-gradient(135deg,
          #5c4033 0%,
          #8b6914 20%,
          #6b4423 40%,
          #8b6914 60%,
          #5c4033 80%,
          #3d2817 100%
        )
      `,
      border: '1px solid #2d1810',
      shadow: 'inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(139,105,20,0.3)',
    },
    dark: {
      background: `
        linear-gradient(135deg,
          #1e293b 0%,
          #334155 30%,
          #1e293b 70%,
          #0f172a 100%
        )
      `,
      border: '1px solid #0f172a',
      shadow: 'inset 0 2px 4px rgba(0,0,0,0.6), inset 0 -2px 4px rgba(51,65,85,0.2)',
    },
    leather: {
      background: `
        linear-gradient(135deg,
          #4a3728 0%,
          #6b4423 30%,
          #4a3728 70%,
          #2d1810 100%
        )
      `,
      border: '1px solid #1a0f0a',
      shadow: 'inset 0 2px 4px rgba(0,0,0,0.6), inset 0 -2px 4px rgba(107,68,35,0.2)',
    },
  };

  // Felt style configurations
  const feltStyles = {
    classic: {
      background: `
        radial-gradient(ellipse 100% 100% at 50% 50%,
          #228b22 0%,
          #1a7a1a 40%,
          #166534 80%,
          #14532d 100%
        )
      `,
    },
    dark: {
      background: `
        radial-gradient(ellipse 100% 100% at 50% 40%,
          #166534 0%,
          #14532d 40%,
          #0f3a20 80%,
          #0a2614 100%
        )
      `,
    },
    emerald: {
      background: `
        radial-gradient(ellipse 100% 100% at 50% 50%,
          #059669 0%,
          #047857 40%,
          #065f46 80%,
          #064e3b 100%
        )
      `,
    },
  };

  const currentRailStyle = railStyles[railStyle] || railStyles.wood;
  const currentFeltStyle = feltStyles[feltStyle] || feltStyles.dark;

  return (
    <div
      ref={containerRef}
      className={`poker-table-outer-container relative w-full h-full flex items-center justify-center ${className}`}
    >
      {/* Table with rail */}
      <motion.div
        className="poker-table-wrapper relative"
        style={{
          width: dimensions.width > 0 ? dimensions.width : '100%',
          maxWidth: '100%',
          aspectRatio: `${aspectRatio}`,
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Wooden/Dark Rail (border) */}
        {showRail && (
          <div
            className="poker-rail absolute inset-0 rounded-[40px] sm:rounded-[60px] overflow-hidden"
            style={{
              padding: '8px',
              background: currentRailStyle.background,
              border: currentRailStyle.border,
              boxShadow: `
                ${currentRailStyle.shadow},
                0 8px 32px rgba(0,0,0,0.4),
                0 4px 16px rgba(0,0,0,0.3)
              `,
            }}
          >
            {/* Rail texture overlay */}
            <div
              className="absolute inset-0 rounded-[32px] sm:rounded-[52px] pointer-events-none opacity-30"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
                backgroundSize: '100px 100px',
              }}
            />

            {/* Inner felt area */}
            <div
              className="poker-felt absolute inset-2 rounded-[32px] sm:rounded-[52px] overflow-hidden"
              style={{
                background: currentFeltStyle.background,
                boxShadow: `
                  inset 0 4px 12px rgba(0,0,0,0.4),
                  inset 0 -2px 8px rgba(0,0,0,0.2)
                `,
              }}
            >
              {/* Felt texture pattern */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='felt'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23felt)' opacity='0.4'/%3E%3C/svg%3E")`,
                  backgroundSize: '200px 200px',
                }}
              />

              {/* Felt edge glow */}
              <div
                className="absolute inset-0 rounded-[30px] sm:rounded-[50px] pointer-events-none"
                style={{
                  boxShadow: 'inset 0 0 60px rgba(0,0,0,0.3)',
                }}
              />

              {/* Table content container */}
              <div className="poker-table-content relative w-full h-full">
                {children}
              </div>
            </div>
          </div>
        )}

        {/* No rail variant */}
        {!showRail && (
          <div
            className="poker-felt-only absolute inset-0 rounded-[24px] sm:rounded-[40px] overflow-hidden"
            style={{
              background: currentFeltStyle.background,
              boxShadow: `
                inset 0 4px 12px rgba(0,0,0,0.4),
                0 8px 32px rgba(0,0,0,0.4)
              `,
            }}
          >
            <div className="poker-table-content relative w-full h-full">
              {children}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/**
 * Responsive Table Zone
 * Maintains aspect ratio and centers content
 */
export function ResponsiveTableZone({
  aspectRatio = 16/9,
  minHeight = 200,
  maxHeight = 600,
  children,
  className = '',
}) {
  return (
    <div
      className={`responsive-table-zone relative w-full ${className}`}
      style={{
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
        aspectRatio: `${aspectRatio}`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Table Felt Background (standalone)
 * For use when you need just the felt without the container
 */
export function TableFeltBackground({
  variant = 'dark',
  className = '',
  children,
}) {
  const variants = {
    dark: 'bg-gradient-to-br from-green-700 via-green-800 to-green-900',
    classic: 'bg-gradient-to-br from-green-600 via-green-700 to-green-800',
    emerald: 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800',
  };

  return (
    <div
      className={`table-felt-bg relative ${variants[variant]} ${className}`}
      style={{
        backgroundImage: `
          radial-gradient(ellipse 100% 80% at 50% 40%, rgba(22, 101, 52, 0.8) 0%, transparent 70%),
          url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.1'/%3E%3C/svg%3E")
        `,
      }}
    >
      {children}
    </div>
  );
}

export default PokerTableContainer;
