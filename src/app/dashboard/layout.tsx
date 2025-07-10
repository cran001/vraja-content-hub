"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// REMOVED: No longer importing NextResponse
// import { NextResponse } from 'next/server';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.replace('/');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return <p className="text-center p-8">Loading...</p>;
  }

  return <>{children}</>;
}