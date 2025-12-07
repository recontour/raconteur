import { useState, useEffect, useRef } from "react";

// Added onType to the arguments
export const useTypewriter = (
  text: string,
  speed = 1,
  onComplete?: () => void,
  onType?: () => void
) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const onTypeRef = useRef(onType); // Ref for the type callback
  const animationRef = useRef<number | null>(null);
  const textRef = useRef(text);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onTypeRef.current = onType;
  }, [onComplete, onType]);

  useEffect(() => {
    if (!text) return;

    textRef.current = text;
    setDisplayedText("");
    setIsTyping(true);

    let currentIndex = 0;
    let lastTime = Date.now();

    const tick = () => {
      if (!textRef.current) return;

      const now = Date.now();

      if (now - lastTime >= speed) {
        const chunk = 1;
        const nextIndex = Math.min(
          currentIndex + chunk,
          textRef.current.length
        );

        setDisplayedText(textRef.current.substring(0, nextIndex));
        currentIndex = nextIndex;
        lastTime = now;

        // FIRE THE TRIGGER
        if (onTypeRef.current) onTypeRef.current();
      }

      if (currentIndex < textRef.current.length) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        setIsTyping(false);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [text, speed]);

  const skip = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setDisplayedText(text);
    setIsTyping(false);
    if (onCompleteRef.current) onCompleteRef.current();
    // Fire one last scroll on skip
    if (onTypeRef.current) onTypeRef.current();
  };

  return { displayedText, isTyping, skip };
};
