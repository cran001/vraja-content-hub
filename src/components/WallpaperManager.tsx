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
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // NEW: State for managing the edit modal
  const [isEditing, setIsEditing] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState<Wallpaper | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');

  
  // --- Data Fetching ---
  const fetchWallpapers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/wallpapers');
      if (!res.ok) throw new Error('Failed to fetch wallpapers');
      const data = await res.json();
      setWallpapers(data);
    } catch (err: any) {
      if (err instanceof Error) setError(err.message);
      else setError('An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWallpapers();
  }, []);

  // --- Handlers for Opening/Closing Edit Modal ---
  // NEW: Function to open the modal and pre-fill it with wallpaper data
  const handleEditClick = (wallpaper: Wallpaper) => {
    setCurrentWallpaper(wallpaper);
    setEditName(wallpaper.name);
    setEditCategory(wallpaper.category);
    setIsEditing(true);
  };

  // NEW: Function to close the modal
  const handleCloseModal = () => {
    setIsEditing(false);
    setCurrentWallpaper(null);
  };

  // --- API Call Handlers ---
  const handleDelete = async (wallpaperId: string) => {
    if (!confirm('Are you sure you want to delete this wallpaper?')) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/admin/wallpapers?id=${wallpaperId}`, { // Corrected to use query param
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete wallpaper');
      }
      fetchWallpapers();
    } catch (err: any) {
      if (err instanceof Error) alert(`Error: ${err.message}`);
      else alert('An unknown error occurred');
    }
  };
  
  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/wallpapers', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Upload failed');
      }
      form.reset();
      fetchWallpapers();
      alert('Wallpaper uploaded successfully!');
    } catch (err: any) {
      if (err instanceof Error) alert(`Error: ${err.message}`);
      else alert('An unknown error occurred');
    }
  };

  // NEW: Function to handle the update submission
  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentWallpaper) return;

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/wallpapers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: currentWallpaper.id,
          name: editName,
          category: editCategory,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Update failed');
      }

      handleCloseModal();
      fetchWallpapers();
      alert('Wallpaper updated successfully!');
    } catch (err: any) {
      if (err instanceof Error) alert(`Error: ${err.message}`);
      else alert('An unknown error occurred');
    }
  };

  // --- Render Logic ---
  if (isLoading) return <p>Loading wallpapers...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <>
      {/* NEW: Edit Modal */}
      {isEditing && currentWallpaper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Edit Wallpaper</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium">Name</label>
                <input type="text" id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div>
                <label htmlFor="edit-category" className="block text-sm font-medium">Category</label>
                <input type="text" id="edit-category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div className="flex justify-end space-x-4">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form Section (No changes here) */}
        <div className="lg:col-span-1 p-6 bg-white rounded-lg shadow-md">
           {/* ... existing upload form ... */}
        </div>

        {/* Wallpaper Gallery Section (Added Edit button) */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Existing Wallpapers</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {wallpapers.map((wallpaper) => (
              <div key={wallpaper.id} className="relative group bg-gray-200 rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={wallpaper.thumbnail_url} alt={wallpaper.name} className="w-full h-48 object-cover" />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50 text-white">
                  <p className="text-sm font-semibold truncate">{wallpaper.name}</p>
                  <p className="text-xs">{wallpaper.category}</p>
                </div>
                {/* NEW: Container for Edit and Delete buttons */}
                <div className="absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEditClick(wallpaper)} className="bg-blue-600 text-white rounded-full p-2 text-xs">Edit</button>
                  <button onClick={() => handleDelete(wallpaper.id)} className="bg-red-600 text-white rounded-full p-2 text-xs">X</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}