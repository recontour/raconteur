"use client";

import { useEffect, useState } from "react";

export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) return;

    const update = () => {
      const kb = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(Math.max(0, kb));
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return offset;
}

export function BottomCTA({
  offset,
  children,
}: {
  offset: number;
  children: React.ReactNode;
}) {
  const pb = offset > 0 ? offset + 16 : 32;
  return (
    <div
      style={{
        paddingBottom: pb,
        transition: "padding-bottom 220ms cubic-bezier(0.22,1,0.36,1)",
      }}
      className="w-full px-6"
    >
      {children}
    </div>
  );
}
