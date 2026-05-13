"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import CityTile, { type CityData } from "@/components/welcome/CityTile";
import { LocationPickerSheet, type PlaceEntry } from "@/components/welcome/LocationPickerSheet";
import { ease } from "@/lib/tokens";
import { Shimmer } from "@/components/ui/Shimmer";
import ReportCard from "@/components/welcome/ReportCard";

type LocationState = "idle" | "loading" | "done" | "denied" | "error";

interface TravelAgentGetResponse {
  message?: string;
  defaultLocation?: string;
}

interface LocalBrief {
  city: string;
  paragraphs: string[];
  images: string[];
  links: { title: string; url?: string; source?: string }[];
}

export default function WelcomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [bootReady, setBootReady] = useState(false);

  const [welcomeMessage, setWelcomeMessage] = useState<string>("");
  const [messageReady, setMessageReady] = useState(false);

  const [defaultLocation, setDefaultLocation] = useState<string>("");
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [locState, setLocState] = useState<LocationState>("idle");

  const [localBrief, setLocalBrief] = useState<LocalBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  // Location picker
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<Record<string, PlaceEntry>>({});

  const hasFetchedTileRef = useRef(false);

  const fetchLocalBrief = useCallback(async (city: string, token: string) => {
    setBriefLoading(true);
    try {
      const res = await fetch("/api/local-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ city }),
      });
      if (res.ok) setLocalBrief((await res.json()) as LocalBrief);
    } catch { /* non-fatal */ }
    finally { setBriefLoading(false); }
  }, []);

  const loadSavedPlaces = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/users/places", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { places: Record<string, PlaceEntry> };
        setSavedPlaces(data.places ?? {});
      }
    } catch { /* non-fatal */ }
  }, []);

  const handleLocationSelect = useCallback(async (cityName: string) => {
    if (!user) return;
    setLocState("loading");
    setCityData(null);
    setLocalBrief(null);
    try {
      const token = await user.getIdToken();
      const [cityRes] = await Promise.all([
        fetch("/api/city", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ city: cityName }),
        }),
        fetch("/api/users/places", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: cityName }),
        }).then(async (r) => {
          if (r.ok) {
            const d = (await r.json()) as { places: Record<string, PlaceEntry> };
            setSavedPlaces(d.places ?? {});
          }
        }),
      ]);

      if (!cityRes.ok) { setLocState("error"); return; }
      const cityPayload = (await cityRes.json()) as CityData;
      setDefaultLocation(cityName);
      setCityData(cityPayload);
      setLocState("done");

      // Persist as travel-agent defaultLocation so next load picks it up
      fetch("/api/travel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ defaultLocation: cityName, defaultAddress: cityName }),
      }).catch(() => { /* non-fatal */ });

      fetchLocalBrief(cityName, token);
    } catch {
      setLocState("error");
    }
  }, [user, fetchLocalBrief]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setWelcomeMessage("What will be your next story? Discover the world's best destinations.");
        setMessageReady(true);
        setBootReady(true);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || bootReady) return;

    const run = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/travel-agent", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setWelcomeMessage("What will be your next story? Discover the world's best destinations.");
          setMessageReady(true);
          return;
        }

        const data = (await res.json()) as TravelAgentGetResponse;
        const message = typeof data.message === "string" ? data.message.trim() : "";
        const location = typeof data.defaultLocation === "string" ? data.defaultLocation.trim() : "";

        setWelcomeMessage(
          message || "What will be your next story? Discover the world's best destinations."
        );
        setMessageReady(true);
        setDefaultLocation(location);

        if (location && !hasFetchedTileRef.current) {
          hasFetchedTileRef.current = true;
          setLocState("loading");

          const [cityRes] = await Promise.all([
            fetch("/api/city", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ city: location }),
            }),
            loadSavedPlaces(token),
          ]);

          if (cityRes.ok) {
            const cityPayload = (await cityRes.json()) as CityData;
            setCityData(cityPayload);
            setLocState("done");
            fetchLocalBrief(location, token);
          } else {
            setLocState("idle");
          }
        } else {
          // No default location yet — still load saved places
          loadSavedPlaces(token);
        }
      } catch {
        setWelcomeMessage("What will be your next story? Discover the world's best destinations.");
        setMessageReady(true);
      } finally {
        setBootReady(true);
      }
    };

    run();
  }, [bootReady, user, fetchLocalBrief, loadSavedPlaces]);

  const requestCurrentLocation = async () => {
    if (!user || !navigator.geolocation || locState === "loading") return;

    setLocState("loading");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const token = await user.getIdToken();

          // Use /api/city directly with coordinates — no client-side geocoding API key needed
          const cityRes = await fetch("/api/city", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });

          if (!cityRes.ok) {
            setLocState("error");
            return;
          }

          const cityPayload = (await cityRes.json()) as CityData;
          const cityName = cityPayload.city;

          // Persist location to the user profile
          const saveRes = await fetch("/api/travel-agent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              defaultLocation: cityName,
              defaultAddress: cityName,
            }),
          });

          if (!saveRes.ok) {
            setLocState("error");
            return;
          }

          setDefaultLocation(cityName);
          setCityData(cityPayload);
          setLocState("done");
          fetchLocalBrief(cityName, token);
        } catch {
          setLocState("error");
        }
      },
      (err) => {
        if (err.code === 1) {
          setLocState("denied");
          return;
        }
        setLocState("error");
      },
      { timeout: 12_000, maximumAge: 60_000 }
    );
  };

  if (!bootReady || !messageReady) {
    return (
      <div className="h-dvh bg-white flex flex-col items-center overflow-hidden">
        <div className="w-full max-w-sm px-6 pt-6 pb-3 shrink-0">
          <Shimmer className="h-28 rounded-xl" />
        </div>
        <div className="w-full max-w-sm px-6 pt-4 flex flex-col gap-3">
          <Shimmer className="h-14 rounded-xl" />
          <Shimmer className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="h-dvh bg-white text-[#1d1d1f] flex flex-col items-center overflow-hidden"
    >
      {/* ── CityTile sticky header ─────────────────────────────────────── */}
      {user && (
        <div className="w-full max-w-sm px-6 pt-6 pb-3 shrink-0 bg-white z-20">
          <CityTile
            data={cityData}
            locState={locState}
            onRequestLocation={requestCurrentLocation}
            onChangeLocation={() => setLocationPickerOpen(true)}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto w-full max-w-sm">
        <div className="relative z-10 px-6 pt-6 pb-10 space-y-4 rounded-t-3xl bg-white/90 backdrop-blur-md shadow-[0_-8px_32px_rgba(0,0,0,0.06)]">
        <AnimatePresence>
          {!localBrief && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease }}
              className="rounded-xl bg-[#1d1d1f] p-6"
            >
              <p className="text-white text-[17px] leading-relaxed">{welcomeMessage}</p>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Plan Travel button ────────────────────────────────────────── */}
        {locState === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease, delay: 0.1 }}
          >
            <Link
              href="/travel"
              className="flex items-center justify-between w-full px-5 py-4 rounded-xl bg-[#1d1d1f] text-white active:scale-[0.97] transition-transform"
            >
              <div className="flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                  <path d="M3 17l4-8 4 4 4-6 4 10" />
                  <path d="M3 21h18" />
                </svg>
                <span className="text-[15px] font-semibold">Plan travel</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </motion.div>
        )}

        {/* ── Report card ──────────────────────────────────────────────── */}
        {locState === "done" && (briefLoading || localBrief) && (
          <ReportCard
            city={localBrief?.city}
            paragraphs={localBrief?.paragraphs ?? []}
            images={localBrief?.images ?? []}
            loading={briefLoading && !localBrief}
          />
        )}
        </div>
      </div>

      {/* Location picker sheet */}
      <LocationPickerSheet
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        savedPlaces={savedPlaces}
        onSelect={handleLocationSelect}
      />
    </motion.div>
  );
}
