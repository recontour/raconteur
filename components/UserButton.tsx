"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/helper/auth";
import { auth } from "@/lib/firebase";

export default function UserButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  const initials = user.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div ref={ref} style={{ position: "fixed", top: "16px", left: "16px", zIndex: 9999 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="User menu"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          fontWeight: 600,
          color: "#1d1d1f",
          letterSpacing: "0.03em",
          transition: "background 0.15s",
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "44px",
            left: 0,
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: "12px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.14)",
            overflow: "hidden",
            minWidth: "140px",
          }}
        >
          {!isHome && (
            <button
              onClick={() => { router.push("/"); setOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 16px",
                textAlign: "left",
                background: "none",
                border: "none",
                borderBottom: "1px solid rgba(0,0,0,0.07)",
                cursor: "pointer",
                fontSize: "14px",
                color: "#1d1d1f",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
              }}
            >
              Home
            </button>
          )}
          <button
            onClick={() => { signOut(auth); setOpen(false); }}
            style={{
              display: "block",
              width: "100%",
              padding: "12px 16px",
              textAlign: "left",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              color: "#1d1d1f",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
