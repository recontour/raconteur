"use client";
import { useAuth } from "@/app/helper/auth";
import BotInterface from "@/components/BotInterface";

export default function Home() {
  const { loading } = useAuth();

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          fontSize: "18px",
          color: "#1d1d1f",
        }}
      >
        Loading...
      </div>
    );

  return <BotInterface />;
}

