"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.replace('/');
    } else {
      setIsVerified(true);
    }
    // The empty dependency array [] is CRITICAL.
    // It ensures this effect runs ONLY ONCE after the component first mounts.
  }, []); // <-- This empty array is the most important change.

  if (!isVerified) {
    // While the check is running, render nothing or a loading spinner.
    // Returning null is the safest option.
    return null;
  }

  // If verified, render the children components.
  return <>{children}</>;
}
