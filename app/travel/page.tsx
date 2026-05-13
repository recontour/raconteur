"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";
import CityTile, { type CityData } from "@/components/welcome/CityTile";
import { ease } from "@/lib/tokens";
import { Shimmer } from "@/components/ui/Shimmer";
import { BranchingInterestsShell } from "@/components/travel/BranchingInterestsShell";
import { ChatPanel } from "@/components/travel/ChatPanel";

// -- Types ---------------------------------------------------------------------
type LocationState = "idle" | "loading" | "done" | "denied" | "error";

// -- Main page -----------------------------------------------------------------
export default function TravelPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const [locState, setLocState] = useState<LocationState>("idle");
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [defaultLocation, setDefaultLocation] = useState("");

  const [chatCity, setChatCity] = useState<string | null>(null);

  const hasFetchedRef = useRef(false);

  // -- Auth -----------------------------------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);

  // -- Boot: load default location from userIndex ---------------------------
  useEffect(() => {
    if (!ready || !user || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    user.getIdToken().then(async (token) => {
      try {
        const agentRes = await fetch("/api/travel-agent", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!agentRes.ok) return;
        const agentData = (await agentRes.json()) as { defaultLocation?: string };
        const location = agentData.defaultLocation?.trim() ?? "";
        if (!location) return;

        setDefaultLocation(location);
        setLocState("loading");

        const cityRes = await fetch("/api/city", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ city: location }),
        });
        if (cityRes.ok) {
          setCityData((await cityRes.json()) as CityData);
          setLocState("done");
        } else {
          setLocState("idle");
        }
      } catch {
        setLocState("idle");
      }
    });
  }, [ready, user]);

  // -- GPS location request -------------------------------------------------
  const requestLocation = () => {
    if (!user || !navigator.geolocation || locState === "loading") return;
    setLocState("loading");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const token = await user.getIdToken();
          const cityRes = await fetch("/api/city", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          if (!cityRes.ok) { setLocState("error"); return; }
          const payload = (await cityRes.json()) as CityData;
          setDefaultLocation(payload.city);
          setCityData(payload);
          setLocState("done");
          fetch("/api/travel-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ defaultLocation: payload.city, defaultAddress: payload.city }),
          }).catch(() => {/* non-fatal */});
        } catch {
          setLocState("error");
        }
      },
      (err) => { setLocState(err.code === 1 ? "denied" : "error"); },
      { timeout: 12_000, maximumAge: 60_000 }
    );
  };

  // -- Loading skeleton -----------------------------------------------------
  if (!ready) {
    return (
      <div className="h-dvh bg-white flex flex-col items-center pt-14 pb-10">
        <div className="w-full max-w-sm px-6 flex flex-col gap-4">
          <Shimmer className="h-28 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <Shimmer key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-white flex flex-col items-center overflow-hidden">
      <AnimatePresence mode="wait">

        {/* -- BROWSE MODE --------------------------------------------------- */}
        {!chatCity && (
          <motion.div
            key="browse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease }}
            className="flex-1 overflow-y-auto w-full max-w-sm px-6 pt-14 pb-10 flex flex-col gap-4"
          >
            {/* City tile */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
            >
              <CityTile
                data={cityData}
                locState={locState}
                onRequestLocation={requestLocation}
                onChangeLocation={locState === "done" ? requestLocation : undefined}
              />
            </motion.div>

            {/* Branching shell for TravelMaster click-conversation flow */}
            <BranchingInterestsShell user={user} defaultLocation={defaultLocation} />
          </motion.div>
        )}

        {/* -- CITY CHAT MODE ------------------------------------------------ */}
        {chatCity && (
          <ChatPanel
            key={`chat-${chatCity}`}
            user={user}
            city={chatCity}
            weather={chatCity === defaultLocation ? cityData ?? undefined : undefined}
            onExit={() => setChatCity(null)}
          />
        )}

      </AnimatePresence>
    </div>
  );
}

