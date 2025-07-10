"use client";

import { useState, useEffect, FormEvent } from 'react';

// Define a type for our wallpaper object for TypeScript
interface Wallpaper {
  id: string;
  name: string;
  category: string;
  thumbnail_url: string;
  original_url: string;
}

export default function WallpaperManager() {
  // State to hold the list of wallpapers fetched from the API
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  // State to manage loading indicators
  const [isLoading, setIsLoading] = useState(true);
  // State to handle any errors
  const [error, setError] = useState('');
  
  // --- Data Fetching ---
  const fetchWallpapers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/wallpapers');
      if (!res.ok) throw new Error('Failed to fetch wallpapers');
      const data = await res.json();
      setWallpapers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect hook to run fetchWallpapers() once when the component loads
  useEffect(() => {
    fetchWallpapers();
  }, []);

  // --- Delete Handler ---
  const handleDelete = async (wallpaperId: string) => {
    // Confirm before deleting
    if (!confirm('Are you sure you want to delete this wallpaper?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/admin/wallpapers/${wallpaperId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete wallpaper');
      }
      
      // If successful, refresh the list of wallpapers
      fetchWallpapers();

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };
  
    // --- Upload Handler ---
  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // NEW: Save a direct reference to the form element before any async operations.
    const form = e.currentTarget; 
    const formData = new FormData(form);
    
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/admin/wallpapers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData,
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Upload failed');
        }

        // CHANGED: Use our saved reference to reset the form.
        form.reset(); 
        fetchWallpapers();
        alert('Wallpaper uploaded successfully!');

    } catch (err: any) {
        alert(`Error: ${err.message}`);
    }
  };

  // --- Render Logic ---
  if (isLoading) return <p>Loading wallpapers...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Upload Form Section */}
      <div className="lg:col-span-1 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Upload New Wallpaper</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">Name</label>
            <input type="text" name="name" id="name" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium">Category</label>
            <input type="text" name="category" id="category" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label htmlFor="image" className="block text-sm font-medium">Image</label>
            <input type="file" name="image" id="image" required accept="image/*" className="mt-1 block w-full text-sm" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">Upload</button>
        </form>
      </div>

      {/* Wallpaper Gallery Section */}
      <div className="lg:col-span-2">
        <h2 className="text-2xl font-bold mb-4">Existing Wallpapers</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wallpapers.map((wallpaper) => (
            <div key={wallpaper.id} className="relative group bg-gray-200 rounded-lg overflow-hidden">
              <img src={wallpaper.thumbnail_url} alt={wallpaper.name} className="w-full h-48 object-cover" />
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50 text-white">
                <p className="text-sm font-semibold truncate">{wallpaper.name}</p>
                <p className="text-xs">{wallpaper.category}</p>
              </div>
              <button
                onClick={() => handleDelete(wallpaper.id)}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete wallpaper"
              >
                X
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
