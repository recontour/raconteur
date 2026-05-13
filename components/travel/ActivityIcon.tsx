"use client";

export function ActivityIcon({
  id,
  stroke = "white",
  size = 22,
}: {
  id: string;
  stroke?: string;
  size?: number;
}) {
  const s = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (id === "adventure")
    return (
      <svg {...s}>
        <path d="M3 18l5-9 4 6 3-4 6 7H3z" />
        <circle cx="17" cy="5" r="2" />
      </svg>
    );

  if (id === "romance")
    return (
      <svg {...s}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );

  if (id === "whats-on")
    return (
      <svg {...s}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    );

  if (id === "food")
    return (
      <svg {...s}>
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6h3" />
        <line x1="19" y1="15" x2="19" y2="22" />
      </svg>
    );

  // culture (default)
  return (
    <svg {...s}>
      <line x1="2" y1="22" x2="22" y2="22" />
      <polyline points="4 11 12 3 20 11" />
      <line x1="4" y1="11" x2="4" y2="22" />
      <line x1="20" y1="11" x2="20" y2="22" />
      <rect x="9" y="15" width="6" height="7" />
    </svg>
  );
}
