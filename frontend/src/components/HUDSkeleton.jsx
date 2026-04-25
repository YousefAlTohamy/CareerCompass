import React from 'react';
import { motion } from 'framer-motion';

/**
 * HUDSkeleton Component
 * A futuristic, pulsing skeleton loader that fits the 2026 HUD aesthetic.
 */
export const HUDSkeleton = ({ className = "", variant = "rect", repeat = 1 }) => {
  const items = Array.from({ length: repeat });

  const getVariantClass = () => {
    switch (variant) {
      case 'circle': return 'rounded-full';
      case 'text': return 'rounded h-3 w-3/4';
      default: return 'rounded-2xl';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((_, i) => (
        <div key={i} className="relative overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
          <motion.div
            className={`w-full h-full min-h-[1rem] ${getVariantClass()}`}
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent"
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>
      ))}
    </div>
  );
};

export const HUDCardSkeleton = () => (
  <div className="glass-card p-6 rounded-3xl space-y-4">
    <div className="flex items-center gap-4">
      <HUDSkeleton variant="circle" className="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <HUDSkeleton variant="text" className="w-1/2" />
        <HUDSkeleton variant="text" className="w-1/4" />
      </div>
    </div>
    <HUDSkeleton variant="rect" className="h-32 w-full" />
  </div>
);

export default HUDSkeleton;
