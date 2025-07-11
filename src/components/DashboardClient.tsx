"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WallpaperManager from "./WallpaperManager";

export default function DashboardClient() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      setIsAuthenticated(true);
    } else {
      router.replace("/");
    }
    // The empty dependency array is critical.
    // It ensures this code runs only ONCE when the component first mounts.
  }, []);

  // While we are checking the token, we show a loading message.
  // This prevents the "flash" of content.
  if (!isAuthenticated) {
    return <p className="text-center p-8">Verifying authentication...</p>;
  }

  // Once authentication is confirmed, we render the real dashboard content.
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Vraja Realm Dashboard</h1>
      <WallpaperManager />
    </div>
  );
}
