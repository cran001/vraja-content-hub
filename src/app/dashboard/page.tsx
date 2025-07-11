import DashboardClient from "@/components/DashboardClient";

export default function DashboardPage() {
  // This is now a simple Server Component.
  // Its only job is to render our smart Client Component.
  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <DashboardClient />
    </main>
  );
}
