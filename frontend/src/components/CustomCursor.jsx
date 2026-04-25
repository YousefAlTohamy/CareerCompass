import { useState, useEffect, useCallback } from 'react';
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function CustomCursor() {
  const { theme } = useTheme();
  const [isHovering, setIsHovering] = useState(false);
  const [particles, setParticles] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  
  // Mouse position (exact)
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Trailing physics for the "Lag" effect
  const springConfig = { damping: 25, stiffness: 150, mass: 0.5 };
  const trailX = useSpring(mouseX, springConfig);
  const trailY = useSpring(mouseY, springConfig);

  // Particle spawning logic
  const spawnParticle = useCallback((x, y) => {
    const id = Math.random().toString(36).substr(2, 9);
    setParticles((prev) => [
      ...prev,
      { id, x, y, size: Math.random() * 4 + 2 }
    ].slice(-15)); // Limit to 15 particles for performance

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 800);
  }, []);

  useEffect(() => {
    let frame = 0;
    const handleMouseMove = (e) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);

      // Spawn particles every few frames for a smooth trail
      frame++;
      if (frame % 3 === 0) {
        spawnParticle(e.clientX, e.clientY);
      }
    };

    const handleMouseOver = (e) => {
      const target = e.target;
      const isInteractive = 
        target.tagName === 'A' || 
        target.tagName === 'BUTTON' ||
        target.closest('a') || 
        target.closest('button') ||
        target.closest('[role="button"]') ||
        target.classList.contains('interactive');
      
      setIsHovering(!!isInteractive);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [isVisible, mouseX, mouseY, spawnParticle]);

  const isDark = theme === 'dark';
  const accentColor = isDark ? '#00D2FF' : '#4f46e5';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .cc-cursor-canvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 999999;
          display: none;
        }
        @media (pointer: fine) and (min-width: 768px) {
          .cc-cursor-canvas {
            display: block;
          }
        }
      `}} />

      <div className="cc-cursor-canvas" style={{ opacity: isVisible ? 1 : 0 }}>
        
        {/* Particle Trail */}
        <AnimatePresence>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0.6, scale: 1, x: p.x, y: p.y }}
              animate={{ opacity: 0, scale: 0, y: p.y + 20 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                borderRadius: '50%',
                backgroundColor: accentColor,
                boxShadow: `0 0 10px ${accentColor}`,
                translateX: '-50%',
                translateY: '-50%',
              }}
            />
          ))}
        </AnimatePresence>

        {/* Trailing Ring (Lag effect) */}
        <motion.div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            x: trailX,
            y: trailY,
            xPercent: -50,
            yPercent: -50,
          }}
        >
          <motion.div
            animate={{
              width: isHovering ? 80 : 40,
              height: isHovering ? 80 : 40,
              rotate: 360,
            }}
            transition={{ 
              rotate: { duration: 4, repeat: Infinity, ease: "linear" },
              width: { type: "spring", damping: 20 },
              height: { type: "spring", damping: 20 }
            }}
            style={{
              border: `1px solid ${accentColor}`,
              borderRadius: '50%',
              opacity: 0.3,
            }}
          >
            {/* HUD Scanning Bit */}
            <div 
              style={{ 
                position: 'absolute', 
                top: -3, 
                left: '50%', 
                width: 6, 
                height: 6, 
                backgroundColor: accentColor, 
                borderRadius: '50%',
                boxShadow: `0 0 10px ${accentColor}`
              }} 
            />
          </motion.div>
        </motion.div>

        {/* Main Glow Orb (Tracks mouse closely) */}
        <motion.div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            x: mouseX,
            y: mouseY,
            xPercent: -50,
            yPercent: -50,
          }}
        >
          <motion.div
            animate={{
              width: isHovering ? 120 : 20,
              height: isHovering ? 120 : 20,
              opacity: isHovering ? 0.4 : 0.1,
            }}
            style={{
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
              filter: 'blur(10px)',
            }}
          />
          
          {/* HUD Target Brackets (Visible on Hover) */}
          <AnimatePresence>
            {isHovering && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                style={{
                  position: 'absolute',
                  width: 60,
                  height: 60,
                  left: '50%',
                  top: '50%',
                  translateX: '-50%',
                  translateY: '-50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, width: 10, height: 10, borderTop: `1px solid ${accentColor}`, borderLeft: `1px solid ${accentColor}` }} />
                <div style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderTop: `1px solid ${accentColor}`, borderRight: `1px solid ${accentColor}` }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: 10, height: 10, borderBottom: `1px solid ${accentColor}`, borderLeft: `1px solid ${accentColor}` }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderBottom: `1px solid ${accentColor}`, borderRight: `1px solid ${accentColor}` }} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </>
  );
}
