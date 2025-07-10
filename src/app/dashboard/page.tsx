import WallpaperManager from "@/components/WallpaperManager";

export default function DashboardPage() {
  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Vraja Realm Dashboard</h1>
        <WallpaperManager />
      </div>
    </main>
  );
}