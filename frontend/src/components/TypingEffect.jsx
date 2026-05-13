import { useState, useEffect } from 'react';

/**
 * A reusable component that renders text with a typing animation.
 * @param {string} text - The text to type out.
 * @param {number} speed - The speed in ms (default 30).
 * @param {string} className - Additional CSS classes.
 */
export default function TypingEffect({ text, speed = 30, className = "" }) {
  const [typingState, setTypingState] = useState({ text, index: 0 });

  const currentIndex = typingState.text === text ? typingState.index : 0;
  const displayedText = text.slice(0, currentIndex);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setTypingState((previous) => {
          const previousIndex = previous.text === text ? previous.index : 0;

          return {
            text,
            index: Math.min(previousIndex + 1, text.length),
          };
        });
      }, speed);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  return (
    <span className={className}>
      {displayedText}
      {currentIndex < text.length && (
        <span className="inline-block w-1 h-4 bg-secondary ml-1 animate-pulse" />
      )}
    </span>
  );
}
