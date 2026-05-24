import { useEffect, useRef, useCallback } from "react";

interface SwipeGestureOptions {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onScroll?: (direction: "up" | "down") => void;
  threshold?: number;
}

export function useSwipeGesture({
  onSwipeUp,
  onSwipeDown,
  onScroll,
  threshold = 50,
}: SwipeGestureOptions) {
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  // Handle touch events
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStart.current = e.changedTouches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      touchEnd.current = e.changedTouches[0].clientY;
      handleSwipe();
    },
    []
  );

  const handleSwipe = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;

    const distance = touchStart.current - touchEnd.current;
    const isUpSwipe = distance > threshold;
    const isDownSwipe = distance < -threshold;

    if (isUpSwipe) {
      onSwipeUp?.();
    } else if (isDownSwipe) {
      onSwipeDown?.();
    }
  }, [onSwipeUp, onSwipeDown, threshold]);

  // Handle scroll events (desktop)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) {
        onScroll?.("down");
      } else if (e.deltaY < 0) {
        onScroll?.("up");
      }
    },
    [onScroll]
  );

  useEffect(() => {
    const element = document.addEventListener
      ? document
      : window;

    element.addEventListener("touchstart", handleTouchStart, false);
    element.addEventListener("touchend", handleTouchEnd, false);
    element.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("wheel", handleWheel);
    };
  }, [handleTouchStart, handleTouchEnd, handleWheel]);
}
