import React, { useState, useEffect, useRef } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 30, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    indexRef.current = 0;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      // Allow for a slight variance in typing speed for realism
      const currentSpeed = speed + (Math.random() * 20 - 10);
      
      setDisplayedText((prev) => {
        const nextChar = text.charAt(indexRef.current);
        indexRef.current++;
        
        if (indexRef.current >= text.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (onComplete) setTimeout(onComplete, 500); // Slight pause before actions appear
          return text;
        }
        
        return prev + nextChar;
      });

    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]); // Only re-run if the source text actually changes

  return (
    <p className="text-lg leading-relaxed text-black font-sans">
      {displayedText}
      <span className="animate-pulse border-r-2 border-blue-500 ml-1"></span>
    </p>
  );
};