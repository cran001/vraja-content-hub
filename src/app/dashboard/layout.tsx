// This is a client component, so it can use hooks and browser APIs.
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NextResponse } from 'next/server';

// This is our new "Auth Guard" layout.
export default function DashboardLayout({
  children, // The 'children' prop will be the actual page content (our page.tsx).
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  // We use a 'loading' state to avoid flashing the dashboard content briefly
  // before the redirect happens.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for the token in localStorage.
    const token = localStorage.getItem('authToken');
    
    // If there's no token, redirect to the login page.
    if (!token) {
      router.replace('/');
    } else {
      // If a token exists, we're done loading.
      setIsLoading(false);
    }
  }, [router]);

  // While checking for the token, we can show a loading spinner or just nothing.
  if (isLoading) {
    return <p className="text-center p-8">Loading...</p>;
  }

  // If loading is finished and the user is authenticated, render the page content.
  return <>{children}</>;
}