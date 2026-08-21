"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import Sidebar from '@/components/dashboard/Sidebar';
import BulkUploader from '@/components/dashboard/BulkUploader';
import CategoryManager from '@/components/dashboard/CategoryManager';
import DarshanUploader from '@/components/dashboard/DarshanUploader';
import EventsScheduler from '@/components/dashboard/EventsScheduler';
import SponsorManager from '@/components/dashboard/SponsorManager';
import GalleryTab from '@/components/dashboard/GalleryTab';
import BooksManager from '@/components/dashboard/BooksManager';
import BookCreateForm from '@/components/dashboard/BookCreateForm';
import CalendarPlaceholder from '@/components/dashboard/CalendarPlaceholder';

interface Category { id: string; name: string; parent_id: string | null; level: number; slug: string; }

const TAB_META: Record<string, { title: string; description: string }> = {
  books:           { title: '📚 Books Library',      description: 'Story books for the app library — open a book to manage its pages.' },
  'add-book':      { title: '➕ Add New Book',       description: 'Create a book with a title, description and cover; add pages right after.' },
  'calendar-uploads': { title: '🗓️ Calendar Uploads', description: 'Reserved space for calendar content — the format will be decided later.' },
  gallery:    { title: '🖼️ Gallery',           description: 'Browse, filter, and manage all uploaded content.' },
  upload:     { title: '⬆️ Bulk Upload',         description: 'Drag and drop up to 50 images with shared metadata in one shot.' },
  darshan:    { title: '🌅 Daily Darshan',        description: 'Upload today\'s deity photos — served by the API on the selected date only.' },
  events:     { title: '📅 Events Scheduler',     description: 'Schedule festival images to appear on a specific date and auto-expire.' },
  sponsors:   { title: '💼 Sponsorships',         description: 'Manage sponsor banners served directly to the Android app.' },
  categories: { title: '🗂️ Categories',          description: 'Build your 3-level content taxonomy (Primary → Sub → Sub-Sub).' },
};

function DashboardInner() {
  const { user, logout } = useAuth();
  const router           = useRouter();
  const [tab, setTab]    = useState('gallery');
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchCategories = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    try {
      const res = await fetch('/api/admin/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCategories(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!user) { router.push('/'); return; }
    fetchCategories();
  }, [user, router, fetchCategories]);

  const handleLogout = () => { logout(); router.push('/'); };

  const meta = TAB_META[tab];

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={tab}
        onTabChange={setTab}
        onLogout={handleLogout}
        userEmail={user?.email}
      />

      <main className="main-content">
        <header className="page-header">
          <h2>{meta.title}</h2>
          <p>{meta.description}</p>
        </header>

        <div className="page-body">
          {tab === 'books'           && <BooksManager onAddNew={() => setTab('add-book')} />}
          {tab === 'add-book'        && <BookCreateForm onCreated={() => setTab('books')} />}
          {tab === 'calendar-uploads' && <CalendarPlaceholder />}
          {tab === 'gallery'    && <GalleryTab />}
          {tab === 'upload'     && <BulkUploader categories={categories} onCategoriesChange={fetchCategories} />}
          {tab === 'darshan'    && <DarshanUploader />}
          {tab === 'events'     && <EventsScheduler categories={categories} />}
          {tab === 'sponsors'   && <SponsorManager />}
          {tab === 'categories' && (
            <CategoryManager
              categories={categories}
              onCategoriesChange={fetchCategories}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  );
}
