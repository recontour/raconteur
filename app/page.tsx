"use client";
import { useAuth } from "@/app/helper/auth";
import { getAuth, signOut } from "firebase/auth";
import WebGLScene from "@/components/WebGLScene";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleLogin = () => {
    router.push("/auth");
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      router.push("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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

  return (
    <WebGLScene
      isLoggedIn={!!user}
      user={user}
      onLogin={handleLogin}
      onLogout={handleLogout}
    />
  );
}
