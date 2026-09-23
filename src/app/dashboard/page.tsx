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
import EditorialWorkbench, { DailyPreview, CalendarPreview, PanchangPreview, ReadinessDashboard } from '@/components/dashboard/EditorialWorkbench';
import { StoryEditor, QuoteEditor, ContributionEditor } from '@/components/dashboard/StoryQuoteEditors';
import DatedEventsManager from '@/components/dashboard/DatedEventsManager';
import ScripturesManager from '@/components/dashboard/ScripturesManager';
import DailyVersesManager from '@/components/dashboard/DailyVersesManager';

interface Category { id: string; name: string; parent_id: string | null; level: number; slug: string; }

const TAB_META: Record<string, { title: string; description: string }> = {
  readiness: { title: 'Content readiness', description: 'Editorial coverage, missing sources and recent actions. Device sync is not measured here.' },
  publishing: { title: 'Review and publishing', description: 'Review sources, translations and metadata before publishing.' },
  'story-feed': { title: 'Katha stories', description: 'Curate an existing book as a feed story. Android wiring is a separate task.' },
  quotes: { title: 'Lock-screen quotes', description: 'Attributed quotations and original reflections. Android wiring is a separate task.' },
  contributions: { title: 'Editorial contributions', description: 'Prepare drafts for review by a shared-library editor.' },
  books:           { title: '📚 Books Library',      description: 'Story books for the app library — open a book to manage its pages.' },
  'add-book':      { title: '➕ Add New Book',       description: 'Create a book with a title, description and cover; add pages right after.' },
  'dated-events':  { title: '🗓️ Dated Events',       description: 'Festivals, Ekadashis and parana timings served to the app\'s calendar and home feed.' },
  'calendar-uploads': { title: 'Calendar manager', description: 'Manage dated observances and scoped editorial timing. /events/dated supplies calendar data.' },
  'panchang-preview': { title: '🌙 Panchang Preview', description: 'Read-only preview of calculated guidance from the external Panchang service. Separate from editorial Hub events.' },
  scriptures:      { title: '📜 Scriptures',         description: 'Downloadable scripture texts with reviewed sources and distribution permissions.' },
  'daily-verses':  { title: '🪷 Daily Verses',       description: 'Curate and schedule the trusted Verse of the Day shown in Bhagwan Bharose.' },
  gallery:    { title: '🖼️ Gallery',           description: 'Browse, filter, and manage all uploaded content.' },
  upload:     { title: '⬆️ Bulk Upload',         description: 'Upload JPEG, PNG or WebP images with shared metadata; each file is validated.' },
  darshan:    { title: '🌅 Daily Darshan',        description: 'Upload today\'s deity photos — served by the API on the selected date only.' },
  events:     { title: 'Festival artwork',     description: '/events supplies scheduled artwork. Dated Events manages calendar records.' },
  sponsors:   { title: '💼 Sponsorships',         description: 'Manage separate sponsor placements. Android placement wiring is pending.' },
  categories: { title: '🗂️ Categories',          description: 'Build your 3-level content taxonomy (Primary → Sub → Sub-Sub).' },
};

function DashboardInner() {
  const { user, logout } = useAuth();
  const router           = useRouter();
  const [tab, setTab]    = useState('readiness');
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

  const effectiveTab = user?.role === 'community_admin' ? 'contributions' : tab;
  const meta = TAB_META[effectiveTab];

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={effectiveTab}
        onTabChange={setTab}
        onLogout={handleLogout}
        userEmail={user?.email}
        communityOnly={user?.role === 'community_admin'}
      />

      <main className="main-content">
        <header className="page-header">
          <h2>{meta.title}</h2>
          <p>{meta.description}</p>
        </header>

        <div className="page-body">
          {effectiveTab === 'contributions' && <ContributionEditor />}
          {user?.role !== 'community_admin' && <>
          {tab === 'readiness' && <ReadinessDashboard />}
          {tab === 'publishing' && <EditorialWorkbench />}
          {tab === 'story-feed' && <StoryEditor />}
          {tab === 'quotes' && <QuoteEditor />}
          {tab === 'books'           && <BooksManager onAddNew={() => setTab('add-book')} />}
          {tab === 'add-book'        && <BookCreateForm onCreated={() => setTab('books')} />}
          {tab === 'dated-events'    && <><CalendarPreview /><DatedEventsManager /></>}
          {tab === 'calendar-uploads' && <><CalendarPreview /><DatedEventsManager /></>}
          {tab === 'panchang-preview' && <PanchangPreview />}
          {tab === 'scriptures'      && <ScripturesManager />}
          {tab === 'daily-verses'    && <><DailyPreview /><DailyVersesManager /></>}
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
          </>}
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
