// This is a client component, so it can use hooks and browser APIs.
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// This is our new, more robust "Auth Guard" layout.
export default function DashboardLayout({
  children, // The 'children' prop will be the actual page content (our page.tsx).
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  // This state now tracks the authentication status.
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // Check for the token in localStorage.
    const token = localStorage.getItem('authToken');
    
    // If there's no token, redirect to the login page immediately.
    if (!token) {
      router.replace('/');
    } else {
      // If a token exists, we can consider the user verified on the client.
      // A full production app might re-verify the token with the server here.
      setIsVerified(true);
    }
  }, [router]);

  // While we haven't verified the token's existence, show a loading message.
  if (!isVerified) {
    return <p className="text-center p-8">Loading...</p>;
  }

  // If verification is complete, render the actual dashboard page content.
  return <>{children}</>;
}
