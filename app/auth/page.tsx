"use client";

import { useRouter } from "next/navigation";
import WebGLAuth from "@/components/WebGLAuth";

export default function AuthPage() {
  const router = useRouter();

  const handleAuthSuccess = () => {
    router.push("/");
  };

  return <WebGLAuth onAuthSuccess={handleAuthSuccess} />;
}
