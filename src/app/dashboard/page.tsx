```typescript
"use client";

import { useAuth } from "@/context/AuthContext";
import WallpaperManager from "@/components/WallpaperManager";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();

  // This effect protects the route on the client side.
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  // If the user is not authenticated, we can render nothing or a loading state
  // while the redirect happens.
  if (!isAuthenticated) {
    return <p>Redirecting...</p>;
  }
  
  // If authenticated, show the dashboard.
  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Vraja Realm Dashboard</h1>
          <button onClick={logout} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700">
            Logout
          </button>
        </div>
        <WallpaperManager />
      </div>
    </main>
  );
}
