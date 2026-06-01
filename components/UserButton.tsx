"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/app/helper/auth";
import { auth } from "@/lib/firebase";

export default function UserBar() {
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

  const firstName = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";
  const initials = user.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : firstName[0]?.toUpperCase() ?? "U";

  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Pill bar */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="User menu"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "5px 14px 5px 5px",
          border: "none",
          borderRadius: "100px",
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          boxShadow: "0 2px 14px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            overflow: "hidden",
            background: "rgba(0,0,0,0.08)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: 600,
            color: "#555",
            fontFamily: FONT,
          }}
        >
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt={firstName}
              width={28}
              height={28}
              style={{ objectFit: "cover", borderRadius: "50%" }}
              referrerPolicy="no-referrer"
            />
          ) : (
            initials
          )}
        </div>

        {/* Greeting */}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#1d1d1f",
            fontFamily: FONT,
            letterSpacing: "-0.01em",
          }}
        >
          Hi {firstName}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            marginTop: "8px",
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: "14px",
            boxShadow: "0 6px 28px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.06)",
            overflow: "hidden",
            minWidth: "150px",
          }}
        >
          {!isHome && (
            <button
              onClick={() => { router.push("/"); setOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 18px",
                textAlign: "left",
                background: "none",
                border: "none",
                borderBottom: "1px solid rgba(0,0,0,0.07)",
                cursor: "pointer",
                fontSize: "14px",
                color: "#1d1d1f",
                fontFamily: FONT,
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
              padding: "12px 18px",
              textAlign: "left",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              color: "#c0392b",
              fontFamily: FONT,
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
