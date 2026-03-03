import { useState, useEffect } from 'react';

/**
 * A reusable component that renders text with a typing animation.
 * @param {string} text - The text to type out.
 * @param {number} speed - The speed in ms (default 30).
 * @param {string} className - Additional CSS classes.
 */
export default function TypingEffect({ text, speed = 30, className = "" }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Reset if text changes
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
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
