"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import BookReader from "@/components/BookReader";
import bookData from "@/data/book.json";

export default function BookPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(false);
      } else {
        // Redirect to login if not authenticated
        router.push("/auth");
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          background: "#1c1c1e",
          color: "#f2f2f7",
          fontSize: "1.1rem",
        }}
      >
        Loading story...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <BookReader stories={bookData.stories} />;
}
