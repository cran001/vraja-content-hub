// This "use client" directive is essential. It tells Next.js that this component
// is interactive and will be run in the user's browser, not on the server.
"use client";

// We import React hooks for managing state and the router for navigation.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  // The useRouter hook gives us access to the Next.js router for navigation.
  const router = useRouter();

  // 'useState' is a React hook for managing component state.
  // We create state variables for the email, password, and any error messages.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // This function is called when the user submits the form.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevents the default browser form submission behavior.
    setError(''); // Clear any previous errors.

    try {
      // Use the browser's 'fetch' API to send a POST request to our login endpoint.
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If the server response is not OK (e.g., 401 Unauthorized), set an error message.
        throw new Error(data.message || 'Something went wrong.');
      }

      // Login was successful!
      // 1. Store the token securely in the browser's localStorage.
      localStorage.setItem('authToken', data.token);
      
      // 2. Redirect the user to the admin dashboard.
      router.push('/dashboard');

    } catch (err: any) {
      setError(err.message);
    }
  };

  // This is the JSX that defines the HTML structure of our component.
  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          Vraja Realm Content Hub
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          {error && <p className="text-sm text-center text-red-600">{error}</p>}
          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}